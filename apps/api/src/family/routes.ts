import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { withActorTransaction } from '@family/database';
import type { Auth } from '../auth/auth.js';
import { toAuthHeaders } from '../auth/routes.js';
import { getVerifiedActor } from '../auth/session.js';
import {
  assertMutationRequest,
  assertUuid,
  BoundedRateLimiter,
  FamilyHttpError,
  requireFamily,
  requireRateLimit,
  resolveExpiry,
  sendFamilyError,
  lockFamily,
} from './authorization.js';
import { acceptInvitation, createInvitation, revokeInvitation } from './invitations.js';
import { approveMembership, listMemberships, revokeMembership } from './memberships.js';
import { confirmClaim, createClaim, declineClaim, previewClaim, revokeClaim } from './claims.js';

interface FamilyParams {
  familyId: string;
}

interface InvitationParams extends FamilyParams {
  invitationId: string;
}

interface MembershipParams extends FamilyParams {
  membershipId: string;
}

interface ClaimParams extends FamilyParams {
  claimId: string;
}

interface InvitationBody {
  intended_member_id?: string;
  expires_at?: string;
}

interface VersionBody {
  version: number;
}

interface AcceptBody {
  token: string;
}

interface ClaimBody {
  membership_id: string;
  member_id: string;
  expires_at?: string;
}

interface ContactVisibilityBody {
  id: string;
  visibility: 'self' | 'family';
}

interface ConfirmBody {
  version: number;
  member_version: number;
  accept_ownership: true;
  contact_visibilities?: ContactVisibilityBody[];
}

interface OptionalVersionBody {
  version?: number;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownBodyKeys(
  allowedKeys: readonly string[],
  nestedArray?: { key: string; allowedKeys: readonly string[] },
) {
  return async (request: FastifyRequest): Promise<void> => {
    // Fastify's default AJV compiler removes additional properties before a
    // route handler sees them. Run this route-local preValidation guard first
    // so unknown fields fail closed without changing Better Auth's schemas.
    const body = request.body;
    if (!isJsonObject(body)) return;
    if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
      throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request body is invalid');
    }
    if (nestedArray) {
      const values = body[nestedArray.key];
      if (!Array.isArray(values)) return;
      for (const value of values) {
        if (
          !isJsonObject(value) ||
          Object.keys(value).some((key) => !nestedArray.allowedKeys.includes(key))
        ) {
          throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request body is invalid');
        }
      }
    }
  };
}

const uuid = { type: 'string', format: 'uuid' } as const;
const familyParams = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId'],
  properties: { familyId: uuid },
} as const;
const invitationParams = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'invitationId'],
  properties: { familyId: uuid, invitationId: uuid },
} as const;
const membershipParams = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'membershipId'],
  properties: { familyId: uuid, membershipId: uuid },
} as const;
const claimParams = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'claimId'],
  properties: { familyId: uuid, claimId: uuid },
} as const;
const versionBody = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: { version: { type: 'integer', minimum: 1 } },
} as const;
const invitationBody = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intended_member_id: uuid,
    expires_at: { type: 'string', format: 'date-time' },
  },
} as const;
const claimBody = {
  type: 'object',
  additionalProperties: false,
  required: ['membership_id', 'member_id'],
  properties: {
    membership_id: uuid,
    member_id: uuid,
    expires_at: { type: 'string', format: 'date-time' },
  },
} as const;
const confirmBody = {
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
        properties: { id: uuid, visibility: { type: 'string', enum: ['self', 'family'] } },
      },
    },
  },
} as const;
const acceptBody = {
  type: 'object',
  additionalProperties: false,
  required: ['token'],
  properties: { token: { type: 'string', minLength: 1, maxLength: 256 } },
} as const;
const optionalVersionBody = {
  type: 'object',
  additionalProperties: false,
  properties: { version: { type: 'integer', minimum: 1 } },
} as const;

export interface FamilyRouteOptions {
  auth: Auth;
  runtimePool: Pool;
  webOrigin: string;
}

async function authenticatedActor(
  auth: Auth,
  request: FastifyRequest,
): Promise<{ userId: string }> {
  const actor = await getVerifiedActor(auth, toAuthHeaders(request.headers));
  if (!actor) throw new FamilyHttpError(401, 'UNAUTHORIZED', 'Authentication is required');
  return actor;
}

function familyParamsOf(request: FastifyRequest<{ Params: FamilyParams }>): FamilyParams {
  const params = request.params;
  assertUuid(params.familyId, 'familyId');
  return params;
}

function replyError(reply: FastifyReply, request: FastifyRequest, error: unknown): FastifyReply {
  return sendFamilyError(reply, request, error);
}

