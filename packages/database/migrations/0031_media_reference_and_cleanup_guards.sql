-- Close media-reference races, restrict draft metadata, and make quarantine cleanup durable.

ALTER TABLE media_processing_jobs DROP CONSTRAINT media_processing_jobs_kind_check;
ALTER TABLE media_processing_jobs ADD CONSTRAINT media_processing_jobs_kind_check
  CHECK (kind IN ('process', 'delete', 'purge_source'));

DROP POLICY tenant_runtime_media_select ON media_assets;
CREATE POLICY tenant_runtime_media_select ON media_assets FOR SELECT TO family_runtime
  USING (
    public.actor_active_member(family_id)
    AND (
      public.actor_active_membership(family_id, owner_membership_id)
      OR (
        status = 'ready'
        AND (
          EXISTS (
            SELECT 1 FROM public.moments moment
             WHERE moment.family_id = media_assets.family_id
               AND moment.media_id = media_assets.id
               AND moment.deleted_at IS NULL
          )
          OR EXISTS (
            SELECT 1 FROM public.memory_items item
            JOIN public.memories memory
              ON memory.family_id = item.family_id AND memory.id = item.memory_id
             WHERE item.family_id = media_assets.family_id
               AND item.media_id = media_assets.id
               AND item.deleted_at IS NULL
               AND memory.deleted_at IS NULL
          )
        )
      )
    )
  );

CREATE FUNCTION public.guard_media_reference()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE asset public.media_assets%ROWTYPE;
BEGIN
  IF NEW.media_id IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO asset FROM public.media_assets candidate
   WHERE candidate.family_id = NEW.family_id AND candidate.id = NEW.media_id
   FOR UPDATE;
  IF NOT FOUND OR asset.status <> 'ready' THEN
    RAISE check_violation USING MESSAGE = 'referenced media must be ready';
  END IF;

  IF TG_TABLE_NAME = 'moments' THEN
    IF asset.purpose <> 'moment_image' OR asset.owner_membership_id <> NEW.author_membership_id THEN
      RAISE check_violation USING MESSAGE = 'Moment media must be a ready image owned by its author';
    END IF;
  ELSIF NEW.kind = 'audio' AND asset.purpose <> 'memory_audio' THEN
    RAISE check_violation USING MESSAGE = 'audio item must reference memory audio';
  ELSIF NEW.kind = 'image' AND asset.purpose NOT IN ('memory_image', 'moment_image') THEN
    RAISE check_violation USING MESSAGE = 'image item must reference image media';
  END IF;
  RETURN NEW;
END
$$;

ALTER FUNCTION public.guard_media_reference() OWNER TO family_media_worker;
REVOKE ALL ON FUNCTION public.guard_media_reference() FROM PUBLIC;

CREATE TRIGGER moments_guard_media_reference
BEFORE INSERT OR UPDATE OF media_id, deleted_at ON moments
FOR EACH ROW EXECUTE FUNCTION public.guard_media_reference();

CREATE TRIGGER memory_items_guard_media_reference
BEFORE INSERT OR UPDATE OF media_id, kind, deleted_at ON memory_items
FOR EACH ROW EXECUTE FUNCTION public.guard_media_reference();

