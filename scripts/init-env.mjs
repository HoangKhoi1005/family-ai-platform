import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const ENV_FILE = '.env';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const DEFAULTS = {
  POSTGRES_USER: 'family_owner',
  POSTGRES_DB: 'family_dev',
  POSTGRES_PORT: '54339',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1035',
  MAILPIT_PORT: '8035',
  MAIL_FROM: 'no-reply@family-ai.local',
  WEB_ORIGIN: 'http://127.0.0.1:3200',
  API_INTERNAL_URL: 'http://127.0.0.1:4010',
  APP_ENV: 'local',
  HOST: '127.0.0.1',
  API_PORT: '4010',
  PORT: '3200',
  WEB_PORT: '3200',
  COMPOSE_PROJECT_NAME: 'family-ai-onboarding',
};

function parseEnvValue(raw) {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("'\\''", "'");
  }
  return value;
}

function readEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) values.set(match[1], parseEnvValue(match[2]));
  }
  return values;
}

function randomPassword() {
  return randomBytes(24).toString('hex');
}

function localDatabaseParts(name, value) {
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
    throw new Error(`${name} must point to a loopback host`);
  }
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    user: decodeURIComponent(parsed.username),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
  };
}

function postgresUrl(user, password, host, port, database) {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
}

const existed = existsSync(ENV_FILE);
const original = existed ? readFileSync(ENV_FILE, 'utf8') : '';
const values = readEnv(original);
if (values.has('APP_ENV') && values.get('APP_ENV') !== 'local') {
  throw new Error('APP_ENV=local is required for this local initializer');
}

const additions = [];
function ensure(name, value) {
  if (values.has(name)) return values.get(name);
  values.set(name, value);
  additions.push(`${name}=${value}`);
  return value;
}

let existingOwnerParts;
if (values.has('DATABASE_URL')) {
  existingOwnerParts = localDatabaseParts('DATABASE_URL', values.get('DATABASE_URL'));
}
const postgresPassword =
  values.get('POSTGRES_PASSWORD') ?? existingOwnerParts?.password ?? randomPassword();
ensure('POSTGRES_USER', existingOwnerParts?.user || DEFAULTS.POSTGRES_USER);
ensure('POSTGRES_PASSWORD', postgresPassword);
ensure('POSTGRES_DB', existingOwnerParts?.database || DEFAULTS.POSTGRES_DB);
ensure('POSTGRES_PORT', existingOwnerParts?.port || DEFAULTS.POSTGRES_PORT);

let ownerParts;
if (values.has('DATABASE_URL')) {
  ownerParts = existingOwnerParts;
  if (!ownerParts.password && !values.get('POSTGRES_PASSWORD')) {
    throw new Error('DATABASE_URL or POSTGRES_PASSWORD must provide the owner password');
  }
} else {
  ownerParts = {
    host: '127.0.0.1',
    port: values.get('POSTGRES_PORT'),
    database: values.get('POSTGRES_DB'),
    password: values.get('POSTGRES_PASSWORD'),
  };
  ensure(
    'DATABASE_URL',
    postgresUrl(
      values.get('POSTGRES_USER'),
      ownerParts.password,
      ownerParts.host,
      ownerParts.port,
      ownerParts.database,
    ),
  );
}

const ownerPassword = values.get('POSTGRES_PASSWORD') || ownerParts.password;
if (!ownerPassword) throw new Error('POSTGRES_PASSWORD is required for local database setup');
if (!values.has('DATABASE_URL')) {
  ensure(
    'DATABASE_URL',
    postgresUrl(
      values.get('POSTGRES_USER'),
      ownerPassword,
      ownerParts.host,
      ownerParts.port,
      ownerParts.database,
    ),
  );
}

const dbHost = ownerParts.host;
const dbPort = ownerParts.port;
const dbName = ownerParts.database;
ensure('AUTH_DATABASE_URL', postgresUrl('family_auth', randomPassword(), dbHost, dbPort, dbName));
ensure(
  'RUNTIME_DATABASE_URL',
  postgresUrl('family_runtime', randomPassword(), dbHost, dbPort, dbName),
);
ensure('BETTER_AUTH_SECRET', randomBytes(32).toString('base64url'));
for (const [name, value] of Object.entries(DEFAULTS)) ensure(name, value);

if (additions.length > 0) {
  const prefix = existed && original.length > 0 && !original.endsWith('\n') ? '\n' : '';
  if (existed) {
    appendFileSync(ENV_FILE, `${prefix}${additions.join('\n')}\n`);
    console.log(`Added ${additions.length} missing local environment values to ignored .env.`);
  } else {
    writeFileSync(ENV_FILE, `${additions.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
    console.log('Created ignored .env with local-only random credentials.');
  }
} else {
  console.log('.env already contains the local environment; preserved without changes.');
}
