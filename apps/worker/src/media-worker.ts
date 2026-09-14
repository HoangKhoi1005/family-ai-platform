import type { MediaStorage } from '@family/media';
import { processMediaAsset } from './media-processor.js';
import type { PostgresMediaJobStore } from './postgres-media-store.js';

export async function processMediaBatch(
  store: PostgresMediaJobStore,
  storage: MediaStorage,
  input: { workerId: string; batchSize: number; leaseSeconds: number },
): Promise<{
  claimed: number;
  ready: number;
  rejected: number;
  deleted: number;
  retrying: number;
  dead: number;
}> {
  await store.sweepStale({ batchSize: input.batchSize, staleAfterMs: 60 * 60 * 1000 });
  const [jobs, deletions] = await Promise.all([store.claim(input), store.claimDeletions(input)]);
  const counts = {
    claimed: jobs.length + deletions.length,
    ready: 0,
    rejected: 0,
    deleted: 0,
    retrying: 0,
    dead: 0,
  };
  for (const job of jobs) {
    try {
      const result = await processMediaAsset(storage, job);
      const accepted = await store.settle({ jobId: job.id, workerId: input.workerId, result });
      if (accepted) counts[result.status] += 1;
    } catch {
      const status = await store.fail({ jobId: job.id, workerId: input.workerId });
      if (status === 'pending') counts.retrying += 1;
      if (status === 'dead_letter') counts.dead += 1;
    }
  }
  for (const job of deletions) {
    try {
      await storage.deleteObject(job.objectKey);
      if (
        job.kind === 'delete' &&
        job.processedObjectKey &&
        job.processedObjectKey !== job.objectKey
      ) {
        await storage.deleteObject(job.processedObjectKey);
      }
      if (await store.settleDeletion({ jobId: job.id, workerId: input.workerId })) {
        counts.deleted += 1;
      }
    } catch {
      const status = await store.fail({ jobId: job.id, workerId: input.workerId });
      if (status === 'pending') counts.retrying += 1;
      if (status === 'dead_letter') counts.dead += 1;
    }
  }
  return counts;
}
