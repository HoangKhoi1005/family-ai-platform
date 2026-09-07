import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
await client.connect();
try {
  const result = await client.query('SELECT name, applied_at FROM schema_migrations ORDER BY name');
  console.table(result.rows);
} finally {
  await client.end();
}
