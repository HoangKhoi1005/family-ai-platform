import pg from 'pg';
import { bootstrapFamily } from './bootstrap-family-operation.mjs';
import { assertBootstrapEnvironment, parseDatabaseTarget } from './database-target.mjs';

const ownerUrl = process.env.DATABASE_URL;
if (!ownerUrl) throw new Error('DATABASE_URL is required');
const owner = parseDatabaseTarget('DATABASE_URL', ownerUrl);
assertBootstrapEnvironment(process.env, owner);

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
  await bootstrapFamily(client, { userId, familyId, name });
  console.log('Bootstrapped a synthetic family with one verified admin.');
} finally {
  await client.end();
}
