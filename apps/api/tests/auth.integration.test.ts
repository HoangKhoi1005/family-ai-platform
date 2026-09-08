import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertSafeApplicationRoles, createDatabasePool } from '@family/database';
import { buildApp } from '../src/app.js';
import { createAuth } from '../src/auth/auth.js';
import { readAuthConfig } from '../src/auth/config.js';
import { createAuthMailer } from '../src/auth/mailer.js';

const config = readAuthConfig(process.env);
const authPool = createDatabasePool(config.authDatabaseUrl);
const runtimePool = createDatabasePool(config.runtimeDatabaseUrl);
const ownerPool = createDatabasePool(requiredEnv('DATABASE_URL'));
const mailer = createAuthMailer(config);
const authLogEntries: Array<{ level: string; event: string }> = [];
const testAuthRateLimitPaths = [
  '/sign-up/email',
  '/sign-in/email',
  '/request-password-reset',
  '/reset-password',
] as const;
const auth = createAuth(config, authPool, mailer, (level, event) => {
  authLogEntries.push({ level, event });
});
const app = buildApp({ auth, publicOrigin: config.webOrigin });
const createdEmails: string[] = [];
let sequence = 0;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for auth integration tests`);
  return value;
}

function uniqueEmail(): string {
  sequence += 1;
  const email = `auth-integration-${Date.now()}-${sequence}@example.test`;
  createdEmails.push(email);
  return email;
}

function cookieHeader(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const values = response.headers['set-cookie'];
  const cookies = Array.isArray(values) ? values : values ? [values] : [];
  return cookies.map((value) => value.split(';', 1)[0]).join('; ');
}

async function waitForMessage(recipient: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const listResponse = await fetch(
      `http://127.0.0.1:${process.env.MAILPIT_PORT ?? '8035'}/api/v1/messages?limit=100`,
    );
    if (!listResponse.ok) throw new Error(`Mailpit list failed with ${listResponse.status}`);
    const list = (await listResponse.json()) as { messages?: Array<{ ID?: string }> };
    for (const summary of list.messages ?? []) {
      if (!summary.ID) continue;
      const messageResponse = await fetch(
        `http://127.0.0.1:${process.env.MAILPIT_PORT ?? '8035'}/api/v1/message/${summary.ID}`,
      );
      if (!messageResponse.ok) continue;
      const detail = (await messageResponse.json()) as unknown;
      const serialized = JSON.stringify(detail);
      if (!serialized.toLowerCase().includes(recipient.toLowerCase())) continue;
      return serialized;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the recipient-scoped Mailpit message');
}

