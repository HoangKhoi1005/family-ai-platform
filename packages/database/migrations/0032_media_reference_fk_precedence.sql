-- Preserve composite foreign-key errors for missing/cross-family media while
-- retaining the row lock and readiness guard for an existing same-family asset.

CREATE OR REPLACE FUNCTION public.guard_media_reference()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE asset public.media_assets%ROWTYPE;
BEGIN
  IF NEW.media_id IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO asset FROM public.media_assets candidate
   WHERE candidate.family_id = NEW.family_id AND candidate.id = NEW.media_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  IF asset.status <> 'ready' THEN
    RAISE check_violation USING MESSAGE = 'referenced media must be ready';
  END IF;

  IF TG_TABLE_NAME = 'moments' THEN
    IF asset.purpose <> 'moment_image' OR asset.owner_membership_id <> NEW.author_membership_id THEN
      RAISE check_violation USING MESSAGE = 'Moment media must be a ready image owned by its author';
    END IF;
  ELSIF NEW.kind = 'audio' AND asset.purpose <> 'memory_audio' THEN
    RAISE check_violation USING MESSAGE = 'audio item must reference memory audio';
  ELSIF NEW.kind = 'image' AND asset.purpose NOT IN ('memory_image', 'moment_image') THEN
    RAISE check_violation USING MESSAGE = 'image item must reference image media';
  END IF;
  RETURN NEW;
END
$$;

ALTER FUNCTION public.guard_media_reference() OWNER TO family_media_worker;
REVOKE ALL ON FUNCTION public.guard_media_reference() FROM PUBLIC;
