import type { Pool } from 'pg';

export type ApplicationRole = 'family_auth' | 'family_runtime';

const TENANT_TABLES = [
  'family_spaces',
  'family_memberships',
  'members',
  'member_account_links',
  'member_contacts',
];
const AUTH_TABLES = ['auth_sessions', 'auth_accounts', 'auth_verifications', 'auth_rate_limits'];
const TABLE_PRIVILEGES = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
];
const COLUMN_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'];
const USERS_TABLE_PRIVILEGES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];

export async function assertSafeApplicationRole(
  pool: Pool,
  expectedRole: ApplicationRole,
): Promise<void> {
  const roleResult = await pool.query<{
    current_user: string;
    rolcanlogin: boolean;
    rolsuper: boolean;
    rolbypassrls: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolinherit: boolean;
    rolreplication: boolean;
  }>(
    `SELECT current_user,
            r.rolcanlogin, r.rolsuper, r.rolbypassrls,
            r.rolcreatedb, r.rolcreaterole, r.rolinherit, r.rolreplication
       FROM pg_roles r
      WHERE r.rolname = current_user`,
  );
  const role = roleResult.rows[0];
  if (!role || role.current_user !== expectedRole) {
    throw new Error(`${expectedRole} connection must use the restricted role`);
  }
  if (
    !role.rolcanlogin ||
    role.rolsuper ||
    role.rolbypassrls ||
    role.rolcreatedb ||
    role.rolcreaterole ||
    role.rolinherit ||
    role.rolreplication
  ) {
    throw new Error(`${expectedRole} connection has unsafe role attributes`);
  }

  const ownership = await pool.query(
    `SELECT r.rolname AS owner
       FROM pg_shdepend d
       JOIN pg_roles r ON r.oid = d.refobjid
      WHERE d.refclassid = 'pg_authid'::regclass
        AND d.deptype = 'o'
        AND r.rolname = current_user
      LIMIT 1`,
  );
  if (ownership.rowCount) {
    throw new Error(`${expectedRole} connection must not own application objects`);
  }

  const membership = await pool.query(
    `SELECT 1
       FROM pg_auth_members m
       JOIN pg_roles member ON member.oid = m.member
       JOIN pg_roles granted ON granted.oid = m.roleid
      WHERE member.rolname = current_user OR granted.rolname = current_user
      LIMIT 1`,
  );
  if (membership.rowCount) throw new Error(`${expectedRole} connection has role membership`);

  const schemaCreate = await pool.query(
    `SELECT 1
       FROM pg_roles
      WHERE rolname = current_user
        AND has_schema_privilege(current_user, 'public', 'CREATE')`,
  );
  if (schemaCreate.rowCount) {
    throw new Error(`${expectedRole} connection can create objects in the public schema`);
  }

  const forbiddenTables = expectedRole === 'family_auth' ? TENANT_TABLES : AUTH_TABLES;
  const privileges =
    expectedRole === 'family_auth'
      ? await pool.query(
          `SELECT c.relname AS table_name, p.privilege_type
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             CROSS JOIN unnest($1::text[]) AS p(privilege_type)
            WHERE n.nspname = 'public'
              AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
              AND c.relname <> ALL($2::text[])
              AND (
                has_table_privilege(
                  current_user, format('public.%I', c.relname), p.privilege_type
                )
                OR (
                  p.privilege_type = ANY($3::text[])
                  AND has_any_column_privilege(
                    current_user, format('public.%I', c.relname), p.privilege_type
                  )
                )
              )
            LIMIT 1`,
          [TABLE_PRIVILEGES, ['users', ...AUTH_TABLES], COLUMN_PRIVILEGES],
        )
      : await pool.query(
          `SELECT table_name, privilege_type
             FROM unnest($1::text[]) AS tables(table_name)
             CROSS JOIN unnest($2::text[]) AS privileges(privilege_type)
            WHERE has_table_privilege(
              current_user, format('public.%I', table_name), privilege_type
            )
               OR (
                 privilege_type = ANY($3::text[])
                 AND has_any_column_privilege(
                   current_user, format('public.%I', table_name), privilege_type
                 )
               )
            LIMIT 1`,
          [forbiddenTables, TABLE_PRIVILEGES, COLUMN_PRIVILEGES],
        );
  if (privileges.rowCount) {
    const row = privileges.rows[0] as { table_name: string; privilege_type: string };
    throw new Error(
      `${expectedRole} connection has forbidden ${row.privilege_type} on ${row.table_name}`,
    );
  }

  if (expectedRole === 'family_runtime') {
    const userPrivileges = await pool.query(
      `SELECT a.attname AS column_name,
              has_column_privilege(current_user, 'public.users', a.attname, 'SELECT') AS can_select,
              has_column_privilege(current_user, 'public.users', a.attname, 'INSERT') AS can_insert,
              has_column_privilege(current_user, 'public.users', a.attname, 'UPDATE') AS can_update,
              has_column_privilege(current_user, 'public.users', a.attname, 'REFERENCES') AS can_reference
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'users'
          AND a.attnum > 0
          AND NOT a.attisdropped`,
    );
    for (const row of userPrivileges.rows as Array<{
      column_name: string;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_reference: boolean;
    }>) {
      const hasPrivilege = row.can_select || row.can_insert || row.can_update || row.can_reference;
      if (!hasPrivilege) continue;
      if (row.column_name !== 'id' && row.column_name !== 'name') {
        throw new Error(
          `${expectedRole} connection has forbidden privilege on users.${row.column_name}`,
        );
      }
      if (row.can_insert || row.can_update || row.can_reference || !row.can_select) {
        throw new Error(
          `${expectedRole} connection has unsafe privilege on users.${row.column_name}`,
        );
      }
    }

    const usersTablePrivilege = await pool.query(
      `SELECT privilege_type
         FROM unnest($1::text[]) AS privileges(privilege_type)
        WHERE has_table_privilege('family_runtime', 'public.users', privilege_type)
        LIMIT 1`,
      [USERS_TABLE_PRIVILEGES],
    );
    if (usersTablePrivilege.rowCount) {
      throw new Error(`family_runtime connection has unsafe table privilege on users`);
    }
  }
}

export async function assertSafeApplicationRoles(authPool: Pool, runtimePool: Pool): Promise<void> {
  await assertSafeApplicationRole(authPool, 'family_auth');
  await assertSafeApplicationRole(runtimePool, 'family_runtime');
}
