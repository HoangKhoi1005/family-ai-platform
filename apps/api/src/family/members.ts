import type { PoolClient } from 'pg';
import type {
  CreateMemberInput,
  MemberContactDto,
  MemberContactInput,
  MemberContactKind,
  MemberContactVisibility,
  MemberListResponse,
  MemberProfileDto,
  MemberSummaryDto,
  UpdateMemberInput,
} from '@family/contracts';
import { writeAudit } from './audit.js';
import {
  FamilyHttpError,
  isUuid,
  lockFamily,
  requireFamily,
  setRouteContext,
} from './authorization.js';

const MAX_CONTACTS = 10;
const FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'fb.com',
  'www.fb.com',
]);

interface MemberRow {
  id: string;
  display_name: string;
  familiar_name: string | null;
  hometown: string | null;
  biography: string | null;
  birth_date: string | null;
  birth_year: number | null;
  deceased: boolean;
  version: number;
}

interface ContactRow extends MemberContactDto {
  member_id?: string;
}

type NormalizedContact = Omit<MemberContactDto, 'id'>;

interface NormalizedCreateMember {
  display_name: string;
  familiar_name: string | null;
  hometown: string | null;
  biography: string | null;
  birth_date: string | null;
  birth_year: number | null;
  deceased: boolean;
  contacts?: NormalizedContact[];
}

interface NormalizedUpdateMember {
  version: number;
  display_name?: string;
  familiar_name?: string | null;
  hometown?: string | null;
  biography?: string | null;
  birth_date?: string | null;
  birth_year?: number | null;
  deceased?: boolean;
  contacts?: NormalizedContact[];
}

interface Cursor {
  family_id: string;
  query: string;
  display_name: string;
  id: string;
}

function invalid(message: string): never {
  throw new FamilyHttpError(400, 'VALIDATION_ERROR', message);
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function normalizeSearchQuery(value: string | undefined): string {
  return value?.trim().normalize('NFC').toLocaleLowerCase('vi-VN') ?? '';
}

function decodeCursor(
  value: string | undefined,
  expected: { familyId: string; query: string },
): Cursor | undefined {
  if (value === undefined) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (
      typeof decoded.family_id !== 'string' ||
      decoded.family_id !== expected.familyId ||
      typeof decoded.query !== 'string' ||
      decoded.query !== expected.query ||
      typeof decoded.display_name !== 'string' ||
      !isUuid(decoded.id)
    )
      invalid('Cursor không hợp lệ.');
    return {
      family_id: decoded.family_id,
      query: decoded.query,
      display_name: decoded.display_name,
      id: decoded.id,
    };
  } catch {
    invalid('Cursor không hợp lệ.');
  }
}

function normalizeDate(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('Ngày sinh không hợp lệ.');
  const parts = value.split('-').map(Number);
  const year = parts[0]!;
  const month = parts[1]!;
  const day = parts[2]!;
  if (year < 1) invalid('Ngày sinh không hợp lệ.');
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    invalid('Ngày sinh không hợp lệ.');
  }
  return value;
}

function normalizeText(
  value: string | null | undefined,
  field: string,
  max: number,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > max) invalid(`${field} không hợp lệ.`);
  return normalized;
}

function normalizePhone(value: string): string {
  const normalized = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+?[0-9]{7,20}$/.test(normalized)) invalid('Số điện thoại không hợp lệ.');
  return normalized;
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) invalid('Email liên hệ không hợp lệ.');
  return normalized;
}

function normalizeFacebook(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    invalid('Liên kết Facebook không hợp lệ.');
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !FACEBOOK_HOSTS.has(parsed.hostname.toLowerCase())
  ) {
    invalid('Liên kết Facebook không hợp lệ.');
  }
  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';
  return parsed.toString();
}

function normalizeContact(input: MemberContactInput): Omit<MemberContactDto, 'id'> {
  const kind = input.kind as MemberContactKind;
  const visibility = input.visibility ?? 'self';
  if (!['phone', 'email', 'facebook'].includes(kind)) invalid('Loại liên hệ không hợp lệ.');
  if (!['self', 'family'].includes(visibility)) invalid('Quyền hiển thị liên hệ không hợp lệ.');
  const raw = input.value.trim();
  if (raw.length === 0 || raw.length > 320) invalid('Liên hệ không hợp lệ.');
  const value =
    kind === 'phone'
      ? normalizePhone(raw)
      : kind === 'email'
        ? normalizeEmail(raw)
        : normalizeFacebook(raw);
  return { kind, value, visibility: visibility as MemberContactVisibility };
}

