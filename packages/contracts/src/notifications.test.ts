import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  notificationListQuerySchema,
  updateNotificationPreferencesBodySchema,
} from './notifications.js';

const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });

app.get(
  '/notifications',
  { schema: { querystring: notificationListQuerySchema } },
  async (request) => request.query,
);
app.put(
  '/notification-preferences',
  { schema: { body: updateNotificationPreferencesBodySchema } },
  async (request) => request.body,
);

beforeAll(async () => app.ready());
afterAll(async () => app.close());

describe('notification input schemas', () => {
  it('accepts the pilot reminder offsets and quiet hours', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/notification-preferences',
      payload: {
        reminder_offsets: ['seven_days', 'one_day', 'same_day'],
        quiet_hours: {
          starts_at: '21:00',
          ends_at: '07:00',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        push_enabled: false,
        version: 1,
      },
    });

    expect(response.statusCode, response.body).toBe(200);
  });

  it('rejects duplicate offsets and untrusted scope fields', async () => {
    const duplicate = await app.inject({
      method: 'PUT',
      url: '/notification-preferences',
      payload: {
        reminder_offsets: ['one_day', 'one_day'],
        quiet_hours: {
          starts_at: '21:00',
          ends_at: '07:00',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        push_enabled: false,
        version: 1,
      },
    });
    expect(duplicate.statusCode).toBe(400);

    const forgedScope = await app.inject({
      method: 'PUT',
      url: '/notification-preferences',
      payload: {
        family_id: '11111111-1111-4111-8111-111111111111',
        membership_id: '22222222-2222-4222-8222-222222222222',
        reminder_offsets: ['one_day'],
        quiet_hours: {
          starts_at: '21:00',
          ends_at: '07:00',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        push_enabled: false,
        version: 1,
      },
    });
    expect(forgedScope.statusCode).toBe(400);
  });

  it('keeps inbox pagination bounded and validates unread filtering', async () => {
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/notifications?limit=50&unread_only=true',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/notifications?limit=101',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/notifications?unread_only=sometimes',
        })
      ).statusCode,
    ).toBe(400);
  });
});
