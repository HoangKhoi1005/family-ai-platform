-- Membership onboarding and tenant authorization. This migration is additive.

ALTER TABLE family_memberships
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE members
  ADD COLUMN familiar_name varchar(120),
  ADD COLUMN hometown varchar(200),
  ADD COLUMN biography varchar(1000);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'family_membership_lookup') THEN
    CREATE ROLE family_membership_lookup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  ELSE
    ALTER ROLE family_membership_lookup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'family_invitation_acceptor') THEN
    CREATE ROLE family_invitation_acceptor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  ELSE
    ALTER ROLE family_invitation_acceptor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$$;

DO $$
DECLARE
  unsafe text;
BEGIN
  SELECT format('helper role membership %s -> %s', member.rolname, granted.rolname)
    INTO unsafe
    FROM pg_auth_members m
    JOIN pg_roles member ON member.oid = m.member
    JOIN pg_roles granted ON granted.oid = m.roleid
   WHERE member.rolname = ANY (ARRAY['family_membership_lookup', 'family_invitation_acceptor'])
      OR granted.rolname = ANY (ARRAY['family_membership_lookup', 'family_invitation_acceptor'])
   LIMIT 1;
  IF unsafe IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe helper role membership: %', unsafe;
  END IF;

  SELECT format('helper role owns object: %s', r.rolname)
    INTO unsafe
    FROM pg_shdepend d
    JOIN pg_roles r ON r.oid = d.refobjid
   WHERE d.refclassid = 'pg_authid'::regclass
     AND d.deptype = 'o'
     AND r.rolname = ANY (ARRAY['family_membership_lookup', 'family_invitation_acceptor'])
   LIMIT 1;
  IF unsafe IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe helper role ownership: %', unsafe;
  END IF;
