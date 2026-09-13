import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../../../apps/api/dist/app.js';
import { CalendarUnavailableError } from '../../../packages/domain/dist/index.js';
import { createDatabasePool } from '../dist/index.js';

const ownerUrl = process.env.DATABASE_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
if (!ownerUrl || !runtimeUrl) {
  throw new Error('DATABASE_URL and RUNTIME_DATABASE_URL are required for calendar API tests');
}

const ids = Object.fromEntries(
  [
    'familyA',
    'familyB',
    'creator',
    'member',
    'admin',
    'pending',
    'revoked',
    'otherFamily',
    'creatorMembership',
    'memberMembership',
    'adminMembership',
    'pendingMembership',
    'revokedMembership',
    'otherMembership',
  ].map((key) => [key, randomUUID()]),
);

const owner = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
const runtimePool = createDatabasePool(runtimeUrl);
const auth = {
  api: {
    getSession: async ({ headers }) => {
      const actorId = headers.get('x-test-actor');
      return actorId
        ? {
            user: {
              id: actorId,
              emailVerified: true,
              email: `${actorId}@example.invalid`,
              name: 'Calendar actor',
            },
          }
        : null;
    },
  },
  handler: async () => new Response(null, { status: 404 }),
};
const app = buildApp({
  auth,
  publicOrigin: 'http://127.0.0.1:3200',
  runtimePool,
});
const unavailableApp = buildApp({
  auth,
  publicOrigin: 'http://127.0.0.1:3200',
  runtimePool,
  calendarConverter: {
    version: 'unavailable-test',
    supportedYears: { first: 1200, last: 2199 },
    solarToLunar() {
      throw new CalendarUnavailableError('Calendar provider unavailable', 'provider_failure');
    },
    lunarToSolar() {
      throw new CalendarUnavailableError('Calendar provider unavailable', 'provider_failure');
    },
  },
});

function vnToday() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDays(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
     VALUES ($1,$2,'Creator',$3,true),($4,$5,'Member',$6,true),
            ($7,$8,'Admin',$9,true),($10,$11,'Pending',$12,true),
            ($13,$14,'Revoked',$15,true),($16,$17,'Other family',$18,true)`,
    [
      ids.creator,
      `calendar-api-${ids.creator}`,
      `${ids.creator}@example.invalid`,
      ids.member,
      `calendar-api-${ids.member}`,
      `${ids.member}@example.invalid`,
      ids.admin,
      `calendar-api-${ids.admin}`,
      `${ids.admin}@example.invalid`,
      ids.pending,
      `calendar-api-${ids.pending}`,
      `${ids.pending}@example.invalid`,
      ids.revoked,
      `calendar-api-${ids.revoked}`,
      `${ids.revoked}@example.invalid`,
      ids.otherFamily,
      `calendar-api-${ids.otherFamily}`,
      `${ids.otherFamily}@example.invalid`,
    ],
  );
  await owner.query(
    `INSERT INTO family_spaces(id,name) VALUES ($1,'Calendar API A'),($2,'Calendar API B')`,
    [ids.familyA, ids.familyB],
  );
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status)
     VALUES ($1,$2,$3,'member','active'),($4,$2,$5,'member','active'),
            ($6,$2,$7,'admin','active'),($8,$2,$9,'member','pending'),
            ($10,$2,$11,'member','revoked'),($12,$13,$14,'member','active')`,
    [
      ids.creatorMembership,
      ids.familyA,
      ids.creator,
      ids.memberMembership,
      ids.member,
      ids.adminMembership,
      ids.admin,
      ids.pendingMembership,
      ids.pending,
      ids.revokedMembership,
      ids.revoked,
      ids.otherMembership,
      ids.familyB,
      ids.otherFamily,
    ],
  );
  await owner.query('COMMIT');
}

async function cleanup() {
  await owner.query('BEGIN');
  await owner.query('DELETE FROM audit_entries WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
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
  await owner.query('DELETE FROM family_memberships WHERE family_id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM family_spaces WHERE id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
    [ids.creator, ids.member, ids.admin, ids.pending, ids.revoked, ids.otherFamily],
  ]);
  await owner.query('COMMIT');
}

