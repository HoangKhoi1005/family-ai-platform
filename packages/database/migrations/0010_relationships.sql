-- Approved family relationships and their reviewed change workflow.

CREATE TABLE relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  from_member_id uuid NOT NULL,
  to_member_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('parent_child', 'partnership')),
  subtype text NOT NULL,
  start_date date,
  end_date date,
  removed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, id),
  FOREIGN KEY(family_id, from_member_id) REFERENCES members(family_id, id),
  FOREIGN KEY(family_id, to_member_id) REFERENCES members(family_id, id),
  CHECK (from_member_id <> to_member_id),
  CHECK (
    (type = 'parent_child'
      AND subtype IN ('biological', 'adoptive', 'unspecified')
      AND start_date IS NULL
      AND end_date IS NULL)
    OR
    (type = 'partnership'
      AND subtype IN ('married', 'partner')
      AND (start_date IS NULL OR end_date IS NULL OR end_date >= start_date))
  ),
  CHECK (type <> 'partnership' OR from_member_id < to_member_id)
);

CREATE UNIQUE INDEX relationships_parent_child_active_unique
  ON relationships(family_id, from_member_id, to_member_id)
  WHERE type = 'parent_child' AND removed_at IS NULL;
CREATE UNIQUE INDEX relationships_partnership_active_unique
  ON relationships(family_id, from_member_id, to_member_id)
  WHERE type = 'partnership' AND end_date IS NULL AND removed_at IS NULL;
CREATE UNIQUE INDEX relationships_partnership_period_unique
  ON relationships(family_id, from_member_id, to_member_id, start_date, end_date) NULLS NOT DISTINCT
  WHERE type = 'partnership' AND removed_at IS NULL;
CREATE INDEX relationships_from_lookup
  ON relationships(family_id, from_member_id) WHERE removed_at IS NULL;
CREATE INDEX relationships_to_lookup
  ON relationships(family_id, to_member_id) WHERE removed_at IS NULL;

CREATE TABLE change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  actor_membership_id uuid NOT NULL,
  type text NOT NULL CHECK (
    type IN ('relationship_create', 'relationship_update', 'relationship_remove')
  ),
  target_id uuid,
  base_version integer CHECK (base_version > 0),
  proposed_payload jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewer_id uuid,
  decision_note varchar(500),
  decided_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, id),
  FOREIGN KEY(family_id, actor_membership_id) REFERENCES family_memberships(family_id, id),
  FOREIGN KEY(family_id, reviewer_id) REFERENCES family_memberships(family_id, id),
  FOREIGN KEY(family_id, target_id) REFERENCES relationships(family_id, id),
  CHECK (proposed_payload IS NULL OR jsonb_typeof(proposed_payload) = 'object'),
  CHECK (
    (type = 'relationship_create'
      AND target_id IS NULL
      AND base_version IS NULL
      AND proposed_payload IS NOT NULL)
    OR
    (type = 'relationship_update'
      AND target_id IS NOT NULL
      AND base_version IS NOT NULL
      AND proposed_payload IS NOT NULL)
    OR
    (type = 'relationship_remove'
      AND target_id IS NOT NULL
      AND base_version IS NOT NULL
      AND proposed_payload IS NULL)
  ),
  CHECK (
    (status = 'pending' AND reviewer_id IS NULL AND decided_at IS NULL)
    OR
    (status IN ('approved', 'rejected') AND reviewer_id IS NOT NULL AND decided_at IS NOT NULL)
    OR
    (status = 'cancelled' AND reviewer_id IS NULL AND decided_at IS NOT NULL)
  )
);

CREATE INDEX change_requests_pending_family
  ON change_requests(family_id, created_at, id) WHERE status = 'pending';
CREATE INDEX change_requests_actor_lookup
  ON change_requests(family_id, actor_membership_id, created_at, id);

ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships FORCE ROW LEVEL SECURITY;
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_runtime_relationships_select ON relationships FOR SELECT TO family_runtime
  USING (public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_relationships_insert ON relationships FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'relationship_decision'
    AND public.actor_active_admin(family_id)
  );
CREATE POLICY tenant_runtime_relationships_update ON relationships FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'relationship_decision'
    AND public.actor_active_admin(family_id)
  )
  WITH CHECK (
    current_setting('app.purpose', true) = 'relationship_decision'
    AND public.actor_active_admin(family_id)
  );

CREATE POLICY tenant_runtime_change_requests_select ON change_requests FOR SELECT TO family_runtime
  USING (
    public.actor_active_admin(family_id)
    OR EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = change_requests.family_id
         AND membership.id = change_requests.actor_membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );
CREATE POLICY tenant_runtime_change_requests_insert ON change_requests FOR INSERT TO family_runtime
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = change_requests.family_id
         AND membership.id = change_requests.actor_membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );
CREATE POLICY tenant_runtime_change_requests_decision ON change_requests FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'relationship_decision'
    AND public.actor_active_admin(family_id)
  )
  WITH CHECK (
    current_setting('app.purpose', true) = 'relationship_decision'
    AND public.actor_active_admin(family_id)
  );
CREATE POLICY tenant_runtime_change_requests_cancel ON change_requests FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'relationship_cancel'
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = change_requests.family_id
         AND membership.id = change_requests.actor_membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  )
  WITH CHECK (
    current_setting('app.purpose', true) = 'relationship_cancel'
    AND status = 'cancelled'
    AND EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = change_requests.family_id
         AND membership.id = change_requests.actor_membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );

REVOKE ALL ON relationships, change_requests FROM PUBLIC, family_auth;
GRANT SELECT ON relationships, change_requests TO family_runtime;
GRANT INSERT
  (family_id, from_member_id, to_member_id, type, subtype, start_date, end_date)
  ON relationships TO family_runtime;
GRANT UPDATE (subtype, start_date, end_date, removed_at, version, updated_at)
  ON relationships TO family_runtime;
GRANT INSERT
  (family_id, actor_membership_id, type, target_id, base_version, proposed_payload)
  ON change_requests TO family_runtime;
GRANT UPDATE (status, reviewer_id, decision_note, decided_at, version, updated_at)
  ON change_requests TO family_runtime;
