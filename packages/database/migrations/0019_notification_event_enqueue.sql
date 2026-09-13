-- Fan out current Event occurrences to active recipients without exposing the membership list.

GRANT INSERT (
  family_id, recipient_membership_id, event_id, occurrence_id, event_revision,
  reminder_offset, kind, channel, due_at, available_at, expires_at
) ON outbox_jobs TO family_membership_lookup;

CREATE FUNCTION public.actor_enqueue_event_reminders(
  p_family_id uuid,
  p_event_id uuid,
  p_event_revision integer
)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  affected integer;
BEGIN
  IF current_setting('app.purpose', true) <> 'calendar_write' THEN
    RAISE insufficient_privilege USING MESSAGE = 'calendar_write context is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.events event
     WHERE event.family_id = p_family_id
       AND event.id = p_event_id
       AND event.revision = p_event_revision
       AND event.status = 'active'
       AND (
         public.actor_active_admin(event.family_id)
         OR EXISTS (
           SELECT 1 FROM public.family_memberships creator
            WHERE creator.family_id = event.family_id
              AND creator.id = event.creator_membership_id
              AND creator.user_id = public.actor_uuid()
              AND creator.status = 'active'
         )
       )
  ) THEN
    RAISE insufficient_privilege USING MESSAGE = 'event reminders cannot be enqueued';
  END IF;

  WITH candidates AS (
    SELECT event.family_id,
           recipient.id AS recipient_membership_id,
           event.id AS event_id,
           occurrence.id AS occurrence_id,
           event.revision AS event_revision,
           reminder.reminder_offset,
           event.timezone,
           occurrence.local_date,
           occurrence.starts_at,
           CASE reminder.reminder_offset
             WHEN 'seven_days' THEN
               ((occurrence.local_date - 7) + time '09:00') AT TIME ZONE event.timezone
             WHEN 'one_day' THEN
               ((occurrence.local_date - 1) + time '09:00') AT TIME ZONE event.timezone
             WHEN 'same_day' THEN
               CASE
                 WHEN occurrence.starts_at IS NULL
                   OR occurrence.starts_at >
                     (occurrence.local_date + time '09:00') AT TIME ZONE event.timezone
                 THEN (occurrence.local_date + time '09:00') AT TIME ZONE event.timezone
                 WHEN occurrence.starts_at >
                   (occurrence.local_date + time '07:00') AT TIME ZONE event.timezone
                 THEN (occurrence.local_date + time '07:00') AT TIME ZONE event.timezone
                 ELSE NULL
               END
           END AS due_at,
           CASE
             WHEN occurrence.starts_at IS NOT NULL THEN occurrence.starts_at
             ELSE ((occurrence.local_date + 1) + time '00:00') AT TIME ZONE event.timezone
           END AS expires_at
      FROM public.events event
      JOIN public.event_occurrences occurrence
        ON occurrence.family_id = event.family_id
       AND occurrence.event_id = event.id
       AND occurrence.event_revision = event.revision
       AND occurrence.status = 'active'
      JOIN public.family_memberships recipient
        ON recipient.family_id = event.family_id
       AND recipient.status = 'active'
      CROSS JOIN LATERAL unnest(event.reminder_offsets) AS reminder(reminder_offset)
     WHERE event.family_id = p_family_id
       AND event.id = p_event_id
       AND event.revision = p_event_revision
       AND event.status = 'active'
       AND public.actor_can_enqueue_event_reminder(
         event.family_id,
         recipient.id,
         event.id,
         occurrence.id,
         event.revision,
         reminder.reminder_offset,
         'in_app'
       )
  )
  INSERT INTO public.outbox_jobs(
    family_id, recipient_membership_id, event_id, occurrence_id, event_revision,
    reminder_offset, kind, channel, due_at, available_at, expires_at
  )
  SELECT family_id, recipient_membership_id, event_id, occurrence_id, event_revision,
         reminder_offset, 'event_reminder', 'in_app', due_at, due_at, expires_at
    FROM candidates
   WHERE due_at IS NOT NULL
     AND due_at >= clock_timestamp()
     AND due_at < expires_at
  ON CONFLICT (
    family_id, recipient_membership_id, occurrence_id, event_revision,
    reminder_offset, kind, channel
  ) DO NOTHING;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END
$$;

ALTER FUNCTION public.actor_enqueue_event_reminders(uuid, uuid, integer)
  OWNER TO family_membership_lookup;
REVOKE ALL ON FUNCTION public.actor_enqueue_event_reminders(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_enqueue_event_reminders(uuid, uuid, integer)
  TO family_runtime;
