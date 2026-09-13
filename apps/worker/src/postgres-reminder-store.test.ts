import { describe, expect, it, vi } from 'vitest';
import { PostgresReminderJobStore } from './postgres-reminder-store.js';

describe('PostgresReminderJobStore', () => {
  it('maps restricted worker functions without selecting notification tables', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'job-1' }] })
      .mockResolvedValueOnce({ rows: [{ status: 'completed' }] })
      .mockResolvedValueOnce({ rows: [{ status: 'pending' }] });
    const store = new PostgresReminderJobStore({ query } as never, () => new Date('2026-09-14Z'));

    await expect(
      store.claim({ workerId: 'worker-a', batchSize: 10, leaseSeconds: 60 }),
    ).resolves.toEqual([{ id: 'job-1' }]);
    await expect(store.deliverInApp({ jobId: 'job-1', workerId: 'worker-a' })).resolves.toBe(
      'completed',
    );
    await expect(
      store.recordFailure({
        jobId: 'job-2',
        workerId: 'worker-a',
        errorCode: 'delivery_failed',
      }),
    ).resolves.toBe('pending');

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      expect.stringContaining('worker_claim_notification_jobs'),
      expect.stringContaining('worker_deliver_in_app_job'),
      expect.stringContaining('worker_fail_notification_job'),
    ]);
  });

  it('rejects an unexpected database status', async () => {
    const store = new PostgresReminderJobStore({
      query: vi.fn().mockResolvedValue({ rows: [{ status: 'unknown' }] }),
    } as never);
    await expect(store.deliverInApp({ jobId: 'job-1', workerId: 'worker-a' })).rejects.toThrow(
      'Unexpected reminder delivery status',
    );
  });
});
