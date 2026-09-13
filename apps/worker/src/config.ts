import { hostname } from 'node:os';

export type ReminderWorkerConfig = {
  databaseUrl: string;
  workerId: string;
  pollMs: number;
  batchSize: number;
  leaseSeconds: number;
};

function boundedInteger(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

export function readReminderWorkerConfig(
  env: Record<string, string | undefined>,
): ReminderWorkerConfig {
  const databaseUrl = env.WORKER_DATABASE_URL;
  if (!databaseUrl) throw new Error('WORKER_DATABASE_URL is required');
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('WORKER_DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('WORKER_DATABASE_URL must use the PostgreSQL protocol');
  }

  const workerId = env.REMINDER_WORKER_ID ?? `reminder-${hostname()}-${process.pid}`;
  if (workerId.trim().length < 1 || workerId.length > 120) {
    throw new Error('REMINDER_WORKER_ID must contain 1 to 120 characters');
  }

  return {
    databaseUrl,
    workerId,
    pollMs: boundedInteger(env, 'REMINDER_WORKER_POLL_MS', 5000, 250, 60000),
    batchSize: boundedInteger(env, 'REMINDER_WORKER_BATCH_SIZE', 25, 1, 100),
    leaseSeconds: boundedInteger(env, 'REMINDER_WORKER_LEASE_SECONDS', 60, 5, 300),
  };
}