END
$$;

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  intended_member_id uuid,
  expires_at timestamptz NOT NULL,
  consumed_by uuid REFERENCES users(id),
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  FOREIGN KEY (family_id, intended_member_id) REFERENCES members(family_id, id),
  FOREIGN KEY (family_id, created_by) REFERENCES family_memberships(family_id, id),
  CHECK ((consumed_by IS NULL) = (consumed_at IS NULL))
);
CREATE INDEX invitations_active_lookup ON invitations(token_hash, expires_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE TABLE member_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  membership_id uuid NOT NULL,
  member_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'declined', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  member_version integer NOT NULL CHECK (member_version > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  FOREIGN KEY (family_id, membership_id) REFERENCES family_memberships(family_id, id),
  FOREIGN KEY (family_id, member_id) REFERENCES members(family_id, id),
  FOREIGN KEY (family_id, created_by) REFERENCES family_memberships(family_id, id)
);
CREATE UNIQUE INDEX member_claims_active_membership ON member_claims(family_id, membership_id)
  WHERE status = 'active';
CREATE UNIQUE INDEX member_claims_active_member ON member_claims(family_id, member_id)
  WHERE status = 'active';

CREATE TABLE audit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  change_summary text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE member_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_claims FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_entries FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.actor_uuid()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ SELECT NULLIF(current_setting('app.actor_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION public.actor_active_member(p_family_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_memberships m
    WHERE m.family_id = p_family_id AND m.user_id = public.actor_uuid() AND m.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.actor_active_admin(p_family_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_memberships m
    WHERE m.family_id = p_family_id AND m.user_id = public.actor_uuid()
      AND m.role = 'admin' AND m.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.actor_linked_member(p_family_id uuid, p_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_account_links l
    JOIN public.family_memberships m ON m.family_id = l.family_id AND m.id = l.membership_id
    WHERE l.family_id = p_family_id AND l.member_id = p_member_id
      AND m.user_id = public.actor_uuid() AND m.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.actor_visible_user(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_user_id = public.actor_uuid() OR EXISTS (
    SELECT 1
    FROM public.family_memberships mine
    JOIN public.family_memberships target ON target.family_id = mine.family_id
    WHERE mine.user_id = public.actor_uuid() AND mine.role = 'admin' AND mine.status = 'active'
      AND target.user_id = p_user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.actor_manage_unlinked_member(p_family_id uuid, p_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT current_setting('app.purpose', true) = 'member_management'
    AND NULLIF(current_setting('app.member_id', true), '')::uuid = p_member_id
    AND public.actor_active_admin(p_family_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.member_account_links l
      WHERE l.family_id = p_family_id AND l.member_id = p_member_id
    )
$$;

CREATE OR REPLACE FUNCTION public.actor_preview_claim(p_claim_id uuid, p_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT current_setting('app.purpose', true) = 'claim_preview'
    AND NULLIF(current_setting('app.claim_id', true), '')::uuid = p_claim_id
    AND EXISTS (
      SELECT 1
      FROM public.member_claims c
      JOIN public.family_memberships m ON m.family_id = c.family_id AND m.id = c.membership_id
      JOIN public.members target ON target.family_id = c.family_id AND target.id = c.member_id
      WHERE c.id = p_claim_id AND c.member_id = p_member_id AND c.status = 'active'
        AND c.expires_at > clock_timestamp() AND c.member_version = target.version
        AND m.user_id = public.actor_uuid() AND m.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.member_account_links l
          WHERE l.family_id = c.family_id AND l.member_id = c.member_id
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.actor_confirm_claim(p_claim_id uuid, p_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT current_setting('app.purpose', true) = 'claim_confirm'
    AND NULLIF(current_setting('app.claim_id', true), '')::uuid = p_claim_id
    AND EXISTS (
      SELECT 1 FROM public.member_claims c
      JOIN public.family_memberships m ON m.family_id = c.family_id AND m.id = c.membership_id
      WHERE c.id = p_claim_id AND c.member_id = p_member_id AND c.status = 'active'
        AND c.expires_at > clock_timestamp() AND m.user_id = public.actor_uuid() AND m.status = 'active'
    )
$$;

ALTER FUNCTION public.actor_uuid() OWNER TO family_membership_lookup;
ALTER FUNCTION public.actor_active_member(uuid) OWNER TO family_membership_lookup;
ALTER FUNCTION public.actor_active_admin(uuid) OWNER TO family_membership_lookup;
ALTER FUNCTION public.actor_linked_member(uuid, uuid) OWNER TO family_membership_lookup;
ALTER FUNCTION public.actor_visible_user(uuid) OWNER TO family_membership_lookup;
ALTER FUNCTION public.actor_manage_unlinked_member(uuid, uuid) OWNER TO family_membership_lookup;
ALTER FUNCTION public.actor_preview_claim(uuid, uuid) OWNER TO family_membership_lookup;
ALTER FUNCTION public.actor_confirm_claim(uuid, uuid) OWNER TO family_membership_lookup;
REVOKE ALL ON FUNCTION public.actor_uuid() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actor_active_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actor_active_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actor_linked_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actor_visible_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actor_manage_unlinked_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actor_preview_claim(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actor_confirm_claim(uuid, uuid) FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO family_membership_lookup;
GRANT SELECT ON family_memberships, member_account_links, member_claims TO family_membership_lookup;
GRANT SELECT (id, family_id, version) ON members TO family_membership_lookup;
GRANT EXECUTE ON FUNCTION public.actor_uuid(), public.actor_active_member(uuid), public.actor_active_admin(uuid),
  public.actor_linked_member(uuid, uuid), public.actor_visible_user(uuid),
  public.actor_manage_unlinked_member(uuid, uuid), public.actor_preview_claim(uuid, uuid),
  public.actor_confirm_claim(uuid, uuid) TO family_runtime;
GRANT EXECUTE ON FUNCTION public.actor_uuid() TO family_invitation_acceptor;

CREATE POLICY tenant_runtime_family_spaces ON family_spaces FOR SELECT TO family_runtime USING (public.actor_active_member(id));
CREATE POLICY tenant_runtime_memberships ON family_memberships FOR SELECT TO family_runtime
  USING (user_id = public.actor_uuid() OR public.actor_active_admin(family_id));
CREATE POLICY tenant_runtime_users ON users FOR SELECT TO family_runtime USING (public.actor_visible_user(id));
CREATE POLICY tenant_runtime_members ON members FOR SELECT TO family_runtime USING (public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_members_insert ON members FOR INSERT TO family_runtime
  WITH CHECK (public.actor_active_admin(family_id));
CREATE POLICY tenant_runtime_members_update ON members FOR UPDATE TO family_runtime
  USING (public.actor_linked_member(family_id, id) OR public.actor_manage_unlinked_member(family_id, id))
  WITH CHECK (public.actor_linked_member(family_id, id) OR public.actor_manage_unlinked_member(family_id, id));
CREATE POLICY tenant_runtime_links ON member_account_links FOR SELECT TO family_runtime USING (public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_links_insert ON member_account_links FOR INSERT TO family_runtime
  WITH CHECK (public.actor_confirm_claim(NULLIF(current_setting('app.claim_id', true), '')::uuid, member_id));
CREATE POLICY tenant_runtime_contacts ON member_contacts FOR SELECT TO family_runtime
  USING (public.actor_active_member(family_id) AND
      (visibility = 'family' OR public.actor_linked_member(family_id, member_id)
      OR public.actor_manage_unlinked_member(family_id, member_id)
      OR public.actor_preview_claim(NULLIF(current_setting('app.claim_id', true), '')::uuid, member_id)));
CREATE POLICY tenant_runtime_contacts_insert ON member_contacts FOR INSERT TO family_runtime
  WITH CHECK (public.actor_linked_member(family_id, member_id) OR public.actor_manage_unlinked_member(family_id, member_id));
CREATE POLICY tenant_runtime_contacts_update ON member_contacts FOR UPDATE TO family_runtime
  USING (public.actor_linked_member(family_id, member_id) OR public.actor_manage_unlinked_member(family_id, member_id))
  WITH CHECK (public.actor_linked_member(family_id, member_id) OR public.actor_manage_unlinked_member(family_id, member_id));
CREATE POLICY tenant_runtime_contacts_delete ON member_contacts FOR DELETE TO family_runtime
  USING (public.actor_linked_member(family_id, member_id) OR public.actor_manage_unlinked_member(family_id, member_id));
CREATE POLICY tenant_runtime_invitation_write ON invitations FOR INSERT TO family_runtime
  WITH CHECK (public.actor_active_admin(family_id) AND created_by IN (
    SELECT id FROM family_memberships WHERE family_id = invitations.family_id AND user_id = public.actor_uuid()
  ));
CREATE POLICY tenant_runtime_invitation_revoke ON invitations FOR UPDATE TO family_runtime
  USING (public.actor_active_admin(family_id)) WITH CHECK (public.actor_active_admin(family_id));
CREATE POLICY tenant_runtime_claims ON member_claims FOR SELECT TO family_runtime
  USING (public.actor_active_admin(family_id) OR EXISTS (
    SELECT 1 FROM family_memberships m WHERE m.id = membership_id AND m.family_id = member_claims.family_id
      AND m.user_id = public.actor_uuid()
  ));
CREATE POLICY tenant_runtime_claim_insert ON member_claims FOR INSERT TO family_runtime
  WITH CHECK (public.actor_active_admin(family_id));
CREATE POLICY tenant_runtime_claim_update ON member_claims FOR UPDATE TO family_runtime
  USING (public.actor_active_admin(family_id) OR EXISTS (
    SELECT 1 FROM family_memberships m WHERE m.id = membership_id AND m.family_id = member_claims.family_id
      AND m.user_id = public.actor_uuid()
  )) WITH CHECK (public.actor_active_admin(family_id) OR EXISTS (
    SELECT 1 FROM family_memberships m WHERE m.id = membership_id AND m.family_id = member_claims.family_id
      AND m.user_id = public.actor_uuid()
  ));
CREATE POLICY tenant_runtime_membership_update ON family_memberships FOR UPDATE TO family_runtime
  USING (public.actor_active_admin(family_id)) WITH CHECK (public.actor_active_admin(family_id));
CREATE POLICY tenant_runtime_audit_insert ON audit_entries FOR INSERT TO family_runtime
  WITH CHECK (actor_id = public.actor_uuid() AND public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_audit_select ON audit_entries FOR SELECT TO family_runtime
  USING (public.actor_active_admin(family_id));

REVOKE ALL ON invitations, member_claims, audit_entries FROM PUBLIC, family_auth;
GRANT SELECT ON family_spaces, family_memberships, members, member_account_links, member_contacts, member_claims TO family_runtime;
GRANT SELECT (id, name) ON users TO family_runtime;
GRANT INSERT (family_id, token_hash, intended_member_id, expires_at, created_by), UPDATE (revoked_at, version)
  ON invitations TO family_runtime;
GRANT INSERT (family_id, membership_id, member_id, expires_at, member_version, created_by), UPDATE (status, version, updated_at)
  ON member_claims TO family_runtime;
GRANT INSERT (family_id, actor_id, action, target_type, target_id, change_summary, version) ON audit_entries TO family_runtime;
GRANT UPDATE (status, version) ON family_memberships TO family_runtime;
GRANT INSERT (family_id, display_name, birth_date, birth_year, deceased, familiar_name, hometown, biography),
  UPDATE (display_name, birth_date, birth_year, deceased, familiar_name, hometown, biography, version, updated_at) ON members TO family_runtime;
GRANT INSERT (family_id, membership_id, member_id) ON member_account_links TO family_runtime;
GRANT INSERT (family_id, member_id, kind, value, visibility), UPDATE (kind, value, visibility), DELETE ON member_contacts TO family_runtime;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token_hash text)
RETURNS TABLE(membership_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := public.actor_uuid();
  v_family uuid;
  v_invitation public.invitations%ROWTYPE;
  v_membership uuid;
BEGIN
  IF v_actor IS NULL OR p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RAISE EXCEPTION 'invitation unavailable' USING ERRCODE = 'P0001';
  END IF;
  SELECT family_id INTO v_family FROM public.invitations
    WHERE token_hash = p_token_hash AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > clock_timestamp()
    LIMIT 1;
  IF v_family IS NULL THEN
    RAISE EXCEPTION 'invitation unavailable' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_family::text));
  SELECT * INTO v_invitation FROM public.invitations WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_invitation.consumed_at IS NOT NULL OR v_invitation.revoked_at IS NOT NULL
     OR v_invitation.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'invitation unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_actor AND email_verified) THEN
    RAISE EXCEPTION 'invitation unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.family_memberships WHERE family_id = v_invitation.family_id AND user_id = v_actor) THEN
    RAISE EXCEPTION 'invitation unavailable' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.family_memberships(family_id, user_id, role, status)
    VALUES (v_invitation.family_id, v_actor, 'member', 'pending') RETURNING id INTO v_membership;
  UPDATE public.invitations SET consumed_by = v_actor, consumed_at = clock_timestamp(), version = version + 1
    WHERE id = v_invitation.id;
  INSERT INTO public.audit_entries(family_id, actor_id, action, target_type, target_id, change_summary)
    VALUES (v_invitation.family_id, v_actor, 'membership.invitation_accepted', 'membership', v_membership, 'pending');
  RETURN QUERY SELECT v_membership, 'pending'::text;
END
$$;
ALTER FUNCTION public.accept_invitation(text) OWNER TO family_invitation_acceptor;
REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO family_invitation_acceptor;
GRANT SELECT (id, email_verified) ON users TO family_invitation_acceptor;
GRANT SELECT, UPDATE ON invitations TO family_invitation_acceptor;
GRANT SELECT, INSERT ON family_memberships TO family_invitation_acceptor;
GRANT INSERT ON audit_entries TO family_invitation_acceptor;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO family_runtime;
