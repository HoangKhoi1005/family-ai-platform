import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../../../apps/api/dist/app.js';
import { createDatabasePool } from '../dist/index.js';

const ownerUrl = process.env.DATABASE_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
if (!ownerUrl || !runtimeUrl) {
  throw new Error('DATABASE_URL and RUNTIME_DATABASE_URL are required for notification API tests');
}

const ids = Object.fromEntries(
  [
    'familyA',
    'familyB',
    'user',
    'otherUser',
    'membership',
    'otherMembership',
    'event',
    'occurrence',
    'notification',
  ].map((key) => [key, randomUUID()]),
);
const owner = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
const runtimePool = createDatabasePool(runtimeUrl);
const auth = {
  api: {
    getSession: async ({ headers }) => {
      const actorId = headers.get('x-test-actor');
      return actorId
        ? { user: { id: actorId, emailVerified: true, email: `${actorId}@example.invalid` } }
        : null;
    },
  },
  handler: async () => new Response(null, { status: 404 }),
};
const app = buildApp({ auth, publicOrigin: 'http://127.0.0.1:3200', runtimePool });

function request(actorId, options) {
  return app.inject({
    ...options,
    headers: {
      'x-test-actor': actorId,
      ...(options.payload
        ? { origin: 'http://127.0.0.1:3200', 'content-type': 'application/json' }
        : {}),
      ...options.headers,
    },
  });
}

async function seed() {
  await owner.query('BEGIN');
  await owner.query(
    `INSERT INTO users(id,auth_subject,name,email,email_verified)
     VALUES ($1,$2,'Inbox member',$3,true),($4,$5,'Other member',$6,true)`,
    [
      ids.user,
      `notification-api-${ids.user}`,
      `${ids.user}@example.invalid`,
      ids.otherUser,
      `notification-api-${ids.otherUser}`,
      `${ids.otherUser}@example.invalid`,
    ],
  );
  await owner.query(`INSERT INTO family_spaces(id,name) VALUES ($1,'Inbox A'),($2,'Inbox B')`, [
    ids.familyA,
    ids.familyB,
  ]);
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status)
     VALUES ($1,$2,$3,'member','active'),($4,$5,$6,'member','active')`,
    [ids.membership, ids.familyA, ids.user, ids.otherMembership, ids.familyB, ids.otherUser],
  );
  await owner.query(
    `INSERT INTO events(
       id,family_id,creator_membership_id,kind,title,calendar_type,recurrence,timezone,
       date_year,date_month,date_day,all_day,reminder_offsets
     ) VALUES ($1,$2,$3,'gathering','Ngày riêng của nhà','gregorian','none',
       'Asia/Ho_Chi_Minh',2026,9,30,true,ARRAY['one_day']::text[])`,
    [ids.event, ids.familyA, ids.membership],
  );
  await owner.query(
    `INSERT INTO event_occurrences(id,family_id,event_id,event_revision,local_date)
     VALUES ($1,$2,$3,1,'2026-09-30')`,
    [ids.occurrence, ids.familyA, ids.event],
  );
  await owner.query(
    `INSERT INTO notifications(
       id,family_id,recipient_membership_id,event_id,occurrence_id,event_revision,reminder_offset
     ) VALUES ($1,$2,$3,$4,$5,1,'one_day')`,
    [ids.notification, ids.familyA, ids.membership, ids.event, ids.occurrence],
  );
  await owner.query('COMMIT');
}

async function cleanup() {
  await owner.query('BEGIN');
  await owner.query('DELETE FROM notifications WHERE family_id=$1', [ids.familyA]);
  await owner.query('DELETE FROM notification_preferences WHERE family_id=$1', [ids.familyA]);
  await owner.query('DELETE FROM event_occurrences WHERE family_id=$1', [ids.familyA]);
  await owner.query('DELETE FROM events WHERE family_id=$1', [ids.familyA]);
  await owner.query('DELETE FROM family_memberships WHERE family_id=ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM family_spaces WHERE id=ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[ids.user, ids.otherUser]]);
  await owner.query('COMMIT');
}

await owner.connect();
try {
  await seed();

  const inbox = await request(ids.user, {
    method: 'GET',
    url: `/api/v1/families/${ids.familyA}/notifications?limit=20`,
  });
  assert.equal(inbox.statusCode, 200, inbox.body);
  assert.equal(inbox.json().unread_count, 1);
  assert.equal(inbox.json().notifications.length, 1);
  assert.equal(inbox.json().notifications[0].occurrence_id, ids.occurrence);

  const firstRead = await request(ids.user, {
    method: 'POST',
    url: `/api/v1/families/${ids.familyA}/notifications/${ids.notification}/read`,
    payload: {},
  });
  assert.equal(firstRead.statusCode, 200, firstRead.body);
  const retryRead = await request(ids.user, {
    method: 'POST',
    url: `/api/v1/families/${ids.familyA}/notifications/${ids.notification}/read`,
    payload: {},
  });
  assert.equal(retryRead.statusCode, 200, retryRead.body);
  assert.equal(retryRead.json().read_at, firstRead.json().read_at);

  const defaults = await request(ids.user, {
    method: 'GET',
    url: `/api/v1/families/${ids.familyA}/notification-preferences`,
  });
  assert.equal(defaults.statusCode, 200, defaults.body);
  assert.deepEqual(defaults.json().reminder_offsets, ['seven_days', 'one_day', 'same_day']);
  assert.equal(defaults.json().push_enabled, false);

  const preferenceBody = {
    reminder_offsets: ['one_day'],
    quiet_hours: { starts_at: '21:00', ends_at: '07:00', timezone: 'Asia/Ho_Chi_Minh' },
    push_enabled: false,
    version: 0,
  };
  const preferences = await request(ids.user, {
    method: 'PATCH',
    url: `/api/v1/families/${ids.familyA}/notification-preferences`,
    payload: preferenceBody,
  });
  assert.equal(preferences.statusCode, 200, preferences.body);
  assert.deepEqual(preferences.json().reminder_offsets, ['one_day']);
  const stale = await request(ids.user, {
    method: 'PATCH',
    url: `/api/v1/families/${ids.familyA}/notification-preferences`,
    payload: preferenceBody,
  });
  assert.equal(stale.statusCode, 409, stale.body);

  const crossFamily = await request(ids.otherUser, {
    method: 'GET',
    url: `/api/v1/families/${ids.familyA}/notifications`,
  });
  assert.equal(crossFamily.statusCode, 404, crossFamily.body);
  await owner.query(`UPDATE family_memberships SET status='revoked' WHERE id=$1`, [ids.membership]);
  const revoked = await request(ids.user, {
    method: 'GET',
    url: `/api/v1/families/${ids.familyA}/notifications`,
  });
  assert.equal(revoked.statusCode, 404, revoked.body);

  console.log('PASS: notification inbox, idempotent read, preferences and tenant access passed.');
} finally {
  await cleanup().catch(() => undefined);
  await app.close();
  await runtimePool.end();
  await owner.end();
}
