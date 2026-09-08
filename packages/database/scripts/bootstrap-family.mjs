import pg from 'pg';

const ownerUrl = process.env.DATABASE_URL;
if (!ownerUrl) throw new Error('DATABASE_URL is required');
if (process.env.APP_ENV !== 'local') throw new Error('bootstrap-family requires APP_ENV=local');

const parsed = new URL(ownerUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
  throw new Error('bootstrap-family requires a loopback DATABASE_URL');
}

function flag(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const userId = flag('user-id');
const familyId = flag('family-id');
const name = flag('name');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!userId || !uuidPattern.test(userId)) throw new Error('--user-id must be a UUID');
if (!familyId || !uuidPattern.test(familyId)) throw new Error('--family-id must be a UUID');
if (!name || name.trim().length === 0 || name.length > 200)
  throw new Error('--name must be non-empty and at most 200 characters');

const client = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
await client.connect();
try {
  await client.query('BEGIN');
  const user = await client.query('SELECT id FROM users WHERE id = $1 AND email_verified = true', [
    userId,
  ]);
  if (user.rowCount !== 1) throw new Error('verified user was not found');
  const existing = await client.query('SELECT 1 FROM family_spaces WHERE id = $1', [familyId]);
  if (existing.rowCount) throw new Error('family id already exists');
  await client.query('INSERT INTO family_spaces(id, name) VALUES ($1, $2)', [
    familyId,
    name.trim(),
  ]);
  const membership = await client.query(
    `INSERT INTO family_memberships(family_id, user_id, role, status)
     VALUES ($1, $2, 'admin', 'active') RETURNING id`,
    [familyId, userId],
  );
  await client.query(
    `INSERT INTO audit_entries(family_id, actor_id, action, target_type, target_id, change_summary)
     VALUES ($1, $2, 'family.bootstrap', 'family', $1, $3)`,
    [familyId, userId, `membership_id=${membership.rows[0].id}`],
  );
  await client.query('COMMIT');
  console.log(`Created family ${familyId} with verified user ${userId} as admin.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
