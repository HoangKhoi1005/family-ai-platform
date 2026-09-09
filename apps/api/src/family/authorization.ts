import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EXPIRY_MS = 7 * DAY_MS;
const MAX_EXPIRY_MS = 30 * DAY_MS;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FamilyRole = 'admin' | 'member';

export interface FamilyMembership {
  id: string;
  role: FamilyRole;
}

export class FamilyHttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'FamilyHttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function assertUuid(value: unknown, field: string): asserts value is string {
  if (!isUuid(value)) throw new FamilyHttpError(400, 'VALIDATION_ERROR', `${field} is invalid`);
}

export function assertMutationRequest(request: FastifyRequest, webOrigin: string): void {
  const origin = request.headers.origin;
  if (origin !== webOrigin) {
    throw new FamilyHttpError(403, 'FORBIDDEN', 'Request origin is not allowed');
  }
  const contentType = request.headers['content-type'];
  if (
    typeof contentType !== 'string' ||
    contentType.split(';', 1)[0]?.trim() !== 'application/json'
  ) {
    throw new FamilyHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'application/json is required');
  }
}

export function resolveExpiry(value: string | undefined): Date {
  const now = Date.now();
  const expiry = value === undefined ? new Date(now + DEFAULT_EXPIRY_MS) : new Date(value);
  if (!Number.isFinite(expiry.getTime())) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'expires_at is invalid');
  }
  if (expiry.getTime() <= now || expiry.getTime() > now + MAX_EXPIRY_MS) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'expires_at is outside the allowed window');
  }
  return expiry;
}

/**
 * Bounded local-instance limiter for the single API process used in this phase.
 * A multi-instance deployment must move these buckets to a shared database store.
 */
export class BoundedRateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly maxKeys: number,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  allow(key: string): boolean {
    const now = Date.now();
    for (const [entryKey, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(entryKey);
    }
    let entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      while (this.entries.size >= this.maxKeys) {
        const oldest = this.entries.keys().next().value;
        if (oldest === undefined) break;
        this.entries.delete(oldest);
      }
      entry = { count: 0, resetAt: now + this.windowMs };
      this.entries.set(key, entry);
    }
    if (entry.count >= this.max) return false;
    entry.count += 1;
    return true;
  }
}

export function requireRateLimit(
  limiter: BoundedRateLimiter,
  actorId: string,
  bucket: string,
): void {
  if (!limiter.allow(`${bucket}:${actorId}`)) {
    throw new FamilyHttpError(429, 'RATE_LIMITED', 'Too many requests');
  }
}

export async function requireFamily(
  client: PoolClient,
  actorId: string,
  familyId: string,
  adminOnly = false,
): Promise<FamilyMembership> {
  const result = await client.query<{ id: string; role: FamilyRole }>(
    `SELECT id, role
       FROM family_memberships
      WHERE family_id = $1 AND user_id = $2 AND status = 'active'
      LIMIT 1`,
    [familyId, actorId],
  );
  const membership = result.rows[0];
  if (!membership) {
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Family resource was not found');
  }
  if (adminOnly && membership.role !== 'admin') {
    throw new FamilyHttpError(403, 'FORBIDDEN', 'This operation requires an administrator');
  }
  return membership;
}

export async function lockFamily(client: PoolClient, familyId: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [familyId]);
}

export async function setRouteContext(
  client: PoolClient,
  values: { purpose?: string; claimId?: string; memberId?: string; requestId?: string },
): Promise<void> {
  if (values.purpose !== undefined) {
    await client.query("SELECT set_config('app.purpose', $1, true)", [values.purpose]);
  }
  if (values.claimId !== undefined) {
    await client.query("SELECT set_config('app.claim_id', $1, true)", [values.claimId]);
  }
  if (values.memberId !== undefined) {
    await client.query("SELECT set_config('app.member_id', $1, true)", [values.memberId]);
  }
  if (values.requestId !== undefined) {
    await client.query("SELECT set_config('app.request_id', $1, true)", [values.requestId]);
  }
}

export function mapFamilyError(error: unknown): FamilyHttpError {
  if (error instanceof FamilyHttpError) return error;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (code === 'P0001' || code === '23505' || code === '40001') {
      return new FamilyHttpError(409, 'CONFLICT', 'The requested state is no longer available');
    }
    if (code === '42501') return new FamilyHttpError(403, 'FORBIDDEN', 'Operation is not allowed');
    if (code === '22P02' || code === '23503' || code === '23514') {
      return new FamilyHttpError(400, 'VALIDATION_ERROR', 'Request is invalid');
    }
  }
  return new FamilyHttpError(500, 'INTERNAL_ERROR', 'An internal error occurred');
}

export function sendFamilyError(
  reply: FastifyReply,
  request: FastifyRequest,
  error: unknown,
): FastifyReply {
  const mapped = mapFamilyError(error);
  return reply.code(mapped.statusCode).send({
    error: { code: mapped.code, message: mapped.message, request_id: request.id },
  });
}
