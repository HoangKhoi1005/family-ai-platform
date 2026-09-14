import { assertSafeApplicationRole, createDatabasePool } from '@family/database';
import { readMediaStorageConfig, S3MediaStorage } from '@family/media';
import { processReminderBatch } from './calendar-reminders.js';
import { readMediaWorkerConfig, readReminderWorkerConfig } from './config.js';
import { processMediaBatch } from './media-worker.js';
import { PostgresMediaJobStore } from './postgres-media-store.js';
import { PostgresReminderJobStore } from './postgres-reminder-store.js';

const config = readReminderWorkerConfig(process.env);
const mediaConfig = readMediaWorkerConfig(process.env);
const pool = createDatabasePool(config.databaseUrl);
await assertSafeApplicationRole(pool, 'family_worker');

const store = new PostgresReminderJobStore(pool);
const mediaStore = new PostgresMediaJobStore(pool);
const mediaStorage = new S3MediaStorage(readMediaStorageConfig(process.env));
let stopping = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let mediaTimer: ReturnType<typeof setTimeout> | undefined;

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

async function pollMedia(): Promise<void> {
  try {
    const result = await processMediaBatch(mediaStore, mediaStorage, mediaConfig);
    if (result.claimed > 0) console.info('Media worker batch processed.', result);
  } catch {
    console.error('Media worker batch failed.', { errorCode: 'media_worker_batch_failed' });
  } finally {
    if (!stopping) mediaTimer = setTimeout(() => void pollMedia(), mediaConfig.pollMs);
  }
}

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (timer) clearTimeout(timer);
  if (mediaTimer) clearTimeout(mediaTimer);
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
await pollMedia();
