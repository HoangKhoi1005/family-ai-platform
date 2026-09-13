-- A restricted worker can only claim and settle notification jobs through narrow functions.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'family_worker') THEN
    CREATE ROLE family_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  ELSE
    ALTER ROLE family_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'family_notification_worker') THEN
    CREATE ROLE family_notification_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  ELSE
    ALTER ROLE family_notification_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO family_worker, family_notification_worker;
GRANT SELECT ON outbox_jobs, family_memberships, events, event_occurrences,
  notification_preferences TO family_notification_worker;
GRANT INSERT (
  family_id, recipient_membership_id, event_id, occurrence_id, event_revision,
  reminder_offset, kind, channel
) ON notifications TO family_notification_worker;
GRANT UPDATE (
  status, attempts, available_at, lease_owner, lease_expires_at, completed_at,
  cancelled_at, last_error_code, updated_at
) ON outbox_jobs TO family_notification_worker;

CREATE FUNCTION public.worker_claim_notification_jobs(
  p_worker_id text,
  p_batch_size integer,
  p_lease_seconds integer,
  p_now timestamptz
)
RETURNS TABLE(id uuid) LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF length(trim(p_worker_id)) NOT BETWEEN 1 AND 120 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid worker id';
  END IF;
  IF p_batch_size NOT BETWEEN 1 AND 100 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid worker batch size';
  END IF;
  IF p_lease_seconds NOT BETWEEN 5 AND 300 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid worker lease';
  END IF;
  IF p_now IS NULL THEN
    RAISE invalid_parameter_value USING MESSAGE = 'worker clock is required';
  END IF;

  UPDATE public.outbox_jobs job
     SET status = 'dead_letter',
         lease_owner = NULL,
         lease_expires_at = NULL,
         last_error_code = 'expired',
         updated_at = p_now
   WHERE job.status IN ('pending', 'leased')
     AND job.expires_at <= p_now;

  RETURN QUERY
  WITH candidates AS (
    SELECT job.id
      FROM public.outbox_jobs job
     WHERE job.channel = 'in_app'
       AND job.attempts < 5
       AND job.available_at <= p_now
       AND job.due_at <= p_now
       AND job.expires_at > p_now
       AND (
         job.status = 'pending'
         OR (job.status = 'leased' AND job.lease_expires_at <= p_now)
       )
     ORDER BY job.available_at, job.due_at, job.id
     FOR UPDATE SKIP LOCKED
     LIMIT p_batch_size
  )
  UPDATE public.outbox_jobs job
     SET status = 'leased',
         lease_owner = p_worker_id,
         lease_expires_at = p_now + make_interval(secs => p_lease_seconds),
         updated_at = p_now
    FROM candidates
   WHERE job.id = candidates.id
  RETURNING job.id;
END
$$;

CREATE FUNCTION public.worker_deliver_in_app_job(
  p_job_id uuid,
  p_worker_id text,
  p_now timestamptz
)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  job public.outbox_jobs%ROWTYPE;
  is_deliverable boolean;
