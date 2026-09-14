-- Run the upload transition with the existing media worker boundary. The worker
-- already owns media lifecycle writes; it only gains the two actor predicates
-- needed to authorize this one client-facing transition.

GRANT EXECUTE ON FUNCTION public.actor_active_membership(uuid, uuid),
  public.actor_active_admin(uuid) TO family_media_worker;
GRANT INSERT (family_id, media_id, kind) ON media_processing_jobs TO family_media_worker;

ALTER FUNCTION public.actor_complete_media_upload(uuid, uuid)
  OWNER TO family_media_worker;
REVOKE ALL ON FUNCTION public.actor_complete_media_upload(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_complete_media_upload(uuid, uuid) TO family_runtime;

REVOKE UPDATE (status, version, updated_at) ON media_assets FROM family_membership_lookup;
REVOKE INSERT ON media_processing_jobs FROM family_membership_lookup;
