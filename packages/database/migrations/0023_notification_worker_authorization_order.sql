-- Authorization and source revision must invalidate a job before quiet-hours deferral.

CREATE FUNCTION public.worker_notification_job_is_deliverable(
  p_job_id uuid,
  p_now timestamptz
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.outbox_jobs job
      JOIN public.family_memberships recipient
        ON recipient.family_id = job.family_id
       AND recipient.id = job.recipient_membership_id
       AND recipient.status = 'active'
      JOIN public.event_occurrences occurrence
        ON occurrence.family_id = job.family_id
       AND occurrence.id = job.occurrence_id
       AND occurrence.event_id = job.event_id
       AND occurrence.event_revision = job.event_revision
       AND occurrence.status = 'active'
      JOIN public.events event
        ON event.family_id = occurrence.family_id
       AND event.id = occurrence.event_id
       AND event.status = 'active'
       AND event.revision = job.event_revision
     WHERE job.id = p_job_id
       AND job.channel = 'in_app'
       AND job.due_at <= p_now
       AND job.expires_at > p_now
       AND job.reminder_offset = ANY(event.reminder_offsets)
       AND NOT EXISTS (
         SELECT 1 FROM public.notification_preferences preference
          WHERE preference.family_id = job.family_id
            AND preference.membership_id = job.recipient_membership_id
            AND NOT (job.reminder_offset = ANY(preference.reminder_offsets))
       )
  )
$$;

ALTER FUNCTION public.worker_notification_job_is_deliverable(uuid, timestamptz)
  OWNER TO family_notification_worker;
REVOKE ALL ON FUNCTION public.worker_notification_job_is_deliverable(uuid, timestamptz)
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.worker_deliver_in_app_job(
  p_job_id uuid,
  p_worker_id text,
  p_now timestamptz
)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  job public.outbox_jobs%ROWTYPE;
  quiet_start time;
  quiet_end time;
  recipient_timezone text;
  recipient_local timestamp;
  quiet_until timestamptz;
  inside_quiet_hours boolean;
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

  IF NOT public.worker_notification_job_is_deliverable(job.id, p_now) THEN
    UPDATE public.outbox_jobs target
       SET status = 'cancelled',
           lease_owner = NULL,
           lease_expires_at = NULL,
           cancelled_at = p_now,
           updated_at = p_now
     WHERE target.id = job.id;
    RETURN 'cancelled';
  END IF;

  SELECT COALESCE(preference.quiet_hours_start, time '21:00'),
         COALESCE(preference.quiet_hours_end, time '07:00'),
         COALESCE(preference.timezone, 'Asia/Ho_Chi_Minh')
    INTO quiet_start, quiet_end, recipient_timezone
    FROM (SELECT 1) AS fallback
    LEFT JOIN public.notification_preferences preference
      ON preference.family_id = job.family_id
     AND preference.membership_id = job.recipient_membership_id;

  recipient_local := p_now AT TIME ZONE recipient_timezone;
  IF quiet_start < quiet_end THEN
    inside_quiet_hours := recipient_local::time >= quiet_start
      AND recipient_local::time < quiet_end;
    quiet_until := (recipient_local::date + quiet_end) AT TIME ZONE recipient_timezone;
  ELSE
    inside_quiet_hours := recipient_local::time >= quiet_start
      OR recipient_local::time < quiet_end;
    quiet_until := (
      CASE
        WHEN recipient_local::time < quiet_end THEN recipient_local::date
        ELSE recipient_local::date + 1
      END + quiet_end
    ) AT TIME ZONE recipient_timezone;
  END IF;

  IF inside_quiet_hours THEN
    IF quiet_until < job.expires_at THEN
      UPDATE public.outbox_jobs target
         SET status = 'pending',
             available_at = GREATEST(target.available_at, quiet_until),
             lease_owner = NULL,
             lease_expires_at = NULL,
             updated_at = p_now
       WHERE target.id = job.id;
      RETURN 'deferred';
    END IF;

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
