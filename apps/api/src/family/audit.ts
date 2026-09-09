import type { PoolClient } from 'pg';

const ACTIONS = new Set([
  'invitation.created',
  'invitation.revoked',
  'membership.invitation_accepted',
  'membership.approved',
  'membership.revoked',
  'claim.created',
  'claim.confirmed',
  'claim.declined',
  'claim.revoked',
  'member.created',
  'member.updated',
  'relationship.change_requested',
  'relationship.change_cancelled',
  'relationship.change_approved',
  'relationship.change_rejected',
  'relationship.created',
  'relationship.updated',
  'relationship.removed',
]);

export type AuditAction =
  | 'invitation.created'
  | 'invitation.revoked'
  | 'membership.invitation_accepted'
  | 'membership.approved'
  | 'membership.revoked'
  | 'claim.created'
  | 'claim.confirmed'
  | 'claim.declined'
  | 'claim.revoked'
  | 'member.created'
  | 'member.updated'
  | 'relationship.change_requested'
  | 'relationship.change_cancelled'
  | 'relationship.change_approved'
  | 'relationship.change_rejected'
  | 'relationship.created'
  | 'relationship.updated'
  | 'relationship.removed';

export async function writeAudit(
  client: PoolClient,
  input: {
    familyId: string;
    actorId: string;
    action: AuditAction;
    targetType:
      'invitation' | 'membership' | 'claim' | 'member' | 'change_request' | 'relationship';
    targetId: string;
    changeSummary: string;
    version?: number;
  },
): Promise<void> {
  if (!ACTIONS.has(input.action)) throw new Error('Unsupported audit action');
  await client.query(
    `INSERT INTO audit_entries
       (family_id, actor_id, action, target_type, target_id, change_summary, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.familyId,
      input.actorId,
      input.action,
      input.targetType,
      input.targetId,
      input.changeSummary,
      input.version ?? 1,
    ],
  );
}
