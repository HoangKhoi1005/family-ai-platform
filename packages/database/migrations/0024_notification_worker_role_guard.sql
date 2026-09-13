-- Refuse inherited or object-owning worker roles beyond the intended helper functions.

DO $$
DECLARE
  unsafe text;
BEGIN
  SELECT format('worker role membership %s -> %s', member.rolname, granted.rolname)
    INTO unsafe
    FROM pg_auth_members membership
    JOIN pg_roles member ON member.oid = membership.member
    JOIN pg_roles granted ON granted.oid = membership.roleid
   WHERE member.rolname = ANY (ARRAY['family_worker', 'family_notification_worker'])
      OR granted.rolname = ANY (ARRAY['family_worker', 'family_notification_worker'])
   LIMIT 1;
  IF unsafe IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe worker role membership: %', unsafe;
  END IF;

  SELECT format('worker login owns object: %s', role.rolname)
    INTO unsafe
    FROM pg_shdepend dependency
    JOIN pg_roles role ON role.oid = dependency.refobjid
   WHERE dependency.refclassid = 'pg_authid'::regclass
     AND dependency.deptype = 'o'
     AND role.rolname = 'family_worker'
   LIMIT 1;
  IF unsafe IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe worker login ownership: %', unsafe;
  END IF;

  SELECT format('worker helper owns unexpected object: %s', dependency.objid)
    INTO unsafe
    FROM pg_shdepend dependency
    JOIN pg_roles role ON role.oid = dependency.refobjid
   WHERE dependency.refclassid = 'pg_authid'::regclass
     AND dependency.deptype = 'o'
     AND role.rolname = 'family_notification_worker'
     AND NOT (
       dependency.classid = 'pg_proc'::regclass
       AND dependency.objid IN (
         SELECT procedure.oid
           FROM pg_proc procedure
           JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
          WHERE namespace.nspname = 'public'
            AND procedure.proname = ANY (ARRAY[
              'worker_claim_notification_jobs',
              'worker_deliver_in_app_job',
              'worker_fail_notification_job',
              'worker_notification_job_is_deliverable'
            ])
       )
     )
   LIMIT 1;
  IF unsafe IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe worker helper ownership: %', unsafe;
  END IF;
END
$$;