function firstLink(message: string): string {
  const match = message.match(/https?:\/\/127\.0\.0\.1:3200\/[^"\\\s]+/);
  if (!match) throw new Error('Mailpit message did not contain a local action link');
  return match[0].replaceAll('\\u0026', '&');
}

describe('real Better Auth sessions', () => {
  beforeAll(async () => {
    await assertSafeApplicationRoles(authPool, runtimePool);
  });

  beforeEach(async () => {
    // Keep each scenario independent of Better Auth's database-backed
    // buckets without deleting rate-limit state for unrelated endpoints.
    await ownerPool.query(
      `DELETE FROM auth_rate_limits
        WHERE split_part(key, '|', 2) = ANY($1::text[])`,
      [testAuthRateLimitPaths],
    );
    authLogEntries.length = 0;
  });

  afterAll(async () => {
    await app.close();
    await mailer.drain();
    await authPool.end();
    await runtimePool.end();
    await ownerPool.query('DELETE FROM users WHERE email = ANY($1::text[])', [createdEmails]);
    await ownerPool.end();
  });

  it('verifies email before sign-in and keeps signup outside every family', async () => {
    const email = uniqueEmail();
    const password = 'correct horse battery staple';
    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { name: 'Người dùng tích hợp', email, password },
    });
    expect(signup.statusCode).toBe(200);

    const beforeVerification = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { email, password },
    });
    expect(beforeVerification.statusCode).toBe(403);

    const deniedMe = await app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(deniedMe.statusCode).toBe(401);

    await mailer.drain();
    const verificationLink = firstLink(await waitForMessage(email));
    const verificationUrl = new URL(verificationLink);
    const verification = await app.inject({
      method: 'GET',
      url: `${verificationUrl.pathname}${verificationUrl.search}`,
      headers: { origin: config.webOrigin },
    });
    expect([200, 302]).toContain(verification.statusCode);
    expect(verification.headers['set-cookie']).toBeUndefined();

    const replay = await app.inject({
      method: 'GET',
      url: `${verificationUrl.pathname}${verificationUrl.search}`,
      headers: { origin: config.webOrigin },
    });
    expect([200, 302]).toContain(replay.statusCode);
    expect(replay.headers['set-cookie']).toBeUndefined();

    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { email, password },
    });
    expect(signIn.statusCode).toBe(200);
    const cookies = cookieHeader(signIn);
    expect(cookies).toContain('better-auth.session_token=');

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: cookies },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({
      user: { id: expect.any(String), name: 'Người dùng tích hợp', email },
      memberships: [],
    });

    const memberships = await ownerPool.query(
      `SELECT fm.id
         FROM family_memberships fm
         JOIN users u ON u.id = fm.user_id
        WHERE u.email = $1`,
      [email],
    );
    expect(memberships.rowCount).toBe(0);
  });

  it('resets a password once and revokes the old session', async () => {
    const email = uniqueEmail();
    const oldPassword = 'old correct horse battery staple';
    const newPassword = 'new correct horse battery staple';

    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { name: 'Reset User', email, password: oldPassword },
    });
    expect(signup.statusCode).toBe(200);
    await mailer.drain();
    const verificationUrl = new URL(firstLink(await waitForMessage(email)));
    const verification = await app.inject({
      method: 'GET',
      url: `${verificationUrl.pathname}${verificationUrl.search}`,
      headers: { origin: config.webOrigin },
    });
    expect([200, 302]).toContain(verification.statusCode);

    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { email, password: oldPassword },
    });
    expect(signIn.statusCode).toBe(200);
    const oldCookie = cookieHeader(signIn);

    const requested = await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { email, redirectTo: config.webOrigin },
    });
    expect(requested.statusCode).toBe(200);
    await mailer.drain();
    const resetUrl = new URL(firstLink(await waitForMessage(email)));
    const resetCallback = await app.inject({
      method: 'GET',
      url: `${resetUrl.pathname}${resetUrl.search}`,
      headers: { origin: config.webOrigin },
    });
    expect(resetCallback.statusCode).toBe(302);
    const token = decodeURIComponent(resetUrl.pathname.split('/').pop() ?? '');
    expect(token.length).toBeGreaterThan(20);

    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { token, newPassword },
    });
    expect(reset.statusCode).toBe(200);

    const revokedMe = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: oldCookie },
    });
    expect(revokedMe.statusCode).toBe(401);

    const oldSignIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { email, password: oldPassword },
    });
    expect(oldSignIn.statusCode).toBe(401);

    const newSignIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { email, password: newPassword },
    });
    expect(newSignIn.statusCode).toBe(200);
    const newCookie = cookieHeader(newSignIn);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { token, newPassword: `${newPassword}!` },
    });
    expect(replay.statusCode).toBe(400);

    const crossOriginSignOut = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { origin: 'https://attacker.invalid', cookie: newCookie },
    });
    expect(crossOriginSignOut.statusCode).toBe(403);

    const signOut = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { origin: config.webOrigin, cookie: newCookie },
    });
    expect(signOut.statusCode).toBe(200);
    const afterSignOut = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: newCookie },
    });
    expect(afterSignOut.statusCode).toBe(401);
  });

  it('rejects expired reset identifiers and cross-origin mutations', async () => {
    const email = uniqueEmail();
    const password = 'expired reset password phrase';
    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { name: 'Expired Reset User', email, password },
    });
    expect(signup.statusCode).toBe(200);
    await mailer.drain();
    const verificationUrl = new URL(firstLink(await waitForMessage(email)));
    await app.inject({
      method: 'GET',
      url: `${verificationUrl.pathname}${verificationUrl.search}`,
      headers: { origin: config.webOrigin },
    });

    const requested = await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      headers: { origin: config.webOrigin, 'content-type': 'application/json' },
      payload: { email, redirectTo: config.webOrigin },
    });
    expect(requested.statusCode).toBe(200);
    const expiredResetRows = await ownerPool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM auth_verifications',
    );
    expect(Number(expiredResetRows.rows[0].count)).toBeGreaterThan(0);
    await mailer.drain();
    const resetUrl = new URL(firstLink(await waitForMessage(email)));
    const expired = await ownerPool.query(
      `UPDATE auth_verifications
          SET expires_at = now() - interval '1 second'
        WHERE id = (
          SELECT id
            FROM auth_verifications
           ORDER BY created_at DESC
           LIMIT 1
        )`,
    );
    expect(expired.rowCount).toBe(1);
    const expiredCallback = await app.inject({
      method: 'GET',
      url: `${resetUrl.pathname}${resetUrl.search}`,
      headers: { origin: config.webOrigin },
    });
    expect(expiredCallback.statusCode).toBe(302);
    expect(expiredCallback.headers.location).toContain('error=INVALID_TOKEN');

    const crossOriginSignIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: 'https://attacker.invalid', 'content-type': 'application/json' },
      payload: { email, password },
    });
    expect(crossOriginSignIn.statusCode).toBe(403);
  });

  it('rate limits repeated email sign-in attempts', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        headers: {
          origin: config.webOrigin,
          'content-type': 'application/json',
          'x-real-ip': `198.51.100.${attempt + 1}`,
        },
        payload: { email: `missing-${attempt}@example.test`, password: 'wrong password phrase' },
      });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 5).every((status) => status !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('redacts rejected callback URLs from Better Auth logs', async () => {
    const secret = 'synthetic-callback-secret-7f5c';
    const response = await auth.handler(
      new Request(`${config.webOrigin}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: {
          origin: config.webOrigin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: 'person@example.test',
          redirectTo: `https://attacker.invalid/callback?leak=${secret}`,
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(authLogEntries.length).toBeGreaterThan(0);
    expect(authLogEntries.every(({ event }) => event === 'BETTER_AUTH_EVENT')).toBe(true);
    expect(authLogEntries.some(({ level }) => level === 'error')).toBe(true);
    expect(JSON.stringify(authLogEntries)).not.toContain(secret);
  });
});
