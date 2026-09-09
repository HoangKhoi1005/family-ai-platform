import type { PoolClient } from 'pg';
import type { OnboardingStateResponse } from '@family/contracts';
import { requireFamily } from './authorization.js';

export async function getOwnOnboarding(
  client: PoolClient,
  actorId: string,
  familyId: string,
): Promise<OnboardingStateResponse> {
  await requireFamily(client, actorId, familyId);
  const links = await client.query<{ member_id: string }>(
    `SELECT l.member_id FROM member_account_links l
     JOIN family_memberships fm ON fm.family_id = l.family_id AND fm.id = l.membership_id
     WHERE fm.user_id = $1 AND fm.family_id = $2 AND fm.status = 'active'`,
    [actorId, familyId],
  );
  const claims = await client.query<{ id: string; version: number }>(
    `SELECT c.id, c.version FROM member_claims c
     JOIN family_memberships fm ON fm.family_id = c.family_id AND fm.id = c.membership_id
     WHERE fm.user_id = $1 AND fm.family_id = $2 AND fm.status = 'active'
       AND c.status = 'active' AND c.expires_at > clock_timestamp()
     ORDER BY c.created_at DESC`,
    [actorId, familyId],
  );
  return { member_id: links.rows[0]?.member_id ?? null, claims: claims.rows };
}
