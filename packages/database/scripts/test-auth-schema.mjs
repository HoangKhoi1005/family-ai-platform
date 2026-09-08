import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { assertSafeApplicationRoles } from './provision-auth.mjs';

const ownerUrl = process.env.DATABASE_URL;
if (!ownerUrl) {
  throw new Error('DATABASE_URL is required; run only against a local/test database');
}

const client = new pg.Client({
  connectionString: ownerUrl,
  connectionTimeoutMillis: 5000,
});

await client.connect();
let inTransaction = false;

async function mustFail(sql, params, expectedCode = '42501') {
  await client.query('SAVEPOINT expected_failure');
  let failed = false;
  try {
    await client.query(sql, params);
  } catch (error) {
    failed = true;
    assert.equal(error.code, expectedCode);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_failure');
  }
  assert.ok(failed, 'Expected restricted-role query to fail');
}

try {
  const roles = await client.query(
    "SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolinherit, rolreplication FROM pg_roles WHERE rolname IN ('family_auth','family_runtime') ORDER BY rolname",
  );
  assert.equal(roles.rowCount, 2, 'Both restricted application roles must exist');
  for (const role of roles.rows) {
    assert.deepEqual(
      role,
      {
        rolname: role.rolname,
        rolcanlogin: true,
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolinherit: false,
        rolreplication: false,
      },
      `${role.rolname} has unsafe PostgreSQL role attributes`,
    );
  }

  await client.query('BEGIN');
  inTransaction = true;
  await assert.doesNotReject(
    () => assertSafeApplicationRoles(client),
    'Provisioning guard must accept the clean local role state',
  );
  const [familyA, familyB, legacyUser, memberA, memberB, accountA] = Array.from({ length: 6 }, () =>
    randomUUID(),
  );
  const now = new Date();

  await client.query(
    "INSERT INTO family_spaces(id,name) VALUES ($1,'Synthetic auth schema A'),($2,'Synthetic auth schema B')",
    [familyA, familyB],
  );
  await client.query('INSERT INTO users(id,auth_subject) VALUES ($1,$2)', [
    legacyUser,
    `legacy-${legacyUser}`,
  ]);
  await client.query(
    "INSERT INTO members(id,family_id,display_name) VALUES ($1,$2,'Synthetic visible member A'),($3,$4,'Synthetic hidden member B')",
    [memberA, familyA, memberB, familyB],
  );
  await client.query(
    'INSERT INTO auth_accounts(id,user_id,account_id,provider_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5)',
    [accountA, legacyUser, `synthetic-account-${accountA}`, 'credential', now],
  );

  assert.equal(
    (await client.query('SELECT id FROM members WHERE id = $1', [memberA])).rowCount,
    1,
    'Tenant denial test requires a visible seeded member',
  );
  assert.equal(
    (await client.query('SELECT id FROM auth_accounts WHERE id = $1', [accountA])).rowCount,
    1,
    'Auth denial test requires a visible seeded account',
  );

  const authTables = [
    'users',
    'auth_sessions',
    'auth_accounts',
    'auth_verifications',
    'auth_rate_limits',
  ];
  const tenantTables = [
    'family_spaces',
    'family_memberships',
    'members',
    'member_account_links',
    'member_contacts',
  ];

  const rls = await client.query(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
            pg_get_userbyid(c.relowner) AS owner
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
      ORDER BY c.relname`,
    [authTables],
  );
  assert.equal(rls.rowCount, authTables.length, 'All auth tables must exist');
  for (const table of rls.rows) {
    assert.equal(table.relrowsecurity, true, `${table.relname} must enable RLS`);
    assert.equal(table.relforcerowsecurity, true, `${table.relname} must force RLS`);
    assert.notEqual(table.owner, 'family_auth', `${table.relname} must not be auth owned`);
    assert.notEqual(table.owner, 'family_runtime', `${table.relname} must not be runtime owned`);
  }

  const requiredColumns = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'users' AND column_name IN ('id','auth_subject','name','email','email_verified','image','updated_at'))
          OR (table_name = 'auth_rate_limits' AND column_name IN ('id','key','count','last_request')))
      ORDER BY table_name, column_name`,
  );
  const columnMap = new Map(
    requiredColumns.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]),
  );
  for (const key of [
    'users.id',
    'users.auth_subject',
    'users.name',
    'users.email',
    'users.email_verified',
    'users.image',
    'users.updated_at',
    'auth_rate_limits.id',
    'auth_rate_limits.key',
    'auth_rate_limits.count',
    'auth_rate_limits.last_request',
  ]) {
    assert.ok(columnMap.has(key), `Missing required column ${key}`);
  }
  assert.equal(columnMap.get('users.auth_subject').is_nullable, 'YES');
  assert.equal(columnMap.get('users.name').is_nullable, 'YES');
  assert.equal(columnMap.get('users.email').is_nullable, 'YES');
  assert.equal(columnMap.get('users.email_verified').is_nullable, 'NO');
  assert.equal(columnMap.get('users.updated_at').is_nullable, 'NO');
  assert.equal(columnMap.get('auth_rate_limits.id').data_type, 'uuid');
  assert.equal(columnMap.get('auth_rate_limits.key').data_type, 'text');
  assert.equal(columnMap.get('auth_rate_limits.count').data_type, 'integer');
  assert.equal(columnMap.get('auth_rate_limits.last_request').data_type, 'bigint');

  for (const table of authTables) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      assert.equal(
        (
          await client.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [
            'family_auth',
            table,
            privilege,
          ])
        ).rows[0].allowed,
        true,
        `family_auth must have ${privilege} on ${table}`,
      );
    }
  }
  for (const table of authTables) {
    assert.equal(
      (
        await client.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [
          'family_runtime',
          table,
          'SELECT',
        ])
      ).rows[0].allowed,
      false,
      `family_runtime must not read ${table}`,
    );
  }
  for (const table of tenantTables) {
    assert.equal(
      (
        await client.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [
          'family_runtime',
          table,
          'SELECT',
        ])
      ).rows[0].allowed,
      true,
      `family_runtime must have tenant SELECT on ${table}`,
    );
  }
  for (const table of tenantTables) {
    assert.equal(
      (
        await client.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [
          'family_auth',
          table,
          'SELECT',
        ])
      ).rows[0].allowed,
      false,
      `family_auth must not read tenant table ${table}`,
    );
  }

  for (const role of ['family_auth', 'family_runtime']) {
    assert.equal(
      (await client.query("SELECT has_schema_privilege($1,'public','USAGE') AS allowed", [role]))
        .rows[0].allowed,
      true,
      `${role} must have explicit public schema usage`,
    );
  }

  async function guardMustReject(setup, message, pattern) {
    await client.query('SAVEPOINT auth_guard');
    try {
      await setup();
      await assert.rejects(() => assertSafeApplicationRoles(client), pattern, message);
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT auth_guard');
    }
  }

  const guardRole = `test_guard_${randomUUID().replaceAll('-', '')}`;
  await guardMustReject(
    async () => {
      await client.query(`CREATE ROLE ${guardRole} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
      await client.query(`GRANT ${guardRole} TO family_auth`);
    },
    'Provisioning must reject application-role memberships',
    /membership/,
  );

  const ownedTable = `test_guard_owned_${randomUUID().replaceAll('-', '')}`;
  await guardMustReject(
    async () => {
      await client.query(`CREATE TABLE ${ownedTable}(id integer)`);
      await client.query(`ALTER TABLE ${ownedTable} OWNER TO family_auth`);
    },
    'Provisioning must reject application-role object ownership',
    /ownership|owns DDL object/,
  );

  await guardMustReject(
    () => client.query('GRANT SELECT ON members TO family_auth'),
    'Provisioning must reject auth access to tenant tables',
    /tenant table/,
  );
  await guardMustReject(
    () => client.query('GRANT SELECT ON auth_accounts TO family_runtime'),
    'Provisioning must reject runtime access to auth tables',
    /auth table/,
  );
  await guardMustReject(
    () => client.query('GRANT SELECT (auth_subject) ON users TO family_runtime'),
    'Provisioning must reject runtime access to sensitive user columns',
    /users\.auth_subject/,
  );

  await client.query('SAVEPOINT allowed_runtime_grants');
  try {
    await client.query('GRANT SELECT (id, name) ON users TO family_runtime');
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON members TO family_runtime');
    const helperFunction = `test_guard_helper_${randomUUID().replaceAll('-', '')}`;
    await client.query(
      `CREATE FUNCTION ${helperFunction}() RETURNS integer LANGUAGE sql IMMUTABLE AS 'SELECT 1'`,
    );
    await client.query(`GRANT EXECUTE ON FUNCTION ${helperFunction}() TO family_runtime`);
    await assert.doesNotReject(
      () => assertSafeApplicationRoles(client),
      'Provisioning must allow planned runtime tenant CRUD, helper EXECUTE, and users(id,name) SELECT',
    );
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT allowed_runtime_grants');
  }

  await client.query('SET LOCAL ROLE family_auth');
  await mustFail('SELECT id FROM members WHERE id = $1', [memberA]);
  assert.equal(
    (await client.query('SELECT id,auth_subject,name,email FROM users WHERE id = $1', [legacyUser]))
      .rows[0].auth_subject,
    `legacy-${legacyUser}`,
    'Existing auth_subject identity must remain unchanged',
  );

  const authUser = randomUUID();
  const authSession = randomUUID();
  const authAccount = randomUUID();
  const authVerification = randomUUID();
  const authRateLimit = randomUUID();
  const authEmail = `synthetic-${authUser}@example.invalid`;
  await client.query(
    'INSERT INTO users(id,name,email,email_verified,updated_at) VALUES ($1,$2,$3,$4,$5)',
    [authUser, 'Synthetic auth user', authEmail, false, now],
  );
  await client.query(
    'INSERT INTO auth_sessions(id,user_id,token,expires_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5)',
    [
      authSession,
      authUser,
      `synthetic-session-${authSession}`,
      new Date(Date.now() + 3600000),
      now,
    ],
  );
  await client.query(
    'INSERT INTO auth_accounts(id,user_id,account_id,provider_id,password,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)',
    [
      authAccount,
      authUser,
      `synthetic-account-${authAccount}`,
      'credential',
      'synthetic-password-hash',
      now,
    ],
  );
  await client.query(
    'INSERT INTO auth_verifications(id,identifier,value,expires_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5)',
    [
      authVerification,
      authEmail,
      `synthetic-value-${authVerification}`,
      new Date(Date.now() + 3600000),
      now,
    ],
  );
  await client.query(
    'INSERT INTO auth_rate_limits(id,key,count,last_request) VALUES ($1,$2,$3,$4)',
    [authRateLimit, `synthetic-rate-${authRateLimit}`, 1, BigInt(Date.now())],
  );
  await client.query('UPDATE users SET name = $1 WHERE id = $2', [
    'Synthetic auth user updated',
    authUser,
  ]);
  await client.query('UPDATE auth_sessions SET user_agent = $1 WHERE id = $2', [
    'synthetic-agent',
    authSession,
  ]);
  await client.query('UPDATE auth_accounts SET scope = $1 WHERE id = $2', [
    'synthetic-scope',
    authAccount,
  ]);
  await client.query('UPDATE auth_verifications SET value = $1 WHERE id = $2', [
    `synthetic-value-updated-${authVerification}`,
    authVerification,
  ]);
  await client.query('UPDATE auth_rate_limits SET count = $1 WHERE id = $2', [2, authRateLimit]);
  for (const [table, id] of [
    ['auth_sessions', authSession],
    ['auth_accounts', authAccount],
    ['auth_verifications', authVerification],
    ['auth_rate_limits', authRateLimit],
  ]) {
    assert.equal(
      (await client.query(`SELECT id FROM ${table} WHERE id = $1`, [id])).rowCount,
      1,
      `family_auth CRUD must read ${table}`,
    );
  }
  await client.query('DELETE FROM auth_rate_limits WHERE id = $1', [authRateLimit]);
  await client.query('DELETE FROM auth_verifications WHERE id = $1', [authVerification]);
  await client.query('DELETE FROM auth_accounts WHERE id = $1', [authAccount]);
  await client.query('DELETE FROM auth_sessions WHERE id = $1', [authSession]);
  await client.query('DELETE FROM users WHERE id = $1', [authUser]);
  await client.query('RESET ROLE');

  await client.query('SET LOCAL ROLE family_runtime');
  await mustFail('SELECT id FROM auth_accounts WHERE id = $1', [accountA]);
  await client.query('RESET ROLE');

  console.log(
    'PASS: auth roles are restricted, auth CRUD is scoped to core tables, tenant/auth cross-access is denied, legacy users are preserved, and all synthetic fixtures roll back.',
  );
} finally {
  if (inTransaction) await client.query('ROLLBACK');
  await client.end();
}
