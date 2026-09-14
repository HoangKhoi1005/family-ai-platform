-- Soft-delete parent records through actor-aware helpers so RLS never has to
-- expose deleted rows to the runtime role.

REVOKE UPDATE (deleted_at) ON moments, memories FROM family_runtime;
GRANT UPDATE (deleted_at, version) ON moments TO family_media_worker;
GRANT UPDATE (deleted_at, version, updated_at) ON memories TO family_media_worker;

CREATE FUNCTION public.actor_delete_moment(
  p_family_id uuid,
  p_moment_id uuid
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE candidate public.moments%ROWTYPE;
BEGIN
  IF current_setting('app.purpose', true) <> 'moments_write' THEN
    RETURN false;
  END IF;
  SELECT * INTO candidate FROM public.moments moment
   WHERE moment.family_id = p_family_id AND moment.id = p_moment_id
     AND (
       public.actor_active_membership(moment.family_id, moment.author_membership_id)
       OR public.actor_active_admin(moment.family_id)
     )
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF candidate.deleted_at IS NOT NULL THEN RETURN true; END IF;

  UPDATE public.moments
     SET deleted_at = now(), version = version + 1
   WHERE family_id = p_family_id AND id = p_moment_id;
  PERFORM public.actor_enqueue_media_delete(p_family_id, candidate.media_id);
  RETURN true;
END
$$;

CREATE FUNCTION public.actor_delete_memory(
  p_family_id uuid,
  p_memory_id uuid
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE candidate public.memories%ROWTYPE;
DECLARE item record;
BEGIN
  IF current_setting('app.purpose', true) <> 'memories_write' THEN
    RETURN false;
  END IF;
  SELECT * INTO candidate FROM public.memories memory
   WHERE memory.family_id = p_family_id AND memory.id = p_memory_id
     AND (
       public.actor_active_membership(memory.family_id, memory.created_by_membership_id)
       OR public.actor_active_admin(memory.family_id)
     )
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF candidate.deleted_at IS NOT NULL THEN RETURN true; END IF;

  UPDATE public.memories
     SET deleted_at = now(), version = version + 1, updated_at = now()
   WHERE family_id = p_family_id AND id = p_memory_id;
  FOR item IN
    SELECT DISTINCT media_id FROM public.memory_items
     WHERE family_id = p_family_id AND memory_id = p_memory_id AND media_id IS NOT NULL
  LOOP
    PERFORM public.actor_enqueue_media_delete(p_family_id, item.media_id);
  END LOOP;
  RETURN true;
END
$$;

ALTER FUNCTION public.actor_delete_moment(uuid, uuid) OWNER TO family_media_worker;
ALTER FUNCTION public.actor_delete_memory(uuid, uuid) OWNER TO family_media_worker;
REVOKE ALL ON FUNCTION public.actor_delete_moment(uuid, uuid),
  public.actor_delete_memory(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_delete_moment(uuid, uuid),
  public.actor_delete_memory(uuid, uuid) TO family_runtime;