export function registerFamilyRoutes(app: FastifyInstance, options: FamilyRouteOptions): void {
  const mutationLimiter = new BoundedRateLimiter(30, 60_000, 4096);
  const claimLimiter = new BoundedRateLimiter(30, 60_000, 4096);

  app.post<{ Body: AcceptBody }>(
    '/api/v1/invitations/accept',
    {
      schema: { body: acceptBody },
      preValidation: rejectUnknownBodyKeys(['token']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'invitation.accept');
        const body = request.body;
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          acceptInvitation(client, body.token),
        );
        return reply.code(201).send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: FamilyParams; Body: InvitationBody }>(
    '/api/v1/families/:familyId/invitations',
    {
      schema: { params: familyParams, body: invitationBody },
      preValidation: rejectUnknownBodyKeys(['intended_member_id', 'expires_at']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'invitation.create');
        const body = request.body ?? {};
        const result = await withActorTransaction(
          options.runtimePool,
          actor.userId,
          async (client) => {
            await requireFamily(client, actor.userId, familyId, true);
            await lockFamily(client, familyId);
            await requireFamily(client, actor.userId, familyId, true);
            const input = {
              familyId,
              actorId: actor.userId,
              expiresAt: resolveExpiry(body.expires_at),
              ...(body.intended_member_id ? { intendedMemberId: body.intended_member_id } : {}),
            };
            return createInvitation(client, input);
          },
        );
        return reply.code(201).send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: InvitationParams; Body: VersionBody }>(
    '/api/v1/families/:familyId/invitations/:invitationId/revoke',
    {
      schema: { params: invitationParams, body: versionBody },
      preValidation: rejectUnknownBodyKeys(['version']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, invitationId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(invitationId, 'invitationId');
        const actor = await authenticatedActor(options.auth, request);
        const result = await withActorTransaction(
          options.runtimePool,
          actor.userId,
          async (client) => {
            await requireFamily(client, actor.userId, familyId, true);
            await lockFamily(client, familyId);
            await requireFamily(client, actor.userId, familyId, true);
            return revokeInvitation(client, {
              familyId,
              actorId: actor.userId,
              invitationId,
              version: request.body.version,
            });
          },
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.get<{ Params: FamilyParams }>(
    '/api/v1/families/:familyId/memberships',
    { schema: { params: familyParams } },
    async (request, reply) => {
      try {
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        const result = await withActorTransaction(
          options.runtimePool,
          actor.userId,
          async (client) => {
            await requireFamily(client, actor.userId, familyId, true);
            return listMemberships(client, familyId);
          },
        );
        return reply.send({ memberships: result });
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: MembershipParams; Body: VersionBody }>(
    '/api/v1/families/:familyId/memberships/:membershipId/approve',
    {
      schema: { params: membershipParams, body: versionBody },
      preValidation: rejectUnknownBodyKeys(['version']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, membershipId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(membershipId, 'membershipId');
        const actor = await authenticatedActor(options.auth, request);
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          approveMembership(client, {
            familyId,
            actorId: actor.userId,
            membershipId,
            version: request.body.version,
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: MembershipParams; Body: VersionBody }>(
    '/api/v1/families/:familyId/memberships/:membershipId/revoke',
    {
      schema: { params: membershipParams, body: versionBody },
      preValidation: rejectUnknownBodyKeys(['version']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, membershipId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(membershipId, 'membershipId');
        const actor = await authenticatedActor(options.auth, request);
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          revokeMembership(client, {
            familyId,
            actorId: actor.userId,
            membershipId,
            version: request.body.version,
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: FamilyParams; Body: ClaimBody }>(
    '/api/v1/families/:familyId/member-claims',
    {
      schema: { params: familyParams, body: claimBody },
      preValidation: rejectUnknownBodyKeys(['membership_id', 'member_id', 'expires_at']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(claimLimiter, actor.userId, 'claim.create');
        const body = request.body;
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          createClaim(client, {
            familyId,
            actorId: actor.userId,
            membershipId: body.membership_id,
            memberId: body.member_id,
            expiresAt: resolveExpiry(body.expires_at),
          }),
        );
        return reply.code(201).send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.get<{ Params: ClaimParams }>(
    '/api/v1/families/:familyId/member-claims/:claimId/preview',
    { schema: { params: claimParams } },
    async (request, reply) => {
      try {
        const { familyId, claimId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(claimId, 'claimId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(claimLimiter, actor.userId, 'claim.preview');
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          previewClaim(client, { familyId, claimId }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: ClaimParams; Body: ConfirmBody }>(
    '/api/v1/families/:familyId/member-claims/:claimId/confirm',
    {
      schema: { params: claimParams, body: confirmBody },
      preValidation: rejectUnknownBodyKeys(
        ['version', 'member_version', 'accept_ownership', 'contact_visibilities'],
        { key: 'contact_visibilities', allowedKeys: ['id', 'visibility'] },
      ),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, claimId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(claimId, 'claimId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(claimLimiter, actor.userId, 'claim.confirm');
        const body = request.body;
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          confirmClaim(client, {
            familyId,
            actorId: actor.userId,
            claimId,
            version: body.version,
            memberVersion: body.member_version,
            acceptOwnership: body.accept_ownership,
            ...(body.contact_visibilities
              ? { contactVisibilities: body.contact_visibilities }
              : {}),
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: ClaimParams; Body: OptionalVersionBody }>(
    '/api/v1/families/:familyId/member-claims/:claimId/decline',
    {
      schema: { params: claimParams, body: optionalVersionBody },
      preValidation: rejectUnknownBodyKeys(['version']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, claimId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(claimId, 'claimId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(claimLimiter, actor.userId, 'claim.decline');
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          declineClaim(client, {
            familyId,
            actorId: actor.userId,
            claimId,
            ...(request.body?.version !== undefined ? { version: request.body.version } : {}),
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: ClaimParams; Body: VersionBody }>(
    '/api/v1/families/:familyId/member-claims/:claimId/revoke',
    {
      schema: { params: claimParams, body: versionBody },
      preValidation: rejectUnknownBodyKeys(['version']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, claimId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(claimId, 'claimId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(claimLimiter, actor.userId, 'claim.revoke');
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          revokeClaim(client, {
            familyId,
            actorId: actor.userId,
            claimId,
            version: request.body.version,
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );
}
