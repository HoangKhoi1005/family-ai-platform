import { randomUUID } from 'node:crypto';
import type {
  CreateMediaUploadInput,
  MediaAssetDto,
  MediaUploadGrantResponse,
} from '@family/contracts';
import type { MediaStorage, ReadGrant } from '@family/media';
import type { PoolClient } from 'pg';
import { FamilyHttpError, requireFamily, setRouteContext } from './authorization.js';

type MediaRow = {
  id: string;
  family_id?: string;
  owner_membership_id?: string;
  purpose: MediaAssetDto['purpose'];
  status: MediaAssetDto['status'];
  object_key?: string;
  processed_object_key?: string | null;
  mime_type: string;
  byte_size: string | number;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  rejection_code?: string | null;
  version: number;
  created_at?: Date | string;
  updated_at?: Date | string;
};

function iso(value: Date | string | undefined): string {
  return value instanceof Date ? value.toISOString() : (value ?? new Date(0).toISOString());
}

export function mapMedia(row: MediaRow): MediaAssetDto {
  return {
    id: row.id,
    purpose: row.purpose,
    status: row.status,
    mime_type: row.mime_type,
    byte_size: Number(row.byte_size),
    width: row.width ?? null,
    height: row.height ?? null,
    duration_ms: row.duration_ms ?? null,
    rejection_code: row.rejection_code ?? null,
    version: row.version,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

const MEDIA_COLUMNS = `id, purpose, status, mime_type, byte_size, width, height,
  duration_ms, rejection_code, version, created_at, updated_at`;

export async function createMediaUpload(
  client: PoolClient,
  storage: MediaStorage,
  input: {
    familyId: string;
    actorId: string;
    mediaId?: string;
    input: CreateMediaUploadInput;
  },
): Promise<MediaUploadGrantResponse> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const mediaId = input.mediaId ?? randomUUID();
  const grant = await storage.createUploadGrant({
    familyId: input.familyId,
    mediaId,
    mimeType: input.input.mime_type,
    byteSize: input.input.byte_size,
  });
  await setRouteContext(client, { purpose: 'media_write' });
  const inserted = await client.query<MediaRow>(
    `INSERT INTO media_assets(
       id, family_id, owner_membership_id, purpose, object_key, mime_type, byte_size
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${MEDIA_COLUMNS}`,
    [
      mediaId,
      input.familyId,
      membership.id,
      input.input.purpose,
      grant.objectKey,
      input.input.mime_type,
      input.input.byte_size,
    ],
  );
  const row = inserted.rows[0];
  if (!row) throw new FamilyHttpError(500, 'INTERNAL_ERROR', 'Media record was not created');
  return {
    media: mapMedia(row),
    upload: {
      url: grant.url,
      method: grant.method,
      headers: { ...grant.headers },
      expires_at: grant.expiresAt,
    },
  };
}

async function ownedMedia(
  client: PoolClient,
  familyId: string,
  mediaId: string,
): Promise<MediaRow | null> {
  const result = await client.query<MediaRow>(
    `SELECT id, family_id, owner_membership_id, purpose, status, object_key,
            processed_object_key, mime_type, byte_size, width, height, duration_ms,
            rejection_code, version, created_at, updated_at
       FROM media_assets
      WHERE family_id = $1 AND id = $2
      LIMIT 1`,
    [familyId, mediaId],
  );
  return result.rows[0] ?? null;
}

export async function completeMediaUpload(
  client: PoolClient,
  storage: MediaStorage,
  input: { familyId: string; actorId: string; mediaId: string },
): Promise<MediaAssetDto> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const row = await ownedMedia(client, input.familyId, input.mediaId);
  if (!row || (row.owner_membership_id !== membership.id && membership.role !== 'admin')) {
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Media was not found');
  }
  if (row.status !== 'pending') return mapMedia(row);
  const object = await storage.headObject(row.object_key!);
  if (!object) throw new FamilyHttpError(409, 'UPLOAD_NOT_FOUND', 'Uploaded media was not found');
  if (object.byteSize !== Number(row.byte_size)) {
    throw new FamilyHttpError(409, 'UPLOAD_MISMATCH', 'Uploaded media size does not match');
  }
  await setRouteContext(client, { purpose: 'media_write' });
  const transitioned = await client.query<{ transitioned: boolean }>(
    `SELECT public.actor_complete_media_upload($1, $2) AS transitioned`,
    [input.familyId, input.mediaId],
  );
  if (!transitioned.rows[0]?.transitioned) {
    const current = await ownedMedia(client, input.familyId, input.mediaId);
    if (!current) throw new FamilyHttpError(404, 'NOT_FOUND', 'Media was not found');
    return mapMedia(current);
  }
  return mapMedia({ ...row, status: 'processing', version: row.version + 1 });
}

