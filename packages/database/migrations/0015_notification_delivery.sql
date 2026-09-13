-- Private in-app notification source, per-member preferences and transactional delivery outbox.

ALTER TABLE event_occurrences
  ADD CONSTRAINT event_occurrences_delivery_identity
  UNIQUE (family_id, id, event_id, event_revision);

CREATE TABLE notification_preferences (
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  membership_id uuid NOT NULL,
  reminder_offsets text[] NOT NULL
    DEFAULT ARRAY['seven_days', 'one_day', 'same_day']::text[]
    CHECK (
      cardinality(reminder_offsets) <= 3
      AND reminder_offsets <@ ARRAY['seven_days', 'one_day', 'same_day']::text[]
      AND array_position(reminder_offsets, NULL) IS NULL
      AND cardinality(array_positions(reminder_offsets, 'seven_days')) <= 1
      AND cardinality(array_positions(reminder_offsets, 'one_day')) <= 1
      AND cardinality(array_positions(reminder_offsets, 'same_day')) <= 1
    ),
  quiet_hours_start time NOT NULL DEFAULT '21:00',
  quiet_hours_end time NOT NULL DEFAULT '07:00',
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'
    CHECK (timezone = 'Asia/Ho_Chi_Minh'),
  push_enabled boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, membership_id),
  FOREIGN KEY (family_id, membership_id)
    REFERENCES family_memberships(family_id, id),
  CHECK (quiet_hours_start <> quiet_hours_end)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  recipient_membership_id uuid NOT NULL,
  event_id uuid NOT NULL,
  occurrence_id uuid NOT NULL,
  event_revision integer NOT NULL CHECK (event_revision > 0),
  reminder_offset text NOT NULL
    CHECK (reminder_offset IN ('seven_days', 'one_day', 'same_day')),
  kind text NOT NULL DEFAULT 'event_reminder' CHECK (kind = 'event_reminder'),
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel = 'in_app'),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (family_id, id),
  UNIQUE (
    family_id, recipient_membership_id, occurrence_id, event_revision,
    reminder_offset, kind, channel
  ),
  FOREIGN KEY (family_id, recipient_membership_id)
    REFERENCES family_memberships(family_id, id),
  FOREIGN KEY (family_id, occurrence_id, event_id, event_revision)
    REFERENCES event_occurrences(family_id, id, event_id, event_revision),
  CHECK (read_at IS NULL OR read_at >= created_at)
);

CREATE INDEX notifications_recipient_timeline
  ON notifications(family_id, recipient_membership_id, created_at DESC, id);
CREATE INDEX notifications_recipient_unread
  ON notifications(family_id, recipient_membership_id, created_at DESC, id)
  WHERE read_at IS NULL;

CREATE TABLE outbox_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  recipient_membership_id uuid NOT NULL,
  event_id uuid NOT NULL,
  occurrence_id uuid NOT NULL,
  event_revision integer NOT NULL CHECK (event_revision > 0),
  reminder_offset text NOT NULL
    CHECK (reminder_offset IN ('seven_days', 'one_day', 'same_day')),
  kind text NOT NULL DEFAULT 'event_reminder' CHECK (kind = 'event_reminder'),
  channel text NOT NULL CHECK (channel IN ('in_app', 'push')),
  due_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'leased', 'completed', 'cancelled', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  lease_owner varchar(120),
  lease_expires_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  last_error_code varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, id),
  UNIQUE (
    family_id, recipient_membership_id, occurrence_id, event_revision,
    reminder_offset, kind, channel
  ),
  FOREIGN KEY (family_id, recipient_membership_id)
    REFERENCES family_memberships(family_id, id),
  FOREIGN KEY (family_id, occurrence_id, event_id, event_revision)
    REFERENCES event_occurrences(family_id, id, event_id, event_revision),
  CHECK (available_at <= expires_at),
  CHECK (due_at <= expires_at),
  CHECK (last_error_code IS NULL OR length(trim(last_error_code)) > 0),
  CHECK (
    (status = 'leased' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'leased' AND lease_owner IS NULL AND lease_expires_at IS NULL)
  ),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);

CREATE INDEX outbox_jobs_delivery_queue
  ON outbox_jobs(available_at, due_at, id)
  WHERE status IN ('pending', 'leased');
