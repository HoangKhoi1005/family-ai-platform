-- Keep the worker function's varchar media fields aligned with its text return contract.

CREATE OR REPLACE FUNCTION public.worker_claim_media_jobs(
  p_worker_id text,
  p_batch_size integer,
  p_lease_seconds integer,
  p_now timestamptz
)
RETURNS TABLE(
  job_id uuid, family_id uuid, media_id uuid, kind text, object_key text,
  processed_object_key text, purpose text, mime_type text, byte_size bigint
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
     WHERE job.kind = 'process' AND job.attempts < 5 AND job.available_at <= p_now
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
    RETURNING job.id, job.family_id, job.media_id, job.kind
  )
  SELECT leased.id, leased.family_id, leased.media_id, leased.kind,
         asset.object_key::text, asset.processed_object_key::text,
         asset.purpose::text, asset.mime_type::text, asset.byte_size
    FROM leased
    JOIN public.media_assets asset
      ON asset.family_id = leased.family_id AND asset.id = leased.media_id;
END
$$;

ALTER FUNCTION public.worker_claim_media_jobs(text, integer, integer, timestamptz)
  OWNER TO family_media_worker;
REVOKE ALL ON FUNCTION public.worker_claim_media_jobs(text, integer, integer, timestamptz)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_claim_media_jobs(text, integer, integer, timestamptz)
  TO family_worker;
