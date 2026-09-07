import { afterAll, expect, it } from 'vitest';
import { buildApp } from './app.js';
const app = buildApp();
afterAll(async () => {
  await app.close();
});
it('provides process liveness with no cache', async () => {
  const response = await app.inject('/health/live');
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok', service: 'family-api' });
  expect(response.headers['cache-control']).toBe('no-store');
});
it('does not expose fake authenticated family endpoints', async () => {
  const response = await app.inject({
    url: '/api/v1/families/fa/members',
    headers: { 'x-user-id': 'admin', 'x-family-id': 'fa' },
  });
  expect(response.statusCode).toBe(404);
  expect(response.json().error.code).toBe('NOT_FOUND');
});
it('sanitizes server errors without leaking their details', async () => {
  const failingApp = buildApp();
  failingApp.get('/synthetic-error', async () => {
    throw new Error('SYNTHETIC_PRIVATE_DETAIL');
  });
  try {
    const response = await failingApp.inject('/synthetic-error');
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('INTERNAL_ERROR');
    expect(response.body).not.toContain('SYNTHETIC_PRIVATE_DETAIL');
    expect(response.body).not.toContain('stack');
  } finally {
    await failingApp.close();
  }
});
