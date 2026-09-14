import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import type { CalendarConverter } from '@family/domain';
import type { MediaStorage } from '@family/media';
import {
  createRelationshipChangeRequestBodySchema,
  createMemberBodySchema,
  memberListQuerySchema,
  memberParamsSchema,
  relationshipChangeRequestListQuerySchema,
  relationshipChangeRequestParamsSchema,
  relationshipDecisionBodySchema,
  relationshipGraphQuerySchema,
  relationshipVersionBodySchema,
  updateMemberBodySchema,
  cancelEventBodySchema,
  createEventBodySchema,
  eventListQuerySchema,
  familyEventParamsSchema,
  familyOccurrenceParamsSchema,
  updateEventBodySchema,
  upsertEventRsvpBodySchema,
  notificationListQuerySchema,
  updateNotificationPreferencesBodySchema,
  createMediaUploadBodySchema,
  mediaParamsSchema,
  createMomentBodySchema,
  momentListQuerySchema,
  momentParamsSchema,
  updateMomentReactionBodySchema,
  createMemoryBodySchema,
  createMemoryFromMomentBodySchema,
  createMemoryItemBodySchema,
  memoryListQuerySchema,
  memoryParamsSchema,
  type CancelEventInput,
  type CreateEventInput,
  type CreateRelationshipChangeRequestInput,
  type CreateMemberInput,
  type EventRsvpResponse,
  type RelationshipDecisionInput,
  type UpdateEventInput,
  type UpdateMemberInput,
  type UpdateNotificationPreferencesInput,
  type CreateMediaUploadInput,
  type CreateMomentInput,
  type UpdateMomentReactionInput,
  type AddMemoryItemInput,
  type CreateMemoryFromMomentInput,
  type CreateMemoryInput,
} from '@family/contracts';
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
import { getOwnOnboarding } from './onboarding.js';
import { getRelationshipGraph } from './relationships.js';
import {
  cancelRelationshipChangeRequest,
  createRelationshipChangeRequest,
  decideRelationshipChangeRequest,
  listPendingRelationshipChangeRequests,
} from './change-requests.js';
import {
  createMember,
  getManagedMember,
  getMemberProfile,
  listMembers,
  normalizeCreateMemberInput,
  normalizeUpdateMemberInput,
  updateMember,
} from './members.js';
import {
  cancelCalendarEvent,
  createCalendarEvent,
  getCalendarEvent,
  listCalendarOccurrences,
  updateCalendarEvent,
  upsertCalendarRsvp,
} from './calendar.js';
import {
  getNotificationPreferences,
  listNotifications,
  markNotificationRead,
  updateNotificationPreferences,
} from './notifications.js';
import { completeMediaUpload, createMediaUpload, getMedia, getMediaContentGrant } from './media.js';
import { createMoment, deleteMoment, listMoments, setMomentReaction } from './moments.js';
import {
  addMemoryItem,
  createMemory,
  createMemoryFromMoment,
  deleteMemory,
  listMemories,
} from './memories.js';

interface FamilyParams {
  familyId: string;
}

interface NotificationParams extends FamilyParams {
  notificationId: string;
}

interface MediaParams extends FamilyParams {
  mediaId: string;
}

interface MomentParams extends FamilyParams {
  momentId: string;
}

interface MomentListQuery {
  cursor?: string;
  limit?: number;
}

interface MemoryParams extends FamilyParams {
  memoryId: string;
}

interface MemoryListQuery {
  cursor?: string;
  limit?: number;
}

