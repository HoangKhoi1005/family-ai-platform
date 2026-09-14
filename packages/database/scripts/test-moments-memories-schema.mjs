import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createDatabasePool, withActorTransaction } from '../dist/index.js';

const ownerUrl = process.env.DATABASE_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
if (!ownerUrl || !runtimeUrl) {
  throw new Error('DATABASE_URL and RUNTIME_DATABASE_URL are required for media schema tests');
}

const owner = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
const runtimePool = createDatabasePool(runtimeUrl);
const ids = Object.fromEntries(
  [
    'familyA',
    'familyB',
    'activeA',
    'activePeerA',
    'pendingA',
    'revokedA',
    'activeB',
    'membershipA',
    'peerMembershipA',
    'pendingMembershipA',
    'revokedMembershipA',
    'membershipB',
    'profileA',
    'profileB',
    'mediaA',
    'mediaB',
    'pendingMediaA',
    'momentA',
    'momentB',
    'memoryA',
    'memoryB',
    'reactionA',
    'itemA',
  ].map((key) => [key, randomUUID()]),
);

async function mustFail(operation, expectedCode) {
  let error;
  try {
    await operation();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, `Expected PostgreSQL ${expectedCode}`);
  assert.equal(error.code, expectedCode);
}

async function seed() {
  await owner.query('BEGIN');
  await owner.query(
    `INSERT INTO users(id,auth_subject,name,email,email_verified)
     VALUES ($1,$2,'Media active A','media-active-a@example.invalid',true),
            ($3,$4,'Media pending A','media-pending-a@example.invalid',true),
            ($5,$6,'Media revoked A','media-revoked-a@example.invalid',true),
            ($7,$8,'Media active B','media-active-b@example.invalid',true)`,
    [
      ids.activeA,
      `media-${ids.activeA}`,
      ids.pendingA,
      `media-${ids.pendingA}`,
      ids.revokedA,
      `media-${ids.revokedA}`,
      ids.activeB,
      `media-${ids.activeB}`,
    ],
  );
  await owner.query(
    `INSERT INTO family_spaces(id,name) VALUES ($1,'Media family A'),($2,'Media family B')`,
    [ids.familyA, ids.familyB],
  );
  await owner.query(
    `INSERT INTO users(id,auth_subject,name,email,email_verified)
     VALUES ($1,$2,'Media peer A','media-peer-a@example.invalid',true)`,
    [ids.activePeerA, `media-${ids.activePeerA}`],
  );
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status)
     VALUES ($1,$2,$3,'admin','active'),
            ($4,$2,$5,'member','pending'),
            ($6,$2,$7,'member','revoked'),
            ($8,$9,$10,'member','active')`,
    [
      ids.membershipA,
      ids.familyA,
      ids.activeA,
      ids.pendingMembershipA,
      ids.pendingA,
      ids.revokedMembershipA,
      ids.revokedA,
      ids.membershipB,
      ids.familyB,
      ids.activeB,
    ],
  );
  await owner.query(
    `INSERT INTO members(id,family_id,display_name)
     VALUES ($1,$2,'Media profile A'),($3,$4,'Media profile B')`,
    [ids.profileA, ids.familyA, ids.profileB, ids.familyB],
  );
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status)
     VALUES ($1,$2,$3,'member','active')`,
    [ids.peerMembershipA, ids.familyA, ids.activePeerA],
  );
  await owner.query(
    `INSERT INTO media_assets(
       id,family_id,owner_membership_id,purpose,object_key,mime_type,byte_size
     ) VALUES ($1,$2,$3,'moment_image',$4,'image/jpeg',1024)`,
    [ids.pendingMediaA, ids.familyA, ids.membershipA, `quarantine/${ids.pendingMediaA}`],
  );
  await owner.query(
    `INSERT INTO member_account_links(family_id,membership_id,member_id)
     VALUES ($1,$2,$3),($4,$5,$6)`,
    [ids.familyA, ids.membershipA, ids.profileA, ids.familyB, ids.membershipB, ids.profileB],
  );
  await owner.query(
    `INSERT INTO media_assets(
       id,family_id,owner_membership_id,purpose,status,object_key,processed_object_key,
       mime_type,byte_size,sha256,width,height
     ) VALUES
       ($1,$2,$3,'moment_image','ready',$4,$5,'image/jpeg',1024,$6,100,100),
       ($7,$8,$9,'moment_image','ready',$10,$11,'image/jpeg',1024,$12,100,100)`,
    [
      ids.mediaA,
      ids.familyA,
      ids.membershipA,
      `quarantine/${ids.mediaA}`,
      `ready/${ids.mediaA}`,
      'a'.repeat(64),
      ids.mediaB,
      ids.familyB,
      ids.membershipB,
      `quarantine/${ids.mediaB}`,
      `ready/${ids.mediaB}`,
      'b'.repeat(64),
    ],
  );
  await owner.query(
    `INSERT INTO moments(
       id,family_id,author_membership_id,media_id,caption,audience,client_request_id
     ) VALUES
       ($1,$2,$3,$4,'Khoảnh khắc A','family','schema-request-a'),
       ($5,$6,$7,$8,'Khoảnh khắc B','family','schema-request-b')`,
    [
      ids.momentA,
      ids.familyA,
      ids.membershipA,
      ids.mediaA,
      ids.momentB,
      ids.familyB,
      ids.membershipB,
      ids.mediaB,
    ],
  );
  await owner.query('COMMIT');
}

