import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cancelEventBodySchema,
  createEventBodySchema,
  eventListQuerySchema,
  updateEventBodySchema,
  upsertEventRsvpBodySchema,
} from './calendar.js';

const memberId = '11111111-1111-4111-8111-111111111111';
const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });

app.post('/events', { schema: { body: createEventBodySchema } }, async (request) => request.body);
app.patch('/events', { schema: { body: updateEventBodySchema } }, async (request) => request.body);
app.post('/cancel', { schema: { body: cancelEventBodySchema } }, async (request) => request.body);
app.put('/rsvp', { schema: { body: upsertEventRsvpBodySchema } }, async (request) => request.body);
app.get(
  '/events',
  { schema: { querystring: eventListQuerySchema } },
  async (request) => request.query,
);

beforeAll(async () => app.ready());
afterAll(async () => app.close());

const common = {
  kind: 'gathering',
  title: 'Họp mặt cả nhà',
  recurrence: 'yearly',
  timezone: 'Asia/Ho_Chi_Minh',
  all_day: true,
  reminder_offsets: ['seven_days', 'one_day', 'same_day'],
};

describe('calendar event input schemas', () => {
  it('accepts Gregorian February 29 with an explicit yearly policy', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        calendar_type: 'gregorian',
        date_parts: { year: 2024, month: 2, day: 29 },
        feb29_policy: 'feb28',
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects missing February 29 policy and impossible Gregorian dates', async () => {
    const missingPolicy = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        calendar_type: 'gregorian',
        date_parts: { year: 2024, month: 2, day: 29 },
      },
    });
    expect(missingPolicy.statusCode).toBe(400);

    const februaryThirty = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        recurrence: 'none',
        calendar_type: 'gregorian',
        date_parts: { year: 2025, month: 2, day: 30 },
      },
    });
    expect(februaryThirty.statusCode).toBe(400);

    const nonLeapYear = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        recurrence: 'none',
        calendar_type: 'gregorian',
        date_parts: { year: 2025, month: 2, day: 29 },
      },
    });
    expect(nonLeapYear.statusCode).toBe(400);
  });

  it('accepts a recurring Vietnamese lunar date with explicit policies', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        kind: 'death_anniversary',
        title: 'Ngày giỗ ông',
        member_id: memberId,
        calendar_type: 'lunar_vietnamese',
        date_parts: { year: 2025, month: 6, day: 30 },
        lunar_policy: { month_mode: 'regular', missing_day: 'last_day' },
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects missing or incompatible calendar policies', async () => {
    const missingLunarPolicy = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        calendar_type: 'lunar_vietnamese',
        date_parts: { year: 2025, month: 6, day: 1 },
      },
    });
    expect(missingLunarPolicy.statusCode).toBe(400);

    const lunarPolicyOnGregorian = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        calendar_type: 'gregorian',
        date_parts: { year: 2025, month: 6, day: 1 },
        lunar_policy: { month_mode: 'regular', missing_day: 'skip' },
      },
    });
    expect(lunarPolicyOnGregorian.statusCode).toBe(400);

    const bothForOneTime = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        recurrence: 'none',
        calendar_type: 'lunar_vietnamese',
        date_parts: { year: 2025, month: 6, day: 1 },
        lunar_policy: { month_mode: 'both', missing_day: 'skip' },
      },
    });
    expect(bothForOneTime.statusCode).toBe(400);
  });

  it('requires a source year for one-time events but permits null for yearly events', async () => {
    const oneTime = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        recurrence: 'none',
        calendar_type: 'gregorian',
        date_parts: { year: null, month: 6, day: 1 },
      },
    });
    expect(oneTime.statusCode).toBe(400);

    const yearly = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        calendar_type: 'gregorian',
        date_parts: { year: null, month: 6, day: 1 },
      },
    });
    expect(yearly.statusCode, yearly.body).toBe(200);
  });

  it('keeps all-day and timed event fields consistent', async () => {
    const timed = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        all_day: false,
        starts_local_time: '18:30',
        duration_minutes: 120,
        calendar_type: 'gregorian',
        date_parts: { year: null, month: 6, day: 1 },
      },
    });
    expect(timed.statusCode, timed.body).toBe(200);

    const missingTime = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        all_day: false,
        calendar_type: 'gregorian',
        date_parts: { year: null, month: 6, day: 1 },
      },
    });
    expect(missingTime.statusCode).toBe(400);

    const timeOnAllDay = await app.inject({
      method: 'POST',
      url: '/events',
      payload: {
        ...common,
        starts_local_time: '18:30',
        calendar_type: 'gregorian',
        date_parts: { year: null, month: 6, day: 1 },
      },
    });
    expect(timeOnAllDay.statusCode).toBe(400);
  });

  it('rejects unsupported timezones, authority fields and unknown data', async () => {
    for (const extra of [
      { timezone: 'Vietnam time' },
      { family_id: memberId },
      { creator_membership_id: memberId },
      { actor_id: memberId },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/events',
        payload: {
          ...common,
          calendar_type: 'gregorian',
          date_parts: { year: null, month: 6, day: 1 },
          ...extra,
        },
      });
      expect(response.statusCode).toBe(400);
    }
  });
});

describe('calendar mutation and list schemas', () => {
  const desiredEvent = {
    ...common,
    calendar_type: 'gregorian',
    date_parts: { year: null, month: 6, day: 1 },
  };

  it('accepts a full versioned update and rejects authority fields', async () => {
    const accepted = await app.inject({
      method: 'PATCH',
      url: '/events',
      payload: { version: 3, event: desiredEvent },
    });
    expect(accepted.statusCode, accepted.body).toBe(200);

    const rejected = await app.inject({
      method: 'PATCH',
      url: '/events',
      payload: { version: 3, event: desiredEvent, family_id: memberId },
    });
    expect(rejected.statusCode).toBe(400);
  });

  it('accepts only version for cancellation and only response for RSVP', async () => {
    const cancel = await app.inject({ method: 'POST', url: '/cancel', payload: { version: 2 } });
    expect(cancel.statusCode).toBe(200);
    const forgedCancel = await app.inject({
      method: 'POST',
      url: '/cancel',
      payload: { version: 2, creator_membership_id: memberId },
    });
    expect(forgedCancel.statusCode).toBe(400);

    for (const response of ['yes', 'no', 'maybe']) {
      const rsvp = await app.inject({ method: 'PUT', url: '/rsvp', payload: { response } });
      expect(rsvp.statusCode).toBe(200);
    }
    const forgedRsvp = await app.inject({
      method: 'PUT',
      url: '/rsvp',
      payload: { response: 'yes', membership_id: memberId },
    });
    expect(forgedRsvp.statusCode).toBe(400);
  });

  it('validates bounded list query dates and pagination', async () => {
    const accepted = await app.inject({
      method: 'GET',
      url: '/events?from=2026-01-01&to=2026-12-31&limit=50&cursor=opaque-cursor',
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
      limit: 50,
      cursor: 'opaque-cursor',
    });

    for (const url of [
      '/events?from=01-01-2026&to=2026-12-31',
      '/events?from=2026-01-01&to=2026-12-31&limit=101',
      `/events?from=2026-01-01&to=2026-12-31&family_id=${memberId}`,
    ]) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(400);
    }
  });
});