interface NotificationListQuery {
  cursor?: string;
  limit?: number;
  unread_only?: boolean;
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

interface MemberListQuery {
  q?: string;
  cursor?: string;
  limit?: number;
}

interface RelationshipGraphQuery {
  root_member_id: string;
  depth?: number;
}

interface ChangeRequestParams extends FamilyParams {
  requestId: string;
}

interface ChangeRequestListQuery {
  status?: 'pending';
  scope?: 'all' | 'mine';
}

interface MemberParams extends FamilyParams {
  memberId: string;
}

interface EventParams extends FamilyParams {
  eventId: string;
}

interface OccurrenceParams extends FamilyParams {
  occurrenceId: string;
}

interface EventListQuery {
  from: string;
  to: string;
  cursor?: string;
  limit?: number;
}

interface RsvpBody {
  response: EventRsvpResponse;
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
    // Keep a route-local fail-closed guard as defense in depth alongside the
    // global AJV additional-property rejection.
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

async function rejectRelationshipRequestUnknownKeys(request: FastifyRequest): Promise<void> {
  const body = request.body;
  if (!isJsonObject(body) || typeof body.type !== 'string') return;
  const topLevel =
    body.type === 'relationship_create' || body.type === 'member_create'
      ? ['type', 'payload']
      : [
          'type',
          'target_id',
          'base_version',
          ...(body.type === 'relationship_update' ? ['payload'] : []),
        ];
  if (Object.keys(body).some((key) => !topLevel.includes(key))) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request body is invalid');
  }
  if (body.type === 'relationship_remove') return;
  const payload = body.payload;
  if (!isJsonObject(payload)) return;
  if (body.type === 'member_create') {
    if (Object.keys(payload).some((key) => !['member', 'relationship'].includes(key))) {
      throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request body is invalid');
    }
    const member = payload.member;
    const relationship = payload.relationship;
    if (
      (isJsonObject(member) &&
        Object.keys(member).some(
          (key) =>
            !['display_name', 'familiar_name', 'hometown', 'birth_year', 'deceased'].includes(key),
        )) ||
      (isJsonObject(relationship) &&
        Object.keys(relationship).some(
          (key) => !['anchor_member_id', 'kind', 'subtype'].includes(key),
        ))
    ) {
      throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request body is invalid');
    }
    return;
  }
  const payloadKeys =
    body.type === 'relationship_update'
      ? ['subtype', 'start_date', 'end_date']
      : payload.type === 'parent_child'
        ? ['from_member_id', 'to_member_id', 'type', 'subtype']
        : ['from_member_id', 'to_member_id', 'type', 'subtype', 'start_date', 'end_date'];
  if (Object.keys(payload).some((key) => !payloadKeys.includes(key))) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request body is invalid');
  }
}

const EVENT_INPUT_KEYS = [
  'kind',
  'title',
  'note',
  'location',
  'member_id',
  'calendar_type',
  'recurrence',
  'timezone',
  'date_parts',
  'lunar_policy',
  'feb29_policy',
  'all_day',
  'starts_local_time',
  'duration_minutes',
  'reminder_offsets',
] as const;

function assertCalendarEventShape(value: unknown): void {
  if (!isJsonObject(value)) return;
  if (Object.keys(value).some((key) => !EVENT_INPUT_KEYS.includes(key as never))) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request body is invalid');
  }
  if (
    isJsonObject(value.date_parts) &&
    Object.keys(value.date_parts).some((key) => !['year', 'month', 'day'].includes(key))
  ) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request body is invalid');
  }
  if (
    isJsonObject(value.lunar_policy) &&
    Object.keys(value.lunar_policy).some((key) => !['month_mode', 'missing_day'].includes(key))
  ) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request body is invalid');
  }
}

async function rejectCreateEventUnknownKeys(request: FastifyRequest): Promise<void> {
  assertCalendarEventShape(request.body);
}

async function rejectUpdateEventUnknownKeys(request: FastifyRequest): Promise<void> {
  if (!isJsonObject(request.body)) return;
  if (Object.keys(request.body).some((key) => !['version', 'event'].includes(key))) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request body is invalid');
  }
  assertCalendarEventShape(request.body.event);
}

