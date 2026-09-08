import type { Pool, PoolClient } from 'pg';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function withActorTransaction<T>(
  pool: Pool,
  actorId: string,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(actorId)) {
    throw new Error('actorId must be a UUID');
  }

  const client = await pool.connect();
  let released = false;
  const release = (error?: Error): void => {
    if (released) return;
    released = true;
    client.release(error);
  };

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    const result = await operation(client);
    await client.query('COMMIT');
    release();
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
      release();
    } catch (rollbackError) {
      release(
        rollbackError instanceof Error ? rollbackError : new Error('Transaction rollback failed'),
      );
    }
    throw error;
  } finally {
    release();
  }
}
