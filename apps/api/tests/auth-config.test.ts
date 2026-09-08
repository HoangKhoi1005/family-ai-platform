import { describe, expect, it } from 'vitest';
import { readAuthConfig } from '../src/auth/config.js';

const validEnv: NodeJS.ProcessEnv = {
  APP_ENV: 'local',
  BETTER_AUTH_SECRET: 'a'.repeat(64),
  WEB_ORIGIN: 'http://127.0.0.1:3200',
  API_INTERNAL_URL: 'http://127.0.0.1:4010',
  AUTH_DATABASE_URL: 'postgresql://family_auth:auth-pass@127.0.0.1:54339/family_dev',
  RUNTIME_DATABASE_URL: 'postgresql://family_runtime:runtime-pass@127.0.0.1:54339/family_dev',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1035',
  MAIL_FROM: 'no-reply@family-ai.local',
};

describe('readAuthConfig', () => {
  it('reads the complete local auth configuration', () => {
    expect(readAuthConfig(validEnv)).toEqual({
      appEnv: 'local',
      secret: validEnv.BETTER_AUTH_SECRET,
      webOrigin: 'http://127.0.0.1:3200',
      apiInternalUrl: 'http://127.0.0.1:4010',
      authDatabaseUrl: validEnv.AUTH_DATABASE_URL,
      runtimeDatabaseUrl: validEnv.RUNTIME_DATABASE_URL,
      smtpHost: '127.0.0.1',
      smtpPort: 1035,
      mailFrom: 'no-reply@family-ai.local',
    });
  });

  it('rejects a missing or weak secret', () => {
    expect(() => readAuthConfig({ ...validEnv, BETTER_AUTH_SECRET: undefined })).toThrow(
      'BETTER_AUTH_SECRET',
    );
    expect(() => readAuthConfig({ ...validEnv, BETTER_AUTH_SECRET: 'too-short' })).toThrow(
      'BETTER_AUTH_SECRET',
    );
  });

  it('rejects invalid or cross-origin URLs', () => {
    expect(() => readAuthConfig({ ...validEnv, WEB_ORIGIN: 'not-a-url' })).toThrow('WEB_ORIGIN');
    expect(() =>
      readAuthConfig({ ...validEnv, API_INTERNAL_URL: 'https://api.example.test' }),
    ).toThrow('API_INTERNAL_URL');
  });

  it('rejects non-loopback SMTP in local mode', () => {
    expect(() => readAuthConfig({ ...validEnv, SMTP_HOST: 'smtp.example.test' })).toThrow(
      'SMTP_HOST',
    );
  });

  it('rejects partial auth database configuration', () => {
    expect(() => readAuthConfig({ ...validEnv, RUNTIME_DATABASE_URL: undefined })).toThrow(
      'RUNTIME_DATABASE_URL',
    );
  });
});
