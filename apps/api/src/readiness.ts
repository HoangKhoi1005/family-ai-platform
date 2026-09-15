import type { Pool } from 'pg';

export type ReadinessProbe = () => Promise<void>;

export function databaseReadinessProbe(pool: Pool): ReadinessProbe {
  return async () => {
    await pool.query('SELECT 1');
  };
}

export async function runReadiness(probes: readonly ReadinessProbe[]): Promise<void> {
  await Promise.all(probes.map((probe) => probe()));
}
