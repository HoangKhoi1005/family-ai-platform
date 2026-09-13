import type {
  ReminderDeliveryResult,
  ReminderFailureResult,
  ReminderJob,
  ReminderJobStore,
} from './calendar-reminders.js';

type Queryable = {
  query<Row extends Record<string, unknown>>(
    sql: string,
    values: unknown[],
  ): Promise<{ rows: Row[] }>;
};

export class PostgresReminderJobStore implements ReminderJobStore {
  constructor(
    private readonly database: Queryable,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async claim(input: {
    workerId: string;
    batchSize: number;
    leaseSeconds: number;
  }): Promise<ReminderJob[]> {
    const result = await this.database.query<{ id: string }>(
      'SELECT id FROM public.worker_claim_notification_jobs($1,$2,$3,$4)',
      [input.workerId, input.batchSize, input.leaseSeconds, this.clock()],
    );
    return result.rows.map(({ id }) => ({ id }));
  }

  async deliverInApp(input: { jobId: string; workerId: string }): Promise<ReminderDeliveryResult> {
    const result = await this.database.query<{ status: string }>(
      'SELECT public.worker_deliver_in_app_job($1,$2,$3) AS status',
      [input.jobId, input.workerId, this.clock()],
    );
    const status = result.rows[0]?.status;
    if (status !== 'completed' && status !== 'cancelled' && status !== 'deferred') {
      throw new Error('Unexpected reminder delivery status');
    }
    return status;
  }

  async recordFailure(input: {
    jobId: string;
    workerId: string;
    errorCode: 'delivery_failed';
  }): Promise<ReminderFailureResult> {
    const result = await this.database.query<{ status: string }>(
      'SELECT public.worker_fail_notification_job($1,$2,$3,$4) AS status',
      [input.jobId, input.workerId, input.errorCode, this.clock()],
    );
    const status = result.rows[0]?.status;
    if (status !== 'pending' && status !== 'dead_letter') {
      throw new Error('Unexpected reminder failure status');
    }
    return status;
  }
}
