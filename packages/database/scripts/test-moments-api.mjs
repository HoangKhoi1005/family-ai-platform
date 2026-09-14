import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createDatabasePool, withActorTransaction } from '../dist/index.js';
import {
  createMoment,
  deleteMoment,
  listMoments,
  setMomentReaction,
} from '../../../apps/api/dist/family/moments.js';
import {
  createMemoryFromMoment,
  deleteMemory,
  listMemories,
} from '../../../apps/api/dist/family/memories.js';

const ownerUrl = process.env.DATABASE_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
if (!ownerUrl || !runtimeUrl) throw new Error('Database URLs are required');
const owner = new pg.Client({ connectionString: ownerUrl });
const runtime = createDatabasePool(runtimeUrl);
const id = Object.fromEntries(
  [
    'family',
    'userA',
    'userB',
    'membershipA',
    'membershipB',
    'memberA',
    'memberB',
    'media',
    'moment',
    'raceMedia',
    'raceMoment',
  ].map((key) => [key, randomUUID()]),
);

await owner.connect();
try {
  await owner.query('BEGIN');
  await owner.query(
    `INSERT INTO users(id,auth_subject,name,email,email_verified) VALUES
     ($1,$2,'Moment A','moment-a@example.invalid',true),($3,$4,'Moment B','moment-b@example.invalid',true)`,
    [id.userA, `moment-${id.userA}`, id.userB, `moment-${id.userB}`],
  );
  await owner.query(`INSERT INTO family_spaces(id,name) VALUES ($1,'Moment API')`, [id.family]);
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status) VALUES
     ($1,$2,$3,'member','active'),($4,$2,$5,'member','active')`,
    [id.membershipA, id.family, id.userA, id.membershipB, id.userB],
  );
  await owner.query(
    `INSERT INTO members(id,family_id,display_name) VALUES ($1,$2,'Nguyễn An'),($3,$2,'Trần Bình')`,
    [id.memberA, id.family, id.memberB],
  );
  await owner.query(
    `INSERT INTO member_account_links(family_id,membership_id,member_id) VALUES ($1,$2,$3),($1,$4,$5)`,
    [id.family, id.membershipA, id.memberA, id.membershipB, id.memberB],
  );
  await owner.query(
    `INSERT INTO media_assets(
       id,family_id,owner_membership_id,purpose,status,object_key,processed_object_key,mime_type,
       byte_size,sha256,width,height
     ) VALUES ($1,$2,$3,'moment_image','ready',$4,$5,'image/jpeg',100,$6,10,10)`,
    [
      id.media,
      id.family,
      id.membershipA,
      `quarantine/${id.media}`,
      `ready/${id.media}`,
      'c'.repeat(64),
    ],
  );
  await owner.query(
    `INSERT INTO moments(id,family_id,author_membership_id,media_id,caption,audience,client_request_id)
     VALUES ($1,$2,$3,$4,'Chiều ở quê','family','integration-seed')`,
    [id.moment, id.family, id.membershipA, id.media],
  );
  await owner.query('COMMIT');

  const visibleToB = await withActorTransaction(runtime, id.userB, (client) =>
    listMoments(client, { familyId: id.family, actorId: id.userB, limit: 20 }),
  );
  assert.equal(visibleToB.moments.length, 1);
  assert.equal(visibleToB.moments[0].author.display_name, 'Nguyễn An');
  assert.equal(visibleToB.moments[0].can_delete, false);

  await withActorTransaction(runtime, id.userB, (client) =>
    setMomentReaction(client, {
      familyId: id.family,
      actorId: id.userB,
      momentId: id.moment,
      reaction: 'thuong',
    }),
  );
  const reacted = await withActorTransaction(runtime, id.userB, (client) =>
    listMoments(client, { familyId: id.family, actorId: id.userB, limit: 20 }),
  );
  assert.equal(reacted.moments[0].my_reaction, 'thuong');

  const input = {
    client_request_id: 'integration-create',
    media_id: id.media,
    caption: null,
    audience: 'family',
  };
  const first = await withActorTransaction(runtime, id.userA, (client) =>
    createMoment(client, {
      familyId: id.family,
      actorId: id.userA,
      idempotencyKey: 'integration-create',
      input,
    }),
  );
  const retry = await withActorTransaction(runtime, id.userA, (client) =>
    createMoment(client, {
      familyId: id.family,
      actorId: id.userA,
      idempotencyKey: 'integration-create',
      input,
    }),
  );
  assert.equal(first.created, true);
  assert.equal(retry.created, false);
  assert.equal(retry.moment.id, first.moment.id);

  const preserved = await withActorTransaction(runtime, id.userA, (client) =>
    createMemoryFromMoment(client, {
      familyId: id.family,
      actorId: id.userA,
      momentId: id.moment,
      input: {},
    }),
  );
  const preservedRetry = await withActorTransaction(runtime, id.userA, (client) =>
    createMemoryFromMoment(client, {
      familyId: id.family,
      actorId: id.userA,
      momentId: id.moment,
      input: {},
    }),
  );
  assert.equal(preserved.created, true);
  assert.equal(preservedRetry.created, false);
  assert.equal(preservedRetry.memory.id, preserved.memory.id);
  const memories = await withActorTransaction(runtime, id.userB, (client) =>
    listMemories(client, { familyId: id.family, actorId: id.userB, limit: 20 }),
  );
  assert.equal(memories.memories.length, 1);
  assert.equal(memories.memories[0].items[0].kind, 'image');

  await withActorTransaction(runtime, id.userA, (client) =>
    deleteMoment(client, { familyId: id.family, actorId: id.userA, momentId: id.moment }),
  );
  await withActorTransaction(runtime, id.userA, (client) =>
    deleteMoment(client, { familyId: id.family, actorId: id.userA, momentId: first.moment.id }),
  );
  let lifecycle = await owner.query(`SELECT status FROM media_assets WHERE id = $1`, [id.media]);
  assert.equal(lifecycle.rows[0].status, 'ready', 'a Memory must retain shared media');

  await withActorTransaction(runtime, id.userA, (client) =>
    deleteMemory(client, {
      familyId: id.family,
      actorId: id.userA,
      memoryId: preserved.memory.id,
    }),
  );
  lifecycle = await owner.query(
    `SELECT asset.status,
            EXISTS (
              SELECT 1 FROM media_processing_jobs job
               WHERE job.family_id = asset.family_id AND job.media_id = asset.id
                 AND job.kind = 'delete' AND job.status = 'pending'
            ) AS cleanup_queued
       FROM media_assets asset WHERE asset.id = $1`,
    [id.media],
  );
  assert.deepEqual(lifecycle.rows[0], { status: 'deleted', cleanup_queued: true });

  await owner.query(
    `INSERT INTO media_assets(
       id,family_id,owner_membership_id,purpose,status,object_key,processed_object_key,
       mime_type,byte_size,sha256,width,height
     ) VALUES ($1,$2,$3,'moment_image','ready',$4,$5,'image/jpeg',100,$6,10,10)`,
    [
      id.raceMedia,
      id.family,
      id.membershipA,
      `quarantine/${id.raceMedia}`,
      `ready/${id.raceMedia}`,
      'd'.repeat(64),
    ],
  );
  await owner.query(
    `INSERT INTO moments(
       id,family_id,author_membership_id,media_id,caption,audience,client_request_id
     ) VALUES ($1,$2,$3,$4,'Cuộc đua lưu và xóa','family','integration-race')`,
    [id.raceMoment, id.family, id.membershipA, id.raceMedia],
  );
  const [preserveRace, deleteRace] = await Promise.allSettled([
    withActorTransaction(runtime, id.userA, (client) =>
      createMemoryFromMoment(client, {
        familyId: id.family,
        actorId: id.userA,
        momentId: id.raceMoment,
        input: {},
      }),
    ),
    withActorTransaction(runtime, id.userA, (client) =>
      deleteMoment(client, {
        familyId: id.family,
        actorId: id.userA,
        momentId: id.raceMoment,
      }),
    ),
  ]);
  assert.equal(deleteRace.status, 'fulfilled');
  if (preserveRace.status === 'rejected') {
    assert.equal(preserveRace.reason.code, 'NOT_FOUND');
  }
  const raceInvariant = await owner.query(
    `SELECT asset.status,
            count(item.id) FILTER (
              WHERE item.deleted_at IS NULL AND memory.deleted_at IS NULL
                AND asset.status = 'deleted'
            )::integer AS broken_references
       FROM media_assets asset
       LEFT JOIN memory_items item
         ON item.family_id = asset.family_id AND item.media_id = asset.id
       LEFT JOIN memories memory
         ON memory.family_id = item.family_id AND memory.id = item.memory_id
      WHERE asset.id = $1
      GROUP BY asset.status`,
    [id.raceMedia],
  );
  assert.equal(raceInvariant.rows[0].broken_references, 0);
  assert.equal(
    raceInvariant.rows[0].status,
    preserveRace.status === 'fulfilled' ? 'ready' : 'deleted',
  );
  console.log('Moments and Memories API integration checks passed.');
} finally {
  await owner.query('BEGIN');
  for (const table of [
    'media_processing_jobs',
    'memory_items',
    'memories',
    'moment_reactions',
    'moments',
    'media_assets',
  ]) {
    await owner.query(`DELETE FROM ${table} WHERE family_id = $1`, [id.family]);
  }
  await owner.query('DELETE FROM member_account_links WHERE family_id = $1', [id.family]);
  await owner.query('DELETE FROM members WHERE family_id = $1', [id.family]);
  await owner.query('DELETE FROM family_memberships WHERE family_id = $1', [id.family]);
  await owner.query('DELETE FROM family_spaces WHERE id = $1', [id.family]);
  await owner.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[id.userA, id.userB]]);
  await owner.query('COMMIT');
  await runtime.end();
  await owner.end();
}
