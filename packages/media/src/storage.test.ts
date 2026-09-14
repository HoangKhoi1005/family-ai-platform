import { describe, expect, it, vi } from 'vitest';
import { S3MediaStorage, readMediaStorageConfig } from './storage.js';

const config = {
  endpoint: 'http://127.0.0.1:9000',
  region: 'us-east-1',
  bucket: 'family-private',
  accessKeyId: 'local-access',
  secretAccessKey: 'local-secret',
  forcePathStyle: true,
};

describe('S3MediaStorage', () => {
  it('creates an opaque quarantine key and caps upload grants at ten minutes', async () => {
    const presign = vi.fn().mockResolvedValue('http://storage.invalid/signed');
    const storage = new S3MediaStorage(config, {
      client: { send: vi.fn() },
      presign,
      now: () => new Date('2026-09-14T00:00:00.000Z'),
    });

    const grant = await storage.createUploadGrant({
      familyId: '11111111-1111-4111-8111-111111111111',
      mediaId: '22222222-2222-4222-8222-222222222222',
      mimeType: 'image/jpeg',
      byteSize: 1024,
      expiresInSeconds: 900,
    });

    expect(grant.objectKey).toBe(
      'quarantine/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222',
    );
    expect(grant.expiresAt).toBe('2026-09-14T00:10:00.000Z');
    expect(presign).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      expiresIn: 600,
    });
  });

  it('caps content grants at sixty seconds and never includes credentials', async () => {
    const presign = vi.fn().mockResolvedValue('http://storage.invalid/private-content');
    const storage = new S3MediaStorage(config, {
      client: { send: vi.fn() },
      presign,
      now: () => new Date('2026-09-14T00:00:00.000Z'),
    });

    const grant = await storage.createReadGrant('ready/family/media', 300);

    expect(grant).toEqual({
      url: 'http://storage.invalid/private-content',
      expiresAt: '2026-09-14T00:01:00.000Z',
    });
    expect(JSON.stringify(grant)).not.toContain(config.accessKeyId);
    expect(JSON.stringify(grant)).not.toContain(config.secretAccessKey);
    expect(presign).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      expiresIn: 60,
    });
  });

  it('requires a complete storage configuration', () => {
    expect(() => readMediaStorageConfig({})).toThrow('MEDIA_STORAGE_ENDPOINT is required');
    expect(() =>
      readMediaStorageConfig({
        MEDIA_STORAGE_ENDPOINT: 'https://storage.example.com',
        MEDIA_STORAGE_REGION: 'auto',
        MEDIA_STORAGE_BUCKET: 'private',
        MEDIA_STORAGE_ACCESS_KEY_ID: 'access',
        MEDIA_STORAGE_SECRET_ACCESS_KEY: 'secret',
      }),
    ).not.toThrow();
  });
});
