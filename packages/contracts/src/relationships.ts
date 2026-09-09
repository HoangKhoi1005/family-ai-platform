import type { MemberSummaryDto } from './profile.js';

export type RelationshipType = 'parent_child' | 'partnership';
export type ParentChildSubtype = 'biological' | 'adoptive' | 'unspecified';
export type PartnershipSubtype = 'married' | 'partner';
export type RelationshipSubtype = ParentChildSubtype | PartnershipSubtype;

export interface RelationshipDto {
  id: string;
  from_member_id: string;
  to_member_id: string;
  type: RelationshipType;
  subtype: RelationshipSubtype;
  start_date: string | null;
  end_date: string | null;
  version: number;
}

export interface RelationshipGraphNodeDto extends MemberSummaryDto {
  distance: number;
}

export interface RelationshipGraphResponse {
  root_member_id: string;
  depth: number;
  nodes: RelationshipGraphNodeDto[];
  relationships: RelationshipDto[];
}

export interface ParentChildRelationshipInput {
  from_member_id: string;
  to_member_id: string;
  type: 'parent_child';
  subtype: ParentChildSubtype;
}

export interface PartnershipRelationshipInput {
  from_member_id: string;
  to_member_id: string;
  type: 'partnership';
  subtype: PartnershipSubtype;
  start_date?: string | null;
  end_date?: string | null;
}

export type CreateRelationshipPayload = ParentChildRelationshipInput | PartnershipRelationshipInput;

export interface UpdateRelationshipPayload {
  subtype?: RelationshipSubtype;
  start_date?: string | null;
  end_date?: string | null;
}

export type CreateRelationshipChangeRequestInput =
  | { type: 'relationship_create'; payload: CreateRelationshipPayload }
  | {
      type: 'relationship_update';
      target_id: string;
      base_version: number;
      payload: UpdateRelationshipPayload;
    }
  | {
      type: 'relationship_remove';
      target_id: string;
      base_version: number;
    };

export type RelationshipChangeRequestType = CreateRelationshipChangeRequestInput['type'];
export type RelationshipChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface RelationshipChangeRequestDto {
  id: string;
  type: RelationshipChangeRequestType;
  target_id: string | null;
  base_version: number | null;
  payload: CreateRelationshipPayload | UpdateRelationshipPayload | null;
  status: RelationshipChangeRequestStatus;
  requested_by: string;
  reviewer_id: string | null;
  decision_note: string | null;
  decided_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RelationshipChangeRequestListResponse {
  change_requests: RelationshipChangeRequestDto[];
}

export interface RelationshipDecisionInput {
  decision: 'approved' | 'rejected';
  version: number;
  note?: string;
}

const uuid = { type: 'string', format: 'uuid' } as const;
const isoDate = { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' } as const;

const createRelationshipPayloadSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['from_member_id', 'to_member_id', 'type', 'subtype'],
  properties: {
    from_member_id: uuid,
    to_member_id: uuid,
    type: { type: 'string', enum: ['parent_child', 'partnership'] },
    subtype: {
      type: 'string',
      enum: ['biological', 'adoptive', 'unspecified', 'married', 'partner'],
    },
    start_date: isoDate,
    end_date: isoDate,
  },
  allOf: [
    {
      if: { properties: { type: { const: 'parent_child' } } },
      then: {
        properties: {
          subtype: { enum: ['biological', 'adoptive', 'unspecified'] },
          start_date: false,
          end_date: false,
        },
      },
    },
    {
      if: { properties: { type: { const: 'partnership' } } },
      then: { properties: { subtype: { enum: ['married', 'partner'] } } },
    },
  ],
} as const;

const updatePayloadSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    subtype: {
      type: 'string',
      enum: ['biological', 'adoptive', 'unspecified', 'married', 'partner'],
    },
    start_date: isoDate,
    end_date: isoDate,
  },
} as const;

export const createRelationshipChangeRequestBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type'],
  properties: {
    type: {
      type: 'string',
      enum: ['relationship_create', 'relationship_update', 'relationship_remove'],
    },
    target_id: uuid,
    base_version: { type: 'integer', minimum: 1 },
    payload: { type: 'object' },
  },
  allOf: [
    {
      if: { properties: { type: { const: 'relationship_create' } } },
      then: {
        required: ['payload'],
        properties: {
          target_id: false,
          base_version: false,
          payload: createRelationshipPayloadSchema,
        },
      },
    },
    {
      if: { properties: { type: { const: 'relationship_update' } } },
      then: {
        required: ['target_id', 'base_version', 'payload'],
        properties: { payload: updatePayloadSchema },
      },
    },
    {
      if: { properties: { type: { const: 'relationship_remove' } } },
      then: { required: ['target_id', 'base_version'], properties: { payload: false } },
    },
  ],
} as const;

export const relationshipGraphQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['root_member_id'],
  properties: {
    root_member_id: uuid,
    depth: { type: 'integer', minimum: 1, maximum: 4, default: 2 },
  },
} as const;

export const relationshipDecisionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'version'],
  properties: {
    decision: { type: 'string', enum: ['approved', 'rejected'] },
    version: { type: 'integer', minimum: 1 },
    note: { type: 'string', minLength: 1, maxLength: 500 },
  },
} as const;

export const relationshipVersionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: { version: { type: 'integer', minimum: 1 } },
} as const;

export const relationshipChangeRequestListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['pending'], default: 'pending' },
  },
} as const;

export const relationshipChangeRequestParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'requestId'],
  properties: { familyId: uuid, requestId: uuid },
} as const;