export async function getMedia(
  client: PoolClient,
  input: { familyId: string; actorId: string; mediaId: string },
): Promise<MediaAssetDto> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const result = await client.query<MediaRow>(
    `SELECT id, family_id, owner_membership_id, purpose, status, object_key,
            processed_object_key, mime_type, byte_size, width, height, duration_ms,
            rejection_code, version, created_at, updated_at
       FROM media_assets asset
      WHERE asset.family_id = $1 AND asset.id = $2
        AND (
          asset.owner_membership_id = $3
          OR (
            asset.status = 'ready'
            AND (
              EXISTS (
                SELECT 1 FROM moments moment
                 WHERE moment.family_id = asset.family_id AND moment.media_id = asset.id
                   AND moment.deleted_at IS NULL
              )
              OR EXISTS (
                SELECT 1 FROM memory_items item
                JOIN memories memory
                  ON memory.family_id = item.family_id AND memory.id = item.memory_id
                 WHERE item.family_id = asset.family_id AND item.media_id = asset.id
                   AND item.deleted_at IS NULL AND memory.deleted_at IS NULL
              )
            )
          )
        )
      LIMIT 1`,
    [input.familyId, input.mediaId, membership.id],
  );
  const row = result.rows[0] ?? null;
  if (!row) throw new FamilyHttpError(404, 'NOT_FOUND', 'Media was not found');
  return mapMedia(row);
}

export async function getMediaContentGrant(
  client: PoolClient,
  storage: MediaStorage,
  input: { familyId: string; actorId: string; mediaId: string },
): Promise<ReadGrant> {
  const membership = await requireFamily(client, input.actorId, input.familyId);
  const result = await client.query<{ object_key: string }>(
    `WITH candidate AS (
       SELECT asset.object_key, asset.processed_object_key, asset.status,
              asset.owner_membership_id,
              EXISTS (
                SELECT 1 FROM moments moment
                 WHERE moment.family_id = asset.family_id AND moment.media_id = asset.id
                   AND moment.deleted_at IS NULL
              ) OR EXISTS (
                SELECT 1 FROM memory_items item
                JOIN memories memory
                  ON memory.family_id = item.family_id AND memory.id = item.memory_id
                 WHERE item.family_id = asset.family_id AND item.media_id = asset.id
                   AND item.deleted_at IS NULL AND memory.deleted_at IS NULL
              ) AS has_visible_parent
         FROM media_assets asset
        WHERE asset.family_id = $1 AND asset.id = $2 AND asset.status <> 'deleted'
     )
     SELECT CASE
              WHEN owner_membership_id = $3 THEN COALESCE(processed_object_key, object_key)
              WHEN status = 'ready' AND has_visible_parent THEN processed_object_key
              ELSE NULL
            END AS object_key
       FROM candidate
      WHERE owner_membership_id = $3 OR (status = 'ready' AND has_visible_parent)`,
    [input.familyId, input.mediaId, membership.id],
  );
  const objectKey = result.rows[0]?.object_key;
  if (!objectKey) throw new FamilyHttpError(404, 'NOT_FOUND', 'Media content was not found');
  return storage.createReadGrant(objectKey, 60);
}
