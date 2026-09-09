import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createDatabasePool, withActorTransaction } from '../dist/index.js';

const ownerUrl = process.env.DATABASE_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
if (!ownerUrl || !runtimeUrl) {
  throw new Error('DATABASE_URL and RUNTIME_DATABASE_URL are required for relationship tests');
}

const owner = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
const runtimePool = createDatabasePool(runtimeUrl);
const ids = Object.fromEntries(
  [
    'familyA',
    'familyB',
    'admin',
    'member',
    'pending',
    'revoked',
    'other',
    'adminMembership',
    'memberMembership',
    'pendingMembership',
    'revokedMembership',
    'otherMembership',
    'parent',
    'child',
    'partner',
    'foreignMember',
    'parentChild',
  ].map((key) => [key, randomUUID()]),
);
const [partnershipFrom, partnershipTo] = [ids.parent, ids.partner].sort();

async function mustFail(operation, expectedCode) {
  let error;
  try {
    await operation();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, `Expected PostgreSQL ${expectedCode}`);
  assert.equal(error.code, expectedCode);
}

async function seed() {
  await owner.query('BEGIN');
  await owner.query(
    `INSERT INTO users(id,auth_subject,name,email,email_verified)
     VALUES ($1,$2,'Relationship admin','relationship-admin@example.invalid',true),
            ($3,$4,'Relationship member','relationship-member@example.invalid',true),
            ($5,$6,'Relationship pending','relationship-pending@example.invalid',true),
            ($7,$8,'Relationship revoked','relationship-revoked@example.invalid',true),
            ($9,$10,'Relationship other','relationship-other@example.invalid',true)`,
    [
      ids.admin,
      `relationship-${ids.admin}`,
      ids.member,
      `relationship-${ids.member}`,
      ids.pending,
      `relationship-${ids.pending}`,
      ids.revoked,
      `relationship-${ids.revoked}`,
      ids.other,
      `relationship-${ids.other}`,
    ],
  );
  await owner.query(
    `INSERT INTO family_spaces(id,name) VALUES ($1,'Relationship A'),($2,'Relationship B')`,
    [ids.familyA, ids.familyB],
  );
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status)
     VALUES ($1,$2,$3,'admin','active'),
            ($4,$2,$5,'member','active'),
            ($6,$2,$7,'member','pending'),
            ($8,$2,$9,'member','revoked'),
            ($10,$11,$12,'member','active')`,
    [
      ids.adminMembership,
      ids.familyA,
      ids.admin,
      ids.memberMembership,
      ids.member,
      ids.pendingMembership,
      ids.pending,
      ids.revokedMembership,
      ids.revoked,
      ids.otherMembership,
      ids.familyB,
      ids.other,
    ],
  );
  await owner.query(
    `INSERT INTO members(id,family_id,display_name)
     VALUES ($1,$2,'Parent'),($3,$2,'Child'),($4,$2,'Partner'),($5,$6,'Foreign')`,
    [ids.parent, ids.familyA, ids.child, ids.partner, ids.foreignMember, ids.familyB],
  );
  await owner.query('COMMIT');
}

async function cleanup() {
  await owner.query('BEGIN');
  await owner.query('DELETE FROM change_requests WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM relationships WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM members WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM family_memberships WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM family_spaces WHERE id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
    [ids.admin, ids.member, ids.pending, ids.revoked, ids.other],
  ]);
  await owner.query('COMMIT');
}

await owner.connect();
try {
  const tables = await owner.query(
    "SELECT to_regclass('public.relationships') AS relationships, to_regclass('public.change_requests') AS change_requests",
  );
  assert.deepEqual(tables.rows[0], {
    relationships: 'relationships',
    change_requests: 'change_requests',
  });

  await seed();

  await mustFail(
    () =>
      owner.query(
        `INSERT INTO relationships(family_id,from_member_id,to_member_id,type,subtype)
         VALUES ($1,$2,$2,'parent_child','biological')`,
        [ids.familyA, ids.parent],
      ),
    '23514',
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO relationships(family_id,from_member_id,to_member_id,type,subtype)
         VALUES ($1,$2,$3,'parent_child','biological')`,
        [ids.familyA, ids.parent, ids.foreignMember],
      ),
    '23503',
  );
  await owner.query(
    `INSERT INTO relationships(id,family_id,from_member_id,to_member_id,type,subtype)
     VALUES ($1,$2,$3,$4,'parent_child','biological')`,
    [ids.parentChild, ids.familyA, ids.parent, ids.child],
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO relationships(family_id,from_member_id,to_member_id,type,subtype)
         VALUES ($1,$2,$3,'parent_child','adoptive')`,
        [ids.familyA, ids.parent, ids.child],
      ),
    '23505',
  );

  await owner.query(
    `INSERT INTO relationships(family_id,from_member_id,to_member_id,type,subtype,start_date,end_date)
     VALUES ($1,$2,$3,'partnership','married','2000-01-01','2010-01-01'),
            ($1,$2,$3,'partnership','married','2020-01-01',NULL)`,
    [ids.familyA, partnershipFrom, partnershipTo],
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO relationships(family_id,from_member_id,to_member_id,type,subtype,start_date)
         VALUES ($1,$2,$3,'partnership','partner','2024-01-01')`,
        [ids.familyA, partnershipFrom, partnershipTo],
      ),
    '23505',
  );

  const visibleToMember = await withActorTransaction(runtimePool, ids.member, (client) =>
    client.query('SELECT id FROM relationships ORDER BY id'),
  );
  assert.equal(visibleToMember.rowCount, 3);
  for (const actorId of [ids.pending, ids.revoked, ids.other]) {
    const hidden = await withActorTransaction(runtimePool, actorId, (client) =>
      client.query('SELECT id FROM relationships'),
    );
    assert.equal(hidden.rowCount, 0);
  }

  const createdRequest = await withActorTransaction(runtimePool, ids.member, (client) =>
    client.query(
      `INSERT INTO change_requests
         (family_id,actor_membership_id,type,proposed_payload)
       VALUES ($1,$2,'relationship_create',$3::jsonb)
       RETURNING id,status`,
      [
        ids.familyA,
        ids.memberMembership,
        JSON.stringify({
          from_member_id: ids.child,
          to_member_id: ids.partner,
          type: 'parent_child',
          subtype: 'unspecified',
        }),
      ],
    ),
  );
  assert.equal(createdRequest.rows[0].status, 'pending');

  const adminRequests = await withActorTransaction(runtimePool, ids.admin, (client) =>
    client.query('SELECT id FROM change_requests'),
  );
  assert.deepEqual(adminRequests.rows, [{ id: createdRequest.rows[0].id }]);
  const ownRequests = await withActorTransaction(runtimePool, ids.member, (client) =>
    client.query('SELECT id FROM change_requests'),
  );
  assert.deepEqual(ownRequests.rows, [{ id: createdRequest.rows[0].id }]);

  const deniedDecision = await withActorTransaction(runtimePool, ids.member, (client) =>
    client.query("UPDATE change_requests SET status='approved',version=version+1 WHERE id=$1", [
      createdRequest.rows[0].id,
    ]),
  );
  assert.equal(deniedDecision.rowCount, 0, 'member cannot see a row through the decision policy');
  await mustFail(
    () =>
      withActorTransaction(runtimePool, ids.admin, (client) =>
        client.query(
          `INSERT INTO relationships(family_id,from_member_id,to_member_id,type,subtype)
           VALUES ($1,$2,$3,'parent_child','unspecified')`,
          [ids.familyA, ids.child, ids.partner],
        ),
      ),
    '42501',
  );

  console.log(
    'PASS: relationship constraints, history, RLS visibility and guarded decision writes passed.',
  );
} finally {
  await cleanup().catch(() => undefined);
  await runtimePool.end();
  await owner.end();
}
