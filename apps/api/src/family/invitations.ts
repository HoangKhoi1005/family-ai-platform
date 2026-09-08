import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { writeAudit } from './audit.js';
import { FamilyHttpError } from './authorization.js';

export interface InvitationCreateInput {
  familyId: string;
  actorId: string;
  intendedMemberId?: string;
  expiresAt: Date;
}

export interface InvitationCreateResult {
  id: string;
  token: string;
  expires_at: string;
  version: number;
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function createInvitation(
  client: PoolClient,
  input: InvitationCreateInput,
): Promise<InvitationCreateResult> {
  if (input.intendedMemberId !== undefined) {
    const target = await client.query<{ id: string }>(
      'SELECT id FROM members WHERE family_id = $1 AND id = $2',
      [input.familyId, input.intendedMemberId],
    );
    if (!target.rowCount) throw new FamilyHttpError(404, 'NOT_FOUND', 'Member was not found');
  }
  const token = randomBytes(32).toString('base64url');
  const inserted = await client.query<{
    id: string;
    expires_at: Date;
    version: number;
  }>(
    `INSERT INTO invitations
       (family_id, token_hash, intended_member_id, expires_at, created_by)
     SELECT $1, $2, $3, $4, fm.id
       FROM family_memberships fm
      WHERE fm.family_id = $1 AND fm.user_id = $5 AND fm.status = 'active'
      RETURNING id, expires_at, version`,
    [
      input.familyId,
      hashInvitationToken(token),
      input.intendedMemberId ?? null,
      input.expiresAt,
      input.actorId,
    ],
  );
  const row = inserted.rows[0];
  if (!row) throw new FamilyHttpError(403, 'FORBIDDEN', 'Operation is not allowed');
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'invitation.created',
    targetType: 'invitation',
    targetId: row.id,
    changeSummary: 'created',
    version: row.version,
  });
  return {
    id: row.id,
    token,
    expires_at: new Date(row.expires_at).toISOString(),
    version: row.version,
  };
}

export async function revokeInvitation(
  client: PoolClient,
  input: { familyId: string; actorId: string; invitationId: string; version: number },
): Promise<{ id: string; version: number; revoked_at: string }> {
  const current = await client.query<{
    id: string;
    version: number;
    expires_at: Date;
    consumed_at: Date | null;
    revoked_at: Date | null;
  }>(
    `SELECT id, version, expires_at, consumed_at, revoked_at
       FROM invitations
      WHERE id = $1 AND family_id = $2
      FOR UPDATE`,
    [input.invitationId, input.familyId],
  );
  const row = current.rows[0];
  if (!row) throw new FamilyHttpError(404, 'NOT_FOUND', 'Invitation was not found');
  if (
    row.version !== input.version ||
    row.consumed_at ||
    row.revoked_at ||
    row.expires_at <= new Date()
  ) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Invitation is no longer available');
  }
  const revokedAt = new Date();
  const updated = await client.query<{ id: string; version: number; revoked_at: Date }>(
    `UPDATE invitations
        SET revoked_at = $3, version = version + 1
      WHERE id = $1 AND family_id = $2 AND version = $4
      RETURNING id, version, revoked_at`,
    [input.invitationId, input.familyId, revokedAt, input.version],
  );
  const result = updated.rows[0];
  if (!result) throw new FamilyHttpError(409, 'CONFLICT', 'Invitation changed');
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'invitation.revoked',
    targetType: 'invitation',
    targetId: result.id,
    changeSummary: 'revoked',
    version: result.version,
  });
  return {
    id: result.id,
    version: result.version,
    revoked_at: new Date(result.revoked_at).toISOString(),
  };
}

export async function acceptInvitation(
  client: PoolClient,
  token: string,
): Promise<{ membership_id: string; status: string }> {
  if (token.length === 0 || token.length > 256) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Invitation is no longer available');
  }
  const result = await client.query<{ membership_id: string; status: string }>(
    'SELECT membership_id, status FROM public.accept_invitation($1)',
    [hashInvitationToken(token)],
  );
  const row = result.rows[0];
  if (!row) throw new FamilyHttpError(409, 'CONFLICT', 'Invitation is no longer available');
  return { membership_id: row.membership_id, status: row.status };
}
