import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';

function fakeAuth(session: unknown) {
  return {
    handler: async () => new Response('{}'),
    api: { getSession: vi.fn().mockResolvedValue(session) },
  } as never;
}

describe('configured API app', () => {
  it('returns only the verified user and an empty membership list from /me', async () => {
    const auth = fakeAuth({
      user: {
        id: 'user-1',
        name: 'Người dùng thử',
        email: 'person@example.test',
        emailVerified: true,
      },
      session: { id: 'session-1' },
    });
    const app = buildApp({ auth, publicOrigin: 'http://127.0.0.1:3200' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: 'better-auth.session_token=opaque' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: { id: 'user-1', name: 'Người dùng thử', email: 'person@example.test' },
      memberships: [],
    });
    expect(response.body).not.toContain('emailVerified');
    expect(response.body).not.toContain('role');
    await app.close();
  });

  it('returns a generic 401 when no verified session exists', async () => {
    const app = buildApp({
      auth: fakeAuth(null),
      publicOrigin: 'http://127.0.0.1:3200',
    });
    const response = await app.inject('/api/v1/me');
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(response.body).not.toContain('session');
    await app.close();
  });

  it('rejects partially configured auth wiring', () => {
    expect(() => buildApp({ auth: fakeAuth(null) })).toThrow('publicOrigin');
    expect(() => buildApp({ publicOrigin: 'http://127.0.0.1:3200' })).toThrow('auth');
  });
});
