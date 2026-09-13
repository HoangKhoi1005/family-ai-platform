import type { PoolClient } from 'pg';
import type {
  EventReminderOffset,
  NotificationDto,
  NotificationListResponse,
  NotificationPreferencesDto,
  UpdateNotificationPreferencesInput,
} from '@family/contracts';
import { FamilyHttpError, requireFamily, setRouteContext } from './authorization.js';

const DEFAULT_OFFSETS: EventReminderOffset[] = ['seven_days', 'one_day', 'same_day'];
const DEFAULT_QUIET_START = '21:00';
const DEFAULT_QUIET_END = '07:00';

interface NotificationRow {
  id: string;
  kind: 'event_reminder';
  channel: 'in_app';
  event_id: string;
  occurrence_id: string;
  event_revision: number;
  reminder_offset: EventReminderOffset;
  created_at: Date | string;
  read_at: Date | string | null;
}

interface PreferenceRow {
  reminder_offsets: EventReminderOffset[];
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: 'Asia/Ho_Chi_Minh';
  push_enabled: boolean;
  version: number;
  updated_at: Date | string;
}

interface NotificationCursor {
  family_id: string;
  created_at: string;
  id: string;
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function localTime(value: string): string {
  return value.slice(0, 5);
}

function mapNotification(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    kind: row.kind,
    channel: row.channel,
    event_id: row.event_id,
    occurrence_id: row.occurrence_id,
    event_revision: row.event_revision,
    reminder_offset: row.reminder_offset,
    created_at: iso(row.created_at),
    read_at: row.read_at === null ? null : iso(row.read_at),
  };
}

function mapPreferences(row: PreferenceRow): NotificationPreferencesDto {
  return {
    reminder_offsets: row.reminder_offsets,
    quiet_hours: {
      starts_at: localTime(row.quiet_hours_start),
      ends_at: localTime(row.quiet_hours_end),
      timezone: row.timezone,
    },
    push_enabled: row.push_enabled,
    version: row.version,
    updated_at: iso(row.updated_at),
  };
}

function encodeCursor(familyId: string, row: NotificationRow): string {
  return Buffer.from(
    JSON.stringify({ family_id: familyId, created_at: iso(row.created_at), id: row.id }),
  ).toString('base64url');
}

function decodeCursor(value: string, familyId: string): NotificationCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<NotificationCursor>;
    if (
      parsed.family_id !== familyId ||
      typeof parsed.created_at !== 'string' ||
      !Number.isFinite(new Date(parsed.created_at).getTime()) ||
      typeof parsed.id !== 'string'
    ) {
      throw new Error('invalid cursor');
    }
    return parsed as NotificationCursor;
  } catch {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Notification cursor is invalid');
  }
}

