import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { MediaStorage } from '@family/media';
import { processMediaAsset } from './media-processor.js';

function storageWith(body: Uint8Array): MediaStorage {
  return {
    createUploadGrant: vi.fn(),
    createReadGrant: vi.fn(),
    headObject: vi.fn(),
    getObject: vi.fn().mockResolvedValue(body),
    putObject: vi.fn(),
    deleteObject: vi.fn(),
  };
}

const baseJob = {
  id: '11111111-1111-4111-8111-111111111111',
  familyId: '22222222-2222-4222-8222-222222222222',
  mediaId: '33333333-3333-4333-8333-333333333333',
  objectKey: 'quarantine/family/media',
  purpose: 'moment_image' as const,
  declaredMimeType: 'image/jpeg',
  declaredByteSize: 1,
};

describe('media processor', () => {
  it('rejects content whose bytes do not match the declared MIME type', async () => {
    const mediaStorage = storageWith(new TextEncoder().encode('not-an-image'));
    await expect(
      processMediaAsset(mediaStorage, {
        ...baseJob,
        declaredByteSize: 12,
      }),
    ).resolves.toEqual({ status: 'rejected', rejectionCode: 'mime_signature_mismatch' });
    expect(mediaStorage.putObject).not.toHaveBeenCalled();
  });

  it('decodes and re-encodes an image before publishing it', async () => {
    const source = await sharp({
      create: { width: 4, height: 3, channels: 3, background: '#8f4b32' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const mediaStorage = storageWith(source);

    const result = await processMediaAsset(mediaStorage, {
      ...baseJob,
      declaredByteSize: source.byteLength,
    });

    expect(result).toMatchObject({ status: 'ready', mimeType: 'image/jpeg', width: 3, height: 4 });
    expect(mediaStorage.putObject).toHaveBeenCalledOnce();
    const output = vi.mocked(mediaStorage.putObject).mock.calls[0]?.[1];
    expect((await sharp(output).metadata()).orientation).toBeUndefined();
  });

  it('rejects an audio asset over ten minutes from verified metadata', async () => {
    const oggHeader = new Uint8Array(32);
    oggHeader.set([0x4f, 0x67, 0x67, 0x53]);
    const mediaStorage = storageWith(oggHeader);
    await expect(
      processMediaAsset(
        mediaStorage,
        {
          ...baseJob,
          purpose: 'memory_audio',
          declaredMimeType: 'audio/ogg',
          declaredByteSize: oggHeader.byteLength,
        },
        {
          detectFileType: async () => ({ mime: 'audio/ogg' }),
          inspectAudio: async () => ({ mimeType: 'audio/ogg', durationMs: 600_001 }),
        },
      ),
    ).resolves.toEqual({ status: 'rejected', rejectionCode: 'audio_too_long' });
  });
});