await owner.connect();
try {
  await seed();
  const today = vnToday();
  const [, month, day] = today.split('-').map(Number);
  const eventInput = {
    kind: 'gathering',
    title: 'Cơm nhà cuối tuần',
    calendar_type: 'gregorian',
    recurrence: 'yearly',
    timezone: 'Asia/Ho_Chi_Minh',
    date_parts: { year: null, month, day },
    all_day: true,
    reminder_offsets: ['seven_days', 'one_day'],
  };

  const missingKey = await request(ids.creator, {
    method: 'POST',
    url: `/api/v1/families/${ids.familyA}/events`,
    payload: eventInput,
  });
  assert.equal(missingKey.statusCode, 400);

  const forbiddenAuthorityField = await request(ids.creator, {
    method: 'POST',
    url: `/api/v1/families/${ids.familyA}/events`,
    headers: { 'idempotency-key': 'calendar-api-invalid-body' },
    payload: { ...eventInput, family_id: ids.familyB },
  });
  assert.equal(forbiddenAuthorityField.statusCode, 400);

  const create = await request(ids.creator, {
    method: 'POST',
    url: `/api/v1/families/${ids.familyA}/events`,
    headers: { 'idempotency-key': 'calendar-api-create-1' },
    payload: eventInput,
  });
  assert.equal(create.statusCode, 201, create.body);
  const created = create.json();
  assert.equal(created.event.title, eventInput.title);
  assert.ok(created.occurrences.length >= 1);

  const retry = await request(ids.creator, {
    method: 'POST',
    url: `/api/v1/families/${ids.familyA}/events`,
    headers: { 'idempotency-key': 'calendar-api-create-1' },
    payload: eventInput,
  });
  assert.equal(retry.statusCode, 201, retry.body);
  assert.equal(retry.json().event.id, created.event.id);
  const detail = await request(ids.member, {
    method: 'GET',
    url: `/api/v1/families/${ids.familyA}/events/${created.event.id}`,
  });
  assert.equal(detail.statusCode, 200, detail.body);
  assert.equal(detail.json().event.can_edit, false);
  const eventCount = await owner.query(
    'SELECT count(*)::int AS count FROM events WHERE family_id=$1',
    [ids.familyA],
  );
  assert.equal(eventCount.rows[0].count, 1);

  const keyConflict = await request(ids.creator, {
    method: 'POST',
    url: `/api/v1/families/${ids.familyA}/events`,
    headers: { 'idempotency-key': 'calendar-api-create-1' },
    payload: { ...eventInput, title: 'Dữ liệu khác' },
  });
  assert.equal(keyConflict.statusCode, 409);
  assert.equal(keyConflict.json().error.code, 'IDEMPOTENCY_CONFLICT');

  for (const actorId of [ids.pending, ids.revoked, ids.otherFamily]) {
    const hidden = await request(actorId, {
      method: 'GET',
      url: `/api/v1/families/${ids.familyA}/events?from=${today}&to=${shiftDays(today, 400)}`,
    });
    assert.equal(hidden.statusCode, 404, hidden.body);
  }

  const list = await request(ids.member, {
    method: 'GET',
    url: `/api/v1/families/${ids.familyA}/events?from=${shiftDays(today, -1)}&to=${shiftDays(today, 400)}&limit=1`,
  });
  assert.equal(list.statusCode, 200, list.body);
  const timeline = list.json();
  assert.equal(timeline.occurrences.length, 1);
  assert.ok(timeline.next_cursor);
  const occurrenceId = timeline.occurrences[0].id;
  const nextPage = await request(ids.member, {
    method: 'GET',
    url: `/api/v1/families/${ids.familyA}/events?from=${shiftDays(today, -1)}&to=${shiftDays(today, 400)}&limit=1&cursor=${encodeURIComponent(timeline.next_cursor)}`,
  });
  assert.equal(nextPage.statusCode, 200, nextPage.body);
  assert.equal(nextPage.json().occurrences.length, 1);
  assert.notEqual(nextPage.json().occurrences[0].id, occurrenceId);

  const forbiddenUpdate = await request(ids.member, {
    method: 'PATCH',
    url: `/api/v1/families/${ids.familyA}/events/${created.event.id}`,
    payload: { version: 1, event: { ...eventInput, title: 'Không được sửa' } },
  });
  assert.equal(forbiddenUpdate.statusCode, 403, forbiddenUpdate.body);

  const firstRsvp = await request(ids.member, {
    method: 'PUT',
    url: `/api/v1/families/${ids.familyA}/occurrences/${occurrenceId}/rsvp`,
    payload: { response: 'yes' },
  });
  assert.equal(firstRsvp.statusCode, 200, firstRsvp.body);
  const retryRsvp = await request(ids.member, {
    method: 'PUT',
    url: `/api/v1/families/${ids.familyA}/occurrences/${occurrenceId}/rsvp`,
    payload: { response: 'maybe' },
  });
  assert.equal(retryRsvp.statusCode, 200, retryRsvp.body);
  assert.equal(retryRsvp.json().response, 'maybe');
  const rsvpCount = await owner.query(
    'SELECT count(*)::int AS count FROM event_rsvps WHERE family_id=$1',
    [ids.familyA],
  );
  assert.equal(rsvpCount.rows[0].count, 1);

  const update = await request(ids.creator, {
    method: 'PATCH',
    url: `/api/v1/families/${ids.familyA}/events/${created.event.id}`,
    payload: { version: 1, event: { ...eventInput, title: 'Cơm nhà tháng này' } },
  });
  assert.equal(update.statusCode, 200, update.body);
  assert.equal(update.json().event.revision, 2);
  assert.equal(update.json().event.version, 2);
  assert.ok(update.json().occurrences.every((item) => item.event_revision === 2));

  const staleUpdate = await request(ids.creator, {
    method: 'PATCH',
    url: `/api/v1/families/${ids.familyA}/events/${created.event.id}`,
    payload: { version: 1, event: eventInput },
  });
  assert.equal(staleUpdate.statusCode, 409);

  const cancel = await request(ids.admin, {
    method: 'POST',
    url: `/api/v1/families/${ids.familyA}/events/${created.event.id}/cancel`,
    payload: { version: 2 },
  });
  assert.equal(cancel.statusCode, 200, cancel.body);
  assert.equal(cancel.json().event.status, 'cancelled');
  assert.ok(cancel.json().occurrences.every((item) => item.status === 'cancelled'));

  const unavailableResponse = await unavailableApp.inject({
    method: 'POST',
    url: `/api/v1/families/${ids.familyA}/events`,
    headers: {
      'x-test-actor': ids.creator,
      origin: 'http://127.0.0.1:3200',
      'content-type': 'application/json',
      'idempotency-key': 'calendar-api-unavailable',
    },
    payload: {
      ...eventInput,
      title: 'Ngày âm lỗi nguồn',
      calendar_type: 'lunar_vietnamese',
      date_parts: { year: null, month: 1, day: 1 },
      lunar_policy: { month_mode: 'regular', missing_day: 'skip' },
    },
  });
  assert.equal(unavailableResponse.statusCode, 503, unavailableResponse.body);
  assert.equal(unavailableResponse.json().error.code, 'CALENDAR_UNAVAILABLE');

  const audit = await owner.query(
    `SELECT action FROM audit_entries WHERE family_id=$1 ORDER BY occurred_at`,
    [ids.familyA],
  );
  assert.deepEqual(
    audit.rows.map((row) => row.action),
    ['event.created', 'event.updated', 'event.cancelled'],
  );

  console.log('PASS: calendar CRUD, idempotency, tenant access, revision and RSVP API passed.');
} finally {
  await cleanup().catch(() => undefined);
  await app.close();
  await unavailableApp.close();
  await runtimePool.end();
  await owner.end();
}
