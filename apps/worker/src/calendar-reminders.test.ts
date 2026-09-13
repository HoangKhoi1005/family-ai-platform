import { describe, expect, it, vi } from 'vitest';
import {
  processReminderBatch,
  type ReminderJob,
  type ReminderJobStore,
} from './calendar-reminders.js';

const jobs: ReminderJob[] = [
  { id: '11111111-1111-4111-8111-111111111111' },
  { id: '22222222-2222-4222-8222-222222222222' },
  { id: '33333333-3333-4333-8333-333333333333' },
];

function store(overrides: Partial<ReminderJobStore> = {}): ReminderJobStore {
  return {
    claim: vi.fn().mockResolvedValue(jobs),
    deliverInApp: vi
      .fn()
      .mockResolvedValueOnce('completed')
      .mockResolvedValueOnce('cancelled')
      .mockRejectedValueOnce(new Error('private database detail')),
    recordFailure: vi.fn().mockResolvedValue('pending'),
    ...overrides,
  };
}

describe('processReminderBatch', () => {
  it('delivers claimed jobs and records a sanitized retry after a transient failure', async () => {
    const repository = store();
    const result = await processReminderBatch(repository, {
      workerId: 'worker-test',
      batchSize: 10,
      leaseSeconds: 60,
    });

    expect(result).toEqual({
      claimed: 3,
      completed: 1,
      cancelled: 1,
      deferred: 0,
      retrying: 1,
      dead: 0,
    });
    expect(repository.recordFailure).toHaveBeenCalledWith({
      jobId: jobs[2]?.id,
      workerId: 'worker-test',
      errorCode: 'delivery_failed',
    });
  });

  it('counts a fifth failed attempt as dead letter', async () => {
    const repository = store({
      claim: vi.fn().mockResolvedValue([jobs[0]]),
      deliverInApp: vi.fn().mockRejectedValue(new Error('timeout')),
      recordFailure: vi.fn().mockResolvedValue('dead_letter'),
    });

    await expect(
      processReminderBatch(repository, {
        workerId: 'worker-test',
        batchSize: 1,
        leaseSeconds: 30,
      }),
    ).resolves.toEqual({
      claimed: 1,
      completed: 0,
      cancelled: 0,
      deferred: 0,
      retrying: 0,
      dead: 1,
    });
  });

  it('reports jobs deferred until quiet hours end without recording a failure', async () => {
    const repository = store({
      claim: vi.fn().mockResolvedValue([jobs[0]]),
      deliverInApp: vi.fn().mockResolvedValue('deferred'),
    });

    await expect(
      processReminderBatch(repository, {
        workerId: 'worker-test',
        batchSize: 1,
        leaseSeconds: 30,
      }),
    ).resolves.toEqual({
      claimed: 1,
      completed: 0,
      cancelled: 0,
      deferred: 1,
      retrying: 0,
      dead: 0,
    });
    expect(repository.recordFailure).not.toHaveBeenCalled();
  });

  it('does not claim more work until the current batch finishes', async () => {
    let release: (() => void) | undefined;
    const delivery = new Promise<'completed'>((resolve) => {
      release = () => resolve('completed');
    });
    const repository = store({
      claim: vi.fn().mockResolvedValue([jobs[0]]),
      deliverInApp: vi.fn().mockReturnValue(delivery),
    });

    const running = processReminderBatch(repository, {
      workerId: 'worker-test',
      batchSize: 1,
      leaseSeconds: 30,
    });
    expect(repository.claim).toHaveBeenCalledTimes(1);
    release?.();
    await running;
    expect(repository.claim).toHaveBeenCalledTimes(1);
  });
});
