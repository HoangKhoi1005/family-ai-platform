import { createHash } from 'node:crypto';
import type {
  CreateMomentInput,
  MomentDto,
  MomentListResponse,
  MomentReaction,
} from '@family/contracts';
import type { PoolClient } from 'pg';
import { FamilyHttpError, lockFamily, requireFamily, setRouteContext } from './authorization.js';
import { mapMedia } from './media.js';

type MomentRow = {
  id: string;
  family_id: string;
  author_membership_id: string;
  media_id: string;
  caption: string | null;
  audience: 'family';
  client_request_id: string;
  version: number;
  created_at: Date | string;
  author_member_id: string | null;
  author_display_name: string | null;
  author_familiar_name: string | null;
  author_hometown: string | null;
  author_birth_date: Date | string | null;
  author_birth_year: number | null;
  author_deceased: boolean | null;
  author_version: number | null;
  media_purpose: MomentDto['media']['purpose'];
  media_status: MomentDto['media']['status'];
  media_mime_type: string;
  media_byte_size: string | number;
  media_width: number | null;
  media_height: number | null;
  media_duration_ms: number | null;
  media_rejection_code: string | null;
  media_version: number;
  media_created_at: Date | string;
  media_updated_at: Date | string;
  my_reaction: MomentReaction | null;
  can_delete: boolean;
};

const SELECT_MOMENT = `
  SELECT moment.id, moment.family_id, moment.author_membership_id, moment.media_id,
         moment.caption, moment.audience, moment.client_request_id, moment.version,
         moment.created_at,
         member.id AS author_member_id, member.display_name AS author_display_name,
         member.familiar_name AS author_familiar_name, member.hometown AS author_hometown,
         member.birth_date AS author_birth_date, member.birth_year AS author_birth_year,
         member.deceased AS author_deceased, member.version AS author_version,
         media.purpose AS media_purpose, media.status AS media_status,
         media.mime_type AS media_mime_type, media.byte_size AS media_byte_size,
         media.width AS media_width, media.height AS media_height,
         media.duration_ms AS media_duration_ms, media.rejection_code AS media_rejection_code,
         media.version AS media_version, media.created_at AS media_created_at,
         media.updated_at AS media_updated_at,
         mine.reaction AS my_reaction,
         (public.actor_active_membership(moment.family_id, moment.author_membership_id)
           OR public.actor_active_admin(moment.family_id)) AS can_delete
    FROM moments moment
    JOIN media_assets media ON media.family_id = moment.family_id AND media.id = moment.media_id
    LEFT JOIN member_account_links link
      ON link.family_id = moment.family_id AND link.membership_id = moment.author_membership_id
    LEFT JOIN members member ON member.family_id = link.family_id AND member.id = link.member_id
    LEFT JOIN moment_reactions mine
      ON mine.family_id = moment.family_id AND mine.moment_id = moment.id
     AND mine.membership_id = (
       SELECT actor_membership.id FROM family_memberships actor_membership
        WHERE actor_membership.family_id = moment.family_id
          AND actor_membership.user_id = public.actor_uuid()
          AND actor_membership.status = 'active' LIMIT 1
     )`;

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function asDate(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export function mapMoment(row: MomentRow): MomentDto {
  return {
    id: row.id,
    caption: row.caption,
    audience: row.audience,
    author:
      row.author_member_id && row.author_display_name
        ? {
            id: row.author_member_id,
            display_name: row.author_display_name,
            familiar_name: row.author_familiar_name,
            hometown: row.author_hometown,
            birth_date: asDate(row.author_birth_date),
            birth_year: row.author_birth_year,
            deceased: row.author_deceased ?? false,
            version: row.author_version ?? 1,
          }
        : null,
    media: mapMedia({
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
    }),
    my_reaction: row.my_reaction,
    can_delete: row.can_delete,
    version: row.version,
    created_at: asIso(row.created_at),
  };
}

function encodeCursor(familyId: string, row: Pick<MomentRow, 'created_at' | 'id'>): string {
  return Buffer.from(
    JSON.stringify({ family_id: familyId, created_at: asIso(row.created_at), id: row.id }),
  ).toString('base64url');
}

function decodeCursor(
  cursor: string | undefined,
  familyId: string,
): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (
      value.family_id !== familyId ||
      typeof value.created_at !== 'string' ||
      typeof value.id !== 'string'
    ) {
      throw new Error('invalid');
    }
    return { createdAt: value.created_at, id: value.id };
  } catch {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Moment cursor is invalid');
  }
}

