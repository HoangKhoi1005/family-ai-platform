const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export interface AuthConfig {
  appEnv: 'local';
  secret: string;
  webOrigin: string;
  apiInternalUrl: string;
  authDatabaseUrl: string;
  runtimeDatabaseUrl: string;
  smtpHost: string;
  smtpPort: number;
  mailFrom: string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseLoopbackHttpUrl(name: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`${name} must use a loopback HTTP URL`);
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${name} must be an origin without credentials or a path`);
  }
  return parsed.origin;
}

function parseLocalPostgresUrl(name: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use the PostgreSQL protocol`);
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname) || !parsed.username || !parsed.password) {
    throw new Error(`${name} must use a credentialed loopback PostgreSQL URL`);
  }
  if (!parsed.pathname || parsed.pathname === '/')
    throw new Error(`${name} must include a database`);
  return value;
}

export function readAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  if (env.APP_ENV !== 'local') {
    throw new Error('APP_ENV=local is required for auth configuration in this phase');
  }

  const secret = required(env, 'BETTER_AUTH_SECRET');
  if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');

  const smtpHost = required(env, 'SMTP_HOST');
  if (!LOOPBACK_HOSTS.has(smtpHost.toLowerCase())) {
    throw new Error('SMTP_HOST must be a loopback host in local mode');
  }

  const smtpPortRaw = required(env, 'SMTP_PORT');
  const smtpPort = Number(smtpPortRaw);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535');
  }

  const mailFrom = required(env, 'MAIL_FROM');
  if (/\s/.test(mailFrom) || !mailFrom.includes('@'))
    throw new Error('MAIL_FROM must be an email address');

  return {
    appEnv: 'local',
    secret,
    webOrigin: parseLoopbackHttpUrl('WEB_ORIGIN', required(env, 'WEB_ORIGIN')),
    apiInternalUrl: parseLoopbackHttpUrl('API_INTERNAL_URL', required(env, 'API_INTERNAL_URL')),
    authDatabaseUrl: parseLocalPostgresUrl('AUTH_DATABASE_URL', required(env, 'AUTH_DATABASE_URL')),
    runtimeDatabaseUrl: parseLocalPostgresUrl(
      'RUNTIME_DATABASE_URL',
      required(env, 'RUNTIME_DATABASE_URL'),
    ),
    smtpHost,
    smtpPort,
    mailFrom,
  };
}
