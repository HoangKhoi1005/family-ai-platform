import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import pg from 'pg';

export const ROLE_NAMES = ['family_auth', 'family_runtime'];
export const TENANT_TABLES = [
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
const ROLE_URLS = [
  ['family_auth', process.env.AUTH_DATABASE_URL],
  ['family_runtime', process.env.RUNTIME_DATABASE_URL],
];
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function parseLocalDatabaseUrl(name, value, expectedUser) {
  if (!value) throw new Error(`${name} is required`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use the PostgreSQL protocol`);
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`${name} must point to a loopback host in APP_ENV=local`);
  }
  if (!parsed.username || !parsed.pathname || parsed.pathname === '/') {
    throw new Error(`${name} must include a role username and database`);
  }
  let user;
  let database;
  let password;
  try {
    user = decodeURIComponent(parsed.username);
    database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
  } catch {
    throw new Error(`${name} contains an invalid encoded password`);
  }
  if (expectedUser && user !== expectedUser) {
    throw new Error(`${name} must use the ${expectedUser} role`);
  }
  if (!password) throw new Error(`${name} must include a role password`);
  return {
    user,
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || '5432',
    database,
    password,
  };
}

export function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export async function assertSafeApplicationRoles(client) {
  const roles = await client.query(
    `SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb,
            rolcreaterole, rolinherit, rolreplication
       FROM pg_roles
      WHERE rolname = ANY($1::text[])
      ORDER BY rolname`,
    [ROLE_NAMES],
  );
  if (roles.rowCount !== ROLE_NAMES.length) {
    throw new Error('Both auth roles must exist; run db:migrate first');
  }
  for (const role of roles.rows) {
    if (
      !role.rolcanlogin ||
      role.rolsuper ||
      role.rolbypassrls ||
      role.rolcreatedb ||
      role.rolcreaterole ||
      role.rolinherit ||
      role.rolreplication
    ) {
      throw new Error(`Refusing to provision elevated or unsafe role ${role.rolname}`);
    }
  }

  const membership = await client.query(
    `SELECT member.rolname AS member, granted.rolname AS granted_role
       FROM pg_auth_members m
       JOIN pg_roles member ON member.oid = m.member
       JOIN pg_roles granted ON granted.oid = m.roleid
      WHERE member.rolname = ANY($1::text[])
         OR granted.rolname = ANY($1::text[])
      LIMIT 1`,
    [ROLE_NAMES],
  );
  if (membership.rowCount) {
    throw new Error(
      `Refusing application role membership ${membership.rows[0].member}->${membership.rows[0].granted_role}`,
    );
  }

  const ownership = await client.query(
    `SELECT r.rolname AS owner
       FROM pg_shdepend d
       JOIN pg_roles r ON r.oid = d.refobjid
      WHERE d.refclassid = 'pg_authid'::regclass
        AND d.deptype = 'o'
        AND r.rolname = ANY($1::text[])
      LIMIT 1`,
    [ROLE_NAMES],
  );
  if (ownership.rowCount) {
    throw new Error(
      `Refusing application role ownership of a database object by ${ownership.rows[0].owner}`,
    );
  }

  const schemaCreate = await client.query(
    `SELECT rolname
       FROM pg_roles
      WHERE rolname = ANY($1::text[])
        AND has_schema_privilege(rolname, 'public', 'CREATE')`,
    [ROLE_NAMES],
  );
  if (schemaCreate.rowCount) {
    throw new Error(
      `Refusing DDL-capable public schema privilege for ${schemaCreate.rows[0].rolname}`,
    );
  }

  const authTenantPrivilege = await client.query(
    `SELECT 'family_auth' AS role_name, c.relname AS table_name, p.privilege_type
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN unnest($1::text[]) AS p(privilege_type)
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND c.relname <> ALL($2::text[])
        AND (
          has_table_privilege(
            'family_auth', format('public.%I', c.relname), p.privilege_type
          )
          OR (
            p.privilege_type = ANY($3::text[])
            AND has_any_column_privilege(
              'family_auth', format('public.%I', c.relname), p.privilege_type
            )
          )
        )
      LIMIT 1`,
    [TABLE_PRIVILEGES, ['users', ...AUTH_TABLES], COLUMN_PRIVILEGES],
  );
  if (authTenantPrivilege.rowCount) {
    const row = authTenantPrivilege.rows[0];
    throw new Error(`Refusing family_auth ${row.privilege_type} on tenant table ${row.table_name}`);
  }

  const runtimeAuthPrivilege = await client.query(
    `SELECT table_name, privilege_type
       FROM unnest($1::text[]) AS tables(table_name)
       CROSS JOIN unnest($2::text[]) AS privileges(privilege_type)
       WHERE has_table_privilege(
        'family_runtime', format('public.%I', table_name), privilege_type
      )
       OR (
         privilege_type = ANY($3::text[])
         AND has_any_column_privilege(
           'family_runtime', format('public.%I', table_name), privilege_type
         )
       )
      LIMIT 1`,
    [AUTH_TABLES, TABLE_PRIVILEGES, COLUMN_PRIVILEGES],
  );
  if (runtimeAuthPrivilege.rowCount) {
    const row = runtimeAuthPrivilege.rows[0];
    throw new Error(
      `Refusing family_runtime ${row.privilege_type} on auth table ${row.table_name}`,
    );
  }

  const runtimeUserPrivileges = await client.query(
    `SELECT a.attname AS column_name,
            has_column_privilege('family_runtime', 'public.users', a.attname, 'SELECT') AS can_select,
            has_column_privilege('family_runtime', 'public.users', a.attname, 'INSERT') AS can_insert,
            has_column_privilege('family_runtime', 'public.users', a.attname, 'UPDATE') AS can_update,
            has_column_privilege('family_runtime', 'public.users', a.attname, 'REFERENCES') AS can_reference
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'users'
        AND a.attnum > 0
        AND NOT a.attisdropped`,
  );
  for (const row of runtimeUserPrivileges.rows) {
    const hasPrivilege = row.can_select || row.can_insert || row.can_update || row.can_reference;
    if (!hasPrivilege) continue;
    if (row.column_name !== 'id' && row.column_name !== 'name') {
      throw new Error(`Refusing family_runtime privilege on users.${row.column_name}`);
    }
    if (row.can_insert || row.can_update || row.can_reference) {
      throw new Error(`Refusing non-SELECT family_runtime privilege on users.${row.column_name}`);
    }
  }

  const runtimeUsersTablePrivilege = await client.query(
    `SELECT privilege_type
       FROM unnest($1::text[]) AS privileges(privilege_type)
      WHERE has_table_privilege('family_runtime', 'public.users', privilege_type)
      LIMIT 1`,
    [USERS_TABLE_PRIVILEGES],
  );
  if (runtimeUsersTablePrivilege.rowCount) {
    throw new Error(
      `Refusing family_runtime ${runtimeUsersTablePrivilege.rows[0].privilege_type} on users table`,
    );
  }
}

async function provision() {
  if (process.env.APP_ENV !== 'local') {
    throw new Error('APP_ENV=local is required for local auth role provisioning');
  }

  const ownerUrl = process.env.DATABASE_URL;
  const owner = parseLocalDatabaseUrl('DATABASE_URL', ownerUrl);
  const passwords = ROLE_URLS.map(([role, value]) => {
    const name = role === 'family_auth' ? 'AUTH_DATABASE_URL' : 'RUNTIME_DATABASE_URL';
    const target = parseLocalDatabaseUrl(name, value, role);
    if (
      target.host !== owner.host ||
      target.port !== owner.port ||
      target.database !== owner.database
    ) {
      throw new Error(`${name} must target the same local database as DATABASE_URL`);
    }
    return [role, target.password];
  });

  const client = new pg.Client({
    connectionString: ownerUrl,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  let inTransaction = false;
  try {
    await assertSafeApplicationRoles(client);

    await client.query('BEGIN');
    inTransaction = true;
    for (const [role, password] of passwords) {
      const literal = (await client.query('SELECT quote_literal($1::text) AS value', [password]))
        .rows[0].value;
      await client.query(`ALTER ROLE ${quoteIdentifier(role)} PASSWORD ${literal}`);
    }
    await client.query('COMMIT');
    inTransaction = false;
    console.log('Provisioned local passwords for family_auth and family_runtime.');
  } finally {
    if (inTransaction) await client.query('ROLLBACK');
    await client.end();
  }
}

try {
  if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    await provision();
  }
} catch (error) {
  console.error(
    `Auth role provisioning failed: ${error instanceof Error ? error.message : 'unknown error'}`,
  );
  process.exitCode = 1;
}
