import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  assertSafeApplicationRoles,
  createDatabasePool,
  withActorTransaction,
} from '@family/database';
import { buildApp } from '../src/app.js';
import { createAuth } from '../src/auth/auth.js';
import { readAuthConfig } from '../src/auth/config.js';
import { createAuthMailer } from '../src/auth/mailer.js';

const config = readAuthConfig(process.env);
const authPool = createDatabasePool(config.authDatabaseUrl);
const runtimePool = createDatabasePool(config.runtimeDatabaseUrl);
const ownerPool = createDatabasePool(requiredEnv('DATABASE_URL'));
const mailer = createAuthMailer(config);
const auth = createAuth(config, authPool, mailer);
const app = buildApp({ auth, publicOrigin: config.webOrigin, runtimePool });
const rateLimitApp = buildApp({ auth, publicOrigin: config.webOrigin, runtimePool });
const createdUsers: string[] = [];
const testAuthRateLimitPaths = ['/sign-up/email', '/sign-in/email'] as const;
let familyId = '';
let admin: { id: string; cookie: string };
let secondAdmin: { id: string; cookie: string };
let candidate: { id: string; cookie: string };
let claimCandidate: { id: string; cookie: string };
let candidateTwo: { id: string; cookie: string };
let candidateThree: { id: string; cookie: string };
let defaultCandidate: { id: string; cookie: string };
let concurrentCandidate: { id: string; cookie: string };
let staleCandidate: { id: string; cookie: string };
let expiredCandidate: { id: string; cookie: string };
let targetMemberId = '';
let targetContactId = '';
let defaultTargetMemberId = '';
let defaultTargetContactId = '';
let staleTargetMemberId = '';
let expiredTargetMemberId = '';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for membership integration tests`);
  return value;
}

function uniqueEmail(label: string): string {
  const email = `membership-${label}-${Date.now()}-${createdUsers.length}@example.test`;
  return email;
}

function cookieHeader(response: { headers: { [name: string]: unknown } }): string {
  const values = response.headers['set-cookie'];
  if (typeof values !== 'string' && !Array.isArray(values)) return '';
  const cookies = Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string')
    : [values];
  return cookies.map((value) => value.split(';', 1)[0]).join('; ');
}

async function clearMembershipAuthRateLimitBuckets(): Promise<void> {
  // Better Auth keys its database buckets as `${ip}|${path}`. Limit cleanup
  // to the exact auth endpoints used by this fixture; do not erase unrelated
  // buckets or trust a client-supplied IP header to create a new namespace.
  await ownerPool.query(
    `DELETE FROM auth_rate_limits
      WHERE split_part(key, '|', 2) = ANY($1::text[])`,
    [testAuthRateLimitPaths],
  );
}

async function createVerifiedUser(label: string): Promise<{ id: string; cookie: string }> {
  const email = uniqueEmail(label);
  await clearMembershipAuthRateLimitBuckets();
  createdUsers.push(email);
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: config.webOrigin, 'content-type': 'application/json' },
    payload: { name: `Synthetic ${label}`, email, password: 'correct horse battery staple' },
  });
  expect(signup.statusCode).toBe(200);
  const user = await ownerPool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    email,
  ]);
  expect(user.rows[0]).toBeTruthy();
  await ownerPool.query('UPDATE users SET email_verified = true WHERE id = $1', [user.rows[0].id]);
  await clearMembershipAuthRateLimitBuckets();
  const signIn = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: config.webOrigin, 'content-type': 'application/json' },
    payload: { email, password: 'correct horse battery staple' },
  });
  expect(signIn.statusCode).toBe(200);
  return { id: user.rows[0].id, cookie: cookieHeader(signIn) };
}

describe('membership routes with real Better Auth sessions', () => {
  beforeAll(async () => {
    await assertSafeApplicationRoles(authPool, runtimePool);
    await clearMembershipAuthRateLimitBuckets();
    admin = await createVerifiedUser('admin');
    secondAdmin = await createVerifiedUser('second-admin');
    candidate = await createVerifiedUser('candidate');
    claimCandidate = await createVerifiedUser('claim-candidate');
    candidateTwo = await createVerifiedUser('candidate-two');
    candidateThree = await createVerifiedUser('candidate-three');
    defaultCandidate = await createVerifiedUser('default-candidate');
    concurrentCandidate = await createVerifiedUser('concurrent-candidate');
    staleCandidate = await createVerifiedUser('stale-candidate');
    expiredCandidate = await createVerifiedUser('expired-candidate');
    await ownerPool.query('BEGIN');
    try {
      const family = await ownerPool.query<{ id: string }>(
        `INSERT INTO family_spaces(name) VALUES ('Synthetic Membership Family') RETURNING id`,
      );
      familyId = family.rows[0].id;
      await ownerPool.query(
        `INSERT INTO family_memberships(family_id,user_id,role,status)
         VALUES ($1,$2,'admin','active'),($1,$3,'admin','active')`,
        [familyId, admin.id, secondAdmin.id],
      );
      await ownerPool.query(
        `INSERT INTO family_memberships(family_id,user_id,role,status)
         VALUES ($1,$2,'member','active'),($1,$3,'member','active'),
                ($1,$4,'member','active'),($1,$5,'member','active')`,
        [
          familyId,
          defaultCandidate.id,
          concurrentCandidate.id,
          staleCandidate.id,
          expiredCandidate.id,
        ],
      );
      const member = await ownerPool.query<{ id: string }>(
        `INSERT INTO members(family_id,display_name,familiar_name,hometown,biography)
         VALUES ($1,'Synthetic Target','Target','Hanoi','Synthetic biography') RETURNING id`,
        [familyId],
      );
      targetMemberId = member.rows[0].id;
      const contact = await ownerPool.query<{ id: string }>(
        `INSERT INTO member_contacts(family_id,member_id,kind,value,visibility)
         VALUES ($1,$2,'email','synthetic-target@example.invalid','self') RETURNING id`,
        [familyId, targetMemberId],
      );
      targetContactId = contact.rows[0].id;
      const otherMembers = await ownerPool.query<{ id: string }>(
        `INSERT INTO members(family_id,display_name) VALUES
          ($1,'Synthetic Default Target'),($1,'Synthetic Stale Target'),($1,'Synthetic Expired Target')
         RETURNING id`,
        [familyId],
      );
      defaultTargetMemberId = otherMembers.rows[0].id;
      staleTargetMemberId = otherMembers.rows[1].id;
      expiredTargetMemberId = otherMembers.rows[2].id;
      const defaultContact = await ownerPool.query<{ id: string }>(
        `INSERT INTO member_contacts(family_id,member_id,kind,value,visibility)
         VALUES ($1,$2,'phone','synthetic-default-phone','self') RETURNING id`,
        [familyId, defaultTargetMemberId],
      );
      defaultTargetContactId = defaultContact.rows[0].id;
      await ownerPool.query('COMMIT');
    } catch (error) {
      await ownerPool.query('ROLLBACK');
      throw error;
    }
    await mailer.drain();
  });

  afterAll(async () => {
    await app.close();
    await rateLimitApp.close();
    await mailer.drain();
    if (!familyId) {
      await ownerPool.query('DELETE FROM users WHERE email = ANY($1::text[])', [createdUsers]);
      await ownerPool.end();
      await runtimePool.end();
      await authPool.end();
      return;
    }
    await ownerPool.query('BEGIN');
    try {
      for (const table of [
        'audit_entries',
        'member_claims',
        'invitations',
        'member_contacts',
        'member_account_links',
        'members',
        'family_memberships',
      ]) {
        await ownerPool.query(`DELETE FROM ${table} WHERE family_id = $1`, [familyId]);
      }
      await ownerPool.query('DELETE FROM family_spaces WHERE id = $1', [familyId]);
      await ownerPool.query('DELETE FROM users WHERE email = ANY($1::text[])', [createdUsers]);
      await ownerPool.query('COMMIT');
    } catch (error) {
      await ownerPool.query('ROLLBACK');
      throw error;
    }
    await ownerPool.end();
    await runtimePool.end();
    await authPool.end();
  });

  it('covers invitation lifecycle, CSRF, pending visibility, and administrator revocation', async () => {
    for (const payload of [{ role: 'admin' }, { id: randomUUID() }]) {
      const unknownFieldResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/families/${familyId}/invitations`,
        headers: {
          cookie: admin.cookie,
          origin: config.webOrigin,
          'content-type': 'application/json',
        },
        payload,
      });
      expect(unknownFieldResponse.statusCode).toBe(400);
    }

    const missingOrigin = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/invitations`,
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: {},
    });
    expect(missingOrigin.statusCode).toBe(403);

    const foreignOrigin = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/invitations`,
      headers: {
        cookie: admin.cookie,
        origin: 'https://attacker.invalid',
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect(foreignOrigin.statusCode).toBe(403);

    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/invitations`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { intended_member_id: targetMemberId },
    });
    expect(created.statusCode).toBe(201);
    const invitation = created.json() as { id: string; token: string; version: number };
    expect(invitation.token).toHaveLength(43);
    expect(created.body).not.toContain('token_hash');

    const accepted = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      headers: {
        cookie: candidate.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { token: invitation.token },
    });
    expect(accepted.statusCode).toBe(201);
    const pending = accepted.json() as { membership_id: string };
    const pendingMe = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: candidate.cookie },
    });
    expect(pendingMe.statusCode).toBe(200);
    expect(pendingMe.json().memberships).toContainEqual({
      id: pending.membership_id,
      status: 'pending',
    });
    expect(pendingMe.body).not.toContain('Synthetic Membership Family');

    const pendingList = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/memberships`,
      headers: { cookie: candidate.cookie },
    });
    expect(pendingList.statusCode).toBe(404);

    const queue = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/memberships`,
      headers: { cookie: admin.cookie },
    });
    expect(queue.statusCode).toBe(200);
    const pendingRow = (
      queue.json() as { memberships: Array<{ id: string; status: string; version: number }> }
    ).memberships.find((row) => row.id === pending.membership_id);
    expect(pendingRow).toMatchObject({
      id: pending.membership_id,
      status: 'pending',
      version: 1,
    });

    const revokedInviteResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/invitations`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect(revokedInviteResponse.statusCode).toBe(201);
    const revokedInvite = revokedInviteResponse.json() as {
      id: string;
      token: string;
      version: number;
    };
    const revokeInviteResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/invitations/${revokedInvite.id}/revoke`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { version: revokedInvite.version },
    });
    expect(revokeInviteResponse.statusCode).toBe(200);
    const revokedAccept = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      headers: {
        cookie: candidateTwo.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { token: revokedInvite.token },
    });
    expect(revokedAccept.statusCode).toBe(409);

    const expiredInviteResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/invitations`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect(expiredInviteResponse.statusCode).toBe(201);
    const expiredInvite = expiredInviteResponse.json() as { id: string; token: string };
    await ownerPool.query(
      "UPDATE invitations SET expires_at = now() - interval '1 second' WHERE id = $1",
      [expiredInvite.id],
    );
    const expiredAccept = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      headers: {
        cookie: candidateTwo.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { token: expiredInvite.token },
    });
    expect(expiredAccept.statusCode).toBe(409);

    const concurrentInviteResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/invitations`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: {},
    });
    const concurrentInvite = concurrentInviteResponse.json() as { token: string };
    const concurrentAccepts = await Promise.all(
      [candidateTwo.cookie, candidateThree.cookie].map((cookie) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/invitations/accept',
          headers: {
            cookie,
            origin: config.webOrigin,
            'content-type': 'application/json',
          },
          payload: { token: concurrentInvite.token },
        }),
      ),
    );
    expect(concurrentAccepts.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    const acceptedConcurrentMemberships = await ownerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM family_memberships fm
         JOIN users u ON u.id = fm.user_id
        WHERE fm.family_id = $1 AND u.email = ANY($2::text[]) AND fm.status = 'pending'`,
      [
        familyId,
        createdUsers.filter(
          (email) => email.includes('candidate-two') || email.includes('candidate-three'),
        ),
      ],
    );
    expect(acceptedConcurrentMemberships.rows[0].count).toBe('1');

    const secondAdminQueue = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/memberships`,
      headers: { cookie: admin.cookie },
    });
    const secondAdminMembership = (
      secondAdminQueue.json() as {
        memberships: Array<{ id: string; user_id: string; version: number }>;
      }
    ).memberships.find((row) => row.user_id === secondAdmin.id);
    expect(secondAdminMembership).toBeTruthy();
    const selfRevoke = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/memberships/${secondAdminMembership!.id}/revoke`,
      headers: {
        cookie: secondAdmin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { version: secondAdminMembership!.version },
    });
    expect(selfRevoke.statusCode).toBe(200);
    const lastAdminQueue = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/memberships`,
      headers: { cookie: admin.cookie },
    });
    const adminMembership = (
      lastAdminQueue.json() as {
        memberships: Array<{ id: string; user_id: string; version: number }>;
      }
    ).memberships.find((row) => row.user_id === admin.id);
    const lastAdminAttempts = await Promise.all(
      [1, 2].map(() =>
        app.inject({
          method: 'POST',
          url: `/api/v1/families/${familyId}/memberships/${adminMembership!.id}/revoke`,
          headers: {
            cookie: admin.cookie,
            origin: config.webOrigin,
            'content-type': 'application/json',
          },
          payload: { version: adminMembership!.version },
        }),
      ),
    );
    expect(lastAdminAttempts.every((response) => response.statusCode === 409)).toBe(true);
  });

  it('rate limits claim preview and revoke per actor', async () => {
    const candidateMembership = (
      await ownerPool.query<{ id: string }>(
        'SELECT id FROM family_memberships WHERE family_id = $1 AND user_id = $2',
        [familyId, expiredCandidate.id],
      )
    ).rows[0];
    expect(candidateMembership).toBeTruthy();
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { membership_id: candidateMembership.id, member_id: expiredTargetMemberId },
    });
    expect(created.statusCode).toBe(201);
    const claim = created.json() as { id: string; version: number };

    const previews = [];
    for (let attempt = 0; attempt < 31; attempt += 1) {
      previews.push(
        await rateLimitApp.inject({
          method: 'GET',
          url: `/api/v1/families/${familyId}/member-claims/${claim.id}/preview`,
          headers: { cookie: expiredCandidate.cookie },
        }),
      );
    }
    expect(previews.slice(0, 30).every((response) => response.statusCode !== 429)).toBe(true);
    expect(previews[30].statusCode).toBe(429);
    const unrelatedPreview = await rateLimitApp.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/member-claims/${claim.id}/preview`,
      headers: { cookie: defaultCandidate.cookie },
    });
    expect(unrelatedPreview.statusCode).not.toBe(429);

    const revokes = [];
    for (let attempt = 0; attempt < 31; attempt += 1) {
      revokes.push(
        await rateLimitApp.inject({
          method: 'POST',
          url: `/api/v1/families/${familyId}/member-claims/${claim.id}/revoke`,
          headers: {
            cookie: admin.cookie,
            origin: config.webOrigin,
            'content-type': 'application/json',
          },
          payload: { version: claim.version },
        }),
      );
    }
    expect(revokes.slice(0, 30).every((response) => response.statusCode !== 429)).toBe(true);
    expect(revokes[30].statusCode).toBe(429);
    const unrelatedRevoke = await rateLimitApp.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims/${claim.id}/revoke`,
      headers: {
        cookie: defaultCandidate.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { version: claim.version },
    });
    expect(unrelatedRevoke.statusCode).not.toBe(429);
  });

  it('covers claim approval, private previews, atomic confirmation, expiry, and revoked access', async () => {
    const claimInvitationResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/invitations`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect(claimInvitationResponse.statusCode).toBe(201);
    const claimInvitation = claimInvitationResponse.json() as { token: string };
    const claimAccepted = await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      headers: {
        cookie: claimCandidate.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { token: claimInvitation.token },
    });
    expect(claimAccepted.statusCode).toBe(201);
    const queue = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/memberships`,
      headers: { cookie: admin.cookie },
    });
    const pending = (
      queue.json() as { memberships: Array<{ id: string; user_id: string; version: number }> }
    ).memberships.find((row) => row.user_id === claimCandidate.id);
    expect(pending).toBeTruthy();
    const approved = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/memberships/${pending!.id}/approve`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { version: pending!.version },
    });
    expect(approved.statusCode).toBe(200);

    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { membership_id: pending!.id, member_id: targetMemberId },
    });
    expect(created.statusCode).toBe(201);
    const claim = created.json() as { id: string; version: number; member_version: number };

    const adminPreview = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/member-claims/${claim.id}/preview`,
      headers: { cookie: admin.cookie },
    });
    expect(adminPreview.statusCode).toBe(404);

    const invalidTargetConfirm = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims/${claim.id}/confirm`,
      headers: {
        cookie: claimCandidate.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: {
        version: claim.version,
        member_version: claim.member_version,
        accept_ownership: true,
        contact_visibilities: [{ id: randomUUID(), visibility: 'family' }],
      },
    });
    expect(invalidTargetConfirm.statusCode).toBe(400);
    const rolledBackLink = await ownerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM member_account_links
        WHERE family_id = $1 AND membership_id = (
          SELECT id FROM family_memberships WHERE family_id = $1 AND user_id = $2
        )`,
      [familyId, claimCandidate.id],
    );
    expect(rolledBackLink.rows[0].count).toBe('0');
    const rolledBackAudit = await ownerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_entries
        WHERE family_id = $1 AND target_id = $2 AND action = 'claim.confirmed'`,
      [familyId, claim.id],
    );
    expect(rolledBackAudit.rows[0].count).toBe('0');

    const preview = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/member-claims/${claim.id}/preview`,
      headers: { cookie: claimCandidate.cookie },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain('synthetic-target@example.invalid');

    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims/${claim.id}/confirm`,
      headers: {
        cookie: claimCandidate.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: {
        version: claim.version,
        member_version: claim.member_version,
        accept_ownership: true,
        contact_visibilities: [{ id: targetContactId, visibility: 'family' }],
      },
    });
    expect(confirmed.statusCode).toBe(200);
    expect((confirmed.json() as { status: string }).status).toBe('consumed');

    const linkedAgain = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/member-claims/${claim.id}/preview`,
      headers: { cookie: claimCandidate.cookie },
    });
    expect(linkedAgain.statusCode).toBe(409);
    const audits = await ownerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_entries
        WHERE family_id = $1 AND target_id = $2 AND action = 'claim.confirmed'`,
      [familyId, claim.id],
    );
    expect(audits.rows[0].count).toBe('1');

    const defaultClaimResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: {
        membership_id: (
          await ownerPool.query<{ id: string }>(
            'SELECT id FROM family_memberships WHERE family_id = $1 AND user_id = $2',
            [familyId, defaultCandidate.id],
          )
        ).rows[0].id,
        member_id: defaultTargetMemberId,
      },
    });
    expect(defaultClaimResponse.statusCode).toBe(201);
    const defaultClaim = defaultClaimResponse.json() as {
      id: string;
      version: number;
      member_version: number;
    };
    const defaultConfirm = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims/${defaultClaim.id}/confirm`,
      headers: {
        cookie: defaultCandidate.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: {
        version: defaultClaim.version,
        member_version: defaultClaim.member_version,
        accept_ownership: true,
      },
    });
    expect(defaultConfirm.statusCode).toBe(200);
    const defaultVisibility = await ownerPool.query<{ visibility: string }>(
      'SELECT visibility FROM member_contacts WHERE id = $1',
      [defaultTargetContactId],
    );
    expect(defaultVisibility.rows[0].visibility).toBe('self');

    const staleMembership = (
      await ownerPool.query<{ id: string }>(
        'SELECT id FROM family_memberships WHERE family_id = $1 AND user_id = $2',
        [familyId, staleCandidate.id],
      )
    ).rows[0].id;
    const staleClaimResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { membership_id: staleMembership, member_id: staleTargetMemberId },
    });
    expect(staleClaimResponse.statusCode).toBe(201);
    const staleClaim = staleClaimResponse.json() as { id: string };
    const otherActorMetadata = await withActorTransaction(
      runtimePool,
      defaultCandidate.id,
      (client) => client.query('SELECT * FROM public.actor_claim_metadata($1)', [staleClaim.id]),
    );
    expect(otherActorMetadata.rows).toEqual([]);
    await ownerPool.query('UPDATE members SET version = version + 1 WHERE id = $1', [
      staleTargetMemberId,
    ]);
    const stalePreview = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/member-claims/${staleClaim.id}/preview`,
      headers: { cookie: staleCandidate.cookie },
    });
    expect(stalePreview.statusCode).toBe(409);
    expect(stalePreview.body).not.toContain('Synthetic Stale Target');

    const expiredClaimResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: {
        membership_id: (
          await ownerPool.query<{ id: string }>(
            'SELECT id FROM family_memberships WHERE family_id = $1 AND user_id = $2',
            [familyId, expiredCandidate.id],
          )
        ).rows[0].id,
        member_id: expiredTargetMemberId,
      },
    });
    expect(expiredClaimResponse.statusCode).toBe(201);
    const expiredClaim = expiredClaimResponse.json() as { id: string };
    await ownerPool.query(
      "UPDATE member_claims SET expires_at = now() - interval '1 second' WHERE id = $1",
      [expiredClaim.id],
    );
    const expiredPreview = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/member-claims/${expiredClaim.id}/preview`,
      headers: { cookie: expiredCandidate.cookie },
    });
    expect(expiredPreview.statusCode).toBe(409);

    const concurrentMembership = (
      await ownerPool.query<{ id: string }>(
        'SELECT id FROM family_memberships WHERE family_id = $1 AND user_id = $2',
        [familyId, concurrentCandidate.id],
      )
    ).rows[0].id;
    const concurrentTarget = (
      await ownerPool.query<{ id: string }>(
        `INSERT INTO members(family_id,display_name) VALUES ($1,'Synthetic Concurrent Target') RETURNING id`,
        [familyId],
      )
    ).rows[0].id;
    const concurrentClaimResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { membership_id: concurrentMembership, member_id: concurrentTarget },
    });
    expect(concurrentClaimResponse.statusCode).toBe(201);
    const concurrentClaim = concurrentClaimResponse.json() as {
      id: string;
      version: number;
      member_version: number;
    };
    const confirmPayload = {
      version: concurrentClaim.version,
      member_version: concurrentClaim.member_version,
      accept_ownership: true as const,
    };
    const concurrentConfirms = await Promise.all(
      [1, 2].map(() =>
        app.inject({
          method: 'POST',
          url: `/api/v1/families/${familyId}/member-claims/${concurrentClaim.id}/confirm`,
          headers: {
            cookie: concurrentCandidate.cookie,
            origin: config.webOrigin,
            'content-type': 'application/json',
          },
          payload: confirmPayload,
        }),
      ),
    );
    expect(concurrentConfirms.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const concurrentLinks = await ownerPool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM member_account_links WHERE family_id = $1 AND member_id = $2',
      [familyId, concurrentTarget],
    );
    expect(concurrentLinks.rows[0].count).toBe('1');

    const revokedCandidateMembership = (
      await ownerPool.query<{ id: string; version: number }>(
        'SELECT id, version FROM family_memberships WHERE family_id = $1 AND user_id = $2',
        [familyId, claimCandidate.id],
      )
    ).rows[0];
    const revokedCandidate = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/memberships/${revokedCandidateMembership.id}/revoke`,
      headers: {
        cookie: admin.cookie,
        origin: config.webOrigin,
        'content-type': 'application/json',
      },
      payload: { version: revokedCandidateMembership.version },
    });
    expect(revokedCandidate.statusCode).toBe(200);
    const revokedActorMetadata = await withActorTransaction(
      runtimePool,
      claimCandidate.id,
      (client) => client.query('SELECT * FROM public.actor_claim_metadata($1)', [claim.id]),
    );
    expect(revokedActorMetadata.rows).toEqual([]);
    const revokedQueue = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/memberships`,
      headers: { cookie: claimCandidate.cookie },
    });
    expect(revokedQueue.statusCode).toBe(404);
    const meAfterRevoke = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: claimCandidate.cookie },
    });
    expect(meAfterRevoke.statusCode).toBe(200);
    expect(meAfterRevoke.body).toContain('revoked');
  });
});
