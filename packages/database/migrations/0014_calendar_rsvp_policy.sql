-- Keep RSVP writes behind the calendar route purpose and current Event revision.

DROP POLICY tenant_runtime_rsvps_insert ON event_rsvps;
DROP POLICY tenant_runtime_rsvps_update ON event_rsvps;

CREATE POLICY tenant_runtime_rsvps_insert ON event_rsvps FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'calendar_write'
    AND EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = event_rsvps.family_id
         AND membership.id = event_rsvps.membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
    AND EXISTS (
      SELECT 1
        FROM event_occurrences occurrence
        JOIN events event
          ON event.family_id = occurrence.family_id
         AND event.id = occurrence.event_id
       WHERE occurrence.family_id = event_rsvps.family_id
         AND occurrence.id = event_rsvps.occurrence_id
         AND occurrence.status = 'active'
         AND event.status = 'active'
         AND event.revision = occurrence.event_revision
    )
  );

CREATE POLICY tenant_runtime_rsvps_update ON event_rsvps FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'calendar_write'
    AND EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = event_rsvps.family_id
         AND membership.id = event_rsvps.membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
    AND EXISTS (
      SELECT 1
        FROM event_occurrences occurrence
        JOIN events event
          ON event.family_id = occurrence.family_id
         AND event.id = occurrence.event_id
       WHERE occurrence.family_id = event_rsvps.family_id
         AND occurrence.id = event_rsvps.occurrence_id
         AND occurrence.status = 'active'
         AND event.status = 'active'
         AND event.revision = occurrence.event_revision
    )
  )
  WITH CHECK (
    current_setting('app.purpose', true) = 'calendar_write'
    AND EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = event_rsvps.family_id
         AND membership.id = event_rsvps.membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
    AND EXISTS (
      SELECT 1
        FROM event_occurrences occurrence
        JOIN events event
          ON event.family_id = occurrence.family_id
         AND event.id = occurrence.event_id
       WHERE occurrence.family_id = event_rsvps.family_id
         AND occurrence.id = event_rsvps.occurrence_id
         AND occurrence.status = 'active'
         AND event.status = 'active'
         AND event.revision = occurrence.event_revision
    )
  );
