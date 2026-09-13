import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const ownerUrl = process.env.DATABASE_URL;
const workerUrl = process.env.WORKER_DATABASE_URL;
if (!ownerUrl || !workerUrl) {
  throw new Error(
    'DATABASE_URL and WORKER_DATABASE_URL are required for notification worker tests',
  );
}

const owner = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
const worker = new pg.Client({ connectionString: workerUrl, connectionTimeoutMillis: 5000 });
const ids = Object.fromEntries(
  [
    'family',
    'creatorUser',
    'recipientUser',
    'revokedUser',
    'creatorMembership',
    'recipientMembership',
    'revokedMembership',
    'event',
    'deliverOccurrence',
    'revokedOccurrence',
    'retryOccurrence',
    'quietOccurrence',
    'deliverJob',
    'revokedJob',
    'retryJob',
    'quietJob',
  ].map((key) => [key, randomUUID()]),
);

async function asWorker(sql, params = []) {
  return worker.query(sql, params);
}

async function cleanup() {
  await owner.query('ROLLBACK');
  await owner.query('DELETE FROM notifications WHERE family_id=$1', [ids.family]);
  await owner.query('DELETE FROM outbox_jobs WHERE family_id=$1', [ids.family]);
  await owner.query('DELETE FROM notification_preferences WHERE family_id=$1', [ids.family]);
  await owner.query('DELETE FROM event_occurrences WHERE family_id=$1', [ids.family]);
  await owner.query('DELETE FROM events WHERE family_id=$1', [ids.family]);
  await owner.query('DELETE FROM family_memberships WHERE family_id=$1', [ids.family]);
  await owner.query('DELETE FROM family_spaces WHERE id=$1', [ids.family]);
  await owner.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [
    [ids.creatorUser, ids.recipientUser, ids.revokedUser],
  ]);
}

function jobValues(id, recipientMembership, occurrenceId) {
  return [id, ids.family, recipientMembership, ids.event, occurrenceId, 1];
}

