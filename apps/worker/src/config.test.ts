import { describe, expect, it } from 'vitest';
import { readReminderWorkerConfig } from './config.js';

const databaseUrl = 'postgresql://family_worker:secret@127.0.0.1:5432/family';

describe('readReminderWorkerConfig', () => {
  it('uses bounded pilot defaults', () => {
    expect(readReminderWorkerConfig({ WORKER_DATABASE_URL: databaseUrl })).toEqual({
      databaseUrl,
      workerId: expect.stringMatching(/^reminder-/),
      pollMs: 5000,
      batchSize: 25,
      leaseSeconds: 60,
    });
  });

  it('rejects the owner URL and invalid polling values', () => {
    expect(() => readReminderWorkerConfig({ DATABASE_URL: databaseUrl })).toThrow(
      'WORKER_DATABASE_URL is required',
    );
    expect(() =>
      readReminderWorkerConfig({
        WORKER_DATABASE_URL: databaseUrl,
        REMINDER_WORKER_BATCH_SIZE: '0',
      }),
    ).toThrow('REMINDER_WORKER_BATCH_SIZE');
  });
});
