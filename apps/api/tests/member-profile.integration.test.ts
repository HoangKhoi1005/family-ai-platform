import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertSafeApplicationRoles, createDatabasePool } from '@family/database';
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
const createdEmails: string[] = [];
const authRateLimitPaths = ['/sign-up/email', '/sign-in/email'] as const;
let sequence = 0;
let familyId = '';
let foreignFamilyId = '';
let admin: { id: string; cookie: string };
let owner: { id: string; cookie: string };
let other: { id: string; cookie: string };
let revoked: { id: string; cookie: string };
let accentedMemberId = '';
let duplicateMemberId = '';
let linkedMemberId = '';
let adminLinkedMemberId = '';
let unlinkedMemberId = '';
let privateMemberId = '';
let literalSearchMemberId = '';
let foreignMemberId = '';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for member profile integration tests`);
  return value;
}

function cookieHeader(response: { headers: { [name: string]: unknown } }): string {
  const values = response.headers['set-cookie'];
  if (typeof values !== 'string' && !Array.isArray(values)) return '';
  const cookies = Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string')
    : [values];
  return cookies.map((value) => value.split(';', 1)[0]).join('; ');
}

async function clearAuthRateLimitBuckets(): Promise<void> {
  await ownerPool.query(
    `DELETE FROM auth_rate_limits
      WHERE split_part(key, '|', 2) = ANY($1::text[])`,
    [authRateLimitPaths],
  );
}

function uniqueEmail(label: string): string {
  sequence += 1;
  const email = `member-profile-${Date.now()}-${sequence}-${label}@example.test`;
  createdEmails.push(email);
  return email;
}

async function createVerifiedUser(label: string): Promise<{ id: string; cookie: string }> {
  const email = uniqueEmail(label);
  await clearAuthRateLimitBuckets();
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
  await clearAuthRateLimitBuckets();
  const signIn = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: config.webOrigin, 'content-type': 'application/json' },
    payload: { email, password: 'correct horse battery staple' },
  });
  expect(signIn.statusCode).toBe(200);
  return { id: user.rows[0].id, cookie: cookieHeader(signIn) };
}

function mutationHeaders(cookie: string): Record<string, string> {
  return { cookie, origin: config.webOrigin, 'content-type': 'application/json' };
}

describe('member directory and profile routes with real Better Auth sessions', () => {
  beforeAll(async () => {
    await assertSafeApplicationRoles(authPool, runtimePool);
    admin = await createVerifiedUser('admin');
    owner = await createVerifiedUser('owner');
    other = await createVerifiedUser('other');
    revoked = await createVerifiedUser('revoked');
    await ownerPool.query('BEGIN');
    try {
      familyId = (
        await ownerPool.query<{ id: string }>(
          `INSERT INTO family_spaces(name) VALUES ('Synthetic Profile Family') RETURNING id`,
        )
      ).rows[0].id;
      foreignFamilyId = (
        await ownerPool.query<{ id: string }>(
          `INSERT INTO family_spaces(name) VALUES ('Synthetic Foreign Family') RETURNING id`,
        )
      ).rows[0].id;
      await ownerPool.query(
        `INSERT INTO family_memberships(family_id,user_id,role,status)
         VALUES ($1,$2,'admin','active'),($1,$3,'member','active'),($1,$4,'member','active'),($1,$5,'member','revoked')`,
        [familyId, admin.id, owner.id, other.id, revoked.id],
      );
      const foreignMember = await ownerPool.query<{ id: string }>(
        `INSERT INTO members(family_id,display_name) VALUES ($1,'Foreign Member') RETURNING id`,
        [foreignFamilyId],
      );
      foreignMemberId = foreignMember.rows[0].id;
      const members = await ownerPool.query<{ id: string }>(
        `INSERT INTO members(
           family_id,display_name,familiar_name,hometown,biography,birth_date,birth_year,deceased
         ) VALUES
           ($1,'Nguyễn Ánh','Ánh','Huế','Private family biography','1984-02-29',1984,false),
           ($1,'Nguyễn Ánh','Anh','Hà Nội','Duplicate name biography',NULL,NULL,false),
           ($1,'Linked Person','Link','Đà Nẵng','Linked biography','1970-01-02',1970,false),
           ($1,'Admin Linked Person','Admin link','Hà Nội','Admin linked biography',NULL,NULL,false),
           ($1,'Unlinked Person','Unlinked','Hải Phòng','Unlinked biography',NULL,1950,false),
           ($1,'Private Contact Person','Private','Cần Thơ','Private biography',NULL,NULL,true),
           ($1,'Literal %_ Person','Literal','Quảng Nam','Literal wildcard biography',NULL,NULL,false)
         RETURNING id`,
        [familyId],
      );
      [
        accentedMemberId,
        duplicateMemberId,
        linkedMemberId,
        adminLinkedMemberId,
        unlinkedMemberId,
        privateMemberId,
        literalSearchMemberId,
      ] = members.rows.map((row) => row.id);
      const ownerMembership = (
        await ownerPool.query<{ id: string }>(
          'SELECT id FROM family_memberships WHERE family_id = $1 AND user_id = $2',
          [familyId, owner.id],
        )
      ).rows[0].id;
      const adminMembership = (
        await ownerPool.query<{ id: string }>(
          'SELECT id FROM family_memberships WHERE family_id = $1 AND user_id = $2',
          [familyId, admin.id],
        )
      ).rows[0].id;
      await ownerPool.query(
        `INSERT INTO member_account_links(family_id,membership_id,member_id)
         VALUES ($1,$2,$3),($1,$4,$5)`,
        [familyId, ownerMembership, linkedMemberId, adminMembership, adminLinkedMemberId],
      );
      await ownerPool.query(
        `INSERT INTO member_contacts(family_id,member_id,kind,value,visibility) VALUES
          ($1,$2,'email','linked-self@example.invalid','self'),
          ($1,$2,'phone','+84901234567','family'),
          ($1,$3,'email','unlinked-private@example.invalid','self'),
          ($1,$3,'facebook','https://facebook.com/unlinked','family'),
          ($1,$4,'email','secret-contact@example.invalid','self'),
          ($1,$5,'email','admin-self@example.invalid','self')`,
        [familyId, linkedMemberId, unlinkedMemberId, privateMemberId, adminLinkedMemberId],
      );
      await ownerPool.query('COMMIT');
    } catch (error) {
      await ownerPool.query('ROLLBACK');
      throw error;
    }
    await mailer.drain();
  });

  afterAll(async () => {
    await app.close();
    await mailer.drain();
    if (familyId) {
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
          await ownerPool.query(`DELETE FROM ${table} WHERE family_id = ANY($1::uuid[])`, [
            [familyId, foreignFamilyId],
          ]);
        }
        await ownerPool.query('DELETE FROM family_spaces WHERE id = ANY($1::uuid[])', [
          [familyId, foreignFamilyId],
        ]);
        await ownerPool.query('DELETE FROM users WHERE email = ANY($1::text[])', [createdEmails]);
        await ownerPool.query('COMMIT');
      } catch (error) {
        await ownerPool.query('ROLLBACK');
        throw error;
      }
    } else {
      await ownerPool.query('DELETE FROM users WHERE email = ANY($1::text[])', [createdEmails]);
    }
    await ownerPool.end();
    await runtimePool.end();
    await authPool.end();
  });

  it('lists accent-folded names with stable cursors and date-only DTOs', async () => {
    const folded = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members?q=nguyen&limit=1`,
      headers: { cookie: owner.cookie },
    });
    expect(folded.statusCode).toBe(200);
    const first = folded.json() as {
      members: Array<{ id: string; display_name: string; birth_date: string | null }>;
      next_cursor: string | null;
    };
    expect(first.members).toHaveLength(1);
    expect([accentedMemberId, duplicateMemberId]).toContain(first.members[0].id);
    expect(first.members[0].display_name).toBe('Nguyễn Ánh');
    expect(first.next_cursor).toEqual(expect.any(String));
    const second = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members?q=nguyen&limit=1&cursor=${encodeURIComponent(first.next_cursor!)}`,
      headers: { cookie: owner.cookie },
    });
    expect(second.statusCode).toBe(200);
    const secondRows = second.json().members as Array<{
      id: string;
      display_name: string;
      birth_date: string | null;
    }>;
    expect(secondRows).toHaveLength(1);
    expect(secondRows[0].id).toBe(
      first.members[0].id === accentedMemberId ? duplicateMemberId : accentedMemberId,
    );
    const pagedRows = [...first.members, ...secondRows];
    expect(pagedRows.map((row) => row.id)).toEqual(
      expect.arrayContaining([accentedMemberId, duplicateMemberId]),
    );
    expect(pagedRows.find((row) => row.id === accentedMemberId)?.birth_date).toBe('1984-02-29');
    const reusedForDifferentQuery = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members?q=anh&limit=1&cursor=${encodeURIComponent(first.next_cursor!)}`,
      headers: { cookie: owner.cookie },
    });
    expect(reusedForDifferentQuery.statusCode).toBe(400);
    const literal = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members?q=${encodeURIComponent('%_')}`,
      headers: { cookie: owner.cookie },
    });
    expect(literal.statusCode).toBe(200);
    expect(literal.json().members).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: literalSearchMemberId })]),
    );
    expect(literal.json().members).toHaveLength(1);
    const contactSearch = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members?q=secret-contact@example.invalid`,
      headers: { cookie: owner.cookie },
    });
    expect(contactSearch.statusCode).toBe(200);
    expect(contactSearch.json().members).toEqual([]);
    const badCursor = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members?cursor=invalid`,
      headers: { cookie: owner.cookie },
    });
    expect(badCursor.statusCode).toBe(400);
  });

  it('filters normal contacts and permits only unlinked admin management', async () => {
    const linkedForOwner = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members/${linkedMemberId}`,
      headers: { cookie: owner.cookie },
    });
    expect(linkedForOwner.statusCode).toBe(200);
    expect(linkedForOwner.body).toContain('linked-self@example.invalid');
    const linkedForAdmin = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members/${linkedMemberId}`,
      headers: { cookie: admin.cookie },
    });
    expect(linkedForAdmin.statusCode).toBe(200);
    expect(linkedForAdmin.body).not.toContain('linked-self@example.invalid');
    expect(linkedForAdmin.body).toContain('+84901234567');
    const management = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members/${unlinkedMemberId}/management`,
      headers: { cookie: admin.cookie },
    });
    expect(management.statusCode).toBe(200);
    expect(management.body).toContain('unlinked-private@example.invalid');
    const memberManagement = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members/${unlinkedMemberId}/management`,
      headers: { cookie: other.cookie },
    });
    expect(memberManagement.statusCode).toBe(403);
    const normalUnlinked = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members/${unlinkedMemberId}`,
      headers: { cookie: admin.cookie },
    });
    expect(normalUnlinked.statusCode).toBe(200);
    expect(normalUnlinked.body).not.toContain('unlinked-private@example.invalid');
    const foreign = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members/${foreignMemberId}`,
      headers: { cookie: admin.cookie },
    });
    expect(foreign.statusCode).toBe(404);
    const revokedResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members`,
      headers: { cookie: revoked.cookie },
    });
    expect(revokedResponse.statusCode).toBe(404);
  });

  it('creates and edits profiles atomically with validation, ownership and versions', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: mutationHeaders(admin.cookie),
      payload: {
        display_name: 'Created Person',
        birth_year: 2001,
        contacts: [{ kind: 'email', value: 'created@example.invalid' }],
      },
    });
    expect(created.statusCode).toBe(201);
    const createdProfile = created.json() as {
      id: string;
      version: number;
      contacts: Array<{ kind: string; value: string; visibility: string }>;
    };
    expect(createdProfile.contacts).toMatchObject([
      { kind: 'email', value: 'created@example.invalid', visibility: 'self' },
    ]);
    const lowYear = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: mutationHeaders(admin.cookie),
      payload: {
        display_name: 'Low Year Synthetic',
        birth_date: '0099-02-28',
        birth_year: 99,
      },
    });
    expect(lowYear.statusCode).toBe(201);
    expect(lowYear.json()).toMatchObject({ birth_date: '0099-02-28', birth_year: 99 });
    const audit = await ownerPool.query<{ action: string }>(
      `SELECT action FROM audit_entries WHERE family_id = $1 AND target_id = $2`,
      [familyId, createdProfile.id],
    );
    expect(audit.rows.map((row) => row.action)).toContain('member.created');

    const unlinkedPatch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${unlinkedMemberId}`,
      headers: mutationHeaders(admin.cookie),
      payload: {
        version: 1,
        display_name: 'Unlinked Updated',
        contacts: [{ kind: 'phone', value: '+84 901 234 567' }],
      },
    });
    expect(unlinkedPatch.statusCode).toBe(200);
    const unlinkedProfile = unlinkedPatch.json() as { version: number };
    expect(unlinkedProfile.version).toBe(2);
    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${unlinkedMemberId}`,
      headers: mutationHeaders(admin.cookie),
      payload: { version: 1, display_name: 'Old Version' },
    });
    expect(stale.statusCode).toBe(409);
    const unauthorized = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${unlinkedMemberId}`,
      headers: mutationHeaders(other.cookie),
      payload: { version: 2, display_name: 'Nope' },
    });
    expect(unauthorized.statusCode).toBe(403);

    const linkedPatch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${linkedMemberId}`,
      headers: mutationHeaders(owner.cookie),
      payload: { version: 1, biography: 'Updated linked biography' },
    });
    expect(linkedPatch.statusCode).toBe(200);
    const linkedAdminPatch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${linkedMemberId}`,
      headers: mutationHeaders(admin.cookie),
      payload: { version: 2, biography: 'Should be denied' },
    });
    expect(linkedAdminPatch.statusCode).toBe(403);
    const adminOwnProfile = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/members/${adminLinkedMemberId}`,
      headers: { cookie: admin.cookie },
    });
    expect(adminOwnProfile.statusCode).toBe(200);
    expect(adminOwnProfile.body).toContain('admin-self@example.invalid');
    const adminOwnPatch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${adminLinkedMemberId}`,
      headers: mutationHeaders(admin.cookie),
      payload: { version: 1, biography: 'Updated admin biography' },
    });
    expect(adminOwnPatch.statusCode).toBe(200);

    const tooManyContacts = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: mutationHeaders(admin.cookie),
      payload: {
        display_name: 'Too Many Contacts',
        contacts: Array.from({ length: 11 }, (_, index) => ({
          kind: 'email',
          value: `contact-${index}@example.invalid`,
        })),
      },
    });
    expect(tooManyContacts.statusCode).toBe(400);
    const unsafe = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${unlinkedMemberId}`,
      headers: mutationHeaders(admin.cookie),
      payload: { version: 2, birth_date: 'not-a-date' },
    });
    expect(unsafe.statusCode).toBe(400);
    const mismatchedBirthPair = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${unlinkedMemberId}`,
      headers: mutationHeaders(admin.cookie),
      payload: { version: 2, birth_date: '2000-01-01' },
    });
    expect(mismatchedBirthPair.statusCode).toBe(400);
    const scriptUrl = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${unlinkedMemberId}`,
      headers: mutationHeaders(admin.cookie),
      payload: {
        version: 2,
        contacts: [{ kind: 'facebook', value: 'javascript:alert(1)' }],
      },
    });
    expect(scriptUrl.statusCode).toBe(400);
    const unknownField = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/members`,
      headers: mutationHeaders(admin.cookie),
      payload: { display_name: 'Unknown', role: 'admin' },
    });
    expect(unknownField.statusCode).toBe(400);
    const auditCount = await ownerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_entries
        WHERE family_id = $1 AND target_id = $2 AND action = 'member.updated'`,
      [familyId, unlinkedMemberId],
    );
    expect(auditCount.rows[0].count).toBe('1');

    const otherMembership = (
      await ownerPool.query<{ id: string }>(
        'SELECT id FROM family_memberships WHERE family_id = $1 AND user_id = $2',
        [familyId, other.id],
      )
    ).rows[0].id;
    const claimResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims`,
      headers: mutationHeaders(admin.cookie),
      payload: { membership_id: otherMembership, member_id: privateMemberId },
    });
    expect(claimResponse.statusCode).toBe(201);
    const claim = claimResponse.json() as { id: string; version: number; member_version: number };
    const initialPreview = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/member-claims/${claim.id}/preview`,
      headers: { cookie: other.cookie },
    });
    expect(initialPreview.statusCode).toBe(200);
    const contactPatch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${familyId}/members/${privateMemberId}`,
      headers: mutationHeaders(admin.cookie),
      payload: {
        version: 1,
        contacts: [{ kind: 'email', value: 'secret-contact@example.invalid', visibility: 'self' }],
      },
    });
    expect(contactPatch.statusCode).toBe(200);
    expect(contactPatch.json().version).toBe(2);
    const preservedContact = await ownerPool.query<{ visibility: string; value: string }>(
      'SELECT visibility, value FROM member_contacts WHERE family_id = $1 AND member_id = $2',
      [familyId, privateMemberId],
    );
    expect(preservedContact.rows).toEqual([
      { visibility: 'self', value: 'secret-contact@example.invalid' },
    ]);
    const claimInvalidatedAudit = await ownerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_entries
        WHERE family_id = $1 AND target_id = $2 AND action = 'member.updated'`,
      [familyId, privateMemberId],
    );
    expect(claimInvalidatedAudit.rows[0].count).toBe('1');
    const stalePreview = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${familyId}/member-claims/${claim.id}/preview`,
      headers: { cookie: other.cookie },
    });
    expect(stalePreview.statusCode).toBe(409);
    expect(stalePreview.body).not.toContain('secret-contact@example.invalid');
    const staleConfirm = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/member-claims/${claim.id}/confirm`,
      headers: mutationHeaders(other.cookie),
      payload: {
        version: claim.version,
        member_version: claim.member_version,
        accept_ownership: true,
      },
    });
    expect(staleConfirm.statusCode).toBe(409);
    const noLink = await ownerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM member_account_links
        WHERE family_id = $1 AND member_id = $2`,
      [familyId, privateMemberId],
    );
    expect(noLink.rows[0].count).toBe('0');
  });
});
