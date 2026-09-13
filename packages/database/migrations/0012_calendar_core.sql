-- Family-scoped events, materialized occurrences and per-membership RSVP.

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  creator_membership_id uuid NOT NULL,
  member_id uuid,
  kind text NOT NULL CHECK (
    kind IN ('birthday', 'death_anniversary', 'wedding_anniversary', 'gathering', 'other')
  ),
  title varchar(160) NOT NULL CHECK (length(trim(title)) > 0),
  note varchar(2000),
  location varchar(300),
  calendar_type text NOT NULL CHECK (calendar_type IN ('gregorian', 'lunar_vietnamese')),
  recurrence text NOT NULL CHECK (recurrence IN ('none', 'yearly')),
  timezone text NOT NULL CHECK (timezone = 'Asia/Ho_Chi_Minh'),
  date_year integer CHECK (date_year BETWEEN 1200 AND 2199),
  date_month integer NOT NULL CHECK (date_month BETWEEN 1 AND 12),
  date_day integer NOT NULL CHECK (date_day BETWEEN 1 AND 31),
  lunar_month_mode text CHECK (lunar_month_mode IN ('regular', 'leap_only', 'both')),
  lunar_missing_day_policy text CHECK (lunar_missing_day_policy IN ('last_day', 'skip')),
  feb29_policy text CHECK (feb29_policy IN ('feb28', 'mar1', 'skip')),
  all_day boolean NOT NULL,
  starts_local_time time,
  duration_minutes integer CHECK (duration_minutes BETWEEN 1 AND 1440),
  reminder_offsets text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK (
    cardinality(reminder_offsets) <= 3
    AND reminder_offsets <@ ARRAY['seven_days', 'one_day', 'same_day']::text[]
    AND array_position(reminder_offsets, NULL) IS NULL
    AND cardinality(array_positions(reminder_offsets, 'seven_days')) <= 1
    AND cardinality(array_positions(reminder_offsets, 'one_day')) <= 1
    AND cardinality(array_positions(reminder_offsets, 'same_day')) <= 1
  ),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, id),
  FOREIGN KEY(family_id, creator_membership_id)
    REFERENCES family_memberships(family_id, id),
  FOREIGN KEY(family_id, member_id) REFERENCES members(family_id, id),
  CHECK (note IS NULL OR length(trim(note)) > 0),
  CHECK (location IS NULL OR length(trim(location)) > 0),
  CHECK (recurrence = 'yearly' OR date_year IS NOT NULL),
  CHECK (
    (all_day AND starts_local_time IS NULL AND duration_minutes IS NULL)
    OR
    (NOT all_day AND starts_local_time IS NOT NULL)
  ),
  CHECK (
    calendar_type <> 'gregorian'
    OR (
      (date_month = 2 AND (
        date_day <= 28
        OR (date_day = 29 AND (
          date_year IS NULL
          OR date_year % 400 = 0
          OR (date_year % 4 = 0 AND date_year % 100 <> 0)
        ))
      ))
      OR (date_month IN (4, 6, 9, 11) AND date_day <= 30)
      OR (date_month NOT IN (2, 4, 6, 9, 11) AND date_day <= 31)
    )
  ),
  CHECK (
    (
      calendar_type = 'gregorian'
      AND lunar_month_mode IS NULL
      AND lunar_missing_day_policy IS NULL
      AND (
        (recurrence = 'yearly' AND date_month = 2 AND date_day = 29 AND feb29_policy IS NOT NULL)
        OR (NOT (recurrence = 'yearly' AND date_month = 2 AND date_day = 29)
          AND feb29_policy IS NULL)
      )
    )
    OR
    (
      calendar_type = 'lunar_vietnamese'
      AND date_day <= 30
      AND lunar_month_mode IS NOT NULL
      AND lunar_missing_day_policy IS NOT NULL
      AND feb29_policy IS NULL
      AND (recurrence = 'yearly' OR lunar_month_mode <> 'both')
    )
  ),
  CHECK (
    (status = 'active' AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  )
);

CREATE INDEX events_family_active_updated
  ON events(family_id, updated_at DESC, id) WHERE status = 'active';
CREATE INDEX events_member_lookup
  ON events(family_id, member_id) WHERE member_id IS NOT NULL;

CREATE TABLE event_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  event_id uuid NOT NULL,
  event_revision integer NOT NULL CHECK (event_revision > 0),
  local_date date NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  calendar_conversion_version varchar(120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, id),
  UNIQUE NULLS NOT DISTINCT (family_id, event_id, event_revision, local_date, starts_at),
  FOREIGN KEY(family_id, event_id) REFERENCES events(family_id, id),
  CHECK (ends_at IS NULL OR (starts_at IS NOT NULL AND ends_at > starts_at)),
  CHECK (
    calendar_conversion_version IS NULL
    OR length(trim(calendar_conversion_version)) > 0
  )
);

CREATE INDEX event_occurrences_family_timeline
  ON event_occurrences(family_id, local_date, starts_at, id) WHERE status = 'active';
CREATE INDEX event_occurrences_event_revision
  ON event_occurrences(family_id, event_id, event_revision);