export async function listMoments(
  client: PoolClient,
  input: { familyId: string; actorId: string; cursor?: string; limit: number },
): Promise<MomentListResponse> {
  await requireFamily(client, input.actorId, input.familyId);
  const cursor = decodeCursor(input.cursor, input.familyId);
  const result = await client.query<MomentRow>(
    `${SELECT_MOMENT}
      WHERE moment.family_id = $1 AND moment.deleted_at IS NULL
        AND ($2::timestamptz IS NULL OR (moment.created_at, moment.id) < ($2::timestamptz, $3::uuid))
      ORDER BY moment.created_at DESC, moment.id DESC LIMIT $4`,
    [input.familyId, cursor?.createdAt ?? null, cursor?.id ?? null, input.limit + 1],
  );
  const hasMore = result.rows.length > input.limit;
  const rows = result.rows.slice(0, input.limit);
  const tail = rows.at(-1);
  return {
    moments: rows.map(mapMoment),
    next_cursor: hasMore && tail ? encodeCursor(input.familyId, tail) : null,
  };
}

function fingerprint(value: CreateMomentInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        client_request_id: value.client_request_id,
        media_id: value.media_id,
        caption: value.caption ?? null,
        audience: value.audience,
      }),
    )
    .digest('hex');
}

export async function createMoment(
  client: PoolClient,
  input: { familyId: string; actorId: string; idempotencyKey: string; input: CreateMomentInput },
): Promise<{ moment: MomentDto; created: boolean }> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  await lockFamily(
    client,
    `${input.familyId}:moment:${membership.id}:${input.input.client_request_id}`,
  );
  const existing = await client.query<MomentRow>(
    `${SELECT_MOMENT}
      WHERE moment.family_id = $1 AND moment.author_membership_id = $2
        AND moment.client_request_id = $3 LIMIT 1`,
    [input.familyId, membership.id, input.input.client_request_id],
  );
  const prior = existing.rows[0];
  if (prior) {
    const priorFingerprint = fingerprint({
      client_request_id: prior.client_request_id,
      media_id: prior.media_id,
      caption: prior.caption,
      audience: prior.audience,
    });
    if (priorFingerprint !== fingerprint(input.input)) {
      throw new FamilyHttpError(409, 'IDEMPOTENCY_CONFLICT', 'Moment retry body does not match');
    }
    return { moment: mapMoment(prior), created: false };
  }
  const media = await client.query<{ id: string }>(
    `SELECT id FROM media_assets
      WHERE family_id = $1 AND id = $2 AND owner_membership_id = $3
        AND purpose = 'moment_image' AND status = 'ready' LIMIT 1`,
    [input.familyId, input.input.media_id, membership.id],
  );
  if (!media.rows[0])
    throw new FamilyHttpError(400, 'MEDIA_NOT_READY', 'Moment media is not ready');
  await setRouteContext(client, { purpose: 'moments_write', requestId: input.idempotencyKey });
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO moments(
       family_id, author_membership_id, media_id, caption, audience, client_request_id
     ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [
      input.familyId,
      membership.id,
      input.input.media_id,
      input.input.caption ?? null,
      input.input.audience,
      input.input.client_request_id,
    ],
  );
  const id = inserted.rows[0]?.id;
  if (!id) throw new FamilyHttpError(500, 'INTERNAL_ERROR', 'Moment was not created');
  const created = await client.query<MomentRow>(
    `${SELECT_MOMENT} WHERE moment.family_id = $1 AND moment.id = $2`,
    [input.familyId, id],
  );
  return { moment: mapMoment(created.rows[0]!), created: true };
}

export async function deleteMoment(
  client: PoolClient,
  input: { familyId: string; actorId: string; momentId: string },
): Promise<void> {
  await requireFamily(client, input.actorId, input.familyId);
  await lockFamily(client, `${input.familyId}:moment-memory:${input.momentId}`);
  await setRouteContext(client, { purpose: 'moments_write' });
  const deleted = await client.query<{ deleted: boolean }>(
    `SELECT public.actor_delete_moment($1,$2) AS deleted`,
    [input.familyId, input.momentId],
  );
  if (!deleted.rows[0]?.deleted)
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Moment was not found');
}

export async function setMomentReaction(
  client: PoolClient,
  input: { familyId: string; actorId: string; momentId: string; reaction: MomentReaction | null },
): Promise<{ reaction: MomentReaction | null }> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const moment = await client.query(
    'SELECT 1 FROM moments WHERE family_id = $1 AND id = $2 AND deleted_at IS NULL',
    [input.familyId, input.momentId],
  );
  if (!moment.rowCount) throw new FamilyHttpError(404, 'NOT_FOUND', 'Moment was not found');
  await setRouteContext(client, { purpose: 'moments_write' });
  if (input.reaction === null) {
    await client.query(
      'DELETE FROM moment_reactions WHERE family_id = $1 AND moment_id = $2 AND membership_id = $3',
      [input.familyId, input.momentId, membership.id],
    );
  } else {
    await client.query(
      `INSERT INTO moment_reactions(family_id,moment_id,membership_id,reaction)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (family_id,moment_id,membership_id)
       DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now()`,
      [input.familyId, input.momentId, membership.id, input.reaction],
    );
  }
  return { reaction: input.reaction };
}
