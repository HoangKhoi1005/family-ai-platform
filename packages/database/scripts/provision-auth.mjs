import { URL } from 'node:url';
import pg from 'pg';

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
  if (expectedUser && decodeURIComponent(parsed.username) !== expectedUser) {
    throw new Error(`${name} must use the ${expectedUser} role`);
  }
  if (!parsed.password) throw new Error(`${name} must include a role password`);
  try {
    return decodeURIComponent(parsed.password);
  } catch {
    throw new Error(`${name} contains an invalid encoded password`);
  }
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function provision() {
  if (process.env.APP_ENV !== 'local') {
    throw new Error('APP_ENV=local is required for local auth role provisioning');
  }

  const ownerUrl = process.env.DATABASE_URL;
  parseLocalDatabaseUrl('DATABASE_URL', ownerUrl);
  const passwords = ROLE_URLS.map(([role, value]) => [
    role,
    parseLocalDatabaseUrl(
      `${role === 'family_auth' ? 'AUTH_DATABASE_URL' : 'RUNTIME_DATABASE_URL'}`,
      value,
      role,
    ),
  ]);

  const client = new pg.Client({
    connectionString: ownerUrl,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  let inTransaction = false;
  try {
    const roles = await client.query(
      `SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb,
              rolcreaterole, rolinherit, rolreplication
         FROM pg_roles
        WHERE rolname = ANY($1::text[])
        ORDER BY rolname`,
      [ROLE_URLS.map(([role]) => role)],
    );
    if (roles.rowCount !== ROLE_URLS.length) {
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
  await provision();
} catch (error) {
  console.error(
    `Auth role provisioning failed: ${error instanceof Error ? error.message : 'unknown error'}`,
  );
  process.exitCode = 1;
}