async function cleanup() {
  await owner.query('ROLLBACK').catch(() => undefined);
  await owner.query('BEGIN');
  for (const table of [
    'media_processing_jobs',
    'memory_items',
    'memories',
    'moment_reactions',
    'moments',
    'media_assets',
  ]) {
    await owner.query(`DELETE FROM ${table} WHERE family_id = ANY($1::uuid[])`, [
      [ids.familyA, ids.familyB],
    ]);
  }
  await owner.query('DELETE FROM member_account_links WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM members WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM family_memberships WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM family_spaces WHERE id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
    [ids.activeA, ids.activePeerA, ids.pendingA, ids.revokedA, ids.activeB],
  ]);
  await owner.query('COMMIT');
}

await owner.connect();
try {
  const tables = await owner.query(
    `SELECT to_regclass('public.media_assets') AS media_assets,
            to_regclass('public.media_processing_jobs') AS media_processing_jobs,
            to_regclass('public.moments') AS moments,
            to_regclass('public.moment_reactions') AS moment_reactions,
            to_regclass('public.memories') AS memories,
            to_regclass('public.memory_items') AS memory_items`,
  );
  assert.deepEqual(tables.rows[0], {
    media_assets: 'media_assets',
    media_processing_jobs: 'media_processing_jobs',
    moments: 'moments',
    moment_reactions: 'moment_reactions',
    memories: 'memories',
    memory_items: 'memory_items',
  });

  await seed();

  await mustFail(
    () =>
      owner.query(
        `INSERT INTO moments(family_id,author_membership_id,media_id,audience,client_request_id)
       VALUES ($1,$2,$3,'family','cross-family-media')`,
        [ids.familyA, ids.membershipA, ids.mediaB],
      ),
    '23503',
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO moments(family_id,author_membership_id,media_id,audience,client_request_id)
       VALUES ($1,$2,$3,'family','schema-request-a')`,
        [ids.familyA, ids.membershipA, ids.mediaA],
      ),
    '23505',
  );
  await owner.query(
    `INSERT INTO moment_reactions(id,family_id,moment_id,membership_id,reaction)
     VALUES ($1,$2,$3,$4,'thuong')`,
    [ids.reactionA, ids.familyA, ids.momentA, ids.membershipA],
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO moment_reactions(family_id,moment_id,membership_id,reaction)
       VALUES ($1,$2,$3,'thuong')`,
        [ids.familyA, ids.momentA, ids.membershipA],
      ),
    '23505',
  );
  await owner.query(
    `INSERT INTO memories(id,family_id,created_by_membership_id,source_moment_id,title,occurred_on,audience)
     VALUES ($1,$2,$3,$4,'Kỷ niệm A','2026-09-14','family')`,
    [ids.memoryA, ids.familyA, ids.membershipA, ids.momentA],
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO memories(family_id,created_by_membership_id,source_moment_id,title,occurred_on,audience)
       VALUES ($1,$2,$3,'Trùng nguồn','2026-09-14','family')`,
        [ids.familyA, ids.membershipA, ids.momentA],
      ),
    '23505',
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO memories(id,family_id,created_by_membership_id,source_moment_id,title,occurred_on,audience)
       VALUES ($1,$2,$3,$4,'Sai nhà','2026-09-14','family')`,
        [ids.memoryB, ids.familyA, ids.membershipA, ids.momentB],
      ),
    '23503',
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO memory_items(
         id,family_id,memory_id,position,kind,body,contributed_by_membership_id
       ) VALUES ($1,$2,$3,0,'text',NULL,$4)`,
        [ids.itemA, ids.familyA, ids.memoryA, ids.membershipA],
      ),
    '23514',
  );

  const visible = await withActorTransaction(runtimePool, ids.activeA, (client) =>
    client.query('SELECT id FROM moments ORDER BY id'),
  );
  assert.deepEqual(
    visible.rows.map((row) => row.id),
    [ids.momentA],
  );
  for (const actorId of [ids.pendingA, ids.revokedA]) {
    const hidden = await withActorTransaction(runtimePool, actorId, (client) =>
      client.query('SELECT id FROM moments'),
    );
    assert.equal(hidden.rowCount, 0);
  }
  const familyB = await withActorTransaction(runtimePool, ids.activeB, (client) =>
    client.query('SELECT id FROM moments'),
  );
  assert.deepEqual(
    familyB.rows.map((row) => row.id),
    [ids.momentB],
  );
  const peerMedia = await withActorTransaction(runtimePool, ids.activePeerA, (client) =>
    client.query('SELECT id,status FROM media_assets ORDER BY id'),
  );
  assert.deepEqual(peerMedia.rows, [{ id: ids.mediaA, status: 'ready' }]);

  await mustFail(
    () =>
      withActorTransaction(runtimePool, ids.activeA, async (client) => {
        await client.query("SELECT set_config('app.purpose', 'media_write', true)");
        await client.query(
          `UPDATE media_assets SET status = 'ready'
            WHERE family_id = $1 AND id = $2`,
          [ids.familyA, ids.pendingMediaA],
        );
      }),
    '42501',
  );
  await mustFail(
    () =>
      withActorTransaction(runtimePool, ids.activeA, async (client) => {
        await client.query("SELECT set_config('app.purpose', 'media_write', true)");
        await client.query(
          `INSERT INTO media_processing_jobs(family_id,media_id,kind)
           VALUES ($1,$2,'process')`,
          [ids.familyA, ids.pendingMediaA],
        );
      }),
    '42501',
  );
  const transition = await withActorTransaction(runtimePool, ids.activeA, async (client) => {
    await client.query("SELECT set_config('app.purpose', 'media_write', true)");
    return client.query(`SELECT public.actor_complete_media_upload($1,$2) AS transitioned`, [
      ids.familyA,
      ids.pendingMediaA,
    ]);
  });
  assert.equal(transition.rows[0]?.transitioned, true);
  const secured = await owner.query(
    `SELECT asset.status,
            EXISTS (
              SELECT 1 FROM media_processing_jobs job
               WHERE job.family_id = asset.family_id AND job.media_id = asset.id
                 AND job.kind = 'process'
            ) AS has_job
       FROM media_assets asset WHERE asset.id = $1`,
    [ids.pendingMediaA],
  );
  assert.deepEqual(secured.rows[0], { status: 'processing', has_job: true });
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO memory_items(
           family_id,memory_id,position,kind,media_id,contributed_by_membership_id
         ) VALUES ($1,$2,1,'image',$3,$4)`,
        [ids.familyA, ids.memoryA, ids.pendingMediaA, ids.membershipA],
      ),
    '23514',
  );

  console.log('Moments, memories, and media schema checks passed.');
} finally {
  try {
    await cleanup();
  } finally {
    await runtimePool.end();
    await owner.end();
  }
}
