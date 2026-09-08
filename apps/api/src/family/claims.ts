import type { PoolClient } from 'pg';
import { writeAudit } from './audit.js';
import { FamilyHttpError, lockFamily, requireFamily, setRouteContext } from './authorization.js';

export interface ClaimCreateInput {
  familyId: string;
  actorId: string;
  membershipId: string;
  memberId: string;
  expiresAt: Date;
}

export interface ContactVisibilityInput {
  id: string;
  visibility: 'self' | 'family';
}

export async function createClaim(
  client: PoolClient,
  input: ClaimCreateInput,
): Promise<{
  id: string;
  status: string;
  version: number;
  member_version: number;
  expires_at: string;
}> {
  await requireFamily(client, input.actorId, input.familyId, true);
  await lockFamily(client, input.familyId);
  await requireFamily(client, input.actorId, input.familyId, true);
  const candidate = await client.query<{ id: string; status: string }>(
    `SELECT id, status
       FROM family_memberships
      WHERE family_id = $1 AND id = $2
      FOR UPDATE`,
    [input.familyId, input.membershipId],
  );
  if (candidate.rows[0]?.status !== 'active') {
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Candidate membership was not found');
  }
  await setRouteContext(client, { purpose: 'member_management', memberId: input.memberId });
  const member = await client.query<{ id: string; version: number }>(
    `SELECT id, version
       FROM members
      WHERE family_id = $1 AND id = $2
      FOR UPDATE`,
    [input.familyId, input.memberId],
  );
  const memberRow = member.rows[0];
  if (!memberRow) throw new FamilyHttpError(404, 'NOT_FOUND', 'Member was not found');
  const link = await client.query(
    'SELECT 1 FROM member_account_links WHERE family_id = $1 AND member_id = $2',
    [input.familyId, input.memberId],
  );
  if (link.rowCount) throw new FamilyHttpError(409, 'CONFLICT', 'Member is already linked');

  await client.query(
    `UPDATE member_claims
        SET status = 'expired', version = version + 1, updated_at = now()
      WHERE family_id = $1 AND status = 'active' AND expires_at <= clock_timestamp()
        AND (membership_id = $2 OR member_id = $3)`,
    [input.familyId, input.membershipId, input.memberId],
  );
  const inserted = await client.query<{
    id: string;
    status: string;
    version: number;
    member_version: number;
    expires_at: Date;
  }>(
    `INSERT INTO member_claims
       (family_id, membership_id, member_id, expires_at, member_version, created_by)
     VALUES ($1, $2, $3, $4, $5, (
       SELECT id FROM family_memberships
        WHERE family_id = $1 AND user_id = $6 AND status = 'active' AND role = 'admin'
     ))
     RETURNING id, status, version, member_version, expires_at`,
    [
      input.familyId,
      input.membershipId,
      input.memberId,
      input.expiresAt,
      memberRow.version,
      input.actorId,
    ],
  );
  const row = inserted.rows[0];
  if (!row) throw new FamilyHttpError(403, 'FORBIDDEN', 'Operation is not allowed');
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'claim.created',
    targetType: 'claim',
    targetId: row.id,
    changeSummary: 'created',
    version: row.version,
  });
  return {
    id: row.id,
    status: row.status,
    version: row.version,
    member_version: row.member_version,
    expires_at: new Date(row.expires_at).toISOString(),
  };
}

interface ClaimMetadata {
  id: string;
  family_id: string;
  membership_id: string;
  member_id: string;
  status: string;
  version: number;
  member_version: number;
  target_version: number;
  expires_at: Date;
  linked: boolean;
}

async function claimMetadata(
  client: PoolClient,
  claimId: string,
): Promise<ClaimMetadata | undefined> {
  const result = await client.query<ClaimMetadata>(
    `SELECT id, family_id, membership_id, member_id, status, version,
            member_version, target_version, expires_at, linked
       FROM public.actor_claim_metadata($1)`,
    [claimId],
  );
  return result.rows[0];
}

