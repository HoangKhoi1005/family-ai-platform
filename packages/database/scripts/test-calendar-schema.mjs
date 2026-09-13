import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createDatabasePool, withActorTransaction } from '../dist/index.js';

const ownerUrl = process.env.DATABASE_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
if (!ownerUrl || !runtimeUrl) {
  throw new Error('DATABASE_URL and RUNTIME_DATABASE_URL are required for calendar schema tests');
}

const owner = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
const runtimePool = createDatabasePool(runtimeUrl);
const ids = Object.fromEntries(
  [
    'familyA',
    'familyB',
    'adminA',
    'creatorA',
    'memberA',
    'pendingA',
    'revokedA',
    'memberB',
    'adminMembershipA',
    'creatorMembershipA',
    'memberMembershipA',
    'pendingMembershipA',
    'revokedMembershipA',
    'membershipB',
    'profileA',
    'profileB',
    'eventA',
    'eventB',
    'occurrenceA',
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

async function asCalendarActor(actorId, operation) {
  return withActorTransaction(runtimePool, actorId, async (client) => {
    await client.query("SELECT set_config('app.purpose', 'calendar_write', true)");
    return operation(client);
  });
}

async function seed() {
  await owner.query('BEGIN');
  await owner.query(
    `INSERT INTO users(id,auth_subject,name,email,email_verified)
     VALUES ($1,$2,'Calendar admin','calendar-admin@example.invalid',true),
            ($3,$4,'Calendar creator','calendar-creator@example.invalid',true),
            ($5,$6,'Calendar member','calendar-member@example.invalid',true),
            ($7,$8,'Calendar pending','calendar-pending@example.invalid',true),
            ($9,$10,'Calendar revoked','calendar-revoked@example.invalid',true),
            ($11,$12,'Calendar other family','calendar-other@example.invalid',true)`,
    [
      ids.adminA,
      `calendar-${ids.adminA}`,
      ids.creatorA,
      `calendar-${ids.creatorA}`,
      ids.memberA,
      `calendar-${ids.memberA}`,
      ids.pendingA,
      `calendar-${ids.pendingA}`,
      ids.revokedA,
      `calendar-${ids.revokedA}`,
      ids.memberB,
      `calendar-${ids.memberB}`,
    ],
  );
  await owner.query(
    `INSERT INTO family_spaces(id,name) VALUES ($1,'Calendar A'),($2,'Calendar B')`,
    [ids.familyA, ids.familyB],
  );
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status)
     VALUES ($1,$2,$3,'admin','active'),
            ($4,$2,$5,'member','active'),
            ($6,$2,$7,'member','active'),
            ($8,$2,$9,'member','pending'),
            ($10,$2,$11,'member','revoked'),
            ($12,$13,$14,'member','active')`,
    [
      ids.adminMembershipA,
      ids.familyA,
      ids.adminA,
      ids.creatorMembershipA,
      ids.creatorA,
      ids.memberMembershipA,
      ids.memberA,
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
    `INSERT INTO members(id,family_id,display_name)
     VALUES ($1,$2,'Calendar profile A'),($3,$4,'Calendar profile B')`,
    [ids.profileA, ids.familyA, ids.profileB, ids.familyB],
  );
  await owner.query(
    `INSERT INTO events(
       id,family_id,creator_membership_id,member_id,kind,title,calendar_type,recurrence,
       timezone,date_year,date_month,date_day,lunar_month_mode,lunar_missing_day_policy,
       all_day,reminder_offsets
     ) VALUES
       ($1,$2,$3,$4,'death_anniversary','Synthetic lunar event','lunar_vietnamese','yearly',
        'Asia/Ho_Chi_Minh',2025,6,30,'regular','last_day',true,
        ARRAY['seven_days','one_day']::text[]),
       ($5,$6,$7,$8,'gathering','Synthetic other family event','gregorian','none',
        'Asia/Ho_Chi_Minh',2026,1,2,NULL,NULL,true,ARRAY[]::text[])`,
    [
      ids.eventA,
      ids.familyA,
      ids.creatorMembershipA,
      ids.profileA,
      ids.eventB,
      ids.familyB,
      ids.membershipB,
      ids.profileB,
    ],
  );
  await owner.query(
    `INSERT INTO event_occurrences(
       id,family_id,event_id,event_revision,local_date,calendar_conversion_version
     ) VALUES ($1,$2,$3,1,'2026-08-12','@dqcai/vn-lunar@1.0.1')`,
    [ids.occurrenceA, ids.familyA, ids.eventA],
  );
  await owner.query('COMMIT');
}

async function cleanup() {
  await owner.query('BEGIN');
  await owner.query('DELETE FROM event_idempotency_keys WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM event_rsvps WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM event_occurrences WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM events WHERE family_id = ANY($1::uuid[])', [
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
    [ids.adminA, ids.creatorA, ids.memberA, ids.pendingA, ids.revokedA, ids.memberB],
  ]);
  await owner.query('COMMIT');
}

await owner.connect();
try {
  const tables = await owner.query(
    `SELECT to_regclass('public.events') AS events,
            to_regclass('public.event_occurrences') AS event_occurrences,
            to_regclass('public.event_rsvps') AS event_rsvps,
            to_regclass('public.event_idempotency_keys') AS event_idempotency_keys`,
  );
  assert.deepEqual(tables.rows[0], {
    events: 'events',
    event_occurrences: 'event_occurrences',
    event_rsvps: 'event_rsvps',
    event_idempotency_keys: 'event_idempotency_keys',
  });

  await seed();

  await mustFail(
    () =>
      owner.query(
        `INSERT INTO events(
           family_id,creator_membership_id,member_id,kind,title,calendar_type,recurrence,
           timezone,date_year,date_month,date_day,all_day
         ) VALUES ($1,$2,$3,'birthday','Cross family','gregorian','yearly',
           'Asia/Ho_Chi_Minh',NULL,1,1,true)`,
        [ids.familyA, ids.creatorMembershipA, ids.profileB],
      ),
    '23503',
  );
  await mustFail(
    () =>
      asCalendarActor(ids.creatorA, (client) =>
        client.query(
          `INSERT INTO event_occurrences(
             family_id,event_id,event_revision,local_date,calendar_conversion_version
           ) VALUES ($1,$2,999,'2026-08-13','@dqcai/vn-lunar@1.0.1')`,
          [ids.familyA, ids.eventA],
        ),
      ),
    '42501',
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO events(
           family_id,creator_membership_id,kind,title,calendar_type,recurrence,timezone,
           date_year,date_month,date_day,lunar_month_mode,lunar_missing_day_policy,all_day
         ) VALUES ($1,$2,'gathering','Wrong policy','gregorian','yearly',
           'Asia/Ho_Chi_Minh',NULL,6,1,'regular','skip',true)`,
        [ids.familyA, ids.creatorMembershipA],
      ),
    '23514',
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO event_occurrences(
           family_id,event_id,event_revision,local_date,calendar_conversion_version
         ) VALUES ($1,$2,1,'2026-08-12','@dqcai/vn-lunar@1.0.1')`,
        [ids.familyA, ids.eventA],
      ),
    '23505',
  );
  await mustFail(
    () =>
      owner.query(
        `INSERT INTO event_occurrences(family_id,event_id,event_revision,local_date)
         VALUES ($1,$2,1,'2026-01-02')`,
        [ids.familyA, ids.eventB],
      ),
    '23503',
  );

  const visible = await withActorTransaction(runtimePool, ids.creatorA, (client) =>
    client.query('SELECT id FROM events ORDER BY id'),
  );
  assert.deepEqual(
    visible.rows.map((row) => row.id),
    [ids.eventA],
  );
  for (const actorId of [ids.pendingA, ids.revokedA]) {
    const hidden = await withActorTransaction(runtimePool, actorId, (client) =>
      client.query('SELECT id FROM events'),
    );
    assert.equal(hidden.rowCount, 0);
  }
  const otherFamily = await withActorTransaction(runtimePool, ids.memberB, (client) =>
    client.query('SELECT id FROM events'),
  );
  assert.deepEqual(
    otherFamily.rows.map((row) => row.id),
    [ids.eventB],
  );

  const created = await asCalendarActor(ids.memberA, (client) =>
    client.query(
      `INSERT INTO events(
         family_id,creator_membership_id,kind,title,calendar_type,recurrence,timezone,
         date_year,date_month,date_day,all_day,reminder_offsets
       ) VALUES ($1,$2,'gathering','Created by member','gregorian','none',
         'Asia/Ho_Chi_Minh',2026,9,13,true,ARRAY[]::text[])
       RETURNING id`,
      [ids.familyA, ids.memberMembershipA],
    ),
  );
  assert.equal(created.rowCount, 1);
  const createdEventId = created.rows[0].id;
  const idempotency = await asCalendarActor(ids.memberA, (client) =>
    client.query(
      `INSERT INTO event_idempotency_keys(
         family_id,actor_membership_id,idempotency_key,request_hash,event_id
       ) VALUES ($1,$2,'calendar-create-1',$3,$4)
       RETURNING event_id`,
      [ids.familyA, ids.memberMembershipA, 'a'.repeat(64), createdEventId],
    ),
  );
  assert.equal(idempotency.rows[0].event_id, createdEventId);
  await mustFail(
    () =>
      asCalendarActor(ids.memberA, (client) =>
        client.query(
          `INSERT INTO event_idempotency_keys(
             family_id,actor_membership_id,idempotency_key,request_hash,event_id
           ) VALUES ($1,$2,'calendar-create-1',$3,$4)`,
          [ids.familyA, ids.memberMembershipA, 'b'.repeat(64), createdEventId],
        ),
      ),
    '23505',
  );
  await mustFail(
    () =>
      asCalendarActor(ids.memberA, (client) =>
        client.query(
          `INSERT INTO events(
             family_id,creator_membership_id,kind,title,calendar_type,recurrence,timezone,
             date_year,date_month,date_day,all_day
           ) VALUES ($1,$2,'gathering','Forged creator','gregorian','none',
             'Asia/Ho_Chi_Minh',2026,9,13,true)`,
          [ids.familyA, ids.adminMembershipA],
        ),
      ),
    '42501',
  );

  const nonCreatorUpdate = await asCalendarActor(ids.memberA, (client) =>
    client.query("UPDATE events SET title='Not allowed' WHERE id=$1", [ids.eventA]),
  );
  assert.equal(nonCreatorUpdate.rowCount, 0);
  const creatorUpdate = await asCalendarActor(ids.creatorA, (client) =>
    client.query("UPDATE events SET title='Creator edit',version=version+1 WHERE id=$1", [
      ids.eventA,
    ]),
  );
  assert.equal(creatorUpdate.rowCount, 1);
  const adminUpdate = await asCalendarActor(ids.adminA, (client) =>
    client.query("UPDATE events SET title='Admin edit',version=version+1 WHERE id=$1", [
      ids.eventA,
    ]),
  );
  assert.equal(adminUpdate.rowCount, 1);

  await mustFail(
    () =>
      withActorTransaction(runtimePool, ids.memberA, (client) =>
        client.query(
          `INSERT INTO event_rsvps(family_id,occurrence_id,membership_id,response)
           VALUES ($1,$2,$3,'yes')`,
          [ids.familyA, ids.occurrenceA, ids.memberMembershipA],
        ),
      ),
    '42501',
  );
  const ownRsvp = await asCalendarActor(ids.memberA, (client) =>
    client.query(
      `INSERT INTO event_rsvps(family_id,occurrence_id,membership_id,response)
       VALUES ($1,$2,$3,'yes') RETURNING response`,
      [ids.familyA, ids.occurrenceA, ids.memberMembershipA],
    ),
  );
  assert.equal(ownRsvp.rows[0].response, 'yes');
  const updatedRsvp = await asCalendarActor(ids.memberA, (client) =>
    client.query(
      `INSERT INTO event_rsvps(family_id,occurrence_id,membership_id,response)
       VALUES ($1,$2,$3,'maybe')
       ON CONFLICT (family_id,occurrence_id,membership_id)
       DO UPDATE SET response=EXCLUDED.response,updated_at=clock_timestamp()
       RETURNING response`,
      [ids.familyA, ids.occurrenceA, ids.memberMembershipA],
    ),
  );
  assert.equal(updatedRsvp.rows[0].response, 'maybe');
  await mustFail(
    () =>
      asCalendarActor(ids.memberA, (client) =>
        client.query(
          `INSERT INTO event_rsvps(family_id,occurrence_id,membership_id,response)
           VALUES ($1,$2,$3,'yes')`,
          [ids.familyA, ids.occurrenceA, ids.adminMembershipA],
        ),
      ),
    '42501',
  );

  const hiddenFromOtherMember = await withActorTransaction(runtimePool, ids.creatorA, (client) =>
    client.query('SELECT membership_id FROM event_rsvps WHERE occurrence_id=$1', [ids.occurrenceA]),
  );
  assert.equal(hiddenFromOtherMember.rowCount, 0);
  const visibleToAdmin = await withActorTransaction(runtimePool, ids.adminA, (client) =>
    client.query('SELECT membership_id FROM event_rsvps WHERE occurrence_id=$1', [ids.occurrenceA]),
  );
  assert.equal(visibleToAdmin.rowCount, 1);
  await owner.query("UPDATE family_memberships SET status='revoked' WHERE id=$1", [
    ids.memberMembershipA,
  ]);
  const revokedRsvp = await withActorTransaction(runtimePool, ids.adminA, (client) =>
    client.query('SELECT membership_id FROM event_rsvps WHERE occurrence_id=$1', [ids.occurrenceA]),
  );
  assert.equal(revokedRsvp.rowCount, 0);

  await owner.query('UPDATE events SET revision=revision+1 WHERE id=$1', [ids.eventA]);
  await mustFail(
    () =>
      asCalendarActor(ids.adminA, (client) =>
        client.query(
          `INSERT INTO event_rsvps(family_id,occurrence_id,membership_id,response)
           VALUES ($1,$2,$3,'yes')`,
          [ids.familyA, ids.occurrenceA, ids.adminMembershipA],
        ),
      ),
    '42501',
  );

  await owner.query("UPDATE family_memberships SET status='revoked' WHERE id=$1", [
    ids.creatorMembershipA,
  ]);
  const adminAfterCreatorRevoked = await asCalendarActor(ids.adminA, (client) =>
    client.query("UPDATE events SET title='Admin keeps event',version=version+1 WHERE id=$1", [
      ids.eventA,
    ]),
  );
  assert.equal(adminAfterCreatorRevoked.rowCount, 1);
  const cancelledOccurrence = await asCalendarActor(ids.adminA, (client) =>
    client.query("UPDATE event_occurrences SET status='cancelled' WHERE id=$1", [ids.occurrenceA]),
  );
  assert.equal(cancelledOccurrence.rowCount, 1);

  console.log('PASS: calendar constraints, tenant RLS, ownership and RSVP isolation passed.');
} finally {
  await cleanup().catch(() => undefined);
  await runtimePool.end();
  await owner.end();
}
