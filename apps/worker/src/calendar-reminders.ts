export type ReminderJob = { id: string };
export type ReminderDeliveryResult = 'completed' | 'cancelled' | 'deferred';
export type ReminderFailureResult = 'pending' | 'dead_letter';

export interface ReminderJobStore {
  claim(input: {
    workerId: string;
    batchSize: number;
    leaseSeconds: number;
  }): Promise<ReminderJob[]>;
  deliverInApp(input: { jobId: string; workerId: string }): Promise<ReminderDeliveryResult>;
  recordFailure(input: {
    jobId: string;
    workerId: string;
    errorCode: 'delivery_failed';
  }): Promise<ReminderFailureResult>;
}

export type ReminderBatchResult = {
  claimed: number;
  completed: number;
  cancelled: number;
  deferred: number;
  retrying: number;
  dead: number;
};

export async function processReminderBatch(
  store: ReminderJobStore,
  input: { workerId: string; batchSize: number; leaseSeconds: number },
): Promise<ReminderBatchResult> {
  const jobs = await store.claim(input);
  const result: ReminderBatchResult = {
    claimed: jobs.length,
    completed: 0,
    cancelled: 0,
    deferred: 0,
    retrying: 0,
    dead: 0,
  };

  for (const job of jobs) {
    try {
      const delivery = await store.deliverInApp({ jobId: job.id, workerId: input.workerId });
      result[delivery] += 1;
    } catch {
      const failure = await store.recordFailure({
        jobId: job.id,
        workerId: input.workerId,
        errorCode: 'delivery_failed',
      });
      if (failure === 'pending') result.retrying += 1;
      else result.dead += 1;
    }
  }

  return result;
}