export async function previewClaim(
  client: PoolClient,
  input: { familyId: string; claimId: string },
): Promise<unknown> {
  const metadata = await claimMetadata(client, input.claimId);
  if (!metadata || metadata.family_id !== input.familyId) {
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Claim was not found');
  }
  if (
    metadata.status !== 'active' ||
    metadata.expires_at <= new Date() ||
    metadata.member_version !== metadata.target_version ||
    metadata.linked
  ) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Claim is no longer available');
  }
  await setRouteContext(client, {
    purpose: 'claim_preview',
    claimId: metadata.id,
    memberId: metadata.member_id,
  });
  const result = await client.query<{
    id: string;
    family_id: string;
    membership_id: string;
    member_id: string;
    status: string;
    expires_at: Date;
    member_version: number;
    version: number;
    display_name: string;
    familiar_name: string | null;
    hometown: string | null;
    biography: string | null;
    contact_id: string | null;
    contact_kind: string | null;
    contact_value: string | null;
    contact_visibility: string | null;
  }>(
    `SELECT c.id, c.family_id, c.membership_id, c.member_id, c.status,
            c.expires_at, c.member_version, c.version,
            target.display_name, target.familiar_name, target.hometown, target.biography,
            contact.id AS contact_id, contact.kind AS contact_kind,
            contact.value AS contact_value, contact.visibility AS contact_visibility
       FROM member_claims c
       JOIN members target ON target.family_id = c.family_id AND target.id = c.member_id
       LEFT JOIN member_contacts contact
         ON contact.family_id = target.family_id AND contact.member_id = target.id
      WHERE c.id = $1 AND c.family_id = $2`,
    [input.claimId, input.familyId],
  );
  const rows = result.rows;
  const row = rows[0];
  if (!row) throw new FamilyHttpError(409, 'CONFLICT', 'Claim is no longer available');
  return {
    id: row.id,
    membership_id: row.membership_id,
    status: row.status,
    expires_at: new Date(row.expires_at).toISOString(),
    version: row.version,
    member_version: row.member_version,
    member: {
      id: row.member_id,
      display_name: row.display_name,
      familiar_name: row.familiar_name,
      hometown: row.hometown,
      biography: row.biography,
    },
    contacts: rows
      .filter((contact) => contact.contact_id !== null)
      .map((contact) => ({
        id: contact.contact_id,
        kind: contact.contact_kind,
        value: contact.contact_value,
        visibility: contact.contact_visibility,
      })),
  };
}

async function lockClaimForCandidate(
  client: PoolClient,
  input: { familyId: string; claimId: string; version: number },
): Promise<ClaimMetadata> {
  const metadata = await claimMetadata(client, input.claimId);
  if (!metadata || metadata.family_id !== input.familyId) {
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Claim was not found');
  }
  if (
    metadata.status !== 'active' ||
    metadata.expires_at <= new Date() ||
    metadata.member_version !== metadata.target_version ||
    metadata.linked ||
    metadata.version !== input.version
  ) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Claim is no longer available');
  }
  await client.query(
    `SELECT id FROM family_memberships
      WHERE family_id = $1 AND id = $2 AND status = 'active'`,
    [input.familyId, metadata.membership_id],
  );
  const claim = await client.query<ClaimMetadata>(
    `SELECT id, family_id, membership_id, member_id, status, version,
            member_version, expires_at,
            (SELECT version FROM members target
              WHERE target.family_id = c.family_id AND target.id = c.member_id) AS target_version,
            EXISTS (SELECT 1 FROM member_account_links l
                     WHERE l.family_id = c.family_id AND l.member_id = c.member_id) AS linked
       FROM member_claims c
      WHERE c.id = $1 AND c.family_id = $2
      FOR UPDATE`,
    [input.claimId, input.familyId],
  );
  const row = claim.rows[0];
  if (!row || row.version !== input.version || row.status !== 'active') {
    throw new FamilyHttpError(409, 'CONFLICT', 'Claim changed');
  }
  const target = await client.query<{ version: number }>(
    `SELECT version FROM members WHERE family_id = $1 AND id = $2`,
    [input.familyId, row.member_id],
  );
  if (target.rows[0]?.version !== row.member_version || row.linked) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Claim is no longer available');
  }
  return row;
}

