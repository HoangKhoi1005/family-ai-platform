import { assertSafeApplicationRole, createDatabasePool } from '@family/database';
import { processReminderBatch } from './calendar-reminders.js';
import { readReminderWorkerConfig } from './config.js';
import { PostgresReminderJobStore } from './postgres-reminder-store.js';

const config = readReminderWorkerConfig(process.env);
const pool = createDatabasePool(config.databaseUrl);
await assertSafeApplicationRole(pool, 'family_worker');

const store = new PostgresReminderJobStore(pool);
let stopping = false;
let timer: ReturnType<typeof setTimeout> | undefined;

async function poll(): Promise<void> {
  try {
    const result = await processReminderBatch(store, config);
    if (result.claimed > 0) {
      console.info('Reminder worker batch processed.', result);
    }
  } catch {
    console.error('Reminder worker batch failed.', { errorCode: 'worker_batch_failed' });
  } finally {
    if (!stopping) timer = setTimeout(() => void poll(), config.pollMs);
  }
}

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (timer) clearTimeout(timer);
  await pool.end();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown());
}

console.info('Reminder worker ready.', {
  workerId: config.workerId,
  batchSize: config.batchSize,
  pollMs: config.pollMs,
});
await poll();
