import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL is required; run only against a local/test database');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
await client.connect();
try {
  await client.query('BEGIN');
  const [fa, fb, user, membership, memberA, memberB] = Array.from({ length: 6 }, () =>
    randomUUID(),
  );
  await client.query(
    "INSERT INTO family_spaces(id,name) VALUES ($1,'Synthetic A'),($2,'Synthetic B')",
    [fa, fb],
  );
  await client.query('INSERT INTO users(id,auth_subject) VALUES ($1,$2)', [
    user,
    `synthetic-${user}`,
  ]);
  await client.query(
    "INSERT INTO family_memberships(id,family_id,user_id,role,status) VALUES ($1,$2,$3,'member','active')",
    [membership, fa, user],
  );
  await client.query(
    "INSERT INTO members(id,family_id,display_name) VALUES ($1,$2,'Synthetic person A'),($3,$4,'Synthetic person B')",
    [memberA, fa, memberB, fb],
  );
  async function mustFail(sql, params, expectedCode) {
    await client.query('SAVEPOINT expected_failure');
    let failed = false;
    try {
      await client.query(sql, params);
    } catch (error) {
      failed = true;
      assert.equal(error.code, expectedCode);
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT expected_failure');
    }
    assert.ok(failed, 'Constraint did not reject invalid data');
  }
  await mustFail(
    'INSERT INTO member_account_links(family_id,membership_id,member_id) VALUES ($1,$2,$3)',
    [fa, membership, memberB],
    '23503',
  );
  await mustFail(
    "INSERT INTO member_contacts(family_id,member_id,kind,value) VALUES ($1,$2,'phone','SYNTHETIC')",
    [fa, memberB],
    '23503',
  );
  await mustFail(
    "INSERT INTO family_memberships(family_id,user_id,role) VALUES ($1,$2,'member')",
    [fa, user],
    '23505',
  );
  await mustFail(
    "INSERT INTO members(family_id,display_name,birth_date,birth_year) VALUES ($1,'Synthetic','2000-01-01',2001)",
    [fa],
    '23514',
  );
  await client.query(
    'INSERT INTO member_account_links(family_id,membership_id,member_id) VALUES ($1,$2,$3)',
    [fa, membership, memberA],
  );
  const role = `test_deny_${randomUUID().replaceAll('-', '')}`;
  await client.query(
    "INSERT INTO member_contacts(family_id,member_id,kind,value) VALUES ($1,$2,'email','synthetic@example.invalid')",
    [fa, memberA],
  );
  assert.equal(
    (await client.query('SELECT id FROM member_contacts WHERE family_id = $1', [fa])).rowCount,
    1,
    'RLS test requires a visible contact fixture before switching roles',
  );
  // Random identifier contains only fixed ASCII prefix + hex; never user input.
  await client.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await client.query(`GRANT SELECT ON members, member_contacts, family_memberships TO ${role}`);
  await client.query(`SET LOCAL ROLE ${role}`);
  for (const table of ['members', 'member_contacts', 'family_memberships']) {
    assert.equal(
      (await client.query(`SELECT * FROM ${table}`)).rowCount,
      0,
      `${table}: RLS should deny all until policies exist`,
    );
  }
  await client.query('RESET ROLE');
  console.log(
    'PASS: cross-family FKs, duplicate membership, date consistency, valid link and deny-all runtime RLS. All synthetic writes rolled back.',
  );
} finally {
  await client.query('ROLLBACK');
  await client.end();
}