export async function confirmClaim(
  client: PoolClient,
  input: {
    familyId: string;
    actorId: string;
    claimId: string;
    version: number;
    memberVersion: number;
    acceptOwnership: true;
    contactVisibilities?: ContactVisibilityInput[];
  },
): Promise<{ id: string; status: string; version: number; member_version: number }> {
  if (input.acceptOwnership !== true) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'accept_ownership must be true');
  }
  await lockFamily(client, input.familyId);
  const metadata = await claimMetadata(client, input.claimId);
  if (!metadata || metadata.family_id !== input.familyId) {
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Claim was not found');
  }
  if (metadata.member_version !== input.memberVersion) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Claim snapshot is stale');
  }
  const row = await lockClaimForCandidate(client, {
    familyId: input.familyId,
    claimId: input.claimId,
    version: input.version,
  });
  await setRouteContext(client, { purpose: 'claim_confirm', claimId: row.id });
  const membership = await client.query<{ id: string }>(
    `SELECT id FROM family_memberships
      WHERE family_id = $1 AND id = $2 AND user_id = $3 AND status = 'active'`,
    [input.familyId, row.membership_id, input.actorId],
  );
  if (!membership.rowCount) throw new FamilyHttpError(403, 'FORBIDDEN', 'Operation is not allowed');

  await client.query(
    `INSERT INTO member_account_links(family_id, membership_id, member_id)
     VALUES ($1, $2, $3)`,
    [input.familyId, row.membership_id, row.member_id],
  );
  const consumed = await client.query<{ id: string; status: string; version: number }>(
    `UPDATE member_claims
        SET status = 'consumed', version = version + 1, updated_at = now()
      WHERE id = $1 AND family_id = $2 AND status = 'active' AND version = $3
      RETURNING id, status, version`,
    [input.claimId, input.familyId, input.version],
  );
  const consumedRow = consumed.rows[0];
  if (!consumedRow) throw new FamilyHttpError(409, 'CONFLICT', 'Claim changed');

  let memberVersion = row.member_version;
  const visibilities = input.contactVisibilities ?? [];
  if (visibilities.length > 0) {
    const ids = new Set<string>();
    for (const visibility of visibilities) {
      if (ids.has(visibility.id)) {
        throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Duplicate contact id');
      }
      ids.add(visibility.id);
    }
    const contacts = await client.query<{ id: string; visibility: 'self' | 'family' }>(
      `SELECT id, visibility FROM member_contacts
        WHERE family_id = $1 AND member_id = $2 AND id = ANY($3::uuid[])
        FOR UPDATE`,
      [input.familyId, row.member_id, [...ids]],
    );
    if (contacts.rowCount !== visibilities.length) {
      throw new FamilyHttpError(
        400,
        'VALIDATION_ERROR',
        'Contact does not belong to the claim target',
      );
    }
    const currentVisibility = new Map(
      contacts.rows.map((contact) => [contact.id, contact.visibility]),
    );
    const changed = visibilities.some(
      (visibility) => currentVisibility.get(visibility.id) !== visibility.visibility,
    );
    for (const visibility of visibilities) {
      await client.query(
        `UPDATE member_contacts
            SET visibility = $1
          WHERE id = $2 AND family_id = $3 AND member_id = $4`,
        [visibility.visibility, visibility.id, input.familyId, row.member_id],
      );
    }
    if (changed) {
      const updatedMember = await client.query<{ version: number }>(
        `UPDATE members
            SET version = version + 1, updated_at = now()
          WHERE id = $1 AND family_id = $2 AND version = $3
          RETURNING version`,
        [row.member_id, input.familyId, input.memberVersion],
      );
      if (!updatedMember.rows[0]) throw new FamilyHttpError(409, 'CONFLICT', 'Member changed');
      memberVersion = updatedMember.rows[0].version;
    }
  }
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'claim.confirmed',
    targetType: 'claim',
    targetId: consumedRow.id,
    changeSummary: visibilities.length > 0 ? 'confirmed_with_visibility' : 'confirmed',
    version: consumedRow.version,
  });
  return {
    id: consumedRow.id,
    status: consumedRow.status,
    version: consumedRow.version,
    member_version: memberVersion,
  };
}

