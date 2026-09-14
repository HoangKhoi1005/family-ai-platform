import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { assertSafeApplicationRole, createDatabasePool } from '../dist/index.js';
import { processMediaBatch } from '../../../apps/worker/dist/media-worker.js';
import { PostgresMediaJobStore } from '../../../apps/worker/dist/postgres-media-store.js';

const ownerUrl = process.env.DATABASE_URL;
const workerUrl = process.env.WORKER_DATABASE_URL;
if (!ownerUrl || !workerUrl) throw new Error('DATABASE_URL and WORKER_DATABASE_URL are required');
const owner = new pg.Client({ connectionString: ownerUrl });
const worker = createDatabasePool(workerUrl);
const ids = Object.fromEntries(
  ['family', 'user', 'membership', 'media', 'job', 'deleteJob', 'staleMedia'].map((key) => [
    key,
    randomUUID(),
  ]),
);
const source = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#8f4b32' } })
  .jpeg()
  .toBuffer();
const puts = [];
const deletes = [];
const storage = {
  createUploadGrant: async () => {
    throw new Error('unused');
  },
  createReadGrant: async () => {
    throw new Error('unused');
  },
  headObject: async () => null,
  getObject: async () => source,
  putObject: async (key, body, mimeType) => {
    puts.push({ key, body, mimeType });
  },
  deleteObject: async (key) => {
    deletes.push(key);
  },
};

await owner.connect();
try {
  await assertSafeApplicationRole(worker, 'family_worker');
  await owner.query('BEGIN');
  await owner.query(
    `INSERT INTO users(id,auth_subject,name,email,email_verified) VALUES ($1,$2,'Worker media','worker-media@example.invalid',true)`,
    [ids.user, `worker-media-${ids.user}`],
  );
  await owner.query(`INSERT INTO family_spaces(id,name) VALUES ($1,'Worker media')`, [ids.family]);
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status) VALUES ($1,$2,$3,'member','active')`,
    [ids.membership, ids.family, ids.user],
  );
  await owner.query(
    `INSERT INTO media_assets(id,family_id,owner_membership_id,purpose,status,object_key,mime_type,byte_size)
     VALUES ($1,$2,$3,'moment_image','processing',$4,'image/jpeg',$5)`,
    [ids.media, ids.family, ids.membership, `quarantine/${ids.media}`, source.byteLength],
  );
  await owner.query(
    `INSERT INTO media_processing_jobs(id,family_id,media_id,kind) VALUES ($1,$2,$3,'process')`,
    [ids.job, ids.family, ids.media],
  );
  await owner.query('COMMIT');

  const result = await processMediaBatch(
    new PostgresMediaJobStore(worker, () => new Date()),
    storage,
    {
      workerId: 'integration-media-worker',
      batchSize: 5,
      leaseSeconds: 120,
    },
  );
  assert.deepEqual(result, {
    claimed: 1,
    ready: 1,
    rejected: 0,
    deleted: 0,
    retrying: 0,
    dead: 0,
  });
  assert.equal(puts.length, 1);
  assert.equal(puts[0].key, `ready/${ids.family}/${ids.media}`);
  const stored = await owner.query(
    `SELECT status,processed_object_key,sha256,width,height FROM media_assets WHERE id = $1`,
    [ids.media],
  );
  assert.equal(stored.rows[0].status, 'ready');
  assert.equal(stored.rows[0].processed_object_key, `ready/${ids.family}/${ids.media}`);
  assert.match(stored.rows[0].sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual([stored.rows[0].width, stored.rows[0].height], [8, 6]);

  const sourcePurge = await processMediaBatch(
    new PostgresMediaJobStore(worker, () => new Date()),
    storage,
    { workerId: 'integration-media-worker', batchSize: 5, leaseSeconds: 120 },
  );
  assert.deepEqual(sourcePurge, {
    claimed: 1,
    ready: 0,
    rejected: 0,
    deleted: 1,
    retrying: 0,
    dead: 0,
  });
  assert.deepEqual(deletes, [`quarantine/${ids.media}`]);

  await owner.query(
    `UPDATE media_assets SET status = 'deleted', deleted_at = now() WHERE id = $1`,
    [ids.media],
  );
  await owner.query(
    `INSERT INTO media_processing_jobs(id,family_id,media_id,kind,available_at)
     VALUES ($1,$2,$3,'delete',now() - interval '1 second')`,
    [ids.deleteJob, ids.family, ids.media],
  );
  const deletion = await processMediaBatch(
    new PostgresMediaJobStore(worker, () => new Date()),
    storage,
    { workerId: 'integration-media-worker', batchSize: 5, leaseSeconds: 120 },
  );
  assert.deepEqual(deletion, {
    claimed: 1,
    ready: 0,
    rejected: 0,
    deleted: 1,
    retrying: 0,
    dead: 0,
  });
  assert.deepEqual(deletes.sort(), [
    `quarantine/${ids.media}`,
    `quarantine/${ids.media}`,
    `ready/${ids.family}/${ids.media}`,
  ]);

  await owner.query(
    `INSERT INTO media_assets(
       id,family_id,owner_membership_id,purpose,status,object_key,mime_type,byte_size,updated_at
     ) VALUES ($1,$2,$3,'moment_image','pending',$4,'image/jpeg',$5,now() - interval '2 hours')`,
    [ids.staleMedia, ids.family, ids.membership, `quarantine/${ids.staleMedia}`, source.byteLength],
  );
  const staleCleanup = await processMediaBatch(
    new PostgresMediaJobStore(worker, () => new Date()),
    storage,
    { workerId: 'integration-media-worker', batchSize: 5, leaseSeconds: 120 },
  );
  assert.deepEqual(staleCleanup, {
    claimed: 1,
    ready: 0,
    rejected: 0,
    deleted: 1,
    retrying: 0,
    dead: 0,
  });
  const stale = await owner.query(
    `SELECT asset.status,job.status AS job_status
       FROM media_assets asset
       JOIN media_processing_jobs job
         ON job.family_id = asset.family_id AND job.media_id = asset.id AND job.kind = 'delete'
      WHERE asset.id = $1`,
    [ids.staleMedia],
  );
  assert.deepEqual(stale.rows[0], { status: 'deleted', job_status: 'completed' });
  assert.ok(deletes.includes(`quarantine/${ids.staleMedia}`));
  console.log('Media worker integration checks passed.');
} finally {
  await owner.query('BEGIN');
  await owner.query('DELETE FROM media_processing_jobs WHERE family_id = $1', [ids.family]);
  await owner.query('DELETE FROM media_assets WHERE family_id = $1', [ids.family]);
  await owner.query('DELETE FROM family_memberships WHERE family_id = $1', [ids.family]);
  await owner.query('DELETE FROM family_spaces WHERE id = $1', [ids.family]);
  await owner.query('DELETE FROM users WHERE id = $1', [ids.user]);
  await owner.query('COMMIT');
  await worker.end();
  await owner.end();
}