await owner.connect();
await worker.connect();
try {
  await owner.query(
    `INSERT INTO users(id,auth_subject,name,email,email_verified)
     VALUES ($1,$2,'Worker creator','worker-creator@example.invalid',true),
            ($3,$4,'Worker recipient','worker-recipient@example.invalid',true),
            ($5,$6,'Worker revoked','worker-revoked@example.invalid',true)`,
    [
      ids.creatorUser,
      `worker-${ids.creatorUser}`,
      ids.recipientUser,
      `worker-${ids.recipientUser}`,
      ids.revokedUser,
      `worker-${ids.revokedUser}`,
    ],
  );
  await owner.query("INSERT INTO family_spaces(id,name) VALUES ($1,'Worker family')", [ids.family]);
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status)
     VALUES ($1,$2,$3,'member','active'),
            ($4,$2,$5,'member','active'),
            ($6,$2,$7,'member','active')`,
    [
      ids.creatorMembership,
      ids.family,
      ids.creatorUser,
      ids.recipientMembership,
      ids.recipientUser,
      ids.revokedMembership,
      ids.revokedUser,
    ],
  );
  await owner.query(
    `INSERT INTO events(
       id,family_id,creator_membership_id,kind,title,calendar_type,recurrence,timezone,
       date_year,date_month,date_day,all_day,reminder_offsets
     ) VALUES ($1,$2,$3,'gathering','Worker synthetic event','gregorian','none',
               'Asia/Ho_Chi_Minh',2099,9,20,true,ARRAY['same_day']::text[])`,
    [ids.event, ids.family, ids.creatorMembership],
  );
  await owner.query(
    `INSERT INTO event_occurrences(id,family_id,event_id,event_revision,local_date,status)
     VALUES ($1,$2,$3,1,'2099-09-20','active'),
            ($4,$2,$3,1,'2099-09-21','active'),
            ($5,$2,$3,1,'2099-09-22','active'),
            ($6,$2,$3,1,'2099-09-23','active')`,
    [
      ids.deliverOccurrence,
      ids.family,
      ids.event,
      ids.revokedOccurrence,
      ids.retryOccurrence,
      ids.quietOccurrence,
    ],
  );
  const insertJob = `INSERT INTO outbox_jobs(
    id,family_id,recipient_membership_id,event_id,occurrence_id,event_revision,
    reminder_offset,channel,due_at,available_at,expires_at
  ) VALUES ($1,$2,$3,$4,$5,$6,'same_day','in_app',
            '2099-09-20T02:00:00Z','2000-01-01T00:00:00Z','2099-09-20T17:00:00Z')`;
  await owner.query(
    insertJob,
    jobValues(ids.deliverJob, ids.recipientMembership, ids.deliverOccurrence),
  );
  await owner.query(
    insertJob,
    jobValues(ids.revokedJob, ids.revokedMembership, ids.revokedOccurrence),
  );
  await owner.query(
    insertJob,
    jobValues(ids.retryJob, ids.recipientMembership, ids.retryOccurrence),
  );

  const noTableAccess = await asWorker(
    "SELECT has_table_privilege(current_user,'public.outbox_jobs','SELECT') AS can_read",
  );
  assert.equal(noTableAccess.rows[0].can_read, false);
  const functionAccess = await asWorker(
    `SELECT
       has_function_privilege(
         current_user,
         'public.worker_claim_notification_jobs(text,integer,integer,timestamp with time zone)',
         'EXECUTE'
       ) AS can_claim,
       has_function_privilege(
         current_user,
         'public.worker_deliver_in_app_job(uuid,text,timestamp with time zone)',
         'EXECUTE'
       ) AS can_deliver,
       has_function_privilege(
         current_user,
         'public.worker_fail_notification_job(uuid,text,text,timestamp with time zone)',
         'EXECUTE'
       ) AS can_fail,
       has_function_privilege(
         current_user,
         'public.worker_notification_job_is_deliverable(uuid,timestamp with time zone)',
         'EXECUTE'
       ) AS can_call_internal_guard`,
  );
  assert.deepEqual(functionAccess.rows[0], {
    can_claim: true,
    can_deliver: true,
    can_fail: true,
    can_call_internal_guard: false,
  });

  const claimed = await asWorker(
    'SELECT id FROM public.worker_claim_notification_jobs($1,$2,$3,$4) ORDER BY id',
    ['worker-a', 10, 60, '2099-09-20T02:00:00Z'],
  );
  assert.deepEqual(
    claimed.rows.map((row) => row.id),
    [ids.deliverJob, ids.retryJob, ids.revokedJob].sort(),
  );
  const competingClaim = await asWorker(
    'SELECT id FROM public.worker_claim_notification_jobs($1,$2,$3,$4)',
    ['worker-b', 10, 60, '2099-09-20T02:00:00Z'],
  );
  assert.deepEqual(competingClaim.rows, []);

  const completed = await asWorker('SELECT public.worker_deliver_in_app_job($1,$2,$3) AS status', [
    ids.deliverJob,
    'worker-a',
    '2099-09-20T02:00:01Z',
  ]);
  assert.equal(completed.rows[0].status, 'completed');
  const notificationCount = await owner.query(
    'SELECT count(*)::int AS count FROM notifications WHERE family_id=$1 AND occurrence_id=$2',
    [ids.family, ids.deliverOccurrence],
  );
  assert.equal(notificationCount.rows[0].count, 1);

  await owner.query(
    `INSERT INTO notification_preferences(
       family_id,membership_id,quiet_hours_start,quiet_hours_end
     ) VALUES ($1,$2,'08:00','10:00')`,
    [ids.family, ids.revokedMembership],
  );
  await owner.query("UPDATE family_memberships SET status='revoked' WHERE id=$1", [
    ids.revokedMembership,
  ]);
  const cancelled = await asWorker('SELECT public.worker_deliver_in_app_job($1,$2,$3) AS status', [
    ids.revokedJob,
    'worker-a',
    '2099-09-20T02:00:01Z',
  ]);
  assert.equal(cancelled.rows[0].status, 'cancelled');
  await owner.query("UPDATE outbox_jobs SET lease_expires_at='2099-09-20T03:00:00Z' WHERE id=$1", [
    ids.retryJob,
  ]);

  await owner.query(
    `INSERT INTO notification_preferences(
       family_id,membership_id,quiet_hours_start,quiet_hours_end
     ) VALUES ($1,$2,'08:00','10:00')`,
    [ids.family, ids.recipientMembership],
  );
  await owner.query(
    insertJob,
    jobValues(ids.quietJob, ids.recipientMembership, ids.quietOccurrence),
  );
  const quietClaim = await asWorker(
    'SELECT id FROM public.worker_claim_notification_jobs($1,$2,$3,$4)',
    ['worker-quiet', 10, 60, '2099-09-20T02:10:00Z'],
  );
  assert.deepEqual(quietClaim.rows, [{ id: ids.quietJob }]);
  const deferred = await asWorker('SELECT public.worker_deliver_in_app_job($1,$2,$3) AS status', [
    ids.quietJob,
    'worker-quiet',
    '2099-09-20T02:10:01Z',
  ]);
  assert.equal(deferred.rows[0].status, 'deferred');
  const deferredState = await owner.query(
    `SELECT status,
            to_char(available_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD HH24:MI') AS available_local,
            attempts
       FROM outbox_jobs WHERE id=$1`,
    [ids.quietJob],
  );
  assert.deepEqual(deferredState.rows[0], {
    status: 'pending',
    available_local: '2099-09-20 10:00',
    attempts: 0,
  });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const workerId = attempt === 1 ? 'worker-a' : `worker-${attempt}`;
    const attemptMinute = attempt * 10;
    if (attempt > 1) {
      const reclaimed = await asWorker(
        'SELECT id FROM public.worker_claim_notification_jobs($1,$2,$3,$4)',
        [workerId, 1, 60, `2099-09-20T02:${attemptMinute}:00Z`],
      );
      assert.deepEqual(reclaimed.rows, [{ id: ids.retryJob }]);
    }
    const failure = await asWorker(
      'SELECT public.worker_fail_notification_job($1,$2,$3,$4) AS status',
      [ids.retryJob, workerId, 'delivery_failed', `2099-09-20T02:${attemptMinute}:01Z`],
    );
    assert.equal(failure.rows[0].status, attempt === 5 ? 'dead_letter' : 'pending');
  }
  const retryState = await owner.query(
    'SELECT status,attempts,last_error_code FROM outbox_jobs WHERE id=$1',
    [ids.retryJob],
  );
  assert.deepEqual(retryState.rows[0], {
    status: 'dead_letter',
    attempts: 5,
    last_error_code: 'delivery_failed',
  });

  console.log('PASS: notification worker lease, revoke, inbox dedupe and retry policy passed.');
} finally {
  await cleanup().catch(() => undefined);
  await worker.end();
  await owner.end();
}
