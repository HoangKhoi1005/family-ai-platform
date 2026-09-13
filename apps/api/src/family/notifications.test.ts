import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  getNotificationPreferences,
  listNotifications,
  markNotificationRead,
  updateNotificationPreferences,
} from './notifications.js';

const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const familyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const membershipId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const notificationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function result<T extends Record<string, unknown>>(rows: T[], command = 'SELECT'): QueryResult<T> {
  return { rows, rowCount: rows.length, command, oid: 0, fields: [] };
}

function clientFor(
  handler: (sql: string, values: unknown[] | undefined) => QueryResult<Record<string, unknown>>,
) {
  return {
    query: async (sql: string, values?: unknown[]) => handler(sql, values),
  } as unknown as PoolClient;
}

describe('notification inbox', () => {
  it('returns only the current membership timeline with an opaque next cursor', async () => {
    const client = clientFor((sql, values) => {
      if (sql.includes('FROM family_memberships')) {
        return result([{ id: membershipId, role: 'member' }]);
      }
      if (sql.includes('count(*)')) return result([{ unread_count: '2' }]);
      if (sql.includes('FROM notifications')) {
        expect(values?.slice(0, 2)).toEqual([familyId, membershipId]);
        return result([
          {
            id: notificationId,
            kind: 'event_reminder',
            channel: 'in_app',
            event_id: '10000000-0000-4000-8000-000000000001',
            occurrence_id: '20000000-0000-4000-8000-000000000002',
            event_revision: 2,
            reminder_offset: 'one_day',
            created_at: '2026-09-14T01:00:00.000Z',
            read_at: null,
          },
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            kind: 'event_reminder',
            channel: 'in_app',
            event_id: '30000000-0000-4000-8000-000000000003',
            occurrence_id: '40000000-0000-4000-8000-000000000004',
            event_revision: 1,
            reminder_offset: 'same_day',
            created_at: '2026-09-13T01:00:00.000Z',
            read_at: null,
          },
        ]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const response = await listNotifications(client, {
      familyId,
      actorId,
      limit: 1,
      unreadOnly: true,
    });

    expect(response.notifications).toHaveLength(1);
    expect(response.unread_count).toBe(2);
    expect(response.next_cursor).toEqual(expect.any(String));
  });

  it('marks a notification read with COALESCE so retries preserve the first timestamp', async () => {
    let updateSql = '';
    const client = clientFor((sql) => {
      if (sql.includes('FROM family_memberships')) {
        return result([{ id: membershipId, role: 'member' }]);
      }
      if (sql.includes('UPDATE notifications')) {
        updateSql = sql;
        return result([
          {
            id: notificationId,
            read_at: '2026-09-14T02:00:00.000Z',
          },
        ]);
      }
      if (sql.includes("set_config('app.purpose'")) return result([]);
      throw new Error(`Unexpected query: ${sql}`);
    });

    const response = await markNotificationRead(client, {
      familyId,
      notificationId,
      actorId,
    });

    expect(updateSql).toContain('COALESCE(read_at, now())');
    expect(response).toEqual({
      id: notificationId,
      read_at: '2026-09-14T02:00:00.000Z',
    });
  });
});

describe('notification preferences', () => {
  it('returns safe defaults without creating a row during GET', async () => {
    const client = clientFor((sql) => {
      if (sql.includes('FROM family_memberships')) {
        return result([{ id: membershipId, role: 'member' }]);
      }
      if (sql.includes('FROM notification_preferences')) return result([]);
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(getNotificationPreferences(client, { familyId, actorId })).resolves.toEqual({
      reminder_offsets: ['seven_days', 'one_day', 'same_day'],
      quiet_hours: {
        starts_at: '21:00',
        ends_at: '07:00',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      push_enabled: false,
      version: 0,
      updated_at: null,
    });
  });

  it('updates an existing row only when its optimistic version still matches', async () => {
    const client = clientFor((sql, values) => {
      if (sql.includes('FROM family_memberships')) {
        return result([{ id: membershipId, role: 'member' }]);
      }
      if (sql.includes("set_config('app.purpose'")) return result([]);
      if (sql.includes('UPDATE notification_preferences')) {
        expect(values).toContain(4);
        return result([
          {
            reminder_offsets: ['one_day'],
            quiet_hours_start: '21:00:00',
            quiet_hours_end: '07:00:00',
            timezone: 'Asia/Ho_Chi_Minh',
            push_enabled: false,
            version: 5,
            updated_at: '2026-09-14T03:00:00.000Z',
          },
        ]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const response = await updateNotificationPreferences(client, {
      familyId,
      actorId,
      input: {
        reminder_offsets: ['one_day'],
        quiet_hours: {
          starts_at: '21:00',
          ends_at: '07:00',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        push_enabled: false,
        version: 4,
      },
    });

    expect(response.version).toBe(5);
    expect(response.reminder_offsets).toEqual(['one_day']);
  });
});
