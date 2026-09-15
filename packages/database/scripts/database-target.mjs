const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const STAGING_DATABASE_HOST = 'postgres';

export function parseDatabaseTarget(name, value, expectedUser) {
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
  if (!parsed.username || !parsed.password || !parsed.pathname || parsed.pathname === '/') {
    throw new Error(`${name} must include a role username, password, and database`);
  }

  let user;
  let database;
  let password;
  try {
    user = decodeURIComponent(parsed.username);
    database = decodeURIComponent(parsed.pathname.slice(1));
    password = decodeURIComponent(parsed.password);
  } catch {
    throw new Error(`${name} contains invalid URL encoding`);
  }
  if (expectedUser && user !== expectedUser) {
    throw new Error(`${name} must use the ${expectedUser} role`);
  }
  if (!database) throw new Error(`${name} must include a database`);

  return {
    name,
    user,
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || '5432',
    database,
    password,
  };
}

export function assertProvisioningEnvironment(env, owner, roles) {
  const appEnv = env.APP_ENV;
  if (appEnv === 'production') {
    throw new Error('staging provisioning refuses APP_ENV=production');
  }
  if (appEnv !== 'local' && appEnv !== 'staging') {
    throw new Error('APP_ENV must be local or staging for role provisioning');
  }

  const targets = [owner, ...roles];
  if (appEnv === 'local') {
    if (targets.some((target) => !LOOPBACK_HOSTS.has(target.host))) {
      throw new Error('local role provisioning requires loopback database targets');
    }
  } else {
    if (env.ALLOW_STAGING_PROVISION !== 'true') {
      throw new Error('ALLOW_STAGING_PROVISION=true is required for staging role provisioning');
    }
    if (targets.some((target) => target.host !== STAGING_DATABASE_HOST)) {
      throw new Error('staging role provisioning requires the postgres service target');
    }
  }

  for (const target of roles) {
    if (
      target.host !== owner.host ||
      target.port !== owner.port ||
      target.database !== owner.database
    ) {
      throw new Error(`${target.name} must target the same database as DATABASE_URL`);
    }
  }
}