CREATE INDEX outbox_jobs_event_revision
  ON outbox_jobs(family_id, event_id, event_revision, status);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_runtime_notification_preferences_select
  ON notification_preferences FOR SELECT TO family_runtime
  USING (
    EXISTS (
      SELECT 1 FROM family_memberships membership
       WHERE membership.family_id = notification_preferences.family_id
         AND membership.id = notification_preferences.membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );
CREATE POLICY tenant_runtime_notification_preferences_insert
  ON notification_preferences FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'notification_write'
    AND EXISTS (
      SELECT 1 FROM family_memberships membership
       WHERE membership.family_id = notification_preferences.family_id
         AND membership.id = notification_preferences.membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );
CREATE POLICY tenant_runtime_notification_preferences_update
  ON notification_preferences FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'notification_write'
    AND EXISTS (
      SELECT 1 FROM family_memberships membership
       WHERE membership.family_id = notification_preferences.family_id
         AND membership.id = notification_preferences.membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  )
  WITH CHECK (
    current_setting('app.purpose', true) = 'notification_write'
    AND EXISTS (
      SELECT 1 FROM family_memberships membership
       WHERE membership.family_id = notification_preferences.family_id
         AND membership.id = notification_preferences.membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );

CREATE POLICY tenant_runtime_notifications_select
  ON notifications FOR SELECT TO family_runtime
  USING (
    EXISTS (
      SELECT 1 FROM family_memberships membership
       WHERE membership.family_id = notifications.family_id
         AND membership.id = notifications.recipient_membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );
CREATE POLICY tenant_runtime_notifications_update
  ON notifications FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'notification_write'
    AND EXISTS (
      SELECT 1 FROM family_memberships membership
       WHERE membership.family_id = notifications.family_id
         AND membership.id = notifications.recipient_membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  )
  WITH CHECK (
    current_setting('app.purpose', true) = 'notification_write'
    AND EXISTS (
      SELECT 1 FROM family_memberships membership
       WHERE membership.family_id = notifications.family_id
         AND membership.id = notifications.recipient_membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );

CREATE POLICY tenant_runtime_outbox_insert
  ON outbox_jobs FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'calendar_write'
    AND EXISTS (
      SELECT 1 FROM family_memberships recipient
       WHERE recipient.family_id = outbox_jobs.family_id
         AND recipient.id = outbox_jobs.recipient_membership_id
         AND recipient.status = 'active'
    )
    AND EXISTS (
      SELECT 1
        FROM event_occurrences occurrence
        JOIN events event
          ON event.family_id = occurrence.family_id
         AND event.id = occurrence.event_id
       WHERE occurrence.family_id = outbox_jobs.family_id
         AND occurrence.id = outbox_jobs.occurrence_id
         AND occurrence.event_id = outbox_jobs.event_id
         AND occurrence.event_revision = outbox_jobs.event_revision
         AND occurrence.status = 'active'
         AND event.status = 'active'
         AND event.revision = occurrence.event_revision
         AND outbox_jobs.reminder_offset = ANY(event.reminder_offsets)
         AND (
           public.actor_active_admin(event.family_id)
           OR EXISTS (
             SELECT 1 FROM family_memberships creator
              WHERE creator.family_id = event.family_id
                AND creator.id = event.creator_membership_id
                AND creator.user_id = public.actor_uuid()
                AND creator.status = 'active'
           )
         )
    )
    AND (
      outbox_jobs.channel = 'in_app'
      OR EXISTS (
        SELECT 1 FROM notification_preferences preference
         WHERE preference.family_id = outbox_jobs.family_id
           AND preference.membership_id = outbox_jobs.recipient_membership_id
           AND preference.push_enabled
      )
    )
  );
CREATE POLICY tenant_runtime_outbox_cancel
  ON outbox_jobs FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'calendar_write'
    AND EXISTS (
      SELECT 1 FROM events event
       WHERE event.family_id = outbox_jobs.family_id
         AND event.id = outbox_jobs.event_id
         AND (
           public.actor_active_admin(event.family_id)
           OR EXISTS (
             SELECT 1 FROM family_memberships creator
              WHERE creator.family_id = event.family_id
                AND creator.id = event.creator_membership_id
                AND creator.user_id = public.actor_uuid()
                AND creator.status = 'active'
           )
         )
    )
  )
  WITH CHECK (
    current_setting('app.purpose', true) = 'calendar_write'
    AND status = 'cancelled'
    AND cancelled_at IS NOT NULL
    AND lease_owner IS NULL
    AND lease_expires_at IS NULL
  );

REVOKE ALL ON notification_preferences, notifications, outbox_jobs FROM family_auth;
REVOKE ALL ON outbox_jobs FROM family_runtime;
GRANT SELECT ON notification_preferences, notifications TO family_runtime;
GRANT INSERT (
  family_id, membership_id, reminder_offsets, quiet_hours_start, quiet_hours_end,
  timezone, push_enabled
) ON notification_preferences TO family_runtime;
GRANT UPDATE (
  reminder_offsets, quiet_hours_start, quiet_hours_end, timezone, push_enabled,
  version, updated_at
) ON notification_preferences TO family_runtime;
GRANT UPDATE (read_at) ON notifications TO family_runtime;
GRANT INSERT (
  id, family_id, recipient_membership_id, event_id, occurrence_id, event_revision,
  reminder_offset, kind, channel, due_at, available_at, expires_at
) ON outbox_jobs TO family_runtime;
GRANT UPDATE (status, lease_owner, lease_expires_at, cancelled_at, updated_at)
  ON outbox_jobs TO family_runtime;