export async function listNotifications(
  client: PoolClient,
  input: {
    familyId: string;
    actorId: string;
    cursor?: string;
    limit: number;
    unreadOnly?: boolean;
  },
): Promise<NotificationListResponse> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const cursor = input.cursor ? decodeCursor(input.cursor, input.familyId) : null;
  const values: unknown[] = [input.familyId, membership.id];
  const conditions = ['family_id = $1', 'recipient_membership_id = $2'];
  if (input.unreadOnly) conditions.push('read_at IS NULL');
  if (cursor) {
    values.push(cursor.created_at, cursor.id);
    conditions.push(
      `(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
    );
  }
  values.push(input.limit + 1);

  const [timeline, unread] = await Promise.all([
    client.query<NotificationRow>(
      `SELECT id,kind,channel,event_id,occurrence_id,event_revision,reminder_offset,
              created_at,read_at
         FROM notifications
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT $${values.length}`,
      values,
    ),
    client.query<{ unread_count: string }>(
      `SELECT count(*)::text AS unread_count
         FROM notifications
        WHERE family_id=$1 AND recipient_membership_id=$2 AND read_at IS NULL`,
      [input.familyId, membership.id],
    ),
  ]);

  const hasMore = timeline.rows.length > input.limit;
  const page = timeline.rows.slice(0, input.limit);
  const tail = page.at(-1);
  return {
    notifications: page.map(mapNotification),
    unread_count: Number(unread.rows[0]?.unread_count ?? 0),
    next_cursor: hasMore && tail ? encodeCursor(input.familyId, tail) : null,
  };
}

export async function markNotificationRead(
  client: PoolClient,
  input: { familyId: string; notificationId: string; actorId: string },
): Promise<{ id: string; read_at: string }> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  await setRouteContext(client, { purpose: 'notification_write' });
  const updated = await client.query<{ id: string; read_at: Date | string }>(
    `UPDATE notifications
        SET read_at=COALESCE(read_at, now())
      WHERE family_id=$1 AND id=$2 AND recipient_membership_id=$3
      RETURNING id,read_at`,
    [input.familyId, input.notificationId, membership.id],
  );
  const row = updated.rows[0];
  if (!row) throw new FamilyHttpError(404, 'NOT_FOUND', 'Notification was not found');
  return { id: row.id, read_at: iso(row.read_at) };
}

export async function getNotificationPreferences(
  client: PoolClient,
  input: { familyId: string; actorId: string },
): Promise<NotificationPreferencesDto> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const result = await client.query<PreferenceRow>(
    `SELECT reminder_offsets,quiet_hours_start,quiet_hours_end,timezone,push_enabled,version,updated_at
       FROM notification_preferences
      WHERE family_id=$1 AND membership_id=$2`,
    [input.familyId, membership.id],
  );
  const row = result.rows[0];
  if (row) return mapPreferences(row);
  return {
    reminder_offsets: [...DEFAULT_OFFSETS],
    quiet_hours: {
      starts_at: DEFAULT_QUIET_START,
      ends_at: DEFAULT_QUIET_END,
      timezone: 'Asia/Ho_Chi_Minh',
    },
    push_enabled: false,
    version: 0,
    updated_at: null,
  };
}

export async function updateNotificationPreferences(
  client: PoolClient,
  input: { familyId: string; actorId: string; input: UpdateNotificationPreferencesInput },
): Promise<NotificationPreferencesDto> {
  if (input.input.push_enabled) {
    throw new FamilyHttpError(400, 'PUSH_UNAVAILABLE', 'Push notifications are not available yet');
  }
  if (input.input.quiet_hours.starts_at === input.input.quiet_hours.ends_at) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Quiet hours must have a duration');
  }
  const membership = await requireFamily(client, input.actorId, input.familyId);
  await setRouteContext(client, { purpose: 'notification_write' });
  const values = [
    input.input.reminder_offsets,
    input.input.quiet_hours.starts_at,
    input.input.quiet_hours.ends_at,
    input.input.quiet_hours.timezone,
    input.input.push_enabled,
    input.familyId,
    membership.id,
    input.input.version,
  ];
  const updated = await client.query<PreferenceRow>(
    `UPDATE notification_preferences
        SET reminder_offsets=$1,quiet_hours_start=$2,quiet_hours_end=$3,timezone=$4,
            push_enabled=$5,version=version+1,updated_at=now()
      WHERE family_id=$6 AND membership_id=$7 AND version=$8
      RETURNING reminder_offsets,quiet_hours_start,quiet_hours_end,timezone,push_enabled,version,updated_at`,
    values,
  );
  if (updated.rows[0]) return mapPreferences(updated.rows[0]);

  if (input.input.version === 0) {
    const inserted = await client.query<PreferenceRow>(
      `INSERT INTO notification_preferences(
         family_id,membership_id,reminder_offsets,quiet_hours_start,quiet_hours_end,timezone,push_enabled
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (family_id,membership_id) DO NOTHING
       RETURNING reminder_offsets,quiet_hours_start,quiet_hours_end,timezone,push_enabled,version,updated_at`,
      [
        input.familyId,
        membership.id,
        input.input.reminder_offsets,
        input.input.quiet_hours.starts_at,
        input.input.quiet_hours.ends_at,
        input.input.quiet_hours.timezone,
        input.input.push_enabled,
      ],
    );
    if (inserted.rows[0]) return mapPreferences(inserted.rows[0]);
  }
  throw new FamilyHttpError(409, 'CONFLICT', 'Notification preferences changed');
}
