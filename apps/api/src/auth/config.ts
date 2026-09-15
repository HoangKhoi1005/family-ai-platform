const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export type AppEnvironment = 'local' | 'staging' | 'production';

export interface AuthConfig {
  appEnv: AppEnvironment;
  secret: string;
  webOrigin: string;
  apiInternalUrl: string;
  authDatabaseUrl: string;
  runtimeDatabaseUrl: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  mailFrom: string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseHttpOrigin(
  name: string,
  value: string,
  policy: { loopback: boolean; https: boolean },
): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${name} must use HTTP`);
  if (policy.loopback && !LOOPBACK_HOSTS.has(parsed.hostname))
    throw new Error(`${name} must use a loopback HTTP URL`);
  if (policy.https && parsed.protocol !== 'https:') throw new Error(`${name} must use HTTPS`);
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

function parsePostgresUrl(name: string, value: string, loopback: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use the PostgreSQL protocol`);
  }
  if (loopback && !LOOPBACK_HOSTS.has(parsed.hostname))
    throw new Error(`${name} must use a loopback PostgreSQL URL`);
  if (!parsed.username || !parsed.password)
    throw new Error(`${name} must use a credentialed PostgreSQL URL`);
  if (!parsed.pathname || parsed.pathname === '/')
    throw new Error(`${name} must include a database`);
  return value;
}

export function readAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  const appEnv = required(env, 'APP_ENV');
  if (!['local', 'staging', 'production'].includes(appEnv))
    throw new Error('APP_ENV must be local, staging, or production');
  const external = appEnv !== 'local';

  const secret = required(env, 'BETTER_AUTH_SECRET');
  if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');

  const smtpHost = required(env, 'SMTP_HOST');
  if (!external && !LOOPBACK_HOSTS.has(smtpHost.toLowerCase())) {
    throw new Error('SMTP_HOST must be a loopback host in local mode');
  }

  const smtpPortRaw = required(env, 'SMTP_PORT');
  const smtpPort = Number(smtpPortRaw);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535');
  }

  const smtpSecureRaw = env.SMTP_SECURE?.trim() || 'false';
  if (!['true', 'false'].includes(smtpSecureRaw))
    throw new Error('SMTP_SECURE must be true or false');
  const smtpSecure = smtpSecureRaw === 'true';
  const smtpUser = env.SMTP_USER?.trim() || undefined;
  const smtpPassword = env.SMTP_PASSWORD?.trim() || undefined;
  if ((smtpUser && !smtpPassword) || (!smtpUser && smtpPassword) || (external && !smtpUser)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD are required together outside local mode');
  }

  const mailFrom = required(env, 'MAIL_FROM');
  if (/\s/.test(mailFrom) || !mailFrom.includes('@'))
    throw new Error('MAIL_FROM must be an email address');

  return {
    appEnv: appEnv as AppEnvironment,
    secret,
    webOrigin: parseHttpOrigin('WEB_ORIGIN', required(env, 'WEB_ORIGIN'), {
      loopback: !external,
      https: external,
    }),
    apiInternalUrl: parseHttpOrigin('API_INTERNAL_URL', required(env, 'API_INTERNAL_URL'), {
      loopback: !external,
      https: false,
    }),
    authDatabaseUrl: parsePostgresUrl(
      'AUTH_DATABASE_URL',
      required(env, 'AUTH_DATABASE_URL'),
      !external,
    ),
    runtimeDatabaseUrl: parsePostgresUrl(
      'RUNTIME_DATABASE_URL',
      required(env, 'RUNTIME_DATABASE_URL'),
      !external,
    ),
    smtpHost,
    smtpPort,
    smtpSecure,
    ...(smtpUser ? { smtpUser } : {}),
    ...(smtpPassword ? { smtpPassword } : {}),
    mailFrom,
  };
}