CREATE TABLE event_rsvps (
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  occurrence_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  response text NOT NULL CHECK (response IN ('yes', 'no', 'maybe')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(family_id, occurrence_id, membership_id),
  FOREIGN KEY(family_id, occurrence_id) REFERENCES event_occurrences(family_id, id),
  FOREIGN KEY(family_id, membership_id) REFERENCES family_memberships(family_id, id)
);

CREATE INDEX event_rsvps_occurrence_response
  ON event_rsvps(family_id, occurrence_id, response);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
ALTER TABLE event_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_occurrences FORCE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_runtime_events_select ON events FOR SELECT TO family_runtime
  USING (public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_events_insert ON events FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'calendar_write'
    AND EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = events.family_id
         AND membership.id = events.creator_membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );
CREATE POLICY tenant_runtime_events_update ON events FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'calendar_write'
    AND public.actor_active_member(family_id)
    AND (
      public.actor_active_admin(family_id)
      OR EXISTS (
        SELECT 1
          FROM family_memberships creator
         WHERE creator.family_id = events.family_id
           AND creator.id = events.creator_membership_id
           AND creator.user_id = public.actor_uuid()
           AND creator.status = 'active'
      )
    )
  )
  WITH CHECK (
    current_setting('app.purpose', true) = 'calendar_write'
    AND public.actor_active_member(family_id)
    AND (
      public.actor_active_admin(family_id)
      OR EXISTS (
        SELECT 1
          FROM family_memberships creator
         WHERE creator.family_id = events.family_id
           AND creator.id = events.creator_membership_id
           AND creator.user_id = public.actor_uuid()
           AND creator.status = 'active'
      )
    )
  );

CREATE POLICY tenant_runtime_occurrences_select ON event_occurrences FOR SELECT TO family_runtime
  USING (public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_occurrences_insert ON event_occurrences FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'calendar_write'
    AND EXISTS (
      SELECT 1
        FROM events event
       WHERE event.family_id = event_occurrences.family_id
         AND event.id = event_occurrences.event_id
         AND event.status = 'active'
         AND event.revision = event_occurrences.event_revision
         AND (
           public.actor_active_admin(event.family_id)
           OR EXISTS (
             SELECT 1
               FROM family_memberships creator
              WHERE creator.family_id = event.family_id
                AND creator.id = event.creator_membership_id
                AND creator.user_id = public.actor_uuid()
                AND creator.status = 'active'
           )
         )
    )
  );
CREATE POLICY tenant_runtime_occurrences_update ON event_occurrences FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'calendar_write'
    AND EXISTS (
      SELECT 1
        FROM events event
       WHERE event.family_id = event_occurrences.family_id
         AND event.id = event_occurrences.event_id
         AND (
           public.actor_active_admin(event.family_id)
           OR EXISTS (
             SELECT 1
               FROM family_memberships creator
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
    AND public.actor_active_member(family_id)
  );

CREATE POLICY tenant_runtime_rsvps_select ON event_rsvps FOR SELECT TO family_runtime
  USING (
    public.actor_active_member(family_id)
    AND EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = event_rsvps.family_id
         AND membership.id = event_rsvps.membership_id
         AND membership.status = 'active'
         AND (
           membership.user_id = public.actor_uuid()
           OR public.actor_active_admin(event_rsvps.family_id)
         )
    )
  );
CREATE POLICY tenant_runtime_rsvps_insert ON event_rsvps FOR INSERT TO family_runtime
  WITH CHECK (
    EXISTS (
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
       WHERE occurrence.family_id = event_rsvps.family_id
         AND occurrence.id = event_rsvps.occurrence_id
         AND occurrence.status = 'active'
    )
  );
CREATE POLICY tenant_runtime_rsvps_update ON event_rsvps FOR UPDATE TO family_runtime
  USING (
    EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = event_rsvps.family_id
         AND membership.id = event_rsvps.membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
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
       WHERE occurrence.family_id = event_rsvps.family_id
         AND occurrence.id = event_rsvps.occurrence_id
         AND occurrence.status = 'active'
    )
  );

REVOKE ALL ON events, event_occurrences, event_rsvps FROM PUBLIC, family_auth;
GRANT SELECT ON events, event_occurrences, event_rsvps TO family_runtime;
GRANT INSERT (
  family_id, creator_membership_id, member_id, kind, title, note, location,
  calendar_type, recurrence, timezone, date_year, date_month, date_day,
  lunar_month_mode, lunar_missing_day_policy, feb29_policy, all_day,
  starts_local_time, duration_minutes, reminder_offsets
) ON events TO family_runtime;
GRANT UPDATE (
  member_id, kind, title, note, location, calendar_type, recurrence, timezone,
  date_year, date_month, date_day, lunar_month_mode, lunar_missing_day_policy,
  feb29_policy, all_day, starts_local_time, duration_minutes, reminder_offsets,
  revision, version, status, cancelled_at, updated_at
) ON events TO family_runtime;
GRANT INSERT (
  family_id, event_id, event_revision, local_date, starts_at, ends_at,
  calendar_conversion_version, status
) ON event_occurrences TO family_runtime;
GRANT UPDATE (status) ON event_occurrences TO family_runtime;
GRANT INSERT (family_id, occurrence_id, membership_id, response)
  ON event_rsvps TO family_runtime;
GRANT UPDATE (response, updated_at) ON event_rsvps TO family_runtime;
