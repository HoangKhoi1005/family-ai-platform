import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateEventInput, EventDetailResponse } from '@family/contracts';
import {
  cancelFamilyEvent,
  createFamilyEvent,
  explain,
  getFamilyEvent,
  inviteTokenFrom,
  listFamilyOccurrences,
  listFamilyNotifications,
  getFamilyNotificationPreferences,
  markFamilyNotificationRead,
  RequestError,
  request,
  updateFamilyEvent,
  upsertFamilyOccurrenceRsvp,
  updateFamilyNotificationPreferences,
} from './api';

const familyId = '10000000-0000-4000-8000-000000000001';
const eventId = '20000000-0000-4000-8000-000000000002';
const occurrenceId = '30000000-0000-4000-8000-000000000003';
const notificationId = '40000000-0000-4000-8000-000000000004';
const event: CreateEventInput = {
  kind: 'gathering',
  title: 'Bữa cơm nhà',
  calendar_type: 'gregorian',
  recurrence: 'none',
  timezone: 'Asia/Ho_Chi_Minh',
  date_parts: { year: 2026, month: 9, day: 20 },
  all_day: true,
  reminder_offsets: ['one_day'],
};

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('invitation input', () => {
  it('accepts the shared link format and keeps only its token', () => {
    expect(inviteTokenFrom('https://family.example/login#invite=family_token-123')).toBe(
      'family_token-123',
    );
  });

  it('accepts a raw invitation token', () => {
    expect(inviteTokenFrom('  family_token-123  ')).toBe('family_token-123');
  });

  it('rejects links without an invitation and malformed values', () => {
    expect(inviteTokenFrom('https://family.example/login')).toBe('');
    expect(inviteTokenFrom('not an invitation')).toBe('');
    expect(inviteTokenFrom('x'.repeat(257))).toBe('');
  });
});

describe('connected request', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports a timed out request separately from an HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_path: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted', 'AbortError')),
            );
          }),
      ),
    );

    await expect(request('/api/v1/me', undefined, 'GET', { timeoutMs: 5 })).rejects.toEqual(
      new RequestError(0, 'REQUEST_TIMEOUT'),
    );
  });

  it('reports cancellation requested by the caller separately from a timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_path: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted', 'AbortError')),
            );
          }),
      ),
    );
    const controller = new AbortController();
    const pending = request('/api/v1/me', undefined, 'GET', {
      signal: controller.signal,
      timeoutMs: 1000,
    });

    controller.abort();

    await expect(pending).rejects.toEqual(new RequestError(0, 'REQUEST_ABORTED'));
  });

  it('explains an unavailable calendar without suggesting a guessed date', () => {
    expect(explain(new RequestError(503, 'CALENDAR_UNAVAILABLE'))).toBe(
      'Chưa thể xác nhận ngày này. Kiểm tra lại ngày và thử sau nhé.',
    );
  });
});

describe('family calendar API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds the occurrence range query without losing an opaque cursor', async () => {
    const fetch = vi.fn(() => jsonResponse({ occurrences: [], next_cursor: 'next-page' }));
    vi.stubGlobal('fetch', fetch);

    await listFamilyOccurrences(familyId, {
      from: '2026-09-01',
      to: '2026-10-31',
      cursor: 'date+/= cursor',
      limit: 3,
    });

    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/families/${familyId}/events?from=2026-09-01&to=2026-10-31&cursor=date%2B%2F%3D+cursor&limit=3`,
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('loads one event through its family-scoped route', async () => {
    const fetch = vi.fn(() => jsonResponse({ event: {}, occurrences: [] }));
    vi.stubGlobal('fetch', fetch);

    await getFamilyEvent(familyId, eventId);

    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/families/${familyId}/events/${eventId}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends the caller-owned idempotency key when creating an event', async () => {
    const detail = { event: {}, occurrences: [] } as unknown as EventDetailResponse;
    const fetch = vi.fn(() => jsonResponse(detail));
    vi.stubGlobal('fetch', fetch);

    await createFamilyEvent(familyId, event, 'calendar-draft-01');

    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/families/${familyId}/events`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'calendar-draft-01',
        },
        body: JSON.stringify(event),
      }),
    );
  });

  it('sends a whole-state update with the optimistic version', async () => {
    const fetch = vi.fn(() => jsonResponse({ event: {}, occurrences: [] }));
    vi.stubGlobal('fetch', fetch);

    await updateFamilyEvent(familyId, eventId, { version: 4, event });

    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/families/${familyId}/events/${eventId}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ version: 4, event }) }),
    );
  });

  it('cancels an event through its explicit action endpoint', async () => {
    const fetch = vi.fn(() => jsonResponse({ event: {}, occurrences: [] }));
    vi.stubGlobal('fetch', fetch);

    await cancelFamilyEvent(familyId, eventId, { version: 5 });

    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/families/${familyId}/events/${eventId}/cancel`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ version: 5 }) }),
    );
  });

  it('writes only the current member RSVP to the occurrence route', async () => {
    const fetch = vi.fn(() =>
      jsonResponse({ occurrence_id: occurrenceId, response: 'yes', updated_at: '2026-09-13' }),
    );
    vi.stubGlobal('fetch', fetch);

    await upsertFamilyOccurrenceRsvp(familyId, occurrenceId, { response: 'yes' });

    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/families/${familyId}/occurrences/${occurrenceId}/rsvp`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ response: 'yes' }) }),
    );
  });
});

describe('family notification API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the inbox and preserves its opaque cursor', async () => {
    const fetch = vi.fn(() =>
      jsonResponse({ notifications: [], unread_count: 0, next_cursor: null }),
    );
    vi.stubGlobal('fetch', fetch);

    await listFamilyNotifications(familyId, {
      cursor: 'created+/= cursor',
      limit: 12,
      unreadOnly: true,
    });

    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/families/${familyId}/notifications?cursor=created%2B%2F%3D+cursor&limit=12&unread_only=true`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('marks one notification read through the idempotent action route', async () => {
    const fetch = vi.fn(() => jsonResponse({ id: notificationId, read_at: '2026-09-14' }));
    vi.stubGlobal('fetch', fetch);

    await markFamilyNotificationRead(familyId, notificationId);

    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/families/${familyId}/notifications/${notificationId}/read`,
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });

  it('loads and updates the current member preferences', async () => {
    const preferences = {
      reminder_offsets: ['one_day'] as Array<'one_day'>,
      quiet_hours: {
        starts_at: '21:00',
        ends_at: '07:00',
        timezone: 'Asia/Ho_Chi_Minh' as const,
      },
      push_enabled: false,
      version: 2,
    };
    const fetch = vi.fn(() => jsonResponse({ ...preferences, updated_at: '2026-09-14' }));
    vi.stubGlobal('fetch', fetch);

    await getFamilyNotificationPreferences(familyId);
    await updateFamilyNotificationPreferences(familyId, preferences);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `/api/v1/families/${familyId}/notification-preferences`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `/api/v1/families/${familyId}/notification-preferences`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify(preferences) }),
    );
  });
});