function idempotencyKeyOf(request: FastifyRequest): string {
  const value = request.headers['idempotency-key'];
  if (
    typeof value !== 'string' ||
    value.length < 8 ||
    value.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(value)
  ) {
    throw new FamilyHttpError(
      400,
      'VALIDATION_ERROR',
      'Idempotency-Key phải dài 8-128 ký tự an toàn',
    );
  }
  return value;
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
const familyNotificationParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['familyId', 'notificationId'],
  properties: { familyId: uuid, notificationId: uuid },
} as const;

export interface FamilyRouteOptions {
  auth: Auth;
  runtimePool: Pool;
  webOrigin: string;
  calendarConverter?: CalendarConverter;
  mediaStorage?: MediaStorage;
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
  const uploadLimiter = new BoundedRateLimiter(20, 60_000, 4096);

  app.get<{ Params: FamilyParams }>(
    '/api/v1/families/:familyId/onboarding',
    { schema: { params: familyParams } },
    async (request, reply) => {
      try {
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        return reply.send(
          await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            getOwnOnboarding(client, actor.userId, familyId),
          ),
        );
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

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

  app.get<{ Params: FamilyParams; Querystring: MemberListQuery }>(
    '/api/v1/families/:familyId/members',
    { schema: { params: familyParams, querystring: memberListQuerySchema } },
    async (request, reply) => {
      try {
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        const result = await withActorTransaction(
          options.runtimePool,
          actor.userId,
          async (client) => {
            await requireFamily(client, actor.userId, familyId);
            const query = request.query.q?.trim();
            return listMembers(client, {
              familyId,
              ...(query ? { q: query } : {}),
              ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
              limit: request.query.limit ?? 20,
            });
          },
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.get<{ Params: FamilyParams; Querystring: RelationshipGraphQuery }>(
    '/api/v1/families/:familyId/relationships',
    { schema: { params: familyParams, querystring: relationshipGraphQuerySchema } },
    async (request, reply) => {
      try {
        const { familyId } = familyParamsOf(request);
        assertUuid(request.query.root_member_id, 'root_member_id');
        const actor = await authenticatedActor(options.auth, request);
        const result = await withActorTransaction(
          options.runtimePool,
          actor.userId,
          async (client) => {
            await requireFamily(client, actor.userId, familyId);
            return getRelationshipGraph(client, {
              familyId,
              rootMemberId: request.query.root_member_id,
              depth: request.query.depth ?? 2,
            });
          },
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: FamilyParams; Body: CreateRelationshipChangeRequestInput }>(
    '/api/v1/families/:familyId/change-requests',
    {
      schema: { params: familyParams, body: createRelationshipChangeRequestBodySchema },
      preValidation: rejectRelationshipRequestUnknownKeys,
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'relationship.request.create');
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          createRelationshipChangeRequest(client, {
            familyId,
            actorId: actor.userId,
            request: request.body,
          }),
        );
        return reply.code(201).send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.get<{ Params: FamilyParams; Querystring: ChangeRequestListQuery }>(
    '/api/v1/families/:familyId/change-requests',
    { schema: { params: familyParams, querystring: relationshipChangeRequestListQuerySchema } },
    async (request, reply) => {
      try {
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          listPendingRelationshipChangeRequests(client, {
            familyId,
            actorId: actor.userId,
            scope: request.query.scope ?? 'all',
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: ChangeRequestParams; Body: RelationshipDecisionInput }>(
    '/api/v1/families/:familyId/change-requests/:requestId/decision',
    {
      schema: {
        params: relationshipChangeRequestParamsSchema,
        body: relationshipDecisionBodySchema,
      },
      preValidation: rejectUnknownBodyKeys(['decision', 'version', 'note']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, requestId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(requestId, 'requestId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'relationship.request.decision');
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          decideRelationshipChangeRequest(client, {
            familyId,
            actorId: actor.userId,
            requestId,
            decision: request.body,
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: ChangeRequestParams; Body: VersionBody }>(
    '/api/v1/families/:familyId/change-requests/:requestId/cancel',
    {
      schema: {
        params: relationshipChangeRequestParamsSchema,
        body: relationshipVersionBodySchema,
      },
      preValidation: rejectUnknownBodyKeys(['version']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, requestId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(requestId, 'requestId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'relationship.request.cancel');
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          cancelRelationshipChangeRequest(client, {
            familyId,
            actorId: actor.userId,
            requestId,
            version: request.body.version,
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.get<{ Params: MemberParams }>(
    '/api/v1/families/:familyId/members/:memberId/management',
    { schema: { params: memberParamsSchema } },
    async (request, reply) => {
      try {
        const { familyId, memberId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(memberId, 'memberId');
        const actor = await authenticatedActor(options.auth, request);
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          getManagedMember(client, { familyId, memberId, actorId: actor.userId }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.get<{ Params: MemberParams }>(
    '/api/v1/families/:familyId/members/:memberId',
    { schema: { params: memberParamsSchema } },
    async (request, reply) => {
      try {
        const { familyId, memberId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(memberId, 'memberId');
        const actor = await authenticatedActor(options.auth, request);
        const result = await withActorTransaction(
          options.runtimePool,
          actor.userId,
          async (client) => {
            await requireFamily(client, actor.userId, familyId);
            return getMemberProfile(client, { familyId, memberId });
          },
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: FamilyParams; Body: CreateMemberInput }>(
    '/api/v1/families/:familyId/members',
    {
      schema: { params: familyParams, body: createMemberBodySchema },
      preValidation: rejectUnknownBodyKeys(
        [
          'display_name',
          'familiar_name',
          'hometown',
          'biography',
          'birth_date',
          'birth_year',
          'deceased',
          'contacts',
        ],
        { key: 'contacts', allowedKeys: ['kind', 'value', 'visibility'] },
      ),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'member.create');
        const member = normalizeCreateMemberInput(request.body);
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          createMember(client, { familyId, actorId: actor.userId, member }),
        );
        return reply.code(201).send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.patch<{ Params: MemberParams; Body: UpdateMemberInput }>(
    '/api/v1/families/:familyId/members/:memberId',
    {
      schema: { params: memberParamsSchema, body: updateMemberBodySchema },
      preValidation: rejectUnknownBodyKeys(
        [
          'version',
          'display_name',
          'familiar_name',
          'hometown',
          'biography',
          'birth_date',
          'birth_year',
          'deceased',
          'contacts',
        ],
        { key: 'contacts', allowedKeys: ['kind', 'value', 'visibility'] },
      ),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, memberId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(memberId, 'memberId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'member.update');
        const update = normalizeUpdateMemberInput(request.body);
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          updateMember(client, { familyId, memberId, actorId: actor.userId, update }),
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

  app.get<{ Params: FamilyParams; Querystring: EventListQuery }>(
    '/api/v1/families/:familyId/events',
    { schema: { params: familyParams, querystring: eventListQuerySchema } },
    async (request, reply) => {
      try {
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        const query = request.query;
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          listCalendarOccurrences(client, {
            familyId,
            actorId: actor.userId,
            from: query.from,
            to: query.to,
            ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
            limit: query.limit ?? 20,
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.get<{ Params: EventParams }>(
    '/api/v1/families/:familyId/events/:eventId',
    { schema: { params: familyEventParamsSchema } },
    async (request, reply) => {
      try {
        const { familyId, eventId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(eventId, 'eventId');
        const actor = await authenticatedActor(options.auth, request);
        return reply.send(
          await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            getCalendarEvent(client, { familyId, eventId, actorId: actor.userId }),
          ),
        );
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: FamilyParams; Body: CreateEventInput }>(
    '/api/v1/families/:familyId/events',
    {
      schema: { params: familyParams, body: createEventBodySchema },
      preValidation: rejectCreateEventUnknownKeys,
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const idempotencyKey = idempotencyKeyOf(request);
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'calendar.create');
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          createCalendarEvent(client, {
            familyId,
            actorId: actor.userId,
            idempotencyKey,
            event: request.body,
            ...(options.calendarConverter ? { converter: options.calendarConverter } : {}),
          }),
        );
        return reply.code(201).send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.patch<{ Params: EventParams; Body: UpdateEventInput }>(
    '/api/v1/families/:familyId/events/:eventId',
    {
      schema: { params: familyEventParamsSchema, body: updateEventBodySchema },
      preValidation: rejectUpdateEventUnknownKeys,
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, eventId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(eventId, 'eventId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'calendar.update');
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          updateCalendarEvent(client, {
            familyId,
            eventId,
            actorId: actor.userId,
            version: request.body.version,
            event: request.body.event,
            ...(options.calendarConverter ? { converter: options.calendarConverter } : {}),
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: EventParams; Body: CancelEventInput }>(
    '/api/v1/families/:familyId/events/:eventId/cancel',
    {
      schema: { params: familyEventParamsSchema, body: cancelEventBodySchema },
      preValidation: rejectUnknownBodyKeys(['version']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, eventId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(eventId, 'eventId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'calendar.cancel');
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          cancelCalendarEvent(client, {
            familyId,
            eventId,
            actorId: actor.userId,
            version: request.body.version,
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.put<{ Params: OccurrenceParams; Body: RsvpBody }>(
    '/api/v1/families/:familyId/occurrences/:occurrenceId/rsvp',
    {
      schema: { params: familyOccurrenceParamsSchema, body: upsertEventRsvpBodySchema },
      preValidation: rejectUnknownBodyKeys(['response']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, occurrenceId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(occurrenceId, 'occurrenceId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'calendar.rsvp');
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          upsertCalendarRsvp(client, {
            familyId,
            occurrenceId,
            actorId: actor.userId,
            response: request.body.response,
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.get<{ Params: FamilyParams; Querystring: NotificationListQuery }>(
    '/api/v1/families/:familyId/notifications',
    { schema: { params: familyParams, querystring: notificationListQuerySchema } },
    async (request, reply) => {
      try {
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          listNotifications(client, {
            familyId,
            actorId: actor.userId,
            limit: request.query.limit ?? 20,
            ...(request.query.cursor !== undefined ? { cursor: request.query.cursor } : {}),
            unreadOnly: request.query.unread_only ?? false,
          }),
        );
        return reply.send(result);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: NotificationParams; Body: Record<string, never> }>(
    '/api/v1/families/:familyId/notifications/:notificationId/read',
    {
      schema: {
        params: familyNotificationParamsSchema,
        body: { type: 'object', additionalProperties: false },
      },
      preValidation: rejectUnknownBodyKeys([]),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, notificationId } = request.params;
        assertUuid(familyId, 'familyId');
        assertUuid(notificationId, 'notificationId');
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'notification.read');
        return reply.send(
          await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            markNotificationRead(client, { familyId, notificationId, actorId: actor.userId }),
          ),
        );
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.get<{ Params: FamilyParams }>(
    '/api/v1/families/:familyId/notification-preferences',
    { schema: { params: familyParams } },
    async (request, reply) => {
      try {
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        return reply.send(
          await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            getNotificationPreferences(client, { familyId, actorId: actor.userId }),
          ),
        );
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.patch<{ Params: FamilyParams; Body: UpdateNotificationPreferencesInput }>(
    '/api/v1/families/:familyId/notification-preferences',
    {
      schema: { params: familyParams, body: updateNotificationPreferencesBodySchema },
      preValidation: rejectUnknownBodyKeys([
        'reminder_offsets',
        'quiet_hours',
        'push_enabled',
        'version',
      ]),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, 'notification.preferences');
        return reply.send(
          await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            updateNotificationPreferences(client, {
              familyId,
              actorId: actor.userId,
              input: request.body,
            }),
          ),
        );
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  if (options.mediaStorage) {
    const mediaStorage = options.mediaStorage;
    app.post<{ Params: FamilyParams; Body: CreateMediaUploadInput }>(
      '/api/v1/families/:familyId/media/uploads',
      {
        schema: { params: familyParams, body: createMediaUploadBodySchema },
        preValidation: rejectUnknownBodyKeys(['mime_type', 'byte_size', 'purpose']),
      },
      async (request, reply) => {
        try {
          assertMutationRequest(request, options.webOrigin);
          const { familyId } = familyParamsOf(request);
          const actor = await authenticatedActor(options.auth, request);
          requireRateLimit(uploadLimiter, actor.userId, `media.upload:${familyId}`);
          const response = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            createMediaUpload(client, mediaStorage, {
              familyId,
              actorId: actor.userId,
              input: request.body,
            }),
          );
          return reply.code(201).send(response);
        } catch (error) {
          return replyError(reply, request, error);
        }
      },
    );

    app.post<{ Params: MediaParams; Body: Record<string, never> }>(
      '/api/v1/families/:familyId/media/:mediaId/complete',
      {
        schema: {
          params: mediaParamsSchema,
          body: { type: 'object', additionalProperties: false },
        },
        preValidation: rejectUnknownBodyKeys([]),
      },
      async (request, reply) => {
        try {
          assertMutationRequest(request, options.webOrigin);
          const { familyId, mediaId } = request.params;
          const actor = await authenticatedActor(options.auth, request);
          requireRateLimit(uploadLimiter, actor.userId, `media.complete:${familyId}`);
          return reply.send(
            await withActorTransaction(options.runtimePool, actor.userId, (client) =>
              completeMediaUpload(client, mediaStorage, {
                familyId,
                mediaId,
                actorId: actor.userId,
              }),
            ),
          );
        } catch (error) {
          return replyError(reply, request, error);
        }
      },
    );

    app.get<{ Params: MediaParams }>(
      '/api/v1/families/:familyId/media/:mediaId',
      { schema: { params: mediaParamsSchema } },
      async (request, reply) => {
        try {
          const { familyId, mediaId } = request.params;
          const actor = await authenticatedActor(options.auth, request);
          return reply.send(
            await withActorTransaction(options.runtimePool, actor.userId, (client) =>
              getMedia(client, { familyId, mediaId, actorId: actor.userId }),
            ),
          );
        } catch (error) {
          return replyError(reply, request, error);
        }
      },
    );

    app.get<{ Params: MediaParams }>(
      '/api/v1/families/:familyId/media/:mediaId/content',
      { schema: { params: mediaParamsSchema } },
      async (request, reply) => {
        try {
          const { familyId, mediaId } = request.params;
          const actor = await authenticatedActor(options.auth, request);
          const grant = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            getMediaContentGrant(client, mediaStorage, {
              familyId,
              mediaId,
              actorId: actor.userId,
            }),
          );
          return reply.redirect(grant.url);
        } catch (error) {
          return replyError(reply, request, error);
        }
      },
    );
  }

  app.get<{ Params: FamilyParams; Querystring: MomentListQuery }>(
    '/api/v1/families/:familyId/moments',
    { schema: { params: familyParams, querystring: momentListQuerySchema } },
    async (request, reply) => {
      try {
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        return reply.send(
          await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            listMoments(client, {
              familyId,
              actorId: actor.userId,
              limit: request.query.limit ?? 20,
              ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
            }),
          ),
        );
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: FamilyParams; Body: CreateMomentInput }>(
    '/api/v1/families/:familyId/moments',
    {
      schema: { params: familyParams, body: createMomentBodySchema },
      preValidation: rejectUnknownBodyKeys([
        'client_request_id',
        'media_id',
        'caption',
        'audience',
      ]),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, `moment.create:${familyId}`);
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          createMoment(client, {
            familyId,
            actorId: actor.userId,
            idempotencyKey: idempotencyKeyOf(request),
            input: request.body,
          }),
        );
        return reply.code(result.created ? 201 : 200).send(result.moment);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.delete<{ Params: MomentParams }>(
    '/api/v1/families/:familyId/moments/:momentId',
    { schema: { params: momentParamsSchema } },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, momentId } = request.params;
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, `moment.delete:${familyId}`);
        await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          deleteMoment(client, { familyId, momentId, actorId: actor.userId }),
        );
        return reply.code(204).send();
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.put<{ Params: MomentParams; Body: UpdateMomentReactionInput }>(
    '/api/v1/families/:familyId/moments/:momentId/reaction',
    {
      schema: { params: momentParamsSchema, body: updateMomentReactionBodySchema },
      preValidation: rejectUnknownBodyKeys(['reaction']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, momentId } = request.params;
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, `moment.reaction:${familyId}`);
        return reply.send(
          await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            setMomentReaction(client, {
              familyId,
              momentId,
              actorId: actor.userId,
              reaction: request.body.reaction,
            }),
          ),
        );
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.get<{ Params: FamilyParams; Querystring: MemoryListQuery }>(
    '/api/v1/families/:familyId/memories',
    { schema: { params: familyParams, querystring: memoryListQuerySchema } },
    async (request, reply) => {
      try {
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        return reply.send(
          await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            listMemories(client, {
              familyId,
              actorId: actor.userId,
              limit: request.query.limit ?? 20,
              ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
            }),
          ),
        );
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: FamilyParams; Body: CreateMemoryInput }>(
    '/api/v1/families/:familyId/memories',
    {
      schema: { params: familyParams, body: createMemoryBodySchema },
      preValidation: rejectUnknownBodyKeys(['title', 'occurred_on', 'audience', 'items'], {
        key: 'items',
        allowedKeys: ['kind', 'position', 'media_id', 'body'],
      }),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId } = familyParamsOf(request);
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, `memory.create:${familyId}`);
        return reply
          .code(201)
          .send(
            await withActorTransaction(options.runtimePool, actor.userId, (client) =>
              createMemory(client, { familyId, actorId: actor.userId, input: request.body }),
            ),
          );
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: MomentParams; Body: CreateMemoryFromMomentInput }>(
    '/api/v1/families/:familyId/moments/:momentId/memory',
    {
      schema: { params: momentParamsSchema, body: createMemoryFromMomentBodySchema },
      preValidation: rejectUnknownBodyKeys(['title']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, momentId } = request.params;
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, `memory.from-moment:${familyId}`);
        const result = await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          createMemoryFromMoment(client, {
            familyId,
            momentId,
            actorId: actor.userId,
            input: request.body,
          }),
        );
        return reply.code(result.created ? 201 : 200).send(result.memory);
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.post<{ Params: MemoryParams; Body: AddMemoryItemInput }>(
    '/api/v1/families/:familyId/memories/:memoryId/items',
    {
      schema: { params: memoryParamsSchema, body: createMemoryItemBodySchema },
      preValidation: rejectUnknownBodyKeys(['version', 'kind', 'position', 'media_id', 'body']),
    },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, memoryId } = request.params;
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, `memory.item:${familyId}`);
        return reply.code(201).send(
          await withActorTransaction(options.runtimePool, actor.userId, (client) =>
            addMemoryItem(client, {
              familyId,
              memoryId,
              actorId: actor.userId,
              input: request.body,
            }),
          ),
        );
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );

  app.delete<{ Params: MemoryParams }>(
    '/api/v1/families/:familyId/memories/:memoryId',
    { schema: { params: memoryParamsSchema } },
    async (request, reply) => {
      try {
        assertMutationRequest(request, options.webOrigin);
        const { familyId, memoryId } = request.params;
        const actor = await authenticatedActor(options.auth, request);
        requireRateLimit(mutationLimiter, actor.userId, `memory.delete:${familyId}`);
        await withActorTransaction(options.runtimePool, actor.userId, (client) =>
          deleteMemory(client, { familyId, memoryId, actorId: actor.userId }),
        );
        return reply.code(204).send();
      } catch (error) {
        return replyError(reply, request, error);
      }
    },
  );
}
