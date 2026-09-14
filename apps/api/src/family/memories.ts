import type {
  AddMemoryItemInput,
  CreateMemoryFromMomentInput,
  CreateMemoryInput,
  CreateMemoryItemInput,
  MemoryDto,
  MemoryItemDto,
  MemoryListResponse,
} from '@family/contracts';
import type { PoolClient } from 'pg';
import { FamilyHttpError, lockFamily, requireFamily, setRouteContext } from './authorization.js';
import { mapMedia } from './media.js';

type MemoryRow = {
  id: string;
  family_id: string;
  created_by_membership_id: string;
  source_moment_id: string | null;
  title: string;
  occurred_on: Date | string;
  audience: 'family';
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
  can_edit: boolean;
};

type ItemRow = {
  id: string;
  memory_id: string;
  kind: MemoryItemDto['kind'];
  position: number;
  body: string | null;
  created_at: Date | string;
  media_id: string | null;
  media_purpose: 'moment_image' | 'memory_image' | 'memory_audio' | null;
  media_status: 'pending' | 'processing' | 'ready' | 'rejected' | 'deleted' | null;
  media_mime_type: string | null;
  media_byte_size: string | number | null;
  media_width: number | null;
  media_height: number | null;
  media_duration_ms: number | null;
  media_rejection_code: string | null;
  media_version: number | null;
  media_created_at: Date | string | null;
  media_updated_at: Date | string | null;
  contributor_id: string | null;
  contributor_display_name: string | null;
  contributor_familiar_name: string | null;
  contributor_hometown: string | null;
  contributor_birth_date: Date | string | null;
  contributor_birth_year: number | null;
  contributor_deceased: boolean | null;
  contributor_version: number | null;
};

const SELECT_MEMORIES = `
  SELECT memory.id, memory.family_id, memory.created_by_membership_id,
         memory.source_moment_id, memory.title, memory.occurred_on, memory.audience,
         memory.version, memory.created_at, memory.updated_at,
         (public.actor_active_membership(memory.family_id, memory.created_by_membership_id)
           OR public.actor_active_admin(memory.family_id)) AS can_edit
    FROM memories memory
  `;

const SELECT_ITEMS = `
  SELECT item.id, item.memory_id, item.kind, item.position, item.body, item.created_at,
         media.id AS media_id, media.purpose AS media_purpose, media.status AS media_status,
         media.mime_type AS media_mime_type, media.byte_size AS media_byte_size,
         media.width AS media_width, media.height AS media_height,
         media.duration_ms AS media_duration_ms, media.rejection_code AS media_rejection_code,
         media.version AS media_version, media.created_at AS media_created_at,
         media.updated_at AS media_updated_at,
         member.id AS contributor_id, member.display_name AS contributor_display_name,
         member.familiar_name AS contributor_familiar_name, member.hometown AS contributor_hometown,
         member.birth_date AS contributor_birth_date, member.birth_year AS contributor_birth_year,
         member.deceased AS contributor_deceased, member.version AS contributor_version
    FROM memory_items item
    LEFT JOIN media_assets media ON media.family_id = item.family_id AND media.id = item.media_id
    LEFT JOIN member_account_links link
      ON link.family_id = item.family_id AND link.membership_id = item.contributed_by_membership_id
    LEFT JOIN members member ON member.family_id = link.family_id AND member.id = link.member_id`;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function dateOnly(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function nullableDate(value: Date | string | null): string | null {
  return value === null ? null : dateOnly(value);
}

function mapItem(row: ItemRow): MemoryItemDto {
  const media =
    row.media_id &&
    row.media_purpose &&
    row.media_status &&
    row.media_mime_type &&
    row.media_byte_size !== null &&
    row.media_version !== null &&
    row.media_created_at &&
    row.media_updated_at
      ? mapMedia({
          id: row.media_id,
          purpose: row.media_purpose,
          status: row.media_status,
          mime_type: row.media_mime_type,
          byte_size: row.media_byte_size,
          width: row.media_width,
          height: row.media_height,
          duration_ms: row.media_duration_ms,
          rejection_code: row.media_rejection_code,
          version: row.media_version,
          created_at: row.media_created_at,
          updated_at: row.media_updated_at,
        })
      : null;
  const contributor =
    row.contributor_id && row.contributor_display_name
      ? {
          id: row.contributor_id,
          display_name: row.contributor_display_name,
          familiar_name: row.contributor_familiar_name,
          hometown: row.contributor_hometown,
          birth_date: nullableDate(row.contributor_birth_date),
          birth_year: row.contributor_birth_year,
          deceased: row.contributor_deceased ?? false,
          version: row.contributor_version ?? 1,
        }
      : null;
  return {
    id: row.id,
    kind: row.kind,
    position: row.position,
    body: row.body,
    media,
    contributor,
    created_at: iso(row.created_at),
  };
}

async function mapMemories(client: PoolClient, rows: MemoryRow[]): Promise<MemoryDto[]> {
  if (rows.length === 0) return [];
  const items = await client.query<ItemRow>(
    `${SELECT_ITEMS}
      WHERE item.family_id = $1 AND item.memory_id = ANY($2::uuid[])
        AND item.deleted_at IS NULL ORDER BY item.memory_id, item.position, item.id`,
    [rows[0]!.family_id, rows.map((row) => row.id)],
  );
  const byMemory = new Map<string, MemoryItemDto[]>();
  for (const item of items.rows) {
    const list = byMemory.get(item.memory_id) ?? [];
    list.push(mapItem(item));
    byMemory.set(item.memory_id, list);
  }
  return rows.map((row) => ({
    id: row.id,
    source_moment_id: row.source_moment_id,
    title: row.title,
    occurred_on: dateOnly(row.occurred_on),
    audience: row.audience,
    items: byMemory.get(row.id) ?? [],
    can_edit: row.can_edit,
    version: row.version,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  }));
}

function encodeCursor(familyId: string, row: MemoryRow): string {
  return Buffer.from(
    JSON.stringify({ family_id: familyId, occurred_on: dateOnly(row.occurred_on), id: row.id }),
  ).toString('base64url');
}

function decodeCursor(
  value: string | undefined,
  familyId: string,
): { occurredOn: string; id: string } | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (
      cursor.family_id !== familyId ||
      typeof cursor.occurred_on !== 'string' ||
      typeof cursor.id !== 'string'
    )
      throw new Error();
    return { occurredOn: cursor.occurred_on, id: cursor.id };
  } catch {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Memory cursor is invalid');
  }
}

