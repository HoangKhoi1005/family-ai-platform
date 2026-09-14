import type { MemberSummaryDto } from './profile.js';
import type { MediaAssetDto } from './media.js';

export type MomentAudience = 'family';
export type MomentReaction = 'thuong';

export interface CreateMomentInput {
  client_request_id: string;
  media_id: string;
  caption?: string | null;
  audience: MomentAudience;
}

export interface UpdateMomentReactionInput {
  reaction: MomentReaction | null;
}

export interface MomentDto {
  id: string;
  caption: string | null;
  audience: MomentAudience;
  author: MemberSummaryDto | null;
  media: MediaAssetDto;
  my_reaction: MomentReaction | null;
  can_delete: boolean;
  version: number;
  created_at: string;
}

export interface MomentListResponse {
  moments: MomentDto[];
  next_cursor: string | null;
}

const uuid = { type: 'string', format: 'uuid' } as const;

export const createMomentBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['client_request_id', 'media_id', 'audience'],
  properties: {
    client_request_id: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: '^[A-Za-z0-9._:-]+$',
    },
    media_id: uuid,
    caption: { type: ['string', 'null'], minLength: 1, maxLength: 500 },
    audience: { const: 'family' },
  },
} as const;

export const updateMomentReactionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reaction'],
  properties: { reaction: { anyOf: [{ const: 'thuong' }, { type: 'null' }] } },
} as const;

export const momentListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cursor: { type: 'string', minLength: 1, maxLength: 512 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
} as const;

export const momentParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'momentId'],
  properties: { familyId: uuid, momentId: uuid },
} as const;
