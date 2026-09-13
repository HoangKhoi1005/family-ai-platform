import type { EventReminderOffset } from './calendar.js';

export type NotificationKind = 'event_reminder';
export type NotificationChannel = 'in_app' | 'push';

export interface NotificationQuietHours {
  starts_at: string;
  ends_at: string;
  timezone: 'Asia/Ho_Chi_Minh';
}

export interface NotificationPreferencesDto {
  reminder_offsets: EventReminderOffset[];
  quiet_hours: NotificationQuietHours;
  push_enabled: boolean;
  version: number;
  updated_at: string;
}

export interface UpdateNotificationPreferencesInput {
  reminder_offsets: EventReminderOffset[];
  quiet_hours: NotificationQuietHours;
  push_enabled: boolean;
  version: number;
}

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  channel: 'in_app';
  event_id: string;
  occurrence_id: string;
  event_revision: number;
  reminder_offset: EventReminderOffset;
  created_at: string;
  read_at: string | null;
}

export interface NotificationListResponse {
  notifications: NotificationDto[];
  unread_count: number;
  next_cursor: string | null;
}

const reminderOffsets = {
  type: 'array',
  maxItems: 3,
  uniqueItems: true,
  items: { type: 'string', enum: ['seven_days', 'one_day', 'same_day'] },
} as const;

const localTime = { type: 'string', pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$' } as const;

export const updateNotificationPreferencesBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reminder_offsets', 'quiet_hours', 'push_enabled', 'version'],
  properties: {
    reminder_offsets: reminderOffsets,
    quiet_hours: {
      type: 'object',
      additionalProperties: false,
      required: ['starts_at', 'ends_at', 'timezone'],
      properties: {
        starts_at: localTime,
        ends_at: localTime,
        timezone: { const: 'Asia/Ho_Chi_Minh' },
      },
    },
    push_enabled: { type: 'boolean' },
    version: { type: 'integer', minimum: 1 },
  },
} as const;

export const notificationListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cursor: { type: 'string', minLength: 1, maxLength: 500 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    unread_only: { type: 'boolean', default: false },
  },
} as const;
