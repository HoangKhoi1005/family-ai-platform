-- Cancel delivery jobs through a narrow helper; runtime never receives outbox read access.

DROP POLICY tenant_runtime_outbox_cancel ON outbox_jobs;
REVOKE UPDATE ON outbox_jobs FROM family_runtime;

GRANT SELECT ON outbox_jobs TO family_membership_lookup;
GRANT UPDATE (status, lease_owner, lease_expires_at, cancelled_at, updated_at)
  ON outbox_jobs TO family_membership_lookup;

CREATE FUNCTION public.actor_cancel_event_outbox_jobs(
  p_family_id uuid,
  p_event_id uuid,
  p_keep_revision integer
)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  affected integer;
BEGIN
  IF current_setting('app.purpose', true) <> 'calendar_write' THEN
    RAISE insufficient_privilege USING MESSAGE = 'calendar_write context is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.events event
     WHERE event.family_id = p_family_id
       AND event.id = p_event_id
       AND (
         public.actor_active_admin(event.family_id)
         OR EXISTS (
           SELECT 1 FROM public.family_memberships creator
            WHERE creator.family_id = event.family_id
              AND creator.id = event.creator_membership_id
              AND creator.user_id = public.actor_uuid()
              AND creator.status = 'active'
         )
       )
  ) THEN
    RAISE insufficient_privilege USING MESSAGE = 'event outbox cannot be managed';
  END IF;

  UPDATE public.outbox_jobs job
     SET status = 'cancelled',
         lease_owner = NULL,
         lease_expires_at = NULL,
         cancelled_at = clock_timestamp(),
         updated_at = clock_timestamp()
   WHERE job.family_id = p_family_id
     AND job.event_id = p_event_id
     AND job.status IN ('pending', 'leased')
     AND (p_keep_revision IS NULL OR job.event_revision <> p_keep_revision);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END
$$;

ALTER FUNCTION public.actor_cancel_event_outbox_jobs(uuid, uuid, integer)
  OWNER TO family_membership_lookup;
REVOKE ALL ON FUNCTION public.actor_cancel_event_outbox_jobs(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actor_cancel_event_outbox_jobs(uuid, uuid, integer)
  TO family_runtime;
