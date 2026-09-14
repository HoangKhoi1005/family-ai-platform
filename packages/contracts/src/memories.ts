import type { MediaAssetDto } from './media.js';
import type { MemberSummaryDto } from './profile.js';

export type MemoryAudience = 'family';
export type MemoryItemKind = 'image' | 'text' | 'audio';

export interface CreateMemoryItemInput {
  kind: MemoryItemKind;
  position: number;
  media_id?: string;
  body?: string;
}

export interface CreateMemoryInput {
  title: string;
  occurred_on: string;
  audience: MemoryAudience;
  items: CreateMemoryItemInput[];
}

export interface CreateMemoryFromMomentInput {
  title?: string;
}

export interface AddMemoryItemInput extends CreateMemoryItemInput {
  version: number;
}

export interface MemoryItemDto {
  id: string;
  kind: MemoryItemKind;
  position: number;
  body: string | null;
  media: MediaAssetDto | null;
  contributor: MemberSummaryDto | null;
  created_at: string;
}

export interface MemoryDto {
  id: string;
  source_moment_id: string | null;
  title: string;
  occurred_on: string;
  audience: MemoryAudience;
  items: MemoryItemDto[];
  can_edit: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryListResponse {
  memories: MemoryDto[];
  next_cursor: string | null;
}

const uuid = { type: 'string', format: 'uuid' } as const;
const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const;

const memoryItemProperties = {
  kind: { type: 'string', enum: ['image', 'text', 'audio'] },
  position: { type: 'integer', minimum: 0, maximum: 49 },
  media_id: uuid,
  body: { type: 'string', minLength: 1, maxLength: 4000 },
} as const;

const memoryItemRules = [
  {
    if: { required: ['kind'], properties: { kind: { const: 'text' } } },
    then: { required: ['body'], properties: { media_id: false } },
  },
  {
    if: { required: ['kind'], properties: { kind: { enum: ['image', 'audio'] } } },
    then: { required: ['media_id'], properties: { body: false } },
  },
] as const;

const createMemoryItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'position'],
  properties: memoryItemProperties,
  allOf: memoryItemRules,
} as const;

export const createMemoryBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'occurred_on', 'audience', 'items'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 160 },
    occurred_on: isoDate,
    audience: { const: 'family' },
    items: { type: 'array', minItems: 1, maxItems: 50, items: createMemoryItemSchema },
  },
} as const;

export const createMemoryFromMomentBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: { title: { type: 'string', minLength: 1, maxLength: 160 } },
} as const;

export const createMemoryItemBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'kind', 'position'],
  properties: {
    version: { type: 'integer', minimum: 1 },
    ...memoryItemProperties,
  },
  allOf: memoryItemRules,
} as const;

export const memoryListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cursor: { type: 'string', minLength: 1, maxLength: 512 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
} as const;

export const memoryParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'memoryId'],
  properties: { familyId: uuid, memoryId: uuid },
} as const;
