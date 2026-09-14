-- Keep media lifecycle transitions behind a narrowly scoped, actor-aware helper.

REVOKE INSERT (status) ON media_assets FROM family_runtime;
REVOKE UPDATE (status, version, updated_at) ON media_assets FROM family_runtime;
REVOKE INSERT ON media_processing_jobs FROM family_runtime;

GRANT UPDATE (status, version, updated_at) ON media_assets TO family_membership_lookup;
GRANT INSERT (family_id, media_id, kind) ON media_processing_jobs TO family_membership_lookup;

CREATE FUNCTION public.actor_complete_media_upload(
  p_family_id uuid,
  p_media_id uuid
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_setting('app.purpose', true) <> 'media_write' THEN
    RETURN false;
  END IF;

  UPDATE public.media_assets asset
     SET status = 'processing', version = version + 1, updated_at = now()
   WHERE asset.family_id = p_family_id
     AND asset.id = p_media_id
     AND asset.status = 'pending'
     AND (
       public.actor_active_membership(asset.family_id, asset.owner_membership_id)
       OR public.actor_active_admin(asset.family_id)
     );

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.media_processing_jobs(family_id, media_id, kind)
  VALUES (p_family_id, p_media_id, 'process')
  ON CONFLICT (family_id, media_id, kind) DO NOTHING;

  RETURN true;
END
$$;

ALTER FUNCTION public.actor_complete_media_upload(uuid, uuid)
  OWNER TO family_membership_lookup;
REVOKE ALL ON FUNCTION public.actor_complete_media_upload(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_complete_media_upload(uuid, uuid) TO family_runtime;
