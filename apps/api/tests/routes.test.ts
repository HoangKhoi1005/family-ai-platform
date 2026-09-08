import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerAuthRoutes } from '../src/auth/routes.js';

describe('registerAuthRoutes', () => {
  it('preserves the auth response and strips untrusted forwarding headers', async () => {
    let received!: Request;
    const auth = {
      handler: async (request: Request) => {
        received = request;
        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: [
            ['content-type', 'application/json'],
            ['set-cookie', 'first=one; Path=/; HttpOnly'],
            ['set-cookie', 'second=two; Path=/; HttpOnly'],
          ],
        });
      },
    } as never;
    const app = Fastify();
    registerAuthRoutes(app, auth, 'http://127.0.0.1:3200');

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email?next=%2Fhome',
      headers: {
        origin: 'http://127.0.0.1:3200',
        'content-type': 'application/json',
        'x-forwarded-host': 'attacker.example',
        'x-forwarded-proto': 'https',
        'x-forwarded-for': '198.51.100.8',
        'x-real-ip': '198.51.100.9',
      },
      payload: { email: 'person@example.test' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ok: true });
    expect(response.headers['set-cookie']).toEqual([
      'first=one; Path=/; HttpOnly',
      'second=two; Path=/; HttpOnly',
    ]);
    expect(received.url).toBe('http://127.0.0.1:3200/api/auth/sign-in/email?next=%2Fhome');
    expect(received.headers.get('x-forwarded-host')).toBeNull();
    expect(received.headers.get('x-forwarded-proto')).toBeNull();
    expect(received.headers.get('x-forwarded-for')).toBeNull();
    expect(received.headers.get('x-real-ip')).toBeNull();
    expect(await received.json()).toEqual({ email: 'person@example.test' });

    await app.close();
  });

  it('rejects unsupported auth methods', async () => {
    const app = Fastify();
    registerAuthRoutes(
      app,
      { handler: async () => new Response('{}') } as never,
      'http://127.0.0.1:3200',
    );

    const response = await app.inject({ method: 'PUT', url: '/api/auth/sign-in/email' });
    expect(response.statusCode).toBe(405);
    await app.close();
  });

  it('rejects a cross-origin auth mutation before invoking Better Auth', async () => {
    let called = false;
    const app = Fastify();
    registerAuthRoutes(
      app,
      {
        handler: async () => {
          called = true;
          return new Response('{}');
        },
      } as never,
      'http://127.0.0.1:3200',
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: 'https://attacker.invalid', 'content-type': 'application/json' },
      payload: { email: 'person@example.test', password: 'wrong password' },
    });
    expect(response.statusCode).toBe(403);
    expect(called).toBe(false);
    await app.close();
  });
});
