import { createDatabasePool, assertSafeApplicationRoles } from '@family/database';
import { readMediaStorageConfig, S3MediaStorage } from '@family/media';
import { readServerConfig } from '@family/config';
import { buildApp } from './app.js';
import { createAuth } from './auth/auth.js';
import { readAuthConfig } from './auth/config.js';
import { createAuthMailer } from './auth/mailer.js';
import { databaseReadinessProbe } from './readiness.js';

const AUTH_ENV_KEYS = [
  'APP_ENV',
  'BETTER_AUTH_SECRET',
  'WEB_ORIGIN',
  'API_INTERNAL_URL',
  'AUTH_DATABASE_URL',
  'RUNTIME_DATABASE_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM',
] as const;

const config = readServerConfig(process.env, 'API_PORT', 'PORT');
const authEnvPresent = AUTH_ENV_KEYS.some((key) => process.env[key] !== undefined);
const authConfig = authEnvPresent ? readAuthConfig(process.env) : undefined;
const authPool = authConfig ? createDatabasePool(authConfig.authDatabaseUrl) : undefined;
const runtimePool = authConfig ? createDatabasePool(authConfig.runtimeDatabaseUrl) : undefined;
const mailer = authConfig ? createAuthMailer(authConfig) : undefined;
const mediaStorage = authConfig
  ? new S3MediaStorage(readMediaStorageConfig(process.env))
  : undefined;

try {
  if (authConfig && authPool && runtimePool) {
    await assertSafeApplicationRoles(authPool, runtimePool);
  }

  const auth =
    authConfig && authPool && mailer ? createAuth(authConfig, authPool, mailer) : undefined;
  const app = buildApp(
    auth && authConfig && authPool && runtimePool
      ? {
          auth,
          publicOrigin: authConfig.webOrigin,
          runtimePool,
          readinessProbes: [databaseReadinessProbe(authPool), databaseReadinessProbe(runtimePool)],
          ...(mediaStorage ? { mediaStorage } : {}),
        }
      : undefined,
  );
  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await app.close();
    await mailer?.drain();
    await authPool?.end();
    await runtimePool?.end();
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void shutdown();
    });
  }
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  await authPool?.end().catch(() => undefined);
  await runtimePool?.end().catch(() => undefined);
  throw error;
}
