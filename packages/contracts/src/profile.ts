export type MemberContactKind = 'phone' | 'email' | 'facebook';
export type MemberContactVisibility = 'self' | 'family';

export interface MemberContactDto {
  id: string;
  kind: MemberContactKind;
  value: string;
  visibility: MemberContactVisibility;
}

export interface MemberSummaryDto {
  id: string;
  display_name: string;
  familiar_name: string | null;
  hometown: string | null;
  birth_date: string | null;
  birth_year: number | null;
  deceased: boolean;
  version: number;
}

export interface MemberProfileDto extends MemberSummaryDto {
  biography: string | null;
  contacts: MemberContactDto[];
}

export interface MemberListResponse {
  members: MemberSummaryDto[];
  next_cursor: string | null;
}

export interface MemberContactInput {
  kind: MemberContactKind;
  value: string;
  visibility?: MemberContactVisibility;
}

export interface CreateMemberInput {
  display_name: string;
  familiar_name?: string | null;
  hometown?: string | null;
  biography?: string | null;
  birth_date?: string | null;
  birth_year?: number | null;
  deceased?: boolean;
  contacts?: MemberContactInput[];
}

export interface UpdateMemberInput extends Omit<CreateMemberInput, 'display_name'> {
  version: number;
  display_name?: string;
}

export const memberParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'memberId'],
  properties: {
    familyId: { type: 'string', format: 'uuid' },
    memberId: { type: 'string', format: 'uuid' },
  },
} as const;

export const memberListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: { type: 'string', maxLength: 120 },
    cursor: { type: 'string', minLength: 1, maxLength: 512 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
} as const;

const contactInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'value'],
  properties: {
    kind: { type: 'string', enum: ['phone', 'email', 'facebook'] },
    value: { type: 'string', minLength: 1, maxLength: 320 },
    visibility: { type: 'string', enum: ['self', 'family'], default: 'self' },
  },
} as const;

export const createMemberBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['display_name'],
  properties: {
    display_name: { type: 'string', minLength: 1, maxLength: 120 },
    familiar_name: { type: ['string', 'null'], maxLength: 120 },
    hometown: { type: ['string', 'null'], maxLength: 200 },
    biography: { type: ['string', 'null'], maxLength: 1000 },
    birth_date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    birth_year: { type: ['integer', 'null'], minimum: 1, maximum: 9999 },
    deceased: { type: 'boolean', default: false },
    contacts: { type: 'array', maxItems: 10, items: contactInputSchema },
  },
} as const;

export const updateMemberBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: {
    version: { type: 'integer', minimum: 1 },
    display_name: { type: 'string', minLength: 1, maxLength: 120 },
    familiar_name: { type: ['string', 'null'], maxLength: 120 },
    hometown: { type: ['string', 'null'], maxLength: 200 },
    biography: { type: ['string', 'null'], maxLength: 1000 },
    birth_date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    birth_year: { type: ['integer', 'null'], minimum: 1, maximum: 9999 },
    deceased: { type: 'boolean' },
    contacts: { type: 'array', maxItems: 10, items: contactInputSchema },
  },
} as const;
