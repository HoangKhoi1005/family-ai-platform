-- Expose only actor-bound claim state needed to report stale conflicts.
-- It never returns profile or contact values and does not broaden contact RLS.
CREATE OR REPLACE FUNCTION public.actor_claim_metadata(p_claim_id uuid)
RETURNS TABLE(
  id uuid,
  family_id uuid,
  membership_id uuid,
  member_id uuid,
  status text,
  version integer,
  member_version integer,
  target_version integer,
  expires_at timestamptz,
  linked boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT c.id,
         c.family_id,
         c.membership_id,
         c.member_id,
         c.status,
         c.version,
         c.member_version,
         target.version,
         c.expires_at,
         EXISTS (
           SELECT 1
             FROM public.member_account_links l
            WHERE l.family_id = c.family_id AND l.member_id = c.member_id
         )
    FROM public.member_claims c
    JOIN public.family_memberships m
      ON m.family_id = c.family_id AND m.id = c.membership_id
    JOIN public.members target
      ON target.family_id = c.family_id AND target.id = c.member_id
   WHERE c.id = p_claim_id
     AND m.user_id = public.actor_uuid()
     AND m.status = 'active'
$$;
ALTER FUNCTION public.actor_claim_metadata(uuid) OWNER TO family_membership_lookup;
REVOKE ALL ON FUNCTION public.actor_claim_metadata(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_claim_metadata(uuid) TO family_runtime;