function normalizeContacts(
  contacts: MemberContactInput[] | undefined,
): NormalizedContact[] | undefined {
  if (contacts === undefined) return undefined;
  if (contacts.length > MAX_CONTACTS) invalid('Tối đa 10 liên hệ.');
  return contacts.map(normalizeContact);
}

function validateDatePair(
  birthDate: string | null | undefined,
  birthYear: number | null | undefined,
): void {
  const date = normalizeDate(birthDate);
  if (
    birthYear !== undefined &&
    birthYear !== null &&
    (!Number.isInteger(birthYear) || birthYear < 1 || birthYear > 9999)
  ) {
    invalid('Năm sinh không hợp lệ.');
  }
  if (
    date &&
    birthYear !== undefined &&
    birthYear !== null &&
    Number(date.slice(0, 4)) !== birthYear
  ) {
    invalid('Ngày và năm sinh không khớp.');
  }
}

export function normalizeCreateMemberInput(input: CreateMemberInput): NormalizedCreateMember {
  const displayName = normalizeText(input.display_name, 'Tên', 120);
  if (!displayName) invalid('Tên không hợp lệ.');
  const birthDate = normalizeDate(input.birth_date);
  validateDatePair(birthDate, input.birth_year);
  const normalized: NormalizedCreateMember = {
    display_name: displayName,
    familiar_name: normalizeText(input.familiar_name, 'Tên thường gọi', 120) ?? null,
    hometown: normalizeText(input.hometown, 'Quê quán', 200) ?? null,
    biography: normalizeText(input.biography, 'Tiểu sử', 1000) ?? null,
    birth_date: birthDate ?? null,
    birth_year: input.birth_year ?? null,
    deceased: input.deceased ?? false,
  };
  const contacts = normalizeContacts(input.contacts);
  if (contacts !== undefined) normalized.contacts = contacts;
  return normalized;
}

export function normalizeUpdateMemberInput(input: UpdateMemberInput): NormalizedUpdateMember {
  if (!Number.isInteger(input.version) || input.version < 1) invalid('Phiên bản không hợp lệ.');
  if (input.display_name !== undefined && !normalizeText(input.display_name, 'Tên', 120)) {
    invalid('Tên không hợp lệ.');
  }
  const birthDate = normalizeDate(input.birth_date);
  validateDatePair(birthDate, input.birth_year);
  const fields: NormalizedUpdateMember = { version: input.version };
  if (input.display_name !== undefined)
    fields.display_name = normalizeText(input.display_name, 'Tên', 120)!;
  if (input.familiar_name !== undefined)
    fields.familiar_name = normalizeText(input.familiar_name, 'Tên thường gọi', 120) ?? null;
  if (input.hometown !== undefined)
    fields.hometown = normalizeText(input.hometown, 'Quê quán', 200) ?? null;
  if (input.biography !== undefined)
    fields.biography = normalizeText(input.biography, 'Tiểu sử', 1000) ?? null;
  if (input.birth_date !== undefined) fields.birth_date = birthDate ?? null;
  if (input.birth_year !== undefined) fields.birth_year = input.birth_year;
  if (input.deceased !== undefined) fields.deceased = input.deceased;
  if (input.contacts !== undefined) fields.contacts = normalizeContacts(input.contacts) ?? [];
  if (Object.keys(fields).length === 1) invalid('Cần có nội dung cập nhật.');
  return fields;
}

function mapSummary(row: MemberRow): MemberSummaryDto {
  return {
    id: row.id,
    display_name: row.display_name,
    familiar_name: row.familiar_name,
    hometown: row.hometown,
    birth_date: row.birth_date,
    birth_year: row.birth_year,
    deceased: row.deceased,
    version: row.version,
  };
}

function mapProfile(row: MemberRow, contacts: ContactRow[]): MemberProfileDto {
  return { ...mapSummary(row), biography: row.biography, contacts };
}

const memberColumns = `
  m.id, m.display_name, m.familiar_name, m.hometown, m.biography,
  m.birth_date::text AS birth_date, m.birth_year, m.deceased, m.version`;

