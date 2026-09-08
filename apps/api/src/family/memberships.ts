import type { PoolClient } from 'pg';
import { writeAudit } from './audit.js';
import { FamilyHttpError, lockFamily, requireFamily } from './authorization.js';

export async function listOwnMemberships(client: PoolClient, actorId: string): Promise<unknown[]> {
  const result = await client.query<{
    id: string;
    family_id: string;
    role: 'admin' | 'member';
    status: 'pending' | 'active' | 'revoked';
    name: string | null;
  }>(
    `SELECT fm.id, fm.family_id, fm.role, fm.status, fs.name
       FROM family_memberships fm
       LEFT JOIN family_spaces fs ON fs.id = fm.family_id AND fm.status = 'active'
      WHERE fm.user_id = $1
      ORDER BY fm.created_at, fm.id`,
    [actorId],
  );
  return result.rows.map((row) =>
    row.status === 'active'
      ? { id: row.id, status: row.status, family_id: row.family_id, name: row.name, role: row.role }
      : { id: row.id, status: row.status },
  );
}

export async function listMemberships(client: PoolClient, familyId: string): Promise<unknown[]> {
  const result = await client.query<{
    id: string;
    user_id: string;
    role: 'admin' | 'member';
    status: 'pending' | 'active' | 'revoked';
    version: number;
    created_at: Date;
    name: string | null;
  }>(
    `SELECT fm.id, fm.user_id, fm.role, fm.status, fm.version, fm.created_at, u.name
       FROM family_memberships fm
       LEFT JOIN users u ON u.id = fm.user_id
      WHERE fm.family_id = $1
      ORDER BY fm.created_at, fm.id`,
    [familyId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    version: row.version,
    created_at: new Date(row.created_at).toISOString(),
    user: { id: row.user_id, name: row.name },
  }));
}

export async function approveMembership(
  client: PoolClient,
  input: { familyId: string; actorId: string; membershipId: string; version: number },
): Promise<{ id: string; status: string; version: number }> {
  await requireFamily(client, input.actorId, input.familyId, true);
  await lockFamily(client, input.familyId);
  await requireFamily(client, input.actorId, input.familyId, true);
  const current = await client.query<{
    id: string;
    role: 'admin' | 'member';
    status: 'pending' | 'active' | 'revoked';
    version: number;
  }>(
    `SELECT id, role, status, version
       FROM family_memberships
      WHERE family_id = $1 AND id = $2
      FOR UPDATE`,
    [input.familyId, input.membershipId],
  );
  const row = current.rows[0];
  if (!row) throw new FamilyHttpError(404, 'NOT_FOUND', 'Membership was not found');
  if (row.status !== 'pending' || row.role !== 'member' || row.version !== input.version) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Membership is no longer pending');
  }
  const updated = await client.query<{ id: string; status: string; version: number }>(
    `UPDATE family_memberships
        SET status = 'active', version = version + 1
      WHERE family_id = $1 AND id = $2 AND status = 'pending' AND version = $3
      RETURNING id, status, version`,
    [input.familyId, input.membershipId, input.version],
  );
  const result = updated.rows[0];
  if (!result) throw new FamilyHttpError(409, 'CONFLICT', 'Membership changed');
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'membership.approved',
    targetType: 'membership',
    targetId: result.id,
    changeSummary: 'approved',
    version: result.version,
  });
  return result;
}

export async function revokeMembership(
  client: PoolClient,
  input: { familyId: string; actorId: string; membershipId: string; version: number },
): Promise<{ id: string; status: string; version: number }> {
  await requireFamily(client, input.actorId, input.familyId, true);
  await lockFamily(client, input.familyId);
  await requireFamily(client, input.actorId, input.familyId, true);
  const current = await client.query<{
    id: string;
    role: 'admin' | 'member';
    status: 'pending' | 'active' | 'revoked';
    version: number;
  }>(
    `SELECT id, role, status, version
       FROM family_memberships
      WHERE family_id = $1 AND id = $2
      FOR UPDATE`,
    [input.familyId, input.membershipId],
  );
  const row = current.rows[0];
  if (!row) throw new FamilyHttpError(404, 'NOT_FOUND', 'Membership was not found');
  if (row.status === 'revoked' || row.version !== input.version) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Membership is no longer active');
  }
  if (row.role === 'admin') {
    const admins = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM family_memberships
        WHERE family_id = $1 AND role = 'admin' AND status = 'active'`,
      [input.familyId],
    );
    if (Number(admins.rows[0]?.count ?? 0) <= 1) {
      throw new FamilyHttpError(409, 'CONFLICT', 'The last administrator cannot be revoked');
    }
  }
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'membership.revoked',
    targetType: 'membership',
    targetId: row.id,
    changeSummary: 'revoked',
    version: row.version + 1,
  });
  const updated = await client.query<{ id: string; status: string; version: number }>(
    `UPDATE family_memberships
        SET status = 'revoked', version = version + 1
      WHERE family_id = $1 AND id = $2 AND version = $3 AND status <> 'revoked'
      RETURNING id, status, version`,
    [input.familyId, input.membershipId, input.version],
  );
  const result = updated.rows[0];
  if (!result) throw new FamilyHttpError(409, 'CONFLICT', 'Membership changed');
  return result;
}
