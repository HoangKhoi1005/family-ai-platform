import { createHash } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { parseBuffer } from 'music-metadata';
import sharp from 'sharp';
import type { MediaStorage } from '@family/media';

export type MediaProcessingJob = {
  id: string;
  familyId: string;
  mediaId: string;
  objectKey: string;
  purpose: 'moment_image' | 'memory_image' | 'memory_audio';
  declaredMimeType: string;
  declaredByteSize: number;
};

export type MediaProcessingResult =
  | { status: 'rejected'; rejectionCode: string }
  | {
      status: 'ready';
      processedObjectKey: string;
      mimeType: string;
      byteSize: number;
      sha256: string;
      width: number | null;
      height: number | null;
      durationMs: number | null;
    };

type AudioInspection = { mimeType: string; durationMs: number | null };
type ProcessorDependencies = {
  inspectAudio?: (body: Uint8Array, declaredMimeType: string) => Promise<AudioInspection>;
  detectFileType?: (body: Uint8Array) => Promise<{ mime: string } | undefined>;
  maxImagePixels?: number;
};

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AUDIO_MIMES = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg']);

async function inspectAudio(body: Uint8Array, declaredMimeType: string): Promise<AudioInspection> {
  const metadata = await parseBuffer(
    Buffer.from(body),
    { mimeType: declaredMimeType },
    { duration: true },
  );
  return {
    mimeType: declaredMimeType,
    durationMs:
      metadata.format.duration === undefined ? null : Math.round(metadata.format.duration * 1000),
  };
}

function hash(body: Uint8Array): string {
  return createHash('sha256').update(body).digest('hex');
}

export async function processMediaAsset(
  storage: MediaStorage,
  job: MediaProcessingJob,
  dependencies: ProcessorDependencies = {},
): Promise<MediaProcessingResult> {
  const body = await storage.getObject(job.objectKey);
  if (body.byteLength !== job.declaredByteSize) {
    return { status: 'rejected', rejectionCode: 'byte_size_mismatch' };
  }
  const detected = await (dependencies.detectFileType ?? fileTypeFromBuffer)(body);
  if (!detected || detected.mime !== job.declaredMimeType) {
    return { status: 'rejected', rejectionCode: 'mime_signature_mismatch' };
  }

  const processedObjectKey = `ready/${job.familyId}/${job.mediaId}`;
  if (job.purpose === 'memory_audio') {
    if (!AUDIO_MIMES.has(detected.mime) || body.byteLength > 25_000_000) {
      return { status: 'rejected', rejectionCode: 'unsupported_audio' };
    }
    let audio: AudioInspection;
    try {
      audio = await (dependencies.inspectAudio ?? inspectAudio)(body, job.declaredMimeType);
    } catch {
      return { status: 'rejected', rejectionCode: 'invalid_audio' };
    }
    if (audio.durationMs === null) {
      return { status: 'rejected', rejectionCode: 'audio_duration_unknown' };
    }
    if (audio.durationMs > 600_000) {
      return { status: 'rejected', rejectionCode: 'audio_too_long' };
    }
    await storage.putObject(processedObjectKey, body, audio.mimeType);
    return {
      status: 'ready',
      processedObjectKey,
      mimeType: audio.mimeType,
      byteSize: body.byteLength,
      sha256: hash(body),
      width: null,
      height: null,
      durationMs: audio.durationMs,
    };
  }

  if (!IMAGE_MIMES.has(detected.mime) || body.byteLength > 10_000_000) {
    return { status: 'rejected', rejectionCode: 'unsupported_image' };
  }
  const pipeline = sharp(body, { failOn: 'warning' }).rotate();
  let output: Buffer;
  try {
    output =
      detected.mime === 'image/png'
        ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
        : detected.mime === 'image/webp'
          ? await pipeline.webp({ quality: 88 }).toBuffer()
          : await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  } catch {
    return { status: 'rejected', rejectionCode: 'invalid_image' };
  }
  const metadata = await sharp(output).metadata();
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;
  if (width === null || height === null) {
    return { status: 'rejected', rejectionCode: 'invalid_image_dimensions' };
  }
  if (width * height > (dependencies.maxImagePixels ?? 40_000_000)) {
    return { status: 'rejected', rejectionCode: 'image_too_large' };
  }
  await storage.putObject(processedObjectKey, output, detected.mime);
  return {
    status: 'ready',
    processedObjectKey,
    mimeType: detected.mime,
    byteSize: output.byteLength,
    sha256: hash(output),
    width,
    height,
    durationMs: null,
  };
}
