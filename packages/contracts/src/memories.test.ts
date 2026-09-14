import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createMemoryBodySchema,
  createMemoryFromMomentBodySchema,
  createMemoryItemBodySchema,
  memoryListQuerySchema,
} from './memories.js';

const mediaId = '11111111-1111-4111-8111-111111111111';
const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
app.post(
  '/memories',
  { schema: { body: createMemoryBodySchema } },
  async (request) => request.body,
);
app.post(
  '/items',
  { schema: { body: createMemoryItemBodySchema } },
  async (request) => request.body,
);
app.post(
  '/from-moment',
  { schema: { body: createMemoryFromMomentBodySchema } },
  async (request) => request.body,
);
app.get(
  '/memories',
  { schema: { querystring: memoryListQuerySchema } },
  async (request) => request.query,
);
beforeAll(async () => app.ready());
afterAll(async () => app.close());

describe('Memory contracts', () => {
  it('accepts a family Memory with ordered text and image items', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/memories',
      payload: {
        title: 'Bữa cơm đầu năm',
        occurred_on: '2026-02-17',
        audience: 'family',
        items: [
          { kind: 'text', body: 'Cả nhà quây quần.', position: 0 },
          { kind: 'image', media_id: mediaId, position: 1 },
        ],
      },
    });
    expect(response.statusCode, response.body).toBe(200);
  });

  it.each([
    { version: 1, kind: 'text', position: 0 },
    { version: 1, kind: 'audio', body: 'not-media', position: 0 },
    { version: 1, kind: 'image', media_id: mediaId, body: 'unexpected', position: 0 },
    { version: 0, kind: 'audio', media_id: mediaId, position: 0 },
    { version: 1, kind: 'text', body: 'Ngoài giới hạn', position: 50 },
  ])('rejects an invalid Memory item %#', async (payload) => {
    expect((await app.inject({ method: 'POST', url: '/items', payload })).statusCode).toBe(400);
  });

  it('bounds timeline pagination', async () => {
    expect((await app.inject({ method: 'GET', url: '/memories?limit=100' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/memories?limit=101' })).statusCode).toBe(400);
  });

  it('accepts an optional title when preserving a Moment as a Memory', async () => {
    expect(
      (await app.inject({ method: 'POST', url: '/from-moment', payload: {} })).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/from-moment',
          payload: { title: 'Một chiều ở quê' },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'POST', url: '/from-moment', payload: { audience: 'family' } }))
        .statusCode,
    ).toBe(400);
  });
});
