import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type {
  CreateEventInput,
  EventDetailResponse,
  EventDto,
  EventOccurrenceDto,
  EventOccurrenceListResponse,
  EventRsvpDto,
  EventRsvpResponse,
} from '@family/contracts';
import { CalendarUnavailableError, type CalendarConverter } from '@family/domain';
import { writeAudit } from './audit.js';
import {
  FamilyHttpError,
  lockFamily,
  requireFamily,
  setRouteContext,
  type FamilyMembership,
} from './authorization.js';
import { generateOccurrences, type GeneratedOccurrence } from './calendar-occurrences.js';

const DAY_MS = 86_400_000;
const MAX_LIST_DAYS = 550;

interface EventRow {
  id: string;
  creator_membership_id: string;
  member_id: string | null;
  kind: EventDto['kind'];
  title: string;
  note: string | null;
  location: string | null;
  calendar_type: EventDto['calendar_type'];
  recurrence: EventDto['recurrence'];
  timezone: 'Asia/Ho_Chi_Minh';
  date_year: number | null;
  date_month: number;
  date_day: number;
  lunar_month_mode: 'regular' | 'leap_only' | 'both' | null;
  lunar_missing_day_policy: 'last_day' | 'skip' | null;
  feb29_policy: 'feb28' | 'mar1' | 'skip' | null;
  all_day: boolean;
  starts_local_time: string | null;
  duration_minutes: number | null;
  reminder_offsets: EventDto['reminder_offsets'];
  revision: number;
  version: number;
  status: EventDto['status'];
  created_at: Date | string;
  updated_at: Date | string;
}

interface OccurrenceRow {
  id: string;
  event_id: string;
  event_revision: number;
  local_date: string;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  calendar_conversion_version: string | null;
  status: EventOccurrenceDto['status'];
  my_rsvp: EventRsvpResponse | null;
  kind: EventDto['kind'];
  title: string;
  member_id: string | null;
  calendar_type: EventDto['calendar_type'];
  all_day: boolean;
}

interface ListCursor {
  family_id: string;
  from: string;
  to: string;
  local_date: string;
  starts_at: string | null;
  id: string;
}

function invalid(message: string): never {
  throw new FamilyHttpError(400, 'VALIDATION_ERROR', message);
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function localTime(value: string | null): string | undefined {
  return value === null ? undefined : value.slice(0, 5);
}

function normalizeText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  return value.trim().normalize('NFC');
}

function normalizeEvent(input: CreateEventInput): CreateEventInput {
  return {
    ...input,
    title: normalizeText(input.title)!,
    ...(input.note !== undefined ? { note: normalizeText(input.note) } : {}),
    ...(input.location !== undefined ? { location: normalizeText(input.location) } : {}),
    reminder_offsets: [...input.reminder_offsets],
  } as CreateEventInput;
}

function toInput(row: EventRow): CreateEventInput {
  const common = {
    kind: row.kind,
    title: row.title,
    note: row.note,
    location: row.location,
    member_id: row.member_id,
    recurrence: row.recurrence,
    timezone: row.timezone,
    date_parts: { year: row.date_year, month: row.date_month, day: row.date_day },
    all_day: row.all_day,
    ...(localTime(row.starts_local_time) !== undefined
      ? { starts_local_time: localTime(row.starts_local_time) }
      : {}),
    ...(row.duration_minutes !== null ? { duration_minutes: row.duration_minutes } : {}),
    reminder_offsets: row.reminder_offsets,
  };
  if (row.calendar_type === 'gregorian') {
    return {
      ...common,
      calendar_type: 'gregorian',
      ...(row.feb29_policy !== null ? { feb29_policy: row.feb29_policy } : {}),
    } as CreateEventInput;
  }
  return {
    ...common,
    calendar_type: 'lunar_vietnamese',
    lunar_policy: {
      month_mode: row.lunar_month_mode!,
      missing_day: row.lunar_missing_day_policy!,
    },
  } as CreateEventInput;
}