export async function listMemories(
  client: PoolClient,
  input: { familyId: string; actorId: string; cursor?: string; limit: number },
): Promise<MemoryListResponse> {
  await requireFamily(client, input.actorId, input.familyId);
  const cursor = decodeCursor(input.cursor, input.familyId);
  const result = await client.query<MemoryRow>(
    `${SELECT_MEMORIES}
      WHERE memory.family_id = $1 AND memory.deleted_at IS NULL
        AND ($2::date IS NULL OR (memory.occurred_on, memory.id) < ($2::date, $3::uuid))
      ORDER BY memory.occurred_on DESC, memory.id DESC LIMIT $4`,
    [input.familyId, cursor?.occurredOn ?? null, cursor?.id ?? null, input.limit + 1],
  );
  const hasMore = result.rows.length > input.limit;
  const rows = result.rows.slice(0, input.limit);
  const memories = await mapMemories(client, rows);
  const tail = rows.at(-1);
  return { memories, next_cursor: hasMore && tail ? encodeCursor(input.familyId, tail) : null };
}

async function assertMediaForItem(
  client: PoolClient,
  familyId: string,
  membershipId: string,
  item: CreateMemoryItemInput,
): Promise<void> {
  if (item.kind === 'text') return;
  const purposes = item.kind === 'image' ? ['memory_image', 'moment_image'] : ['memory_audio'];
  const result = await client.query(
    `SELECT 1 FROM media_assets
      WHERE family_id = $1 AND id = $2 AND owner_membership_id = $3
        AND status = 'ready' AND purpose = ANY($4::text[]) LIMIT 1`,
    [familyId, item.media_id, membershipId, purposes],
  );
  if (!result.rowCount)
    throw new FamilyHttpError(400, 'MEDIA_NOT_READY', 'Memory media is not ready');
}

async function fetchMemory(
  client: PoolClient,
  familyId: string,
  memoryId: string,
): Promise<MemoryDto> {
  const result = await client.query<MemoryRow>(
    `${SELECT_MEMORIES} WHERE memory.family_id = $1 AND memory.id = $2 AND memory.deleted_at IS NULL`,
    [familyId, memoryId],
  );
  const row = result.rows[0];
  if (!row) throw new FamilyHttpError(404, 'NOT_FOUND', 'Memory was not found');
  return (await mapMemories(client, [row]))[0]!;
}

