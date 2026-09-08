import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';
import type { AuthConfig } from './config.js';
import type { AuthMailer } from './mailer.js';

export type AuthLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type AuthLogSink = (level: AuthLogLevel, event: 'BETTER_AUTH_EVENT') => void;

const defaultAuthLogSink: AuthLogSink = (level, event) => {
  console[level](event);
};

export function createAuthLogger(sink: AuthLogSink = defaultAuthLogSink) {
  return {
    level: 'info' as const,
    log: (level: AuthLogLevel) => {
      sink(level, 'BETTER_AUTH_EVENT');
    },
  };
}

export function createAuth(
  config: AuthConfig,
  pool: Pool,
  mailer: AuthMailer,
  log: AuthLogSink = defaultAuthLogSink,
) {
  return betterAuth({
    appName: 'Family AI',
    baseURL: config.webOrigin,
    basePath: '/api/auth',
    secret: config.secret,
    logger: createAuthLogger(log),
    database: pool,
    trustedOrigins: [config.webOrigin],
    user: {
      modelName: 'users',
      fields: {
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        mailer.sendReset(user.email, url);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        mailer.sendVerification(user.email, url);
      },
    },
    session: {
      modelName: 'auth_sessions',
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      cookieCache: { enabled: false },
      expiresIn: 604800,
    },
    account: {
      modelName: 'auth_accounts',
      fields: {
        userId: 'user_id',
        providerId: 'provider_id',
        accountId: 'account_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    verification: {
      modelName: 'auth_verifications',
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      storeIdentifier: 'hashed',
    },
    rateLimit: {
      enabled: true,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
      },
      storage: 'database',
      modelName: 'auth_rate_limits',
      fields: {
        lastRequest: 'last_request',
      },
    },
    advanced: {
      disableOriginCheck: false,
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      database: { generateId: 'uuid' },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
