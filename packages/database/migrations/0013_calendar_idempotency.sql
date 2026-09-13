-- Durable create-event retry keys. The request hash prevents accidental key reuse.

CREATE TABLE event_idempotency_keys (
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  actor_membership_id uuid NOT NULL,
  idempotency_key varchar(128) NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  event_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, actor_membership_id, idempotency_key),
  FOREIGN KEY (family_id, actor_membership_id)
    REFERENCES family_memberships(family_id, id),
  FOREIGN KEY (family_id, event_id) REFERENCES events(family_id, id)
);

CREATE INDEX event_idempotency_keys_created
  ON event_idempotency_keys(family_id, created_at);

ALTER TABLE event_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_idempotency_keys FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_runtime_event_keys_select
  ON event_idempotency_keys FOR SELECT TO family_runtime
  USING (
    EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = event_idempotency_keys.family_id
         AND membership.id = event_idempotency_keys.actor_membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );

CREATE POLICY tenant_runtime_event_keys_insert
  ON event_idempotency_keys FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'calendar_write'
    AND EXISTS (
      SELECT 1
        FROM family_memberships membership
       WHERE membership.family_id = event_idempotency_keys.family_id
         AND membership.id = event_idempotency_keys.actor_membership_id
         AND membership.user_id = public.actor_uuid()
         AND membership.status = 'active'
    )
  );

REVOKE ALL ON event_idempotency_keys FROM PUBLIC, family_auth;
GRANT SELECT ON event_idempotency_keys TO family_runtime;
GRANT INSERT (family_id, actor_membership_id, idempotency_key, request_hash, event_id)
  ON event_idempotency_keys TO family_runtime;