function mapEvent(row: EventRow, membership: FamilyMembership): EventDto {
  return {
    ...toInput(row),
    id: row.id,
    status: row.status,
    revision: row.revision,
    version: row.version,
    can_edit: membership.role === 'admin' || row.creator_membership_id === membership.id,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapOccurrence(row: OccurrenceRow): EventOccurrenceDto {
  return {
    id: row.id,
    event_id: row.event_id,
    event_revision: row.event_revision,
    local_date: row.local_date,
    starts_at: row.starts_at === null ? null : iso(row.starts_at),
    ends_at: row.ends_at === null ? null : iso(row.ends_at),
    calendar_conversion_version: row.calendar_conversion_version,
    status: row.status,
    my_rsvp: row.my_rsvp,
    event: {
      id: row.event_id,
      kind: row.kind,
      title: row.title,
      member_id: row.member_id,
      calendar_type: row.calendar_type,
      all_day: row.all_day,
    },
  };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]),
  );
}

function requestHash(input: CreateEventInput): string {
  return createHash('sha256')
    .update(JSON.stringify(stable(input)))
    .digest('hex');
}

function vietnamToday(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function shiftDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftMonths(value: string, months: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function generationWindow(today = vietnamToday()): { from: string; to: string } {
  return { from: shiftDays(today, -30), to: shiftMonths(today, 18) };
}

function mapCalendarError(error: unknown): never {
  if (error instanceof CalendarUnavailableError) {
    throw new FamilyHttpError(503, 'CALENDAR_UNAVAILABLE', error.message);
  }
  throw error;
}

async function insertOccurrences(
  client: PoolClient,
  input: {
    familyId: string;
    eventId: string;
    revision: number;
    occurrences: GeneratedOccurrence[];
  },
): Promise<void> {
  for (const occurrence of input.occurrences) {
    await client.query(
      `INSERT INTO event_occurrences(
         family_id,event_id,event_revision,local_date,starts_at,ends_at,
         calendar_conversion_version,status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'active')
       ON CONFLICT (family_id,event_id,event_revision,local_date,starts_at)
       DO NOTHING`,
      [
        input.familyId,
        input.eventId,
        input.revision,
        occurrence.localDate,
        occurrence.startsAt,
        occurrence.endsAt,
        occurrence.calendarConversionVersion,
      ],
    );
  }
}

const EVENT_COLUMNS = `
  id,creator_membership_id,member_id,kind,title,note,location,calendar_type,recurrence,
  timezone,date_year,date_month,date_day,lunar_month_mode,lunar_missing_day_policy,
  feb29_policy,all_day,starts_local_time,duration_minutes,reminder_offsets,revision,
  version,status,created_at,updated_at`;

async function findEvent(
  client: PoolClient,
  familyId: string,
  eventId: string,
): Promise<EventRow | undefined> {
  const result = await client.query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events WHERE family_id=$1 AND id=$2 LIMIT 1`,
    [familyId, eventId],
  );
  return result.rows[0];
}

function assertCanEdit(row: EventRow, membership: FamilyMembership): void {
  if (membership.role !== 'admin' && row.creator_membership_id !== membership.id) {
    throw new FamilyHttpError(403, 'FORBIDDEN', 'Bạn không có quyền sửa ngày này');
  }
}

function eventValues(input: CreateEventInput): unknown[] {
  return [
    input.member_id ?? null,
    input.kind,
    input.title,
    input.note ?? null,
    input.location ?? null,
    input.calendar_type,
    input.recurrence,
    input.timezone,
    input.date_parts.year,
    input.date_parts.month,
    input.date_parts.day,
    input.calendar_type === 'lunar_vietnamese' ? input.lunar_policy.month_mode : null,
    input.calendar_type === 'lunar_vietnamese' ? input.lunar_policy.missing_day : null,
    input.calendar_type === 'gregorian' ? (input.feb29_policy ?? null) : null,
    input.all_day,
    input.starts_local_time ?? null,
    input.duration_minutes ?? null,
    input.reminder_offsets,
  ];
}

export async function createCalendarEvent(
  client: PoolClient,
  input: {
    familyId: string;
    actorId: string;
    idempotencyKey: string;
    event: CreateEventInput;
    today?: string;
    converter?: CalendarConverter;
  },
): Promise<EventDetailResponse> {
  await setRouteContext(client, { purpose: 'calendar_write' });
  await lockFamily(client, `${input.familyId}:calendar:${input.idempotencyKey}`);
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const event = normalizeEvent(input.event);
  const hash = requestHash(event);
  const existingKey = await client.query<{ request_hash: string; event_id: string }>(
    `SELECT request_hash,event_id FROM event_idempotency_keys
      WHERE family_id=$1 AND actor_membership_id=$2 AND idempotency_key=$3`,
    [input.familyId, membership.id, input.idempotencyKey],
  );
  if (existingKey.rows[0]) {
    if (existingKey.rows[0].request_hash !== hash) {
      throw new FamilyHttpError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Khóa gửi lại đã dùng cho dữ liệu khác',
      );
    }
    return getCalendarEvent(client, {
      familyId: input.familyId,
      actorId: input.actorId,
      eventId: existingKey.rows[0].event_id,
    });
  }

  let occurrences: GeneratedOccurrence[];
  try {
    occurrences = generateOccurrences(event, generationWindow(input.today), input.converter);
  } catch (error) {
    mapCalendarError(error);
  }

  const values = eventValues(event);
  const created = await client.query<EventRow>(
    `INSERT INTO events(
       family_id,creator_membership_id,member_id,kind,title,note,location,calendar_type,
       recurrence,timezone,date_year,date_month,date_day,lunar_month_mode,
       lunar_missing_day_policy,feb29_policy,all_day,starts_local_time,duration_minutes,
       reminder_offsets
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     RETURNING ${EVENT_COLUMNS}`,
    [input.familyId, membership.id, ...values],
  );
  const row = created.rows[0]!;
  await insertOccurrences(client, {
    familyId: input.familyId,
    eventId: row.id,
    revision: row.revision,
    occurrences,
  });
  await client.query(
    `INSERT INTO event_idempotency_keys(
       family_id,actor_membership_id,idempotency_key,request_hash,event_id
     ) VALUES ($1,$2,$3,$4,$5)`,
    [input.familyId, membership.id, input.idempotencyKey, hash, row.id],
  );
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'event.created',
    targetType: 'event',
    targetId: row.id,
    changeSummary: 'Created family event',
  });
  return getCalendarEvent(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    eventId: row.id,
  });
}

function parseListDate(value: string, field: string): number {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) {
    invalid(`${field} không hợp lệ`);
  }
  return time;
}

function decodeCursor(
  cursor: string | undefined,
  expected: Pick<ListCursor, 'family_id' | 'from' | 'to'>,
): ListCursor | undefined {
  if (cursor === undefined) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as ListCursor;
    if (
      value.family_id !== expected.family_id ||
      value.from !== expected.from ||
      value.to !== expected.to ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.local_date) ||
      (value.starts_at !== null && typeof value.starts_at !== 'string') ||
      typeof value.id !== 'string'
    ) {
      invalid('Cursor không hợp lệ');
    }
    return value;
  } catch {
    invalid('Cursor không hợp lệ');
  }
}

function encodeCursor(cursor: ListCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export async function listCalendarOccurrences(
  client: PoolClient,
  input: {
    familyId: string;
    actorId: string;
    from: string;
    to: string;
    cursor?: string;
    limit: number;
  },
): Promise<EventOccurrenceListResponse> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  void membership;
  const fromTime = parseListDate(input.from, 'Ngày bắt đầu');
  const toTime = parseListDate(input.to, 'Ngày kết thúc');
  if (fromTime > toTime || toTime - fromTime > MAX_LIST_DAYS * DAY_MS) {
    invalid('Khoảng ngày không hợp lệ');
  }
  const cursor = decodeCursor(input.cursor, {
    family_id: input.familyId,
    from: input.from,
    to: input.to,
  });
  const result = await client.query<OccurrenceRow>(
    `SELECT o.id,o.event_id,o.event_revision,o.local_date::text,o.starts_at,o.ends_at,
            o.calendar_conversion_version,o.status,r.response AS my_rsvp,
            e.kind,e.title,e.member_id,e.calendar_type,e.all_day
       FROM event_occurrences o
       JOIN events e ON e.family_id=o.family_id AND e.id=o.event_id
                     AND e.revision=o.event_revision
       LEFT JOIN event_rsvps r ON r.family_id=o.family_id AND r.occurrence_id=o.id
                               AND r.membership_id=$4
      WHERE o.family_id=$1 AND o.status='active' AND e.status='active'
        AND o.local_date BETWEEN $2::date AND $3::date
        AND ($5::date IS NULL OR (o.local_date,COALESCE(o.starts_at,'-infinity'),o.id)
             > ($5::date,COALESCE($6::timestamptz,'-infinity'),$7::uuid))
      ORDER BY o.local_date, o.starts_at NULLS FIRST, o.id
      LIMIT $8`,
    [
      input.familyId,
      input.from,
      input.to,
      membership.id,
      cursor?.local_date ?? null,
      cursor?.starts_at ?? null,
      cursor?.id ?? null,
      input.limit + 1,
    ],
  );
  const hasMore = result.rows.length > input.limit;
  const rows = hasMore ? result.rows.slice(0, input.limit) : result.rows;
  const last = rows.at(-1);
  return {
    occurrences: rows.map(mapOccurrence),
    next_cursor:
      hasMore && last
        ? encodeCursor({
            family_id: input.familyId,
            from: input.from,
            to: input.to,
            local_date: last.local_date,
            starts_at: last.starts_at === null ? null : iso(last.starts_at),
            id: last.id,
          })
        : null,
  };
}

export async function getCalendarEvent(
  client: PoolClient,
  input: { familyId: string; actorId: string; eventId: string },
): Promise<EventDetailResponse> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const event = await findEvent(client, input.familyId, input.eventId);
  if (!event) throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy ngày này');
  const occurrences = await client.query<OccurrenceRow>(
    `SELECT o.id,o.event_id,o.event_revision,o.local_date::text,o.starts_at,o.ends_at,
            o.calendar_conversion_version,o.status,r.response AS my_rsvp,
            e.kind,e.title,e.member_id,e.calendar_type,e.all_day
       FROM event_occurrences o
       JOIN events e ON e.family_id=o.family_id AND e.id=o.event_id
       LEFT JOIN event_rsvps r ON r.family_id=o.family_id AND r.occurrence_id=o.id
                               AND r.membership_id=$3
      WHERE o.family_id=$1 AND o.event_id=$2 AND o.event_revision=e.revision
      ORDER BY o.local_date,o.starts_at NULLS FIRST,o.id`,
    [input.familyId, input.eventId, membership.id],
  );
  return { event: mapEvent(event, membership), occurrences: occurrences.rows.map(mapOccurrence) };
}

export async function updateCalendarEvent(
  client: PoolClient,
  input: {
    familyId: string;
    actorId: string;
    eventId: string;
    version: number;
    event: CreateEventInput;
    today?: string;
    converter?: CalendarConverter;
  },
): Promise<EventDetailResponse> {
  await setRouteContext(client, { purpose: 'calendar_write' });
  await lockFamily(client, `${input.familyId}:calendar`);
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const current = await findEvent(client, input.familyId, input.eventId);
  if (!current) throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy ngày này');
  assertCanEdit(current, membership);
  if (current.status !== 'active' || current.version !== input.version) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Ngày này đã thay đổi, vui lòng tải lại');
  }
  const event = normalizeEvent(input.event);
  let occurrences: GeneratedOccurrence[];
  try {
    occurrences = generateOccurrences(event, generationWindow(input.today), input.converter);
  } catch (error) {
    mapCalendarError(error);
  }
  const values = eventValues(event);
  const updated = await client.query<EventRow>(
    `UPDATE events SET
       member_id=$3,kind=$4,title=$5,note=$6,location=$7,calendar_type=$8,recurrence=$9,
       timezone=$10,date_year=$11,date_month=$12,date_day=$13,lunar_month_mode=$14,
       lunar_missing_day_policy=$15,feb29_policy=$16,all_day=$17,starts_local_time=$18,
       duration_minutes=$19,reminder_offsets=$20,revision=revision+1,version=version+1,
       updated_at=clock_timestamp()
      WHERE family_id=$1 AND id=$2 AND version=$21 AND status='active'
      RETURNING ${EVENT_COLUMNS}`,
    [input.familyId, input.eventId, ...values, input.version],
  );
  const row = updated.rows[0];
  if (!row) throw new FamilyHttpError(409, 'CONFLICT', 'Ngày này đã thay đổi, vui lòng tải lại');
  await client.query(
    `UPDATE event_occurrences SET status='cancelled'
      WHERE family_id=$1 AND event_id=$2 AND event_revision<$3 AND status='active'
        AND local_date >= $4::date`,
    [input.familyId, input.eventId, row.revision, input.today ?? vietnamToday()],
  );
  await insertOccurrences(client, {
    familyId: input.familyId,
    eventId: input.eventId,
    revision: row.revision,
    occurrences,
  });
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'event.updated',
    targetType: 'event',
    targetId: input.eventId,
    changeSummary: 'Updated family event',
    version: row.version,
  });
  return getCalendarEvent(client, input);
}

export async function cancelCalendarEvent(
  client: PoolClient,
  input: { familyId: string; actorId: string; eventId: string; version: number; today?: string },
): Promise<EventDetailResponse> {
  await setRouteContext(client, { purpose: 'calendar_write' });
  await lockFamily(client, `${input.familyId}:calendar`);
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const current = await findEvent(client, input.familyId, input.eventId);
  if (!current) throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy ngày này');
  assertCanEdit(current, membership);
  if (current.status !== 'active' || current.version !== input.version) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Ngày này đã thay đổi, vui lòng tải lại');
  }
  const updated = await client.query<EventRow>(
    `UPDATE events SET status='cancelled',cancelled_at=clock_timestamp(),
       version=version+1,updated_at=clock_timestamp()
      WHERE family_id=$1 AND id=$2 AND version=$3 AND status='active'
      RETURNING ${EVENT_COLUMNS}`,
    [input.familyId, input.eventId, input.version],
  );
  if (!updated.rows[0]) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Ngày này đã thay đổi, vui lòng tải lại');
  }
  await client.query(
    `UPDATE event_occurrences SET status='cancelled'
      WHERE family_id=$1 AND event_id=$2 AND status='active' AND local_date >= $3::date`,
    [input.familyId, input.eventId, input.today ?? vietnamToday()],
  );
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'event.cancelled',
    targetType: 'event',
    targetId: input.eventId,
    changeSummary: 'Cancelled family event',
    version: updated.rows[0].version,
  });
  return getCalendarEvent(client, input);
}

export async function upsertCalendarRsvp(
  client: PoolClient,
  input: {
    familyId: string;
    actorId: string;
    occurrenceId: string;
    response: EventRsvpResponse;
  },
): Promise<EventRsvpDto> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const occurrence = await client.query<{ id: string }>(
    `SELECT o.id FROM event_occurrences o
       JOIN events e ON e.family_id=o.family_id AND e.id=o.event_id
      WHERE o.family_id=$1 AND o.id=$2 AND o.status='active' AND e.status='active'
        AND o.event_revision=e.revision`,
    [input.familyId, input.occurrenceId],
  );
  if (!occurrence.rows[0]) {
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy lần diễn ra này');
  }
  const result = await client.query<{ response: EventRsvpResponse; updated_at: Date | string }>(
    `INSERT INTO event_rsvps(family_id,occurrence_id,membership_id,response)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (family_id,occurrence_id,membership_id)
     DO UPDATE SET response=EXCLUDED.response,updated_at=clock_timestamp()
     RETURNING response,updated_at`,
    [input.familyId, input.occurrenceId, membership.id, input.response],
  );
  return {
    occurrence_id: input.occurrenceId,
    response: result.rows[0]!.response,
    updated_at: iso(result.rows[0]!.updated_at),
  };
}
