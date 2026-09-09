import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabasePool } from '@family/database';
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
const createdUsers: string[] = [];
let familyId = '';
let admin: { id: string; cookie: string };
let member: { id: string; cookie: string };
let parentMemberId = '';
let childMemberId = '';
let thirdMemberId = '';
let relationshipId = '';
let relationshipVersion = 0;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for relationship integration tests`);
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

async function clearAuthRateLimit(): Promise<void> {
  await ownerPool.query(
    `DELETE FROM auth_rate_limits
      WHERE split_part(key, '|', 2) = ANY($1::text[])`,
    [['/sign-up/email', '/sign-in/email']],
  );
}

async function createVerifiedUser(label: string): Promise<{ id: string; cookie: string }> {
  const email = `relationships-${label}-${Date.now()}-${createdUsers.length}@example.test`;
  createdUsers.push(email);
  await clearAuthRateLimit();
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: config.webOrigin, 'content-type': 'application/json' },
    payload: { name: `Relationship ${label}`, email, password: 'correct horse battery staple' },
  });
  expect(signup.statusCode).toBe(200);
  const user = await ownerPool.query<{ id: string }>('SELECT id FROM users WHERE email=$1', [
    email,
  ]);
  await ownerPool.query('UPDATE users SET email_verified=true WHERE id=$1', [user.rows[0]!.id]);
  await clearAuthRateLimit();
  const signin = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: config.webOrigin, 'content-type': 'application/json' },
    payload: { email, password: 'correct horse battery staple' },
  });
  expect(signin.statusCode).toBe(200);
  return { id: user.rows[0]!.id, cookie: cookieHeader(signin) };
}

describe('relationship routes with real sessions and PostgreSQL', () => {
  beforeAll(async () => {
    admin = await createVerifiedUser('admin');
    member = await createVerifiedUser('member');
    const family = await ownerPool.query<{ id: string }>(
      "INSERT INTO family_spaces(name) VALUES ('Relationship Integration Family') RETURNING id",
    );
    familyId = family.rows[0]!.id;
    await ownerPool.query(
      `INSERT INTO family_memberships(family_id,user_id,role,status)
       VALUES ($1,$2,'admin','active'),($1,$3,'member','active')`,
      [familyId, admin.id, member.id],
    );
    const members = await ownerPool.query<{ id: string }>(
      `INSERT INTO members(family_id,display_name)
       VALUES ($1,'Nguyễn Văn Cha'),($1,'Nguyễn Minh Con'),($1,'Nguyễn An Nhiên') RETURNING id`,
      [familyId],
    );
    parentMemberId = members.rows[0]!.id;
    childMemberId = members.rows[1]!.id;
    thirdMemberId = members.rows[2]!.id;
  });

  afterAll(async () => {
    await app.close();
    await mailer.drain();
    if (familyId) {
      await ownerPool.query('DELETE FROM audit_entries WHERE family_id=$1', [familyId]);
      await ownerPool.query('DELETE FROM change_requests WHERE family_id=$1', [familyId]);
      await ownerPool.query('DELETE FROM relationships WHERE family_id=$1', [familyId]);
      await ownerPool.query('DELETE FROM members WHERE family_id=$1', [familyId]);
      await ownerPool.query('DELETE FROM family_memberships WHERE family_id=$1', [familyId]);
      await ownerPool.query('DELETE FROM family_spaces WHERE id=$1', [familyId]);
    }
    await ownerPool.query('DELETE FROM users WHERE email = ANY($1::text[])', [createdUsers]);
    await ownerPool.end();
    await runtimePool.end();
    await authPool.end();
  });

  it('keeps a proposal out of the graph until an administrator approves it', async () => {
    const graphUrl = `/api/v1/families/${familyId}/relationships?root_member_id=${parentMemberId}&depth=2`;
    const memberHeaders = {
      cookie: member.cookie,
      origin: config.webOrigin,
      'content-type': 'application/json',
    };
    const adminHeaders = { ...memberHeaders, cookie: admin.cookie };

    expect(
      (await app.inject({ method: 'GET', url: graphUrl, headers: memberHeaders })).json(),
    ).toMatchObject({
      relationships: [],
    });

    const proposed = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${familyId}/change-requests`,
      headers: memberHeaders,
      payload: {
        type: 'relationship_create',
        payload: {
          from_member_id: parentMemberId,
          to_member_id: childMemberId,
          type: 'parent_child',
          subtype: 'biological',
        },
      },
    });
    expect(proposed.statusCode).toBe(201);
    expect(proposed.json()).toMatchObject({
      type: 'relationship_create',
      status: 'pending',
      version: 1,
    });

    expect(
      (await app.inject({ method: 'GET', url: graphUrl, headers: memberHeaders })).json(),
    ).toMatchObject({
      relationships: [],
    });

    const decisionUrl = `/api/v1/families/${familyId}/change-requests/${proposed.json().id}/decision`;
    expect(
      (
        await app.inject({
          method: 'POST',
          url: decisionUrl,
          headers: memberHeaders,
          payload: { decision: 'approved', version: 1 },
        })
      ).statusCode,
    ).toBe(403);

    const approved = await app.inject({
      method: 'POST',
      url: decisionUrl,
      headers: adminHeaders,
      payload: { decision: 'approved', version: 1 },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: 'approved', version: 2 });

    const graph = await app.inject({ method: 'GET', url: graphUrl, headers: memberHeaders });
    expect(graph.statusCode).toBe(200);
    expect(graph.json().relationships).toEqual([
      expect.objectContaining({
        from_member_id: parentMemberId,
        to_member_id: childMemberId,
        type: 'parent_child',
        subtype: 'biological',
      }),
    ]);
    relationshipId = graph.json().relationships[0].id;
    relationshipVersion = graph.json().relationships[0].version;
    const audits = await ownerPool.query<{ action: string }>(
      `SELECT action FROM audit_entries
        WHERE family_id=$1 AND action LIKE 'relationship.%'
        ORDER BY occurred_at`,
      [familyId],
    );
    expect(audits.rows.map((row) => row.action)).toEqual([
      'relationship.change_requested',
      'relationship.created',
      'relationship.change_approved',
    ]);
  });

  it('applies an approved subtype update and approved removal with optimistic versions', async () => {
    expect(relationshipId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(relationshipVersion).toBe(1);
    const memberHeaders = {
      cookie: member.cookie,
      origin: config.webOrigin,
      'content-type': 'application/json',
    };
    const adminHeaders = { ...memberHeaders, cookie: admin.cookie };
    const base = `/api/v1/families/${familyId}`;
    const update = await app.inject({
      method: 'POST',
      url: `${base}/change-requests`,
      headers: memberHeaders,
      payload: {
        type: 'relationship_update',
        target_id: relationshipId,
        base_version: relationshipVersion,
        payload: { subtype: 'adoptive' },
      },
    });
    expect(update.statusCode, update.body).toBe(201);
    const updateDecision = await app.inject({
      method: 'POST',
      url: `${base}/change-requests/${update.json().id}/decision`,
      headers: adminHeaders,
      payload: { decision: 'approved', version: update.json().version },
    });
    expect(updateDecision.statusCode).toBe(200);
    relationshipVersion += 1;
    const updatedGraph = await app.inject({
      method: 'GET',
      url: `${base}/relationships?root_member_id=${parentMemberId}&depth=2`,
      headers: memberHeaders,
    });
    expect(updatedGraph.json().relationships[0]).toMatchObject({
      id: relationshipId,
      subtype: 'adoptive',
      version: relationshipVersion,
    });

    const staleRemove = await app.inject({
      method: 'POST',
      url: `${base}/change-requests`,
      headers: memberHeaders,
      payload: {
        type: 'relationship_remove',
        target_id: relationshipId,
        base_version: relationshipVersion - 1,
      },
    });
    expect(staleRemove.statusCode).toBe(409);

    const remove = await app.inject({
      method: 'POST',
      url: `${base}/change-requests`,
      headers: memberHeaders,
      payload: {
        type: 'relationship_remove',
        target_id: relationshipId,
        base_version: relationshipVersion,
      },
    });
    expect(remove.statusCode).toBe(201);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `${base}/change-requests/${remove.json().id}/decision`,
          headers: adminHeaders,
          payload: { decision: 'approved', version: 1 },
        })
      ).statusCode,
    ).toBe(200);
    const removedGraph = await app.inject({
      method: 'GET',
      url: `${base}/relationships?root_member_id=${parentMemberId}&depth=2`,
      headers: memberHeaders,
    });
    expect(removedGraph.json().relationships).toEqual([]);
  });

  it('keeps cancelled and rejected requests out of the approved graph', async () => {
    const memberHeaders = {
      cookie: member.cookie,
      origin: config.webOrigin,
      'content-type': 'application/json',
    };
    const adminHeaders = { ...memberHeaders, cookie: admin.cookie };
    const base = `/api/v1/families/${familyId}`;
    const payload = {
      type: 'relationship_create',
      payload: {
        from_member_id: parentMemberId,
        to_member_id: thirdMemberId,
        type: 'parent_child',
        subtype: 'unspecified',
      },
    };
    const cancellable = await app.inject({
      method: 'POST',
      url: `${base}/change-requests`,
      headers: memberHeaders,
      payload,
    });
    const cancelled = await app.inject({
      method: 'POST',
      url: `${base}/change-requests/${cancellable.json().id}/cancel`,
      headers: memberHeaders,
      payload: { version: 1 },
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({ status: 'cancelled', version: 2 });

    const rejectable = await app.inject({
      method: 'POST',
      url: `${base}/change-requests`,
      headers: memberHeaders,
      payload,
    });
    const rejected = await app.inject({
      method: 'POST',
      url: `${base}/change-requests/${rejectable.json().id}/decision`,
      headers: adminHeaders,
      payload: { decision: 'rejected', version: 1, note: 'Thông tin chưa đủ.' },
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json()).toMatchObject({
      status: 'rejected',
      decision_note: 'Thông tin chưa đủ.',
    });
    const graph = await app.inject({
      method: 'GET',
      url: `${base}/relationships?root_member_id=${parentMemberId}&depth=2`,
      headers: memberHeaders,
    });
    expect(graph.json().relationships).toEqual([]);
  });

  it('serializes concurrent approvals so opposite parent edges cannot create a cycle', async () => {
    const memberHeaders = {
      cookie: member.cookie,
      origin: config.webOrigin,
      'content-type': 'application/json',
    };
    const adminHeaders = { ...memberHeaders, cookie: admin.cookie };
    const base = `/api/v1/families/${familyId}`;
    const propose = (from: string, to: string) =>
      app.inject({
        method: 'POST',
        url: `${base}/change-requests`,
        headers: memberHeaders,
        payload: {
          type: 'relationship_create',
          payload: {
            from_member_id: from,
            to_member_id: to,
            type: 'parent_child',
            subtype: 'unspecified',
          },
        },
      });
    const forward = await propose(childMemberId, thirdMemberId);
    const reverse = await propose(thirdMemberId, childMemberId);
    expect(forward.statusCode).toBe(201);
    expect(reverse.statusCode).toBe(201);

    const decisions = await Promise.all([
      app.inject({
        method: 'POST',
        url: `${base}/change-requests/${forward.json().id}/decision`,
        headers: adminHeaders,
        payload: { decision: 'approved', version: 1 },
      }),
      app.inject({
        method: 'POST',
        url: `${base}/change-requests/${reverse.json().id}/decision`,
        headers: adminHeaders,
        payload: { decision: 'approved', version: 1 },
      }),
    ]);
    expect(decisions.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const persisted = await ownerPool.query(
      `SELECT from_member_id,to_member_id FROM relationships
        WHERE family_id=$1 AND removed_at IS NULL
          AND from_member_id = ANY($2::uuid[]) AND to_member_id = ANY($2::uuid[])`,
      [familyId, [childMemberId, thirdMemberId]],
    );
    expect(persisted.rowCount).toBe(1);
  });
});