export async function listMembers(
  client: PoolClient,
  input: { familyId: string; q?: string; cursor?: string; limit: number },
): Promise<MemberListResponse> {
  const query = normalizeSearchQuery(input.q);
  const cursor = decodeCursor(input.cursor, { familyId: input.familyId, query });
  const values: unknown[] = [input.familyId];
  const predicates = ['m.family_id = $1'];
  if (query) {
    values.push(`%${escapeLikePattern(query)}%`);
    const index = values.length;
    predicates.push(
      `(public.unaccent(lower(m.display_name)) LIKE public.unaccent(lower($${index})) ESCAPE E'\\\\'
        OR public.unaccent(lower(coalesce(m.familiar_name, ''))) LIKE public.unaccent(lower($${index})) ESCAPE E'\\\\')`,
    );
  }
  if (cursor) {
    values.push(cursor.display_name, cursor.id);
    const nameIndex = values.length - 1;
    predicates.push(`(m.display_name, m.id) > ($${nameIndex}, $${nameIndex + 1})`);
  }
  values.push(input.limit + 1);
  const limitIndex = values.length;
  const result = await client.query<MemberRow>(
    `SELECT ${memberColumns}
       FROM members m
      WHERE ${predicates.join(' AND ')}
      ORDER BY m.display_name ASC, m.id ASC
      LIMIT $${limitIndex}`,
    values,
  );
  const hasMore = result.rows.length > input.limit;
  const rows = hasMore ? result.rows.slice(0, input.limit) : result.rows;
  return {
    members: rows.map(mapSummary),
    next_cursor: hasMore
      ? encodeCursor({
          family_id: input.familyId,
          query,
          display_name: rows[rows.length - 1]!.display_name,
          id: rows[rows.length - 1]!.id,
        })
      : null,
  };
}

async function selectMember(
  client: PoolClient,
  familyId: string,
  memberId: string,
): Promise<MemberRow> {
  const result = await client.query<MemberRow>(
    `SELECT ${memberColumns} FROM members m WHERE m.family_id = $1 AND m.id = $2`,
    [familyId, memberId],
  );
  const row = result.rows[0];
  if (!row) throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
  return row;
}

async function selectContacts(
  client: PoolClient,
  familyId: string,
  memberId: string,
): Promise<ContactRow[]> {
  const result = await client.query<ContactRow>(
    `SELECT id, kind, value, visibility
       FROM member_contacts
      WHERE family_id = $1 AND member_id = $2
      ORDER BY id`,
    [familyId, memberId],
  );
  return result.rows;
}

export async function getMemberProfile(
  client: PoolClient,
  input: { familyId: string; memberId: string },
): Promise<MemberProfileDto> {
  const row = await selectMember(client, input.familyId, input.memberId);
  return mapProfile(row, await selectContacts(client, input.familyId, input.memberId));
}

export async function getManagedMember(
  client: PoolClient,
  input: { familyId: string; memberId: string; actorId: string },
): Promise<MemberProfileDto> {
  await requireFamily(client, input.actorId, input.familyId, true);
  const row = await selectMember(client, input.familyId, input.memberId);
  const linked = await client.query(
    `SELECT 1 FROM member_account_links WHERE family_id = $1 AND member_id = $2 LIMIT 1`,
    [input.familyId, input.memberId],
  );
  if (linked.rowCount) throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
  await setRouteContext(client, { purpose: 'member_management', memberId: input.memberId });
  return mapProfile(row, await selectContacts(client, input.familyId, input.memberId));
}

async function memberAuthorization(
  client: PoolClient,
  input: { familyId: string; memberId: string; actorId: string },
): Promise<{ adminUnlinked: boolean }> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const linked = await client.query(
    `SELECT 1
       FROM member_account_links l
       JOIN family_memberships fm ON fm.family_id = l.family_id AND fm.id = l.membership_id
      WHERE l.family_id = $1 AND l.member_id = $2 AND fm.user_id = $3 AND fm.status = 'active'
      LIMIT 1`,
    [input.familyId, input.memberId, input.actorId],
  );
  const anyLink = await client.query(
    `SELECT 1 FROM member_account_links WHERE family_id = $1 AND member_id = $2 LIMIT 1`,
    [input.familyId, input.memberId],
  );
  if (linked.rowCount) return { adminUnlinked: false };
  if (membership.role === 'admin') {
    if (anyLink.rowCount)
      throw new FamilyHttpError(403, 'FORBIDDEN', 'Không được sửa hồ sơ đã liên kết.');
    await setRouteContext(client, { purpose: 'member_management', memberId: input.memberId });
    return { adminUnlinked: true };
  }
  throw new FamilyHttpError(403, 'FORBIDDEN', 'Bạn không có quyền sửa hồ sơ này.');
}

