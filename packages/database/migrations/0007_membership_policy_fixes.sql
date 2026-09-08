-- Tighten the additive onboarding policies without changing immutable 0006.

CREATE OR REPLACE FUNCTION public.actor_active_membership(p_family_id uuid, p_membership_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_memberships m
    WHERE m.family_id = p_family_id AND m.id = p_membership_id
      AND m.user_id = public.actor_uuid() AND m.status = 'active'
  )
$$;
ALTER FUNCTION public.actor_active_membership(uuid, uuid) OWNER TO family_membership_lookup;
REVOKE ALL ON FUNCTION public.actor_active_membership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_active_membership(uuid, uuid) TO family_runtime;

CREATE OR REPLACE FUNCTION public.actor_confirm_claim(
  p_claim_id uuid,
  p_membership_id uuid,
  p_member_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT current_setting('app.purpose', true) = 'claim_confirm'
    AND NULLIF(current_setting('app.claim_id', true), '')::uuid = p_claim_id
    AND EXISTS (
      SELECT 1
      FROM public.member_claims c
      JOIN public.family_memberships m ON m.family_id = c.family_id AND m.id = c.membership_id
      JOIN public.members target ON target.family_id = c.family_id AND target.id = c.member_id
      WHERE c.id = p_claim_id AND c.membership_id = p_membership_id AND c.member_id = p_member_id
        AND c.status = 'active' AND c.expires_at > clock_timestamp()
        AND c.member_version = target.version
        AND m.user_id = public.actor_uuid() AND m.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.member_account_links l
          WHERE l.family_id = c.family_id AND l.member_id = c.member_id
        )
    )
$$;
ALTER FUNCTION public.actor_confirm_claim(uuid, uuid, uuid) OWNER TO family_membership_lookup;
REVOKE ALL ON FUNCTION public.actor_confirm_claim(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_confirm_claim(uuid, uuid, uuid) TO family_runtime;
REVOKE EXECUTE ON FUNCTION public.actor_confirm_claim(uuid, uuid) FROM family_runtime;

DROP POLICY IF EXISTS tenant_runtime_links_insert ON member_account_links;
CREATE POLICY tenant_runtime_links_insert ON member_account_links FOR INSERT TO family_runtime
  WITH CHECK (
    public.actor_confirm_claim(
      NULLIF(current_setting('app.claim_id', true), '')::uuid,
      membership_id,
      member_id
    )
  );

DROP POLICY IF EXISTS tenant_runtime_claims ON member_claims;
DROP POLICY IF EXISTS tenant_runtime_claim_insert ON member_claims;
DROP POLICY IF EXISTS tenant_runtime_claim_update ON member_claims;
CREATE POLICY tenant_runtime_claims ON member_claims FOR SELECT TO family_runtime
  USING (
    public.actor_active_admin(family_id)
    OR (
      status IN ('active', 'consumed', 'declined') AND expires_at > clock_timestamp()
      AND public.actor_active_membership(family_id, membership_id)
      AND member_version = (
        SELECT target.version FROM public.members target
        WHERE target.family_id = member_claims.family_id AND target.id = member_claims.member_id
      )
    )
  );
CREATE POLICY tenant_runtime_claim_insert ON member_claims FOR INSERT TO family_runtime
  WITH CHECK (
    public.actor_active_admin(family_id)
    AND created_by IN (
      SELECT m.id FROM public.family_memberships m
      WHERE m.family_id = member_claims.family_id AND m.user_id = public.actor_uuid()
        AND m.role = 'admin' AND m.status = 'active'
    )
    AND expires_at > clock_timestamp()
    AND member_version = (
      SELECT target.version FROM public.members target
      WHERE target.family_id = member_claims.family_id AND target.id = member_claims.member_id
    )
    AND EXISTS (
      SELECT 1 FROM public.family_memberships candidate
      WHERE candidate.family_id = member_claims.family_id AND candidate.id = member_claims.membership_id
        AND candidate.status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.member_account_links l
      WHERE l.family_id = member_claims.family_id AND l.member_id = member_claims.member_id
    )
  );
CREATE POLICY tenant_runtime_claim_update ON member_claims FOR UPDATE TO family_runtime
  USING (
    public.actor_active_admin(family_id)
    OR (
      status = 'active' AND expires_at > clock_timestamp()
      AND public.actor_active_membership(family_id, membership_id)
      AND member_version = (
        SELECT target.version FROM public.members target
        WHERE target.family_id = member_claims.family_id AND target.id = member_claims.member_id
      )
    )
  )
  WITH CHECK (
    public.actor_active_admin(family_id)
    OR (
      public.actor_active_membership(family_id, membership_id)
      AND member_version = (
        SELECT target.version FROM public.members target
        WHERE target.family_id = member_claims.family_id AND target.id = member_claims.member_id
      )
    )
  );

DROP POLICY IF EXISTS tenant_runtime_invitation_select ON invitations;
CREATE POLICY tenant_runtime_invitation_select ON invitations FOR SELECT TO family_runtime
  USING (public.actor_active_admin(family_id));
GRANT SELECT (
  id, family_id, intended_member_id, expires_at, consumed_by, consumed_at,
  revoked_at, created_by, created_at, version
) ON invitations TO family_runtime;
GRANT SELECT ON audit_entries TO family_runtime;
