-- Additive hardening for pre-existing application roles. This migration fails
-- closed instead of changing memberships, ownership, or privileges in place.
DO $$
DECLARE
  bad text;
BEGIN
  SELECT rolname
    INTO bad
    FROM pg_roles
   WHERE rolname = ANY (ARRAY['family_auth', 'family_runtime'])
     AND (
       NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR
       rolcreaterole OR rolinherit OR rolreplication
     )
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe application role attributes: %', bad;
  END IF;

  SELECT format('role membership %s -> %s', member.rolname, granted.rolname)
    INTO bad
    FROM pg_auth_members m
    JOIN pg_roles member ON member.oid = m.member
    JOIN pg_roles granted ON granted.oid = m.roleid
   WHERE member.rolname = ANY (ARRAY['family_auth', 'family_runtime'])
      OR granted.rolname = ANY (ARRAY['family_auth', 'family_runtime'])
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe application role membership: %', bad;
  END IF;

  SELECT format('database object owned by %s', r.rolname)
    INTO bad
    FROM pg_shdepend d
    JOIN pg_roles r ON r.oid = d.refobjid
   WHERE d.refclassid = 'pg_authid'::regclass
     AND d.deptype = 'o'
     AND r.rolname = ANY (ARRAY['family_auth', 'family_runtime'])
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Application role owns DDL object: %', bad;
  END IF;

  SELECT rolname
    INTO bad
    FROM pg_roles
   WHERE rolname = ANY (ARRAY['family_auth', 'family_runtime'])
     AND has_schema_privilege(rolname, 'public', 'CREATE')
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Application role has public schema CREATE privilege: %', bad;
  END IF;

  SELECT format('family_auth %s on tenant table %s', privilege_type, table_name)
    INTO bad
    FROM (
      SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
         AND c.relname NOT IN (
           'users', 'auth_sessions', 'auth_accounts',
           'auth_verifications', 'auth_rate_limits'
         )
    ) AS tables
    CROSS JOIN unnest(ARRAY[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE',
      'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ]) AS privileges(privilege_type)
   WHERE has_table_privilege(
     'family_auth', format('public.%I', table_name), privilege_type
   )
   OR (
     privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
     AND has_any_column_privilege(
       'family_auth', format('public.%I', table_name), privilege_type
     )
   )
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Auth role has tenant privilege: %', bad;
  END IF;

  SELECT format('family_runtime %s on auth table %s', privilege_type, table_name)
    INTO bad
    FROM unnest(ARRAY[
      'auth_sessions', 'auth_accounts', 'auth_verifications', 'auth_rate_limits'
    ]) AS tables(table_name)
    CROSS JOIN unnest(ARRAY[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE',
      'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ]) AS privileges(privilege_type)
   WHERE has_table_privilege(
     'family_runtime', format('public.%I', table_name), privilege_type
   )
   OR (
     privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
     AND has_any_column_privilege(
       'family_runtime', format('public.%I', table_name), privilege_type
     )
   )
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Runtime role has auth privilege: %', bad;
  END IF;

  SELECT format('family_runtime privilege on users.%s', a.attname)
    INTO bad
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'users'
     AND a.attnum > 0 AND NOT a.attisdropped
     AND (
       (
         a.attname NOT IN ('id', 'name') AND (
           has_column_privilege('family_runtime', 'public.users', a.attname, 'SELECT') OR
           has_column_privilege('family_runtime', 'public.users', a.attname, 'INSERT') OR
           has_column_privilege('family_runtime', 'public.users', a.attname, 'UPDATE') OR
           has_column_privilege('family_runtime', 'public.users', a.attname, 'REFERENCES')
         )
       ) OR (
         a.attname IN ('id', 'name') AND (
           has_column_privilege('family_runtime', 'public.users', a.attname, 'INSERT') OR
           has_column_privilege('family_runtime', 'public.users', a.attname, 'UPDATE') OR
           has_column_privilege('family_runtime', 'public.users', a.attname, 'REFERENCES')
         )
       )
     )
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Runtime role has unsafe users privilege: %', bad;
  END IF;

  SELECT format('family_runtime %s on users', privilege_type)
    INTO bad
    FROM unnest(ARRAY[
      'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ]) AS privileges(privilege_type)
   WHERE has_table_privilege('family_runtime', 'public.users', privilege_type)
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Runtime role has unsafe users table privilege: %', bad;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO family_auth, family_runtime;
