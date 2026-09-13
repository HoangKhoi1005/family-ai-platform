import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createDatabasePool, withActorTransaction } from '../dist/index.js';

const ownerUrl = process.env.DATABASE_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
if (!ownerUrl || !runtimeUrl) {
  throw new Error(
    'DATABASE_URL and RUNTIME_DATABASE_URL are required for notification schema tests',
  );
}

const owner = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
const runtimePool = createDatabasePool(runtimeUrl);
const ids = Object.fromEntries(
  [
    'familyA',
    'familyB',
    'creatorA',
    'memberA',
    'adminA',
    'pendingA',
    'revokedA',
    'memberB',
    'creatorMembershipA',
    'memberMembershipA',
    'adminMembershipA',
    'pendingMembershipA',
    'revokedMembershipA',
    'membershipB',
    'eventA',
    'eventB',
    'timedEventA',
    'oldOccurrenceA',
    'currentOccurrenceA',
    'occurrenceB',
    'timedMorningOccurrenceA',
    'timedEarlyOccurrenceA',
    'timedTooEarlyOccurrenceA',
    'notificationA',
    'jobA',
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

async function asActor(actorId, purpose, operation) {
  return withActorTransaction(runtimePool, actorId, async (client) => {
    if (purpose) await client.query("SELECT set_config('app.purpose', $1, true)", [purpose]);
    return operation(client);
  });
}

async function seed() {
  await owner.query('BEGIN');
  await owner.query(
    `INSERT INTO users(id,auth_subject,name,email,email_verified)
     VALUES ($1,$2,'Notification creator','notification-creator@example.invalid',true),
            ($3,$4,'Notification member','notification-member@example.invalid',true),
            ($5,$6,'Notification admin','notification-admin@example.invalid',true),
            ($7,$8,'Notification pending','notification-pending@example.invalid',true),
            ($9,$10,'Notification revoked','notification-revoked@example.invalid',true),
            ($11,$12,'Notification other family','notification-other@example.invalid',true)`,
    [
      ids.creatorA,
      `notification-${ids.creatorA}`,
      ids.memberA,
      `notification-${ids.memberA}`,
      ids.adminA,
      `notification-${ids.adminA}`,
      ids.pendingA,
      `notification-${ids.pendingA}`,
      ids.revokedA,
      `notification-${ids.revokedA}`,
      ids.memberB,
      `notification-${ids.memberB}`,
    ],
  );
  await owner.query(
    `INSERT INTO family_spaces(id,name) VALUES ($1,'Notification A'),($2,'Notification B')`,
    [ids.familyA, ids.familyB],
  );
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status)
     VALUES ($1,$2,$3,'member','active'),
            ($4,$2,$5,'member','active'),
            ($6,$2,$7,'admin','active'),
            ($8,$2,$9,'member','pending'),
            ($10,$2,$11,'member','revoked'),
            ($12,$13,$14,'member','active')`,
    [
      ids.creatorMembershipA,
      ids.familyA,
      ids.creatorA,
      ids.memberMembershipA,
      ids.memberA,
      ids.adminMembershipA,
      ids.adminA,
      ids.pendingMembershipA,
      ids.pendingA,
      ids.revokedMembershipA,
      ids.revokedA,
      ids.membershipB,
      ids.familyB,
      ids.memberB,
    ],
  );
  await owner.query(
    `INSERT INTO events(
       id,family_id,creator_membership_id,kind,title,calendar_type,recurrence,timezone,
       date_year,date_month,date_day,all_day,starts_local_time,reminder_offsets,revision
     ) VALUES
       ($1,$2,$3,'gathering','Synthetic notification event','gregorian','none',
        'Asia/Ho_Chi_Minh',2026,9,20,true,NULL,ARRAY['one_day']::text[],2),
       ($4,$5,$6,'gathering','Synthetic other event','gregorian','none',
        'Asia/Ho_Chi_Minh',2026,9,20,true,NULL,ARRAY['one_day']::text[],1),
       ($7,$2,$3,'gathering','Synthetic timed event','gregorian','none',
        'Asia/Ho_Chi_Minh',2026,9,20,false,time '10:00',ARRAY['same_day']::text[],1)`,
    [
      ids.eventA,
      ids.familyA,
      ids.creatorMembershipA,
      ids.eventB,
      ids.familyB,
      ids.membershipB,
      ids.timedEventA,
    ],
  );
  await owner.query(
    `INSERT INTO event_occurrences(
       id,family_id,event_id,event_revision,local_date,starts_at,status
     )
     VALUES ($1,$2,$3,1,(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+29,NULL,'cancelled'),
            ($4,$2,$3,2,(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+30,NULL,'active'),
            ($5,$6,$7,1,(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+30,NULL,'active'),
            ($8,$2,$9,1,(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+31,
             (((clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+31)+time '10:00') AT TIME ZONE 'Asia/Ho_Chi_Minh','active'),
            ($10,$2,$9,1,(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+32,
             (((clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+32)+time '08:00') AT TIME ZONE 'Asia/Ho_Chi_Minh','active'),
            ($11,$2,$9,1,(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+33,
             (((clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+33)+time '06:00') AT TIME ZONE 'Asia/Ho_Chi_Minh','active')`,
    [
      ids.oldOccurrenceA,
      ids.familyA,
      ids.eventA,
      ids.currentOccurrenceA,
      ids.occurrenceB,
      ids.familyB,
      ids.eventB,
      ids.timedMorningOccurrenceA,
      ids.timedEventA,
      ids.timedEarlyOccurrenceA,
      ids.timedTooEarlyOccurrenceA,
    ],
  );
  await owner.query('COMMIT');
}

async function cleanup() {
  await owner.query('ROLLBACK');
  await owner.query('BEGIN');
  for (const table of ['notifications', 'outbox_jobs', 'notification_preferences']) {
    await owner.query(`DELETE FROM ${table} WHERE family_id = ANY($1::uuid[])`, [
      [ids.familyA, ids.familyB],
    ]);
  }
  await owner.query('DELETE FROM event_occurrences WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM events WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM family_memberships WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM family_spaces WHERE id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
    [ids.creatorA, ids.memberA, ids.adminA, ids.pendingA, ids.revokedA, ids.memberB],
  ]);
  await owner.query('COMMIT');
}

const insertJobSql = `INSERT INTO outbox_jobs(
  id,family_id,recipient_membership_id,event_id,occurrence_id,event_revision,
  reminder_offset,channel,due_at,available_at,expires_at
) VALUES ($1,$2,$3,$4,$5,$6,'one_day','in_app',
          '2026-09-19T02:00:00Z','2026-09-19T02:00:00Z','2099-09-20T02:00:00Z')`;

await owner.connect();
try {
  const tables = await owner.query(
    `SELECT to_regclass('public.notification_preferences') AS notification_preferences,
            to_regclass('public.notifications') AS notifications,
            to_regclass('public.outbox_jobs') AS outbox_jobs`,
  );
  assert.deepEqual(tables.rows[0], {
    notification_preferences: 'notification_preferences',
    notifications: 'notifications',
    outbox_jobs: 'outbox_jobs',
  });
  await seed();

  await mustFail(
    () =>
      asActor(ids.memberA, undefined, (client) =>
        client.query(
          'INSERT INTO notification_preferences(family_id,membership_id) VALUES ($1,$2)',
          [ids.familyA, ids.memberMembershipA],
        ),
      ),
    '42501',
  );
  const ownPreferences = await asActor(ids.memberA, 'notification_write', (client) =>
    client.query(
      `INSERT INTO notification_preferences(family_id,membership_id)
       VALUES ($1,$2) RETURNING reminder_offsets,quiet_hours_start,quiet_hours_end,push_enabled`,
      [ids.familyA, ids.memberMembershipA],
    ),
  );
  assert.deepEqual(ownPreferences.rows[0], {
    reminder_offsets: ['seven_days', 'one_day', 'same_day'],
    quiet_hours_start: '21:00:00',
    quiet_hours_end: '07:00:00',
    push_enabled: false,
  });
  await mustFail(
    () =>
      asActor(ids.memberA, 'notification_write', (client) =>
        client.query(
          'INSERT INTO notification_preferences(family_id,membership_id) VALUES ($1,$2)',
          [ids.familyA, ids.creatorMembershipA],
        ),
      ),
    '42501',
  );
  for (const [actorId, membershipId] of [
    [ids.pendingA, ids.pendingMembershipA],
    [ids.revokedA, ids.revokedMembershipA],
  ]) {
    await mustFail(
      () =>
        asActor(actorId, 'notification_write', (client) =>
          client.query(
            'INSERT INTO notification_preferences(family_id,membership_id) VALUES ($1,$2)',
            [ids.familyA, membershipId],
          ),
        ),
      '42501',
    );
  }
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO notification_preferences(family_id,membership_id,reminder_offsets)
         VALUES ($1,$2,ARRAY['one_day','one_day']::text[])`,
        [ids.familyA, ids.creatorMembershipA],
      ),
    '23514',
  );

  await mustFail(
    () =>
      asActor(ids.creatorA, undefined, (client) =>
        client.query('SELECT public.actor_enqueue_event_reminders($1,$2,$3)', [
          ids.familyA,
          ids.eventA,
          2,
        ]),
      ),
    '42501',
  );
  await mustFail(
    () =>
      asActor(ids.memberA, 'calendar_write', (client) =>
        client.query('SELECT public.actor_enqueue_event_reminders($1,$2,$3)', [
          ids.familyA,
          ids.eventA,
          2,
        ]),
      ),
    '42501',
  );
  const enqueued = await asActor(ids.creatorA, 'calendar_write', (client) =>
    client.query('SELECT public.actor_enqueue_event_reminders($1,$2,$3) AS count', [
      ids.familyA,
      ids.eventA,
      2,
    ]),
  );
  assert.equal(enqueued.rows[0].count, 3);
  const enqueuedRetry = await asActor(ids.creatorA, 'calendar_write', (client) =>
    client.query('SELECT public.actor_enqueue_event_reminders($1,$2,$3) AS count', [
      ids.familyA,
      ids.eventA,
      2,
    ]),
  );
  assert.equal(enqueuedRetry.rows[0].count, 0);
  const fanoutRecipients = await owner.query(
    `SELECT array_agg(recipient_membership_id ORDER BY recipient_membership_id) AS recipients
       FROM outbox_jobs WHERE family_id=$1 AND event_id=$2`,
    [ids.familyA, ids.eventA],
  );
  assert.deepEqual(
    fanoutRecipients.rows[0].recipients,
    [ids.adminMembershipA, ids.creatorMembershipA, ids.memberMembershipA].sort(),
  );
  await owner.query('DELETE FROM outbox_jobs WHERE family_id=$1 AND event_id=$2', [
    ids.familyA,
    ids.eventA,
  ]);

  const timedEnqueue = await asActor(ids.creatorA, 'calendar_write', (client) =>
    client.query('SELECT public.actor_enqueue_event_reminders($1,$2,$3) AS count', [
      ids.familyA,
      ids.timedEventA,
      1,
    ]),
  );
  assert.equal(timedEnqueue.rows[0].count, 6);
  const timedDueTimes = await owner.query(
    `SELECT occurrence_id,
            to_char(due_at AT TIME ZONE 'Asia/Ho_Chi_Minh','HH24:MI') AS due_local
       FROM outbox_jobs
      WHERE family_id=$1 AND event_id=$2
      ORDER BY occurrence_id,due_local`,
    [ids.familyA, ids.timedEventA],
  );
  assert.deepEqual(
    [
      ...new Set(
        timedDueTimes.rows
          .filter((job) => job.occurrence_id === ids.timedMorningOccurrenceA)
          .map((job) => job.due_local),
      ),
    ],
    ['09:00'],
  );
  assert.deepEqual(
    [
      ...new Set(
        timedDueTimes.rows
          .filter((job) => job.occurrence_id === ids.timedEarlyOccurrenceA)
          .map((job) => job.due_local),
      ),
    ],
    ['07:00'],
  );
  assert.equal(
    timedDueTimes.rows.some((job) => job.occurrence_id === ids.timedTooEarlyOccurrenceA),
    false,
  );
  await owner.query('DELETE FROM outbox_jobs WHERE family_id=$1 AND event_id=$2', [
    ids.familyA,
    ids.timedEventA,
  ]);

  const job = await asActor(ids.creatorA, 'calendar_write', (client) =>
    client.query(insertJobSql, [
      ids.jobA,
      ids.familyA,
      ids.memberMembershipA,
      ids.eventA,
      ids.currentOccurrenceA,
      2,
    ]),
  );
  assert.equal(job.rowCount, 1);
  await mustFail(
    () =>
      asActor(ids.creatorA, 'calendar_write', (client) =>
        client.query(insertJobSql, [
          randomUUID(),
          ids.familyA,
          ids.memberMembershipA,
          ids.eventA,
          ids.currentOccurrenceA,
          2,
        ]),
      ),
    '23505',
  );
  await owner.query('DELETE FROM outbox_jobs WHERE id=$1', [ids.jobA]);
  await asActor(ids.memberA, 'notification_write', (client) =>
    client.query(
      `UPDATE notification_preferences
          SET reminder_offsets=ARRAY['seven_days']::text[],version=version+1
        WHERE family_id=$1 AND membership_id=$2`,
      [ids.familyA, ids.memberMembershipA],
    ),
  );
  await mustFail(
    () =>
      asActor(ids.creatorA, 'calendar_write', (client) =>
        client.query(insertJobSql, [
          ids.jobA,
          ids.familyA,
          ids.memberMembershipA,
          ids.eventA,
          ids.currentOccurrenceA,
          2,
        ]),
      ),
    '42501',
  );
  await asActor(ids.memberA, 'notification_write', (client) =>
    client.query(
      `UPDATE notification_preferences
          SET reminder_offsets=ARRAY['seven_days','one_day','same_day']::text[],
              version=version+1
        WHERE family_id=$1 AND membership_id=$2`,
      [ids.familyA, ids.memberMembershipA],
    ),
  );
  await asActor(ids.creatorA, 'calendar_write', (client) =>
    client.query(insertJobSql, [
      ids.jobA,
      ids.familyA,
      ids.memberMembershipA,
      ids.eventA,
      ids.currentOccurrenceA,
      2,
    ]),
  );
  await mustFail(
    () =>
      asActor(ids.creatorA, 'calendar_write', (client) =>
        client.query(insertJobSql.replace("'in_app'", "'push'"), [
          randomUUID(),
          ids.familyA,
          ids.memberMembershipA,
          ids.eventA,
          ids.currentOccurrenceA,
          2,
        ]),
      ),
    '42501',
  );
  for (const [recipientId, occurrenceId, revision] of [
    [ids.pendingMembershipA, ids.currentOccurrenceA, 2],
    [ids.revokedMembershipA, ids.currentOccurrenceA, 2],
    [ids.memberMembershipA, ids.oldOccurrenceA, 1],
  ]) {
    await mustFail(
      () =>
        asActor(ids.creatorA, 'calendar_write', (client) =>
          client.query(insertJobSql, [
            randomUUID(),
            ids.familyA,
            recipientId,
            ids.eventA,
            occurrenceId,
            revision,
          ]),
        ),
      '42501',
    );
  }
  await mustFail(
    () =>
      owner.query(insertJobSql, [
        randomUUID(),
        ids.familyA,
        ids.memberMembershipA,
        ids.eventB,
        ids.occurrenceB,
        1,
      ]),
    '23503',
  );
  await mustFail(
    () => asActor(ids.memberA, undefined, (client) => client.query('SELECT id FROM outbox_jobs')),
    '42501',
  );

  await owner.query(
    `INSERT INTO notifications(
       id,family_id,recipient_membership_id,event_id,occurrence_id,event_revision,
       reminder_offset,channel
     ) VALUES ($1,$2,$3,$4,$5,2,'one_day','in_app')`,
    [ids.notificationA, ids.familyA, ids.memberMembershipA, ids.eventA, ids.currentOccurrenceA],
  );
  const visibleToRecipient = await asActor(ids.memberA, undefined, (client) =>
    client.query('SELECT id,read_at FROM notifications'),
  );
  assert.equal(visibleToRecipient.rows[0].id, ids.notificationA);
  assert.equal(
    (
      await asActor(ids.creatorA, undefined, (client) =>
        client.query('SELECT id FROM notifications'),
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (await asActor(ids.adminA, undefined, (client) => client.query('SELECT id FROM notifications')))
      .rowCount,
    0,
  );
  const noPurposeRead = await asActor(ids.memberA, undefined, (client) =>
    client.query('UPDATE notifications SET read_at=clock_timestamp() WHERE id=$1', [
      ids.notificationA,
    ]),
  );
  assert.equal(noPurposeRead.rowCount, 0);
  const markedRead = await asActor(ids.memberA, 'notification_write', (client) =>
    client.query(
      `UPDATE notifications SET read_at=clock_timestamp()
        WHERE id=$1 AND read_at IS NULL RETURNING read_at`,
      [ids.notificationA],
    ),
  );
  assert.equal(markedRead.rowCount, 1);

  const workerA = new pg.Client({ connectionString: ownerUrl });
  const workerB = new pg.Client({ connectionString: ownerUrl });
  await Promise.all([workerA.connect(), workerB.connect()]);
  const claimSql = `WITH candidate AS (
    SELECT id FROM outbox_jobs
     WHERE (status='pending' OR (status='leased' AND lease_expires_at <= clock_timestamp()))
       AND due_at <= clock_timestamp()
       AND available_at <= clock_timestamp() AND expires_at > clock_timestamp()
     ORDER BY due_at,id FOR UPDATE SKIP LOCKED LIMIT 1
  )
  UPDATE outbox_jobs job
     SET status='leased',lease_owner=$1,
         lease_expires_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp()
    FROM candidate WHERE job.id=candidate.id RETURNING job.id`;
  try {
    await owner.query(
      `UPDATE outbox_jobs
          SET due_at=clock_timestamp()+interval '1 hour',
              available_at=clock_timestamp()-interval '1 minute',
              expires_at=clock_timestamp()+interval '2 hours'
        WHERE id=$1`,
      [ids.jobA],
    );
    await workerA.query('BEGIN');
    const claimedBeforeDue = await workerA.query(claimSql, ['worker-a']);
    assert.equal(claimedBeforeDue.rowCount, 0);
    await workerA.query('COMMIT');

    await owner.query(
      `UPDATE outbox_jobs
          SET due_at=clock_timestamp()-interval '1 minute',
              available_at=clock_timestamp()-interval '1 minute',
              expires_at=clock_timestamp()+interval '1 hour'
        WHERE id=$1`,
      [ids.jobA],
    );
    await workerA.query('BEGIN');
    await workerB.query('BEGIN');
    const claimedA = await workerA.query(claimSql, ['worker-a']);
    const claimedB = await workerB.query(claimSql, ['worker-b']);
    assert.equal(claimedA.rowCount, 1);
    assert.equal(claimedB.rowCount, 0);
    await workerA.query('COMMIT');
    await workerB.query('COMMIT');
    await owner.query(
      `UPDATE outbox_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1`,
      [ids.jobA],
    );
    await workerB.query('BEGIN');
    const reclaimed = await workerB.query(claimSql, ['worker-b']);
    assert.equal(reclaimed.rows[0].id, ids.jobA);
    await workerB.query('COMMIT');
  } finally {
    await workerA.query('ROLLBACK').catch(() => undefined);
    await workerB.query('ROLLBACK').catch(() => undefined);
    await Promise.all([workerA.end(), workerB.end()]);
  }

  await mustFail(
    () =>
      asActor(ids.creatorA, 'calendar_write', (client) =>
        client.query(
          `UPDATE outbox_jobs
              SET status='cancelled',cancelled_at=clock_timestamp(),
                  lease_owner=NULL,lease_expires_at=NULL
            WHERE family_id=$1 AND event_id=$2`,
          [ids.familyA, ids.eventA],
        ),
      ),
    '42501',
  );
  await mustFail(
    () =>
      asActor(ids.creatorA, undefined, (client) =>
        client.query('SELECT public.actor_cancel_event_outbox_jobs($1,$2,$3)', [
          ids.familyA,
          ids.eventA,
          null,
        ]),
      ),
    '42501',
  );
  await mustFail(
    () =>
      asActor(ids.memberA, 'calendar_write', (client) =>
        client.query('SELECT public.actor_cancel_event_outbox_jobs($1,$2,$3)', [
          ids.familyA,
          ids.eventA,
          null,
        ]),
      ),
    '42501',
  );
  const cancelledJobs = await asActor(ids.creatorA, 'calendar_write', (client) =>
    client.query('SELECT public.actor_cancel_event_outbox_jobs($1,$2,$3) AS count', [
      ids.familyA,
      ids.eventA,
      null,
    ]),
  );
  assert.equal(cancelledJobs.rows[0].count, 1);
  const cancelledJob = await owner.query(
    'SELECT status,cancelled_at,lease_owner,lease_expires_at FROM outbox_jobs WHERE id=$1',
    [ids.jobA],
  );
  assert.equal(cancelledJob.rows[0].status, 'cancelled');
  assert.ok(cancelledJob.rows[0].cancelled_at);
  assert.equal(cancelledJob.rows[0].lease_owner, null);
  assert.equal(cancelledJob.rows[0].lease_expires_at, null);

  await owner.query("UPDATE family_memberships SET status='revoked' WHERE id=$1", [
    ids.memberMembershipA,
  ]);
  assert.equal(
    (
      await asActor(ids.memberA, undefined, (client) =>
        client.query('SELECT id FROM notifications'),
      )
    ).rowCount,
    0,
  );

  console.log('PASS: notification constraints, inbox privacy, dedupe and lease isolation passed.');
} finally {
  await cleanup();
  await runtimePool.end();
  await owner.end();
}