export async function declineClaim(
  client: PoolClient,
  input: { familyId: string; actorId: string; claimId: string; version?: number },
): Promise<{ id: string; status: string; version: number }> {
  await lockFamily(client, input.familyId);
  const metadata = await claimMetadata(client, input.claimId);
  if (!metadata || metadata.family_id !== input.familyId) {
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Claim was not found');
  }
  const row = await lockClaimForCandidate(client, {
    familyId: input.familyId,
    claimId: input.claimId,
    version: input.version ?? metadata.version,
  });
  await setRouteContext(client, { purpose: 'claim_confirm', claimId: row.id });
  const membership = await client.query<{ id: string }>(
    `SELECT id FROM family_memberships
      WHERE family_id = $1 AND id = $2 AND user_id = $3 AND status = 'active'`,
    [input.familyId, row.membership_id, input.actorId],
  );
  if (!membership.rowCount) throw new FamilyHttpError(403, 'FORBIDDEN', 'Operation is not allowed');
  const updated = await client.query<{ id: string; status: string; version: number }>(
    `UPDATE member_claims
        SET status = 'declined', version = version + 1, updated_at = now()
      WHERE id = $1 AND family_id = $2 AND status = 'active' AND version = $3
      RETURNING id, status, version`,
    [input.claimId, input.familyId, row.version],
  );
  const result = updated.rows[0];
  if (!result) throw new FamilyHttpError(409, 'CONFLICT', 'Claim changed');
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'claim.declined',
    targetType: 'claim',
    targetId: result.id,
    changeSummary: 'declined',
    version: result.version,
  });
  return result;
}

export async function revokeClaim(
  client: PoolClient,
  input: { familyId: string; actorId: string; claimId: string; version: number },
): Promise<{ id: string; status: string; version: number }> {
  await requireFamily(client, input.actorId, input.familyId, true);
  await lockFamily(client, input.familyId);
  await requireFamily(client, input.actorId, input.familyId, true);
  const current = await client.query<{ id: string; status: string; version: number }>(
    `SELECT id, status, version
       FROM member_claims
      WHERE family_id = $1 AND id = $2
      FOR UPDATE`,
    [input.familyId, input.claimId],
  );
  const row = current.rows[0];
  if (!row) throw new FamilyHttpError(404, 'NOT_FOUND', 'Claim was not found');
  if (row.status !== 'active' || row.version !== input.version) {
    throw new FamilyHttpError(409, 'CONFLICT', 'Claim is no longer available');
  }
  const updated = await client.query<{ id: string; status: string; version: number }>(
    `UPDATE member_claims
        SET status = 'revoked', version = version + 1, updated_at = now()
      WHERE id = $1 AND family_id = $2 AND status = 'active' AND version = $3
      RETURNING id, status, version`,
    [input.claimId, input.familyId, input.version],
  );
  const result = updated.rows[0];
  if (!result) throw new FamilyHttpError(409, 'CONFLICT', 'Claim changed');
  await writeAudit(client, {
    familyId: input.familyId,
    actorId: input.actorId,
    action: 'claim.revoked',
    targetType: 'claim',
    targetId: result.id,
    changeSummary: 'revoked',
    version: result.version,
  });
  return result;
}