export async function createMemory(
  client: PoolClient,
  input: { familyId: string; actorId: string; input: CreateMemoryInput },
): Promise<MemoryDto> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  for (const item of input.input.items)
    await assertMediaForItem(client, input.familyId, membership.id, item);
  await setRouteContext(client, { purpose: 'memories_write' });
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO memories(family_id,created_by_membership_id,title,occurred_on,audience)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [
      input.familyId,
      membership.id,
      input.input.title,
      input.input.occurred_on,
      input.input.audience,
    ],
  );
  const memoryId = inserted.rows[0]!.id;
  for (const item of input.input.items) {
    await client.query(
      `INSERT INTO memory_items(
         family_id,memory_id,position,kind,media_id,body,contributed_by_membership_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        input.familyId,
        memoryId,
        item.position,
        item.kind,
        item.media_id ?? null,
        item.body ?? null,
        membership.id,
      ],
    );
  }
  return fetchMemory(client, input.familyId, memoryId);
}

export async function createMemoryFromMoment(
  client: PoolClient,
  input: {
    familyId: string;
    actorId: string;
    momentId: string;
    input: CreateMemoryFromMomentInput;
  },
): Promise<{ memory: MemoryDto; created: boolean }> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  await lockFamily(client, `${input.familyId}:moment-memory:${input.momentId}`);
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM memories WHERE family_id = $1 AND source_moment_id = $2 AND deleted_at IS NULL',
    [input.familyId, input.momentId],
  );
  if (existing.rows[0])
    return {
      memory: await fetchMemory(client, input.familyId, existing.rows[0].id),
      created: false,
    };
  const source = await client.query<{
    id: string;
    media_id: string;
    caption: string | null;
    audience: 'family';
    created_at: Date | string;
    author_membership_id: string;
  }>(
    `SELECT id,media_id,caption,audience,created_at,author_membership_id FROM moments
      WHERE family_id = $1 AND id = $2 AND deleted_at IS NULL LIMIT 1`,
    [input.familyId, input.momentId],
  );
  const moment = source.rows[0];
  if (!moment) throw new FamilyHttpError(404, 'NOT_FOUND', 'Moment was not found');
  if (moment.author_membership_id !== membership.id && membership.role !== 'admin') {
    throw new FamilyHttpError(
      403,
      'FORBIDDEN',
      'Only the author or an administrator can preserve this Moment',
    );
  }
  await setRouteContext(client, { purpose: 'memories_write' });
  const occurredOn = dateOnly(moment.created_at);
  const title =
    input.input.title ?? (moment.caption?.trim().slice(0, 160) || `Khoảnh khắc ${occurredOn}`);
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO memories(
       family_id,created_by_membership_id,source_moment_id,title,occurred_on,audience
     ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [input.familyId, membership.id, moment.id, title, occurredOn, moment.audience],
  );
  const memoryId = inserted.rows[0]!.id;
  await client.query(
    `INSERT INTO memory_items(
       family_id,memory_id,position,kind,media_id,contributed_by_membership_id
     ) VALUES ($1,$2,0,'image',$3,$4)`,
    [input.familyId, memoryId, moment.media_id, membership.id],
  );
  return { memory: await fetchMemory(client, input.familyId, memoryId), created: true };
}

export async function addMemoryItem(
  client: PoolClient,
  input: { familyId: string; actorId: string; memoryId: string; input: AddMemoryItemInput },
): Promise<MemoryDto> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  await assertMediaForItem(client, input.familyId, membership.id, input.input);
  await setRouteContext(client, { purpose: 'memories_write' });
  const updated = await client.query(
    `UPDATE memories SET version = version + 1, updated_at = now()
      WHERE family_id = $1 AND id = $2 AND version = $3 AND deleted_at IS NULL`,
    [input.familyId, input.memoryId, input.input.version],
  );
  if (!updated.rowCount) throw new FamilyHttpError(409, 'CONFLICT', 'Memory has changed');
  await client.query(
    `INSERT INTO memory_items(
       family_id,memory_id,position,kind,media_id,body,contributed_by_membership_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      input.familyId,
      input.memoryId,
      input.input.position,
      input.input.kind,
      input.input.media_id ?? null,
      input.input.body ?? null,
      membership.id,
    ],
  );
  return fetchMemory(client, input.familyId, input.memoryId);
}

export async function deleteMemory(
  client: PoolClient,
  input: { familyId: string; actorId: string; memoryId: string },
): Promise<void> {
  await requireFamily(client, input.actorId, input.familyId);
  await setRouteContext(client, { purpose: 'memories_write' });
  const deleted = await client.query<{ deleted: boolean }>(
    `SELECT public.actor_delete_memory($1,$2) AS deleted`,
    [input.familyId, input.memoryId],
  );
  if (!deleted.rows[0]?.deleted)
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Memory was not found');
}
