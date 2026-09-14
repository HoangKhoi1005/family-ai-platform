import type { MediaProcessingJob, MediaProcessingResult } from './media-processor.js';

type Queryable = {
  query<Row extends Record<string, unknown>>(
    sql: string,
    values: unknown[],
  ): Promise<{ rows: Row[] }>;
};

export class PostgresMediaJobStore {
  constructor(
    private readonly database: Queryable,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async claim(input: {
    workerId: string;
    batchSize: number;
    leaseSeconds: number;
  }): Promise<MediaProcessingJob[]> {
    const result = await this.database.query<{
      job_id: string;
      family_id: string;
      media_id: string;
      object_key: string;
      purpose: MediaProcessingJob['purpose'];
      mime_type: string;
      byte_size: string | number;
    }>('SELECT * FROM public.worker_claim_media_jobs($1,$2,$3,$4)', [
      input.workerId,
      input.batchSize,
      input.leaseSeconds,
      this.clock(),
    ]);
    return result.rows.map((row) => ({
      id: row.job_id,
      familyId: row.family_id,
      mediaId: row.media_id,
      objectKey: row.object_key,
      purpose: row.purpose,
      declaredMimeType: row.mime_type,
      declaredByteSize: Number(row.byte_size),
    }));
  }

  async settle(input: {
    jobId: string;
    workerId: string;
    result: MediaProcessingResult;
  }): Promise<boolean> {
    if (input.result.status === 'rejected') {
      const response = await this.database.query<{ accepted: boolean }>(
        'SELECT public.worker_reject_media_job($1,$2,$3,$4) AS accepted',
        [input.jobId, input.workerId, input.result.rejectionCode, this.clock()],
      );
      return response.rows[0]?.accepted ?? false;
    }
    const result = input.result;
    const response = await this.database.query<{ accepted: boolean }>(
      `SELECT public.worker_complete_media_job(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
       ) AS accepted`,
      [
        input.jobId,
        input.workerId,
        result.processedObjectKey,
        result.mimeType,
        result.byteSize,
        result.sha256,
        result.width,
        result.height,
        result.durationMs,
        this.clock(),
      ],
    );
    return response.rows[0]?.accepted ?? false;
  }

  async sweepStale(input: { batchSize: number; staleAfterMs: number }): Promise<number> {
    const now = this.clock();
    const result = await this.database.query<{ swept: string | number }>(
      'SELECT public.worker_sweep_stale_media($1,$2,$3) AS swept',
      [input.batchSize, new Date(now.getTime() - input.staleAfterMs), now],
    );
    return Number(result.rows[0]?.swept ?? 0);
  }

  async claimDeletions(input: {
    workerId: string;
    batchSize: number;
    leaseSeconds: number;
  }): Promise<
    Array<{
      id: string;
      kind: 'delete' | 'purge_source';
      objectKey: string;
      processedObjectKey: string | null;
    }>
  > {
    const result = await this.database.query<{
      job_id: string;
      kind: 'delete' | 'purge_source';
      object_key: string;
      processed_object_key: string | null;
    }>('SELECT * FROM public.worker_claim_media_delete_jobs($1,$2,$3,$4)', [
      input.workerId,
      input.batchSize,
      input.leaseSeconds,
      this.clock(),
    ]);
    return result.rows.map((row) => ({
      id: row.job_id,
      kind: row.kind,
      objectKey: row.object_key,
      processedObjectKey: row.processed_object_key,
    }));
  }

  async settleDeletion(input: { jobId: string; workerId: string }): Promise<boolean> {
    const response = await this.database.query<{ accepted: boolean }>(
      'SELECT public.worker_complete_media_delete_job($1,$2,$3) AS accepted',
      [input.jobId, input.workerId, this.clock()],
    );
    return response.rows[0]?.accepted ?? false;
  }

  async fail(input: {
    jobId: string;
    workerId: string;
  }): Promise<'pending' | 'dead_letter' | 'lost'> {
    const response = await this.database.query<{ status: 'pending' | 'dead_letter' | 'lost' }>(
      'SELECT public.worker_fail_media_job($1,$2,$3,$4) AS status',
      [input.jobId, input.workerId, 'processing_failed', this.clock()],
    );
    return response.rows[0]?.status ?? 'lost';
  }
}
