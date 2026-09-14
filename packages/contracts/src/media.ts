export type MediaPurpose = 'moment_image' | 'memory_image' | 'memory_audio';
export type MediaStatus = 'pending' | 'processing' | 'ready' | 'rejected' | 'deleted';

export interface CreateMediaUploadInput {
  mime_type: string;
  byte_size: number;
  purpose: MediaPurpose;
}

export interface MediaAssetDto {
  id: string;
  purpose: MediaPurpose;
  status: MediaStatus;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  rejection_code: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface MediaUploadGrantResponse {
  media: MediaAssetDto;
  upload: {
    url: string;
    method: 'PUT';
    headers: Record<string, string>;
    expires_at: string;
  };
}

const imageMime = ['image/jpeg', 'image/png', 'image/webp'] as const;
const audioMime = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg'] as const;

export const createMediaUploadBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['mime_type', 'byte_size', 'purpose'],
  properties: {
    mime_type: { type: 'string', enum: [...imageMime, ...audioMime] },
    byte_size: { type: 'integer', minimum: 1, maximum: 25_000_000 },
    purpose: { type: 'string', enum: ['moment_image', 'memory_image', 'memory_audio'] },
  },
  allOf: [
    {
      if: {
        required: ['purpose'],
        properties: { purpose: { enum: ['moment_image', 'memory_image'] } },
      },
      then: {
        properties: {
          mime_type: { enum: imageMime },
          byte_size: { type: 'integer', minimum: 1, maximum: 10_000_000 },
        },
      },
    },
    {
      if: { required: ['purpose'], properties: { purpose: { const: 'memory_audio' } } },
      then: { properties: { mime_type: { enum: audioMime } } },
    },
  ],
} as const;

export const mediaParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'mediaId'],
  properties: {
    familyId: { type: 'string', format: 'uuid' },
    mediaId: { type: 'string', format: 'uuid' },
  },
} as const;