BEGIN
  SELECT * INTO job
    FROM public.outbox_jobs candidate
   WHERE candidate.id = p_job_id
     AND candidate.status = 'leased'
     AND candidate.lease_owner = p_worker_id
     AND candidate.lease_expires_at > p_now
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE object_not_in_prerequisite_state USING MESSAGE = 'notification job lease is not active';
  END IF;

  SELECT job.channel = 'in_app'
    AND job.due_at <= p_now
    AND job.expires_at > p_now
    AND EXISTS (
      SELECT 1 FROM public.family_memberships recipient
       WHERE recipient.family_id = job.family_id
         AND recipient.id = job.recipient_membership_id
         AND recipient.status = 'active'
    )
    AND EXISTS (
      SELECT 1
        FROM public.event_occurrences occurrence
        JOIN public.events event
          ON event.family_id = occurrence.family_id
         AND event.id = occurrence.event_id
       WHERE occurrence.family_id = job.family_id
         AND occurrence.id = job.occurrence_id
         AND occurrence.event_id = job.event_id
         AND occurrence.event_revision = job.event_revision
         AND occurrence.status = 'active'
         AND event.status = 'active'
         AND event.revision = job.event_revision
         AND job.reminder_offset = ANY(event.reminder_offsets)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_preferences preference
       WHERE preference.family_id = job.family_id
         AND preference.membership_id = job.recipient_membership_id
         AND NOT (job.reminder_offset = ANY(preference.reminder_offsets))
    )
    INTO is_deliverable;

  IF NOT is_deliverable THEN
    UPDATE public.outbox_jobs target
       SET status = 'cancelled',
           lease_owner = NULL,
           lease_expires_at = NULL,
           cancelled_at = p_now,
           updated_at = p_now
     WHERE target.id = job.id;
    RETURN 'cancelled';
  END IF;

  INSERT INTO public.notifications(
    family_id, recipient_membership_id, event_id, occurrence_id,
    event_revision, reminder_offset, kind, channel
  ) VALUES (
    job.family_id, job.recipient_membership_id, job.event_id, job.occurrence_id,
    job.event_revision, job.reminder_offset, job.kind, job.channel
  )
  ON CONFLICT (
    family_id, recipient_membership_id, occurrence_id, event_revision,
    reminder_offset, kind, channel
  ) DO NOTHING;

  UPDATE public.outbox_jobs target
     SET status = 'completed',
         attempts = target.attempts + 1,
         lease_owner = NULL,
         lease_expires_at = NULL,
         completed_at = p_now,
         last_error_code = NULL,
         updated_at = p_now
   WHERE target.id = job.id;
  RETURN 'completed';
END
$$;

CREATE FUNCTION public.worker_fail_notification_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_now timestamptz
)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  job public.outbox_jobs%ROWTYPE;
  next_attempt integer;
  next_available timestamptz;
  next_status text;
BEGIN
  IF p_error_code <> 'delivery_failed' THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid worker error code';
  END IF;

  SELECT * INTO job
    FROM public.outbox_jobs candidate
   WHERE candidate.id = p_job_id
     AND candidate.status = 'leased'
     AND candidate.lease_owner = p_worker_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE object_not_in_prerequisite_state USING MESSAGE = 'notification job lease is not owned';
  END IF;

  next_attempt := job.attempts + 1;
  next_available := p_now + make_interval(
    secs => LEAST(900, 30 * power(2, job.attempts)::integer)
  );
  next_status := CASE
    WHEN next_attempt >= 5 OR next_available >= job.expires_at THEN 'dead_letter'
    ELSE 'pending'
  END;

  UPDATE public.outbox_jobs target
     SET status = next_status,
         attempts = next_attempt,
         available_at = LEAST(next_available, target.expires_at),
         lease_owner = NULL,
         lease_expires_at = NULL,
         last_error_code = p_error_code,
         updated_at = p_now
   WHERE target.id = job.id;
  RETURN next_status;
END
$$;

ALTER FUNCTION public.worker_claim_notification_jobs(text, integer, integer, timestamptz)
  OWNER TO family_notification_worker;
ALTER FUNCTION public.worker_deliver_in_app_job(uuid, text, timestamptz)
  OWNER TO family_notification_worker;
ALTER FUNCTION public.worker_fail_notification_job(uuid, text, text, timestamptz)
  OWNER TO family_notification_worker;

REVOKE ALL ON FUNCTION public.worker_claim_notification_jobs(text, integer, integer, timestamptz)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.worker_deliver_in_app_job(uuid, text, timestamptz)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.worker_fail_notification_job(uuid, text, text, timestamptz)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_claim_notification_jobs(text, integer, integer, timestamptz),
  public.worker_deliver_in_app_job(uuid, text, timestamptz),
  public.worker_fail_notification_job(uuid, text, text, timestamptz)
  TO family_worker;
