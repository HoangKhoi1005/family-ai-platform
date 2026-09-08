export interface MembershipSummary {
  id: string;
  status: 'pending' | 'active' | 'revoked';
  family_id?: string;
  name?: string | null;
  role?: 'admin' | 'member';
}

export interface InvitationCreateInput {
  intended_member_id?: string;
  expires_at?: string;
}

export interface InvitationCreateResponse {
  id: string;
  token: string;
  expires_at: string;
  version: number;
}

export interface VersionMutationInput {
  version: number;
}

export interface ClaimCreateInput {
  membership_id: string;
  member_id: string;
  expires_at?: string;
}

export interface ContactVisibilityInput {
  id: string;
  visibility: 'self' | 'family';
}

export interface ClaimConfirmInput {
  version: number;
  member_version: number;
  accept_ownership: true;
  contact_visibilities?: ContactVisibilityInput[];
}

export const invitationCreateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intended_member_id: { type: 'string', format: 'uuid' },
    expires_at: { type: 'string', format: 'date-time' },
  },
} as const;

export const claimConfirmSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'member_version', 'accept_ownership'],
  properties: {
    version: { type: 'integer', minimum: 1 },
    member_version: { type: 'integer', minimum: 1 },
    accept_ownership: { const: true },
    contact_visibilities: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'visibility'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          visibility: { type: 'string', enum: ['self', 'family'] },
        },
      },
    },
  },
} as const;