async function replaceContacts(
  client: PoolClient,
  familyId: string,
  memberId: string,
  contacts: Omit<MemberContactDto, 'id'>[],
): Promise<void> {
  await client.query('DELETE FROM member_contacts WHERE family_id = $1 AND member_id = $2', [
    familyId,
    memberId,
  ]);
  for (const contact of contacts) {
    await client.query(
      `INSERT INTO member_contacts(family_id, member_id, kind, value, visibility)
       VALUES ($1, $2, $3, $4, $5)`,
      [familyId, memberId, contact.kind, contact.value, contact.visibility],
    );
  }
}

export async function createMember(
  client: PoolClient,
  input: { familyId: string; actorId: string; member: CreateMemberInput },
): Promise<MemberProfileDto> {
  await requireFamily(client, input.actorId, input.familyId, true);
  await lockFamily(client, input.familyId);
  await requireFamily(client, input.actorId, input.familyId, true);
  const member = normalizeCreateMemberInput(input.member);
  const inserted = await client.query<MemberRow>(
    `INSERT INTO members(
       family_id, display_name, familiar_name, hometown, biography,
       birth_date, birth_year, deceased
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, display_name, familiar_name, hometown, biography,
       birth_date::text AS birth_date, birth_year, deceased, version`,
    [
      input.familyId,
      member.display_name,
      member.familiar_name ?? null,
      member.hometown ?? null,
      member.biography ?? null,
      member.birth_date ?? null,
      member.birth_year ?? null,
      member.deceased ?? false,
    ],
  );
  const row = inserted.rows[0];
  if (!row) throw new FamilyHttpError(500, 'INTERNAL_ERROR', 'Không thể tạo hồ sơ.');
  await setRouteContext(client, { purpose: 'member_management', memberId: row.id });
  if (member.contacts) await replaceContacts(client, input.familyId, row.id, member.contacts);
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'member.created',
    targetType: 'member',
    targetId: row.id,
    changeSummary: 'created',
    version: row.version,
  });
  return mapProfile(row, await selectContacts(client, input.familyId, row.id));
}

export async function updateMember(
  client: PoolClient,
  input: { familyId: string; memberId: string; actorId: string; update: UpdateMemberInput },
): Promise<MemberProfileDto> {
  await requireFamily(client, input.actorId, input.familyId);
  await lockFamily(client, input.familyId);
  await requireFamily(client, input.actorId, input.familyId);
  const current = await selectMember(client, input.familyId, input.memberId);
  await memberAuthorization(client, input);
  const update = normalizeUpdateMemberInput(input.update);
  validateDatePair(
    Object.prototype.hasOwnProperty.call(update, 'birth_date')
      ? update.birth_date
      : current.birth_date,
    Object.prototype.hasOwnProperty.call(update, 'birth_year')
      ? update.birth_year
      : current.birth_year,
  );
  const values: unknown[] = [input.memberId, input.familyId];
  const assignments: string[] = [];
  const columns: Array<
    | 'display_name'
    | 'familiar_name'
    | 'hometown'
    | 'biography'
    | 'birth_date'
    | 'birth_year'
    | 'deceased'
  > = [
    'display_name',
    'familiar_name',
    'hometown',
    'biography',
    'birth_date',
    'birth_year',
    'deceased',
  ];
  for (const column of columns) {
    if (update[column] !== undefined) {
      values.push(update[column]);
      assignments.push(`${column} = $${values.length}`);
    }
  }
  values.push(update.version);
  const versionIndex = values.length;
  const updated = await client.query<MemberRow>(
    `UPDATE members
        SET ${assignments.length ? `${assignments.join(', ')},` : ''}
            version = version + 1, updated_at = clock_timestamp()
      WHERE id = $1 AND family_id = $2 AND version = $${versionIndex}
      RETURNING id, display_name, familiar_name, hometown, biography,
        birth_date::text AS birth_date, birth_year, deceased, version`,
    values,
  );
  const row = updated.rows[0];
  if (!row) throw new FamilyHttpError(409, 'CONFLICT', 'Hồ sơ đã thay đổi.');
  if (update.contacts !== undefined)
    await replaceContacts(client, input.familyId, row.id, update.contacts);
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'member.updated',
    targetType: 'member',
    targetId: row.id,
    changeSummary:
      update.contacts !== undefined ? 'profile_and_contacts_updated' : 'profile_updated',
    version: row.version,
  });
  return mapProfile(row, await selectContacts(client, input.familyId, row.id));
}
