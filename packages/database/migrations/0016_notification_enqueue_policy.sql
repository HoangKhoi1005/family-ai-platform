-- Evaluate enqueue authorization without exposing other memberships or the outbox to runtime users.

GRANT SELECT ON events, event_occurrences, notification_preferences
  TO family_membership_lookup;

CREATE FUNCTION public.actor_can_enqueue_event_reminder(
  p_family_id uuid,
  p_recipient_membership_id uuid,
  p_event_id uuid,
  p_occurrence_id uuid,
  p_event_revision integer,
  p_reminder_offset text,
  p_channel text
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT current_setting('app.purpose', true) = 'calendar_write'
    AND EXISTS (
      SELECT 1 FROM public.family_memberships recipient
       WHERE recipient.family_id = p_family_id
         AND recipient.id = p_recipient_membership_id
         AND recipient.status = 'active'
    )
    AND EXISTS (
      SELECT 1
        FROM public.event_occurrences occurrence
        JOIN public.events event
          ON event.family_id = occurrence.family_id
         AND event.id = occurrence.event_id
       WHERE occurrence.family_id = p_family_id
         AND occurrence.id = p_occurrence_id
         AND occurrence.event_id = p_event_id
         AND occurrence.event_revision = p_event_revision
         AND occurrence.status = 'active'
         AND event.status = 'active'
         AND event.revision = occurrence.event_revision
         AND p_reminder_offset = ANY(event.reminder_offsets)
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
    )
    AND (
      p_channel = 'in_app'
      OR (
        p_channel = 'push'
        AND EXISTS (
          SELECT 1 FROM public.notification_preferences preference
           WHERE preference.family_id = p_family_id
             AND preference.membership_id = p_recipient_membership_id
             AND preference.push_enabled
        )
      )
    )
$$;

ALTER FUNCTION public.actor_can_enqueue_event_reminder(uuid, uuid, uuid, uuid, integer, text, text)
  OWNER TO family_membership_lookup;
REVOKE ALL ON FUNCTION public.actor_can_enqueue_event_reminder(
  uuid, uuid, uuid, uuid, integer, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_can_enqueue_event_reminder(
  uuid, uuid, uuid, uuid, integer, text, text
) TO family_runtime;

DROP POLICY tenant_runtime_outbox_insert ON outbox_jobs;
CREATE POLICY tenant_runtime_outbox_insert
  ON outbox_jobs FOR INSERT TO family_runtime
  WITH CHECK (
    public.actor_can_enqueue_event_reminder(
      family_id,
      recipient_membership_id,
      event_id,
      occurrence_id,
      event_revision,
      reminder_offset,
      channel
    )
  );
