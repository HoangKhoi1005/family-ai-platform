-- Remove unreferenced private objects through an idempotent, leased worker job.

GRANT SELECT ON moments, memories, memory_items TO family_media_worker;

CREATE FUNCTION public.actor_enqueue_media_delete(
  p_family_id uuid,
  p_media_id uuid
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_setting('app.purpose', true) NOT IN ('moments_write', 'memories_write') THEN
    RETURN false;
  END IF;

  UPDATE public.media_assets asset
     SET status = 'deleted', deleted_at = COALESCE(deleted_at, now()),
         version = version + 1, updated_at = now()
   WHERE asset.family_id = p_family_id
     AND asset.id = p_media_id
     AND asset.status <> 'deleted'
     AND (
       public.actor_active_membership(asset.family_id, asset.owner_membership_id)
       OR public.actor_active_admin(asset.family_id)
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.moments moment
        WHERE moment.family_id = asset.family_id AND moment.media_id = asset.id
          AND moment.deleted_at IS NULL
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.memory_items item
       JOIN public.memories memory
         ON memory.family_id = item.family_id AND memory.id = item.memory_id
        WHERE item.family_id = asset.family_id AND item.media_id = asset.id
          AND item.deleted_at IS NULL AND memory.deleted_at IS NULL
     );

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.media_processing_jobs
     SET status = 'completed', completed_at = COALESCE(completed_at, now()),
         lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
   WHERE family_id = p_family_id AND media_id = p_media_id AND kind = 'process'
     AND status IN ('pending', 'leased');

  INSERT INTO public.media_processing_jobs(family_id, media_id, kind)
  VALUES (p_family_id, p_media_id, 'delete')
  ON CONFLICT (family_id, media_id, kind) DO NOTHING;
  RETURN true;
END
$$;

ALTER FUNCTION public.actor_enqueue_media_delete(uuid, uuid) OWNER TO family_media_worker;
REVOKE ALL ON FUNCTION public.actor_enqueue_media_delete(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_enqueue_media_delete(uuid, uuid) TO family_runtime;

CREATE FUNCTION public.worker_claim_media_delete_jobs(
  p_worker_id text,
  p_batch_size integer,
  p_lease_seconds integer,
  p_now timestamptz
)
RETURNS TABLE(
  job_id uuid, family_id uuid, media_id uuid, object_key text,
  processed_object_key text
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF length(trim(p_worker_id)) NOT BETWEEN 1 AND 120 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid worker id';
  END IF;
  IF p_batch_size NOT BETWEEN 1 AND 25 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid media worker batch size';
  END IF;
  IF p_lease_seconds NOT BETWEEN 10 AND 300 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid media worker lease';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT job.id
      FROM public.media_processing_jobs job
     WHERE job.kind = 'delete' AND job.attempts < 5 AND job.available_at <= p_now
       AND (job.status = 'pending'
         OR (job.status = 'leased' AND job.lease_expires_at <= p_now))
     ORDER BY job.available_at, job.id
     FOR UPDATE SKIP LOCKED LIMIT p_batch_size
  ), leased AS (
    UPDATE public.media_processing_jobs job
       SET status = 'leased', lease_owner = p_worker_id,
           lease_expires_at = p_now + make_interval(secs => p_lease_seconds),
           updated_at = p_now
      FROM candidates WHERE job.id = candidates.id
    RETURNING job.id, job.family_id, job.media_id
  )
  SELECT leased.id, leased.family_id, leased.media_id,
         asset.object_key::text, asset.processed_object_key::text
    FROM leased
    JOIN public.media_assets asset
      ON asset.family_id = leased.family_id AND asset.id = leased.media_id
   WHERE asset.status = 'deleted';
END
$$;

CREATE FUNCTION public.worker_complete_media_delete_job(
  p_job_id uuid,
  p_worker_id text,
  p_now timestamptz
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.media_processing_jobs job
     SET status = 'completed', completed_at = p_now,
         lease_owner = NULL, lease_expires_at = NULL, updated_at = p_now
   WHERE job.id = p_job_id AND job.kind = 'delete' AND job.status = 'leased'
     AND job.lease_owner = p_worker_id AND job.lease_expires_at > p_now
     AND EXISTS (
       SELECT 1 FROM public.media_assets asset
        WHERE asset.family_id = job.family_id AND asset.id = job.media_id
          AND asset.status = 'deleted'
     );
  RETURN FOUND;
END
$$;

ALTER FUNCTION public.worker_claim_media_delete_jobs(text, integer, integer, timestamptz)
  OWNER TO family_media_worker;
ALTER FUNCTION public.worker_complete_media_delete_job(uuid, text, timestamptz)
  OWNER TO family_media_worker;
REVOKE ALL ON FUNCTION public.worker_claim_media_delete_jobs(text, integer, integer, timestamptz),
  public.worker_complete_media_delete_job(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_claim_media_delete_jobs(text, integer, integer, timestamptz),
  public.worker_complete_media_delete_job(uuid, text, timestamptz) TO family_worker;