CREATE OR REPLACE FUNCTION public.actor_enqueue_media_delete(
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
   WHERE family_id = p_family_id AND media_id = p_media_id
     AND kind IN ('process', 'purge_source') AND status IN ('pending', 'leased');

  INSERT INTO public.media_processing_jobs(family_id, media_id, kind)
  VALUES (p_family_id, p_media_id, 'delete')
  ON CONFLICT (family_id, media_id, kind) DO NOTHING;
  RETURN true;
END
$$;

ALTER FUNCTION public.actor_enqueue_media_delete(uuid, uuid) OWNER TO family_media_worker;

CREATE OR REPLACE FUNCTION public.worker_complete_media_job(
  p_job_id uuid, p_worker_id text, p_processed_object_key text,
  p_mime_type text, p_byte_size bigint, p_sha256 text,
  p_width integer, p_height integer, p_duration_ms integer, p_now timestamptz
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE claimed public.media_processing_jobs%ROWTYPE;
BEGIN
  SELECT * INTO claimed FROM public.media_processing_jobs job
   WHERE job.id = p_job_id AND job.kind = 'process' AND job.status = 'leased'
     AND job.lease_owner = p_worker_id AND job.lease_expires_at > p_now
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.media_assets asset
     SET status = 'ready', processed_object_key = p_processed_object_key,
         mime_type = p_mime_type, byte_size = p_byte_size, sha256 = p_sha256,
         width = p_width, height = p_height, duration_ms = p_duration_ms,
         rejection_code = NULL, version = version + 1, updated_at = p_now
   WHERE asset.family_id = claimed.family_id AND asset.id = claimed.media_id
     AND asset.status = 'processing';
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.media_processing_jobs SET status = 'completed', completed_at = p_now,
         lease_owner = NULL, lease_expires_at = NULL, updated_at = p_now
   WHERE id = p_job_id;
  INSERT INTO public.media_processing_jobs(family_id, media_id, kind)
  VALUES (claimed.family_id, claimed.media_id, 'purge_source')
  ON CONFLICT (family_id, media_id, kind) DO NOTHING;
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.worker_reject_media_job(
  p_job_id uuid, p_worker_id text, p_rejection_code text, p_now timestamptz
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE claimed public.media_processing_jobs%ROWTYPE;
BEGIN
  IF length(trim(p_rejection_code)) NOT BETWEEN 1 AND 120 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid media rejection code';
  END IF;
  SELECT * INTO claimed FROM public.media_processing_jobs job
   WHERE job.id = p_job_id AND job.kind = 'process' AND job.status = 'leased'
     AND job.lease_owner = p_worker_id AND job.lease_expires_at > p_now
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.media_assets SET status = 'rejected', rejection_code = p_rejection_code,
         version = version + 1, updated_at = p_now
   WHERE family_id = claimed.family_id AND id = claimed.media_id AND status = 'processing';
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.media_processing_jobs SET status = 'completed', completed_at = p_now,
         lease_owner = NULL, lease_expires_at = NULL, updated_at = p_now
   WHERE id = p_job_id;
  INSERT INTO public.media_processing_jobs(family_id, media_id, kind)
  VALUES (claimed.family_id, claimed.media_id, 'delete')
  ON CONFLICT (family_id, media_id, kind) DO NOTHING;
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.worker_fail_media_job(
  p_job_id uuid, p_worker_id text, p_error_code text, p_now timestamptz
)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE claimed public.media_processing_jobs%ROWTYPE;
DECLARE next_status text;
BEGIN
  IF length(trim(p_error_code)) NOT BETWEEN 1 AND 120 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid media failure code';
  END IF;
  SELECT * INTO claimed FROM public.media_processing_jobs job
   WHERE job.id = p_job_id AND job.status = 'leased' AND job.lease_owner = p_worker_id
     AND job.lease_expires_at > p_now
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'lost'; END IF;
  next_status := CASE WHEN claimed.attempts + 1 >= 5 THEN 'dead_letter' ELSE 'pending' END;
  UPDATE public.media_processing_jobs
     SET attempts = attempts + 1, status = next_status,
         available_at = p_now + make_interval(secs => LEAST(300, 5 * (2 ^ attempts)::integer)),
         lease_owner = NULL, lease_expires_at = NULL, last_error_code = p_error_code,
         updated_at = p_now
   WHERE id = claimed.id;
  IF next_status = 'dead_letter' AND claimed.kind = 'process' THEN
    UPDATE public.media_assets
       SET status = 'rejected', rejection_code = p_error_code,
           version = version + 1, updated_at = p_now
     WHERE family_id = claimed.family_id AND id = claimed.media_id AND status = 'processing';
    INSERT INTO public.media_processing_jobs(family_id, media_id, kind)
    VALUES (claimed.family_id, claimed.media_id, 'delete')
    ON CONFLICT (family_id, media_id, kind) DO NOTHING;
  END IF;
  RETURN next_status;
END
$$;

DROP FUNCTION public.worker_claim_media_delete_jobs(text, integer, integer, timestamptz);
CREATE FUNCTION public.worker_claim_media_delete_jobs(
  p_worker_id text,
  p_batch_size integer,
  p_lease_seconds integer,
  p_now timestamptz
)
RETURNS TABLE(
  job_id uuid, family_id uuid, media_id uuid, kind text, object_key text,
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
      JOIN public.media_assets asset
        ON asset.family_id = job.family_id AND asset.id = job.media_id
     WHERE job.kind IN ('delete', 'purge_source')
       AND job.attempts < 5 AND job.available_at <= p_now
       AND (job.status = 'pending'
         OR (job.status = 'leased' AND job.lease_expires_at <= p_now))
       AND (
         (job.kind = 'purge_source' AND asset.status = 'ready')
         OR (
           job.kind = 'delete' AND asset.status IN ('deleted', 'rejected')
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
           )
         )
       )
     ORDER BY job.available_at, job.id
     FOR UPDATE OF job, asset SKIP LOCKED LIMIT p_batch_size
  ), leased AS (
    UPDATE public.media_processing_jobs job
       SET status = 'leased', lease_owner = p_worker_id,
           lease_expires_at = p_now + make_interval(secs => p_lease_seconds),
           updated_at = p_now
      FROM candidates WHERE job.id = candidates.id
    RETURNING job.id, job.family_id, job.media_id, job.kind
  )
  SELECT leased.id, leased.family_id, leased.media_id, leased.kind,
         asset.object_key::text, asset.processed_object_key::text
    FROM leased
    JOIN public.media_assets asset
      ON asset.family_id = leased.family_id AND asset.id = leased.media_id;
END
$$;

CREATE OR REPLACE FUNCTION public.worker_complete_media_delete_job(
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
   WHERE job.id = p_job_id AND job.kind IN ('delete', 'purge_source')
     AND job.status = 'leased' AND job.lease_owner = p_worker_id
     AND job.lease_expires_at > p_now
     AND EXISTS (
       SELECT 1 FROM public.media_assets asset
        WHERE asset.family_id = job.family_id AND asset.id = job.media_id
          AND ((job.kind = 'purge_source' AND asset.status = 'ready')
            OR (job.kind = 'delete' AND asset.status IN ('deleted', 'rejected')))
     );
  RETURN FOUND;
END
$$;

CREATE FUNCTION public.worker_sweep_stale_media(
  p_batch_size integer,
  p_stale_before timestamptz,
  p_now timestamptz
)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE swept integer;
BEGIN
  IF p_batch_size NOT BETWEEN 1 AND 100 OR p_stale_before > p_now - interval '15 minutes' THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid stale media sweep';
  END IF;
  WITH candidates AS (
    SELECT asset.family_id, asset.id
      FROM public.media_assets asset
     WHERE (asset.status = 'rejected'
       OR (asset.status = 'pending' AND asset.updated_at <= p_stale_before))
       AND NOT EXISTS (
         SELECT 1 FROM public.media_processing_jobs job
          WHERE job.family_id = asset.family_id AND job.media_id = asset.id
            AND job.kind = 'delete'
       )
     ORDER BY asset.updated_at, asset.id
     FOR UPDATE SKIP LOCKED LIMIT p_batch_size
  ), prepared AS (
    UPDATE public.media_assets asset
       SET status = CASE WHEN asset.status = 'pending' THEN 'deleted' ELSE asset.status END,
           deleted_at = CASE WHEN asset.status = 'pending' THEN p_now ELSE asset.deleted_at END,
           version = CASE WHEN asset.status = 'pending' THEN asset.version + 1 ELSE asset.version END,
           updated_at = CASE WHEN asset.status = 'pending' THEN p_now ELSE asset.updated_at END
      FROM candidates
     WHERE asset.family_id = candidates.family_id AND asset.id = candidates.id
    RETURNING asset.family_id, asset.id
  ), queued AS (
    INSERT INTO public.media_processing_jobs(family_id, media_id, kind)
    SELECT family_id, id, 'delete' FROM prepared
    ON CONFLICT (family_id, media_id, kind) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO swept FROM queued;
  RETURN swept;
END
$$;

ALTER FUNCTION public.worker_complete_media_job(
  uuid, text, text, text, bigint, text, integer, integer, integer, timestamptz
) OWNER TO family_media_worker;
ALTER FUNCTION public.worker_reject_media_job(uuid, text, text, timestamptz)
  OWNER TO family_media_worker;
ALTER FUNCTION public.worker_fail_media_job(uuid, text, text, timestamptz)
  OWNER TO family_media_worker;
ALTER FUNCTION public.worker_claim_media_delete_jobs(text, integer, integer, timestamptz)
  OWNER TO family_media_worker;
ALTER FUNCTION public.worker_complete_media_delete_job(uuid, text, timestamptz)
  OWNER TO family_media_worker;
ALTER FUNCTION public.worker_sweep_stale_media(integer, timestamptz, timestamptz)
  OWNER TO family_media_worker;

REVOKE ALL ON FUNCTION public.worker_claim_media_delete_jobs(text, integer, integer, timestamptz),
  public.worker_complete_media_delete_job(uuid, text, timestamptz),
  public.worker_sweep_stale_media(integer, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_claim_media_delete_jobs(text, integer, integer, timestamptz),
  public.worker_complete_media_delete_job(uuid, text, timestamptz),
  public.worker_sweep_stale_media(integer, timestamptz, timestamptz) TO family_worker;
