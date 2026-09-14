import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { MediaStorage } from '@family/media';
import { completeMediaUpload, createMediaUpload, getMedia, getMediaContentGrant } from './media.js';

const familyId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const membershipId = '33333333-3333-4333-8333-333333333333';
const mediaId = '44444444-4444-4444-8444-444444444444';

function result<T extends Record<string, unknown>>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}

function storage(overrides: Partial<MediaStorage> = {}): MediaStorage {
  return {
    createUploadGrant: vi.fn().mockResolvedValue({
      url: 'http://storage.invalid/upload',
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      expiresAt: '2026-09-14T00:10:00.000Z',
      objectKey: `quarantine/${familyId}/${mediaId}`,
    }),
    createReadGrant: vi.fn().mockResolvedValue({
      url: 'http://storage.invalid/read',
      expiresAt: '2026-09-14T00:01:00.000Z',
    }),
    headObject: vi.fn().mockResolvedValue({ byteSize: 1024, mimeType: 'image/jpeg' }),
    getObject: vi.fn(),
    putObject: vi.fn(),
    deleteObject: vi.fn(),
    ...overrides,
  };
}

describe('media services', () => {
  it('creates a pending upload owned by the active membership without exposing object keys', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM family_memberships'))
          return result([{ id: membershipId, role: 'member' }]);
        if (sql.includes("set_config('app.purpose'")) return result([]);
        if (sql.includes('INSERT INTO media_assets'))
          return result([
            {
              id: mediaId,
              purpose: 'moment_image',
              status: 'pending',
              mime_type: 'image/jpeg',
              byte_size: '1024',
              width: null,
              height: null,
              duration_ms: null,
              rejection_code: null,
              version: 1,
              created_at: new Date('2026-09-14T00:00:00Z'),
              updated_at: new Date('2026-09-14T00:00:00Z'),
            },
          ]);
        throw new Error(`Unexpected query: ${sql}`);
      }),
    } as unknown as PoolClient;

    const response = await createMediaUpload(client, storage(), {
      familyId,
      actorId,
      mediaId,
      input: { mime_type: 'image/jpeg', byte_size: 1024, purpose: 'moment_image' },
    });

    expect(response.media).toMatchObject({ id: mediaId, status: 'pending', byte_size: 1024 });
    expect(response.upload.method).toBe('PUT');
    expect(JSON.stringify(response)).not.toContain('objectKey');
    expect(JSON.stringify(response)).not.toContain('quarantine/');
  });

  it('rejects completion when the quarantined object does not exist', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM family_memberships'))
          return result([{ id: membershipId, role: 'member' }]);
        if (sql.includes('FROM media_assets'))
          return result([
            {
              id: mediaId,
              family_id: familyId,
              owner_membership_id: membershipId,
              purpose: 'moment_image',
              status: 'pending',
              object_key: `quarantine/${mediaId}`,
              mime_type: 'image/jpeg',
              byte_size: '1024',
              version: 1,
            },
          ]);
        throw new Error(`Unexpected query: ${sql}`);
      }),
    } as unknown as PoolClient;

    await expect(
      completeMediaUpload(client, storage({ headObject: vi.fn().mockResolvedValue(null) }), {
        familyId,
        actorId,
        mediaId,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'UPLOAD_NOT_FOUND' });
  });

  it('uses the actor-aware database transition after checking the uploaded object', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM family_memberships'))
        return result([{ id: membershipId, role: 'member' }]);
      if (sql.includes('FROM media_assets'))
        return result([
          {
            id: mediaId,
            family_id: familyId,
            owner_membership_id: membershipId,
            purpose: 'moment_image',
            status: 'pending',
            object_key: `quarantine/${mediaId}`,
            mime_type: 'image/jpeg',
            byte_size: '1024',
            version: 1,
          },
        ]);
      if (sql.includes("set_config('app.purpose'")) return result([]);
      if (sql.includes('actor_complete_media_upload')) return result([{ transitioned: true }]);
      throw new Error(`Unexpected query: ${sql}`);
    });
    const client = { query } as unknown as PoolClient;

    const response = await completeMediaUpload(client, storage(), { familyId, actorId, mediaId });

    expect(response).toMatchObject({ id: mediaId, status: 'processing', version: 2 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE media_assets'))).toBe(
      false,
    );
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO media_processing_jobs')),
    ).toBe(false);
  });

  it('does not issue a content URL when no visible parent refers to another member’s media', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM family_memberships'))
          return result([{ id: membershipId, role: 'member' }]);
        if (sql.includes('WITH candidate')) return result([]);
        throw new Error(`Unexpected query: ${sql}`);
      }),
    } as unknown as PoolClient;
    const mediaStorage = storage();

    await expect(
      getMediaContentGrant(client, mediaStorage, {
        familyId,
        actorId,
        mediaId,
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(mediaStorage.createReadGrant).not.toHaveBeenCalled();
  });

  it('hides another member’s draft metadata unless ready media has a visible parent', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM family_memberships'))
        return result([{ id: membershipId, role: 'member' }]);
      if (sql.includes('FROM media_assets asset')) return result([]);
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      getMedia({ query } as unknown as PoolClient, { familyId, actorId, mediaId }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(String(query.mock.calls.at(-1)?.[0])).toContain("asset.status = 'ready'");
    expect(String(query.mock.calls.at(-1)?.[0])).toContain('asset.owner_membership_id = $3');
  });
});
