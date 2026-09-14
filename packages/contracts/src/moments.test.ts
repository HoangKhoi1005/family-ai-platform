import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createMomentBodySchema,
  momentListQuerySchema,
  updateMomentReactionBodySchema,
} from './moments.js';

const mediaId = '11111111-1111-4111-8111-111111111111';
const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
app.post('/moments', { schema: { body: createMomentBodySchema } }, async (request) => request.body);
app.get(
  '/moments',
  { schema: { querystring: momentListQuerySchema } },
  async (request) => request.query,
);
app.put(
  '/reaction',
  { schema: { body: updateMomentReactionBodySchema } },
  async (request) => request.body,
);
beforeAll(async () => app.ready());
afterAll(async () => app.close());

describe('Moment contracts', () => {
  it('accepts the family-only pilot payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/moments',
      payload: {
        client_request_id: 'moment-request-1',
        media_id: mediaId,
        caption: 'Cơm nhà',
        audience: 'family',
      },
    });
    expect(response.statusCode, response.body).toBe(200);
  });

  it('rejects a broader audience, long caption and forged actor scope', async () => {
    for (const payload of [
      {
        client_request_id: 'moment-request-1',
        media_id: mediaId,
        caption: '',
        audience: 'selected_people',
      },
      {
        client_request_id: 'moment-request-1',
        media_id: mediaId,
        caption: 'a'.repeat(501),
        audience: 'family',
      },
      {
        client_request_id: 'moment-request-1',
        media_id: mediaId,
        audience: 'family',
        family_id: mediaId,
      },
    ]) {
      expect((await app.inject({ method: 'POST', url: '/moments', payload })).statusCode).toBe(400);
    }
  });

  it('bounds pagination and allows only Thương or removal', async () => {
    expect((await app.inject({ method: 'GET', url: '/moments?limit=100' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/moments?limit=101' })).statusCode).toBe(400);
    expect(
      (await app.inject({ method: 'PUT', url: '/reaction', payload: { reaction: 'thuong' } }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'PUT', url: '/reaction', payload: { reaction: null } }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'PUT', url: '/reaction', payload: { reaction: 'like' } }))
        .statusCode,
    ).toBe(400);
  });
});
