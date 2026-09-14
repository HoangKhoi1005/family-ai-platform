import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMediaUploadBodySchema } from './media.js';

const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
app.post(
  '/upload',
  { schema: { body: createMediaUploadBodySchema } },
  async (request) => request.body,
);
beforeAll(async () => app.ready());
afterAll(async () => app.close());

describe('media contracts', () => {
  it('accepts a bounded JPEG Moment upload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/upload',
      payload: { mime_type: 'image/jpeg', byte_size: 10_000_000, purpose: 'moment_image' },
    });
    expect(response.statusCode, response.body).toBe(200);
  });

  it.each([
    { mime_type: 'image/heic', byte_size: 100, purpose: 'moment_image' },
    { mime_type: 'image/jpeg', byte_size: 10_000_001, purpose: 'moment_image' },
    { mime_type: 'audio/webm', byte_size: 25_000_001, purpose: 'memory_audio' },
    { mime_type: 'image/jpeg', byte_size: 100, purpose: 'memory_audio' },
    { mime_type: 'image/jpeg', byte_size: 100, purpose: 'moment_image', family_id: 'forged' },
  ])('rejects an unsupported or untrusted upload %#', async (payload) => {
    const response = await app.inject({ method: 'POST', url: '/upload', payload });
    expect(response.statusCode).toBe(400);
  });
});
