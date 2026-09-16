import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { bootstrapFamily } from './bootstrap-family-operation.mjs';
import { assertBootstrapEnvironment, parseDatabaseTarget } from './database-target.mjs';

const ownerUrl = process.env.DATABASE_URL;
if (!ownerUrl) throw new Error('DATABASE_URL is required; run only against a local/test database');
const ownerTarget = parseDatabaseTarget('DATABASE_URL', ownerUrl);
assertBootstrapEnvironment(process.env, ownerTarget);

const client = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
const verifiedUserId = randomUUID();
const unverifiedUserId = randomUUID();
const familyId = randomUUID();
await client.connect();

try {
  await client.query(
    `INSERT INTO users(id, auth_subject, name, email, email_verified)
     VALUES ($1, $2, 'Synthetic bootstrap admin', $3, true),
            ($4, $5, 'Synthetic unverified admin', $6, false)`,
    [
      verifiedUserId,
      `bootstrap-${verifiedUserId}`,
      `bootstrap-${verifiedUserId}@example.invalid`,
      unverifiedUserId,
      `bootstrap-${unverifiedUserId}`,
      `bootstrap-${unverifiedUserId}@example.invalid`,
    ],
  );

  await assert.rejects(
    () =>
      bootstrapFamily(client, {
        userId: unverifiedUserId,
        familyId,
        name: 'Synthetic rejected family',
      }),
    /verified user was not found/,
  );
  assert.equal(
    (
      await client.query('SELECT count(*)::int AS count FROM family_spaces WHERE id = $1', [
        familyId,
      ])
    ).rows[0].count,
    0,
    'An unverified user must not create a family',
  );

  await bootstrapFamily(client, {
    userId: verifiedUserId,
    familyId,
    name: '  Synthetic staging family  ',
  });
  const created = await client.query(
    `SELECT f.name, m.role, m.status, a.action
       FROM family_spaces f
       JOIN family_memberships m ON m.family_id = f.id AND m.user_id = $2
       JOIN audit_entries a ON a.family_id = f.id AND a.actor_id = $2
      WHERE f.id = $1`,
    [familyId, verifiedUserId],
  );
  assert.deepEqual(created.rows, [
    {
      name: 'Synthetic staging family',
      role: 'admin',
      status: 'active',
      action: 'family.bootstrap',
    },
  ]);

  await assert.rejects(
    () =>
      bootstrapFamily(client, {
        userId: verifiedUserId,
        familyId,
        name: 'Synthetic duplicate family',
      }),
    /family id already exists/,
  );
  assert.equal(
    (
      await client.query(
        'SELECT count(*)::int AS count FROM family_memberships WHERE family_id = $1',
        [familyId],
      )
    ).rows[0].count,
    1,
    'A repeated family id must not duplicate the admin membership',
  );
  assert.equal(
    (
      await client.query('SELECT count(*)::int AS count FROM audit_entries WHERE family_id = $1', [
        familyId,
      ])
    ).rows[0].count,
    1,
    'A repeated family id must not duplicate the audit entry',
  );

  console.log('Family bootstrap integration checks passed.');
} finally {
  await client
    .query('DELETE FROM audit_entries WHERE family_id = $1', [familyId])
    .catch(() => undefined);
  await client
    .query('DELETE FROM family_memberships WHERE family_id = $1', [familyId])
    .catch(() => undefined);
  await client.query('DELETE FROM family_spaces WHERE id = $1', [familyId]).catch(() => undefined);
  await client
    .query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[verifiedUserId, unverifiedUserId]])
    .catch(() => undefined);
  await client.end();
}
