import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { createDatabasePool, withActorTransaction } from '../dist/index.js';

const ownerUrl = process.env.DATABASE_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
if (!ownerUrl || !runtimeUrl) {
  throw new Error('DATABASE_URL and RUNTIME_DATABASE_URL are required for tenant tests');
}

const owner = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
const runtimePool = createDatabasePool(runtimeUrl);
const secondRuntimePool = createDatabasePool(runtimeUrl);
await owner.connect();

const ids = {
  familyA: randomUUID(),
  familyB: randomUUID(),
  adminA: randomUUID(),
  memberA: randomUUID(),
  memberB: randomUUID(),
  pending: randomUUID(),
  revoked: randomUUID(),
  candidate: randomUUID(),
  userB: randomUUID(),
  membershipAdminA: randomUUID(),
  membershipMemberA: randomUUID(),
  membershipPending: randomUUID(),
  membershipRevoked: randomUUID(),
  membershipB: randomUUID(),
  linkedMemberA: randomUUID(),
  linkedMemberB: randomUUID(),
  pendingMember: randomUUID(),
  revokedMember: randomUUID(),
  claimPending: randomUUID(),
  claimRevoked: randomUUID(),
  claimValid: randomUUID(),
  claimExpired: randomUUID(),
  claimStale: randomUUID(),
  staleMember: randomUUID(),
  extraMember: randomUUID(),
};

function tokenHash(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function mustFail(operation, code = '42501') {
  let failed = false;
  try {
    await operation();
  } catch (error) {
    failed = true;
    assert.equal(error.code, code, `Expected PostgreSQL ${code}, got ${error.code}`);
  }
  assert.ok(failed, 'Expected operation to fail');
}

async function mustReject(operation, code = 'P0001') {
  let failed = false;
  try {
    await operation();
  } catch (error) {
    failed = true;
    assert.equal(error.code, code, `Expected PostgreSQL ${code}, got ${error.code}`);
  }
  assert.ok(failed, 'Expected operation to be rejected');
}

async function seed() {
  await owner.query('BEGIN');
  await owner.query(
    `INSERT INTO users(id,auth_subject,name,email,email_verified)
     VALUES
       ($1,$2,'Synthetic admin','tenant-admin@example.invalid',true),
       ($3,$4,'Synthetic member','tenant-member@example.invalid',true),
       ($5,$6,'Synthetic pending','tenant-pending@example.invalid',true),
       ($7,$8,'Synthetic revoked','tenant-revoked@example.invalid',true),
       ($9,$10,'Synthetic candidate','tenant-candidate@example.invalid',true),
       ($11,$12,'Synthetic other family','tenant-other@example.invalid',true)`,
    [
      ids.adminA,
      `tenant-${ids.adminA}`,
      ids.memberA,
      `tenant-${ids.memberA}`,
      ids.pending,
      `tenant-${ids.pending}`,
      ids.revoked,
      `tenant-${ids.revoked}`,
      ids.candidate,
      `tenant-${ids.candidate}`,
      ids.userB,
      `tenant-${ids.userB}`,
    ],
  );
  await owner.query(
    `INSERT INTO family_spaces(id,name) VALUES ($1,'Synthetic Tenant A'),($2,'Synthetic Tenant B')`,
    [ids.familyA, ids.familyB],
  );
  await owner.query(
    `INSERT INTO family_memberships(id,family_id,user_id,role,status)
     VALUES
       ($1,$7,$2,'admin','active'),
       ($3,$7,$4,'member','active'),
       ($5,$7,$6,'member','pending'),
       ($8,$7,$9,'member','revoked'),
       ($10,$11,$12,'member','active')`,
    [
      ids.membershipAdminA,
      ids.adminA,
      ids.membershipMemberA,
      ids.memberA,
      ids.membershipPending,
      ids.pending,
      ids.familyA,
      ids.membershipRevoked,
      ids.revoked,
      ids.membershipB,
      ids.familyB,
      ids.userB,
    ],
  );
  await owner.query(
    `INSERT INTO members(id,family_id,display_name,familiar_name,hometown,biography)
     VALUES
       ($1,$3,'Linked member A','A','Hanoi','Synthetic biography'),
       ($2,$3,'Unlinked member A',NULL,NULL,NULL),
       ($4,$5,'Linked member B',NULL,NULL,NULL),
       ($6,$3,'Pending target',NULL,NULL,NULL),
       ($7,$3,'Revoked target',NULL,NULL,NULL),
       ($8,$3,'Stale target',NULL,NULL,NULL),
       ($9,$3,'Extra target',NULL,NULL,NULL)`,
    [
      ids.linkedMemberA,
      ids.memberB,
      ids.familyA,
      ids.linkedMemberB,
      ids.familyB,
      ids.pendingMember,
      ids.revokedMember,
      ids.staleMember,
      ids.extraMember,
    ],
  );
  await owner.query(
    `INSERT INTO member_account_links(family_id,membership_id,member_id)
     VALUES ($1,$2,$3),($4,$5,$6)`,
    [
      ids.familyA,
      ids.membershipMemberA,
      ids.linkedMemberA,
      ids.familyB,
      ids.membershipB,
      ids.linkedMemberB,
    ],
  );
  await owner.query(
    `INSERT INTO member_contacts(family_id,member_id,kind,value,visibility)
     VALUES
       ($1,$2,'phone','family-phone-a','family'),
       ($1,$2,'email','self-member-a','self'),
       ($1,$3,'email','self-unlinked-a','self'),
       ($4,$5,'phone','family-phone-b','family'),
       ($1,$6,'email','self-stale','self')`,
    [ids.familyA, ids.linkedMemberA, ids.memberB, ids.familyB, ids.linkedMemberB, ids.staleMember],
  );
  await owner.query(
    `INSERT INTO member_claims(id,family_id,membership_id,member_id,expires_at,member_version,created_by)
     VALUES
       ($1,$5,$2,$3,now()+interval '1 hour',1,$4),
       ($6,$5,$7,$8,now()+interval '1 hour',1,$4)`,
    [
      ids.claimPending,
      ids.membershipPending,
      ids.pendingMember,
      ids.membershipAdminA,
      ids.familyA,
      ids.claimRevoked,
      ids.membershipRevoked,
      ids.revokedMember,
    ],
  );
  await owner.query('COMMIT');
}

async function cleanup() {
  await owner.query('BEGIN');
  for (const table of [
    'audit_entries',
    'member_claims',
    'invitations',
    'member_contacts',
    'member_account_links',
    'members',
    'family_memberships',
  ]) {
    await owner.query(`DELETE FROM ${table} WHERE family_id = ANY($1::uuid[])`, [
      [ids.familyA, ids.familyB],
    ]);
  }
  await owner.query('DELETE FROM family_spaces WHERE id = ANY($1::uuid[])', [
    [ids.familyA, ids.familyB],
  ]);
  await owner.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
    [ids.adminA, ids.memberA, ids.pending, ids.revoked, ids.candidate, ids.userB],
  ]);
  await owner.query('COMMIT');
}

try {
  await seed();

  const helperRoles = await owner.query(
    `SELECT rolname,rolcanlogin,rolinherit,rolbypassrls
       FROM pg_roles
      WHERE rolname = ANY($1::text[]) ORDER BY rolname`,
    [['family_membership_lookup', 'family_invitation_acceptor']],
  );
  assert.deepEqual(helperRoles.rows, [
    {
      rolname: 'family_invitation_acceptor',
      rolcanlogin: false,
      rolinherit: false,
      rolbypassrls: true,
    },
    {
      rolname: 'family_membership_lookup',
      rolcanlogin: false,
      rolinherit: false,
      rolbypassrls: true,
    },
  ]);
  const helperMemberships = await owner.query(
    `SELECT 1
       FROM pg_auth_members m
       JOIN pg_roles member ON member.oid = m.member
       JOIN pg_roles granted ON granted.oid = m.roleid
      WHERE member.rolname = 'family_runtime'
        AND granted.rolname = ANY($1::text[])`,
    [['family_membership_lookup', 'family_invitation_acceptor']],
  );
  assert.equal(helperMemberships.rowCount, 0, 'runtime cannot assume helper roles');
  const securityDefiners = await owner.query(
    `SELECT p.proname,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
    [
      [
        'actor_uuid',
        'actor_active_member',
        'actor_active_membership',
        'actor_active_admin',
        'actor_linked_member',
        'actor_visible_user',
        'actor_manage_unlinked_member',
        'actor_preview_claim',
        'actor_confirm_claim',
        'accept_invitation',
      ],
    ],
  );
  assert.equal(securityDefiners.rowCount, 11);
  for (const fn of securityDefiners.rows) {
    assert.equal(fn.prosecdef, true, `${fn.proname} must be SECURITY DEFINER`);
    assert.ok(fn.proconfig?.some((value) => value.startsWith('search_path=pg_catalog, public')));
  }

  let connected = false;
  const fakePool = {
    connect: async () => {
      connected = true;
      throw new Error('pool must not be touched for an invalid actor');
    },
  };
  await assert.rejects(
    () => withActorTransaction(fakePool, 'not-a-uuid', async () => undefined),
    /actorId must be a UUID/,
  );
  assert.equal(connected, false, 'invalid actor must be rejected before pool access');

  const familyRows = await withActorTransaction(runtimePool, ids.adminA, async (client) => {
    const result = await client.query('SELECT id,name FROM family_spaces ORDER BY id');
    assert.equal(
      (await client.query("SELECT current_setting('app.actor_id')")).rows[0].current_setting,
      ids.adminA,
    );
    return result.rows;
  });
  assert.deepEqual(familyRows, [{ id: ids.familyA, name: 'Synthetic Tenant A' }]);

  const members = await withActorTransaction(runtimePool, ids.adminA, async (client) => {
    const result = await client.query(
      'SELECT id,display_name,familiar_name,hometown,biography FROM members ORDER BY id',
    );
    return result.rows;
  });
  assert.equal(members.length, 6, 'active admin sees only same-family members');
  assert.equal(
    members.some((row) => row.display_name === 'Linked member B'),
    false,
  );

  const contacts = await withActorTransaction(runtimePool, ids.adminA, async (client) => {
    const result = await client.query(
      'SELECT value,visibility FROM member_contacts ORDER BY value',
    );
    return result.rows;
  });
  assert.deepEqual(contacts, [{ value: 'family-phone-a', visibility: 'family' }]);

  const ownContacts = await withActorTransaction(runtimePool, ids.memberA, async (client) => {
    const result = await client.query(
      'SELECT value,visibility FROM member_contacts ORDER BY value',
    );
    return result.rows;
  });
  assert.deepEqual(ownContacts, [
    { value: 'family-phone-a', visibility: 'family' },
    { value: 'self-member-a', visibility: 'self' },
  ]);

  const pendingMemberships = await withActorTransaction(
    runtimePool,
    ids.pending,
    async (client) => {
      const result = await client.query(
        'SELECT family_id,status FROM family_memberships ORDER BY family_id',
      );
      return result.rows;
    },
  );
  assert.deepEqual(pendingMemberships, [{ family_id: ids.familyA, status: 'pending' }]);
  const memberMemberships = await withActorTransaction(runtimePool, ids.memberA, (client) =>
    client.query('SELECT user_id FROM family_memberships ORDER BY user_id'),
  );
  assert.deepEqual(
    memberMemberships.rows,
    [{ user_id: ids.memberA }],
    'members see only their membership',
  );
  const pendingMembers = await withActorTransaction(runtimePool, ids.pending, (client) =>
    client.query('SELECT id FROM members'),
  );
  assert.deepEqual(pendingMembers.rows, [], 'pending members cannot see tenant data');
  const revokedMembers = await withActorTransaction(runtimePool, ids.revoked, (client) =>
    client.query('SELECT id FROM members'),
  );
  assert.deepEqual(revokedMembers.rows, [], 'revoked members cannot see tenant data');
  const pendingClaims = await withActorTransaction(runtimePool, ids.pending, (client) =>
    client.query('SELECT id FROM member_claims'),
  );
  assert.deepEqual(pendingClaims.rows, [], 'pending members cannot read or act on claims');
  const revokedClaims = await withActorTransaction(runtimePool, ids.revoked, (client) =>
    client.query('SELECT id FROM member_claims'),
  );
  assert.deepEqual(revokedClaims.rows, [], 'revoked members cannot read or act on claims');
  await withActorTransaction(runtimePool, ids.adminA, (client) =>
    client.query('UPDATE member_claims SET version=version+1 WHERE id=$1', [ids.claimPending]),
  );
  await mustFail(() =>
    withActorTransaction(runtimePool, ids.adminA, (client) =>
      client.query('SELECT id FROM auth_accounts'),
    ),
  );
  await mustFail(() =>
    withActorTransaction(runtimePool, ids.adminA, (client) =>
      client.query('SELECT id,name,email FROM users'),
    ),
  );
  await mustFail(() =>
    withActorTransaction(runtimePool, ids.memberA, (client) =>
      client.query('UPDATE family_memberships SET role = $1 WHERE id = $2', [
        'admin',
        ids.membershipMemberA,
      ]),
    ),
  );
  await mustFail(() =>
    withActorTransaction(runtimePool, ids.memberA, (client) =>
      client.query('UPDATE users SET email = $1 WHERE id = $2', [
        'leak@example.invalid',
        ids.memberA,
      ]),
    ),
  );
  await mustFail(() =>
    withActorTransaction(runtimePool, ids.memberA, (client) =>
      client.query('DELETE FROM members WHERE id = $1', [ids.linkedMemberA]),
    ),
  );
  await withActorTransaction(runtimePool, ids.adminA, (client) =>
    mustFail(() => client.query('SET ROLE family_membership_lookup')),
  );

  await withActorTransaction(runtimePool, ids.adminA, async (client) => {
    await client.query("SELECT set_config('app.purpose','claim_preview',true)");
    await client.query("SELECT set_config('app.claim_id',$1,true)", [randomUUID()]);
    await client.query("SELECT set_config('app.purpose','claim_confirm',true)");
  });
  const managedContact = await withActorTransaction(runtimePool, ids.adminA, async (client) => {
    await client.query("SELECT set_config('app.purpose','member_management',true)");
    await client.query("SELECT set_config('app.member_id',$1,true)", [ids.memberB]);
    const result = await client.query('SELECT value FROM member_contacts WHERE member_id = $1', [
      ids.memberB,
    ]);
    return result.rows;
  });
  assert.deepEqual(
    managedContact,
    [{ value: 'self-unlinked-a' }],
    'purpose is necessary for admin unlinked contact access',
  );
  const adminInvitationToken = `synthetic-admin-invite-${randomUUID()}`;
  const adminInvitation = await withActorTransaction(runtimePool, ids.adminA, (client) =>
    client.query(
      `INSERT INTO invitations(family_id,token_hash,expires_at,created_by)
       VALUES ($1,$2,now()+interval '1 hour',$3)
       RETURNING id,family_id,expires_at,revoked_at,version`,
      [ids.familyA, tokenHash(adminInvitationToken), ids.membershipAdminA],
    ),
  );
  assert.equal(adminInvitation.rows.length, 1, 'active admin can create an invitation');
  const revokedInvitation = await withActorTransaction(runtimePool, ids.adminA, (client) =>
    client.query(
      `UPDATE invitations SET revoked_at=clock_timestamp(),version=version+1
       WHERE id=$1 RETURNING id,revoked_at,version`,
      [adminInvitation.rows[0].id],
    ),
  );
  assert.equal(revokedInvitation.rows.length, 1, 'active admin can revoke an invitation');
  await mustFail(() =>
    withActorTransaction(runtimePool, ids.adminA, (client) =>
      client.query('SELECT token_hash FROM invitations WHERE id=$1', [adminInvitation.rows[0].id]),
    ),
  );
  await withActorTransaction(runtimePool, ids.memberA, async (client) => {
    await client.query('SELECT 1');
  });

  const invitationToken = `synthetic-invite-${randomUUID()}`;
  const invitationId = randomUUID();
  await owner.query(
    `INSERT INTO invitations(id,family_id,token_hash,expires_at,created_by)
     VALUES ($1,$2,$3,now()+interval '1 hour',$4)`,
    [invitationId, ids.familyA, tokenHash(invitationToken), ids.membershipAdminA],
  );
  const accepted = await withActorTransaction(runtimePool, ids.candidate, async (client) => {
    const result = await client.query('SELECT * FROM public.accept_invitation($1)', [
      tokenHash(invitationToken),
    ]);
    return result.rows;
  });
  assert.equal(accepted.length, 1);
  assert.match(accepted[0].membership_id, /^[0-9a-f-]{36}$/i);
  assert.equal(accepted[0].status, 'pending');
  const invitationState = await owner.query(
    'SELECT consumed_by,consumed_at FROM invitations WHERE id=$1',
    [invitationId],
  );
  assert.equal(invitationState.rows[0].consumed_by, ids.candidate);
  assert.ok(invitationState.rows[0].consumed_at);
  const acceptedRole = await owner.query('SELECT role,status FROM family_memberships WHERE id=$1', [
    accepted[0].membership_id,
  ]);
  assert.deepEqual(acceptedRole.rows, [{ role: 'member', status: 'pending' }]);
  await owner.query(`UPDATE family_memberships SET status='active',version=version+1 WHERE id=$1`, [
    accepted[0].membership_id,
  ]);
  for (const [membershipId, memberId] of [
    [ids.membershipPending, ids.extraMember],
    [ids.membershipRevoked, ids.extraMember],
  ]) {
    await mustFail(
      () =>
        withActorTransaction(runtimePool, ids.adminA, (client) =>
          client.query(
            `INSERT INTO member_claims(family_id,membership_id,member_id,expires_at,member_version,created_by)
           VALUES ($1,$2,$3,now()+interval '1 hour',1,$4)`,
            [ids.familyA, membershipId, memberId, ids.membershipAdminA],
          ),
        ),
      '42501',
    );
  }
  await owner.query(
    `INSERT INTO member_claims(id,family_id,membership_id,member_id,expires_at,member_version,created_by)
     VALUES ($1,$5,$2,$3,now()+interval '1 hour',1,$4)`,
    [ids.claimValid, accepted[0].membership_id, ids.memberB, ids.membershipAdminA, ids.familyA],
  );
  const candidateClaims = await withActorTransaction(runtimePool, ids.candidate, (client) =>
    client.query('SELECT id FROM member_claims ORDER BY id'),
  );
  assert.deepEqual(
    candidateClaims.rows.map((row) => row.id),
    [ids.claimValid],
    'only active candidate claims are visible',
  );
  const validPreview = await withActorTransaction(runtimePool, ids.candidate, async (client) => {
    await client.query("SELECT set_config('app.purpose','claim_preview',true)");
    await client.query("SELECT set_config('app.claim_id',$1,true)", [ids.claimValid]);
    return (
      await client.query('SELECT value,visibility FROM member_contacts WHERE member_id=$1', [
        ids.memberB,
      ])
    ).rows;
  });
  assert.deepEqual(validPreview, [{ value: 'self-unlinked-a', visibility: 'self' }]);
  await mustFail(() =>
    withActorTransaction(runtimePool, ids.adminA, (client) =>
      client.query(
        `INSERT INTO member_claims(family_id,membership_id,member_id,expires_at,member_version,created_by)
         VALUES ($1,$2,$3,now()+interval '1 hour',1,$4)`,
        [ids.familyA, accepted[0].membership_id, ids.linkedMemberA, ids.membershipAdminA],
      ),
    ),
  );
  await mustFail(() =>
    withActorTransaction(runtimePool, ids.adminA, (client) =>
      client.query(
        `INSERT INTO member_claims(family_id,membership_id,member_id,expires_at,member_version,created_by)
         VALUES ($1,$2,$3,now()+interval '1 hour',1,$4)`,
        [ids.familyA, accepted[0].membership_id, ids.extraMember, ids.membershipMemberA],
      ),
    ),
  );
  await mustFail(() =>
    withActorTransaction(runtimePool, ids.candidate, (client) =>
      client.query(
        `INSERT INTO member_account_links(family_id,membership_id,member_id)
         VALUES ($1,$2,$3)`,
        [ids.familyA, ids.membershipMemberA, ids.memberB],
      ),
    ),
  );
  await withActorTransaction(runtimePool, ids.candidate, async (client) => {
    await client.query("SELECT set_config('app.purpose','claim_confirm',true)");
    await client.query("SELECT set_config('app.claim_id',$1,true)", [ids.claimValid]);
    const claimState = await client.query(
      `SELECT status,expires_at > clock_timestamp() AS fresh,
              EXISTS (SELECT 1 FROM family_memberships m
                      WHERE m.id=membership_id AND m.family_id=member_claims.family_id
                        AND m.user_id=public.actor_uuid() AND m.status='active') AS candidate_active
         FROM member_claims WHERE id=$1`,
      [ids.claimValid],
    );
    assert.deepEqual(claimState.rows, [{ status: 'active', fresh: true, candidate_active: true }]);
    await client.query(
      `INSERT INTO member_account_links(family_id,membership_id,member_id)
       VALUES ($1,$2,$3)`,
      [ids.familyA, accepted[0].membership_id, ids.memberB],
    );
    await client.query(
      `UPDATE member_claims SET status='consumed',version=version+1,updated_at=clock_timestamp()
       WHERE id=$1`,
      [ids.claimValid],
    );
  });
  const createdClaim = await withActorTransaction(runtimePool, ids.adminA, (client) =>
    client.query(
      `INSERT INTO member_claims(family_id,membership_id,member_id,expires_at,member_version,created_by)
       VALUES ($1,$2,$3,now()+interval '1 hour',1,$4)
       RETURNING id,member_version`,
      [ids.familyA, accepted[0].membership_id, ids.staleMember, ids.membershipAdminA],
    ),
  );
  assert.equal(createdClaim.rows[0].member_version, 1);
  ids.claimStale = createdClaim.rows[0].id;
  await owner.query('UPDATE members SET version=version+1 WHERE id=$1', [ids.staleMember]);
  const stalePreview = await withActorTransaction(runtimePool, ids.candidate, async (client) => {
    await client.query("SELECT set_config('app.purpose','claim_preview',true)");
    await client.query("SELECT set_config('app.claim_id',$1,true)", [ids.claimStale]);
    return (
      await client.query('SELECT value FROM member_contacts WHERE member_id=$1', [ids.staleMember])
    ).rows;
  });
  assert.deepEqual(stalePreview, [], 'stale claims cannot preview contacts');
  await mustFail(
    () =>
      withActorTransaction(runtimePool, ids.candidate, async (client) => {
        await client.query("SELECT set_config('app.purpose','claim_confirm',true)");
        await client.query("SELECT set_config('app.claim_id',$1,true)", [ids.claimStale]);
        await client.query(
          `INSERT INTO member_account_links(family_id,membership_id,member_id)
           VALUES ($1,$2,$3)`,
          [ids.familyA, accepted[0].membership_id, ids.staleMember],
        );
      }),
    '42501',
  );
  const staleUpdate = await withActorTransaction(runtimePool, ids.candidate, (client) =>
    client.query(
      `UPDATE member_claims SET status='consumed',version=version+1,updated_at=clock_timestamp()
       WHERE id=$1 RETURNING id`,
      [ids.claimStale],
    ),
  );
  assert.equal(staleUpdate.rowCount, 0, 'stale claims cannot be updated');
  await owner.query(
    `UPDATE member_claims SET status='declined',version=version+1,updated_at=clock_timestamp()
     WHERE id=$1`,
    [ids.claimStale],
  );
  await owner.query(
    `INSERT INTO member_claims(id,family_id,membership_id,member_id,expires_at,member_version,created_by)
     VALUES ($1,$5,$2,$3,now()-interval '1 hour',1,$4)`,
    [
      ids.claimExpired,
      accepted[0].membership_id,
      ids.extraMember,
      ids.membershipAdminA,
      ids.familyA,
    ],
  );
  const expiredPreview = await withActorTransaction(runtimePool, ids.candidate, async (client) => {
    await client.query("SELECT set_config('app.purpose','claim_preview',true)");
    await client.query("SELECT set_config('app.claim_id',$1,true)", [ids.claimExpired]);
    return (
      await client.query('SELECT value FROM member_contacts WHERE member_id=$1', [ids.extraMember])
    ).rows;
  });
  assert.deepEqual(expiredPreview, [], 'expired claims cannot preview contacts');
  const expiredUpdate = await withActorTransaction(runtimePool, ids.candidate, (client) =>
    client.query(
      `UPDATE member_claims SET status='consumed',version=version+1,updated_at=clock_timestamp()
       WHERE id=$1 RETURNING id`,
      [ids.claimExpired],
    ),
  );
  assert.equal(expiredUpdate.rowCount, 0, 'expired claims cannot be updated');
  const adminAudit = await withActorTransaction(runtimePool, ids.adminA, (client) =>
    client.query(
      'SELECT action,target_type,target_id,change_summary FROM audit_entries WHERE family_id=$1 ORDER BY occurred_at',
      [ids.familyA],
    ),
  );
  assert.ok(adminAudit.rows.some((row) => row.action === 'membership.invitation_accepted'));
  const candidateAudit = await withActorTransaction(runtimePool, ids.candidate, (client) =>
    client.query('SELECT id FROM audit_entries WHERE family_id=$1', [ids.familyA]),
  );
  assert.deepEqual(candidateAudit.rows, [], 'non-admin members cannot read family audit');

  const conflictToken = `synthetic-conflict-${randomUUID()}`;
  const conflictInvitationId = randomUUID();
  await owner.query(
    `INSERT INTO invitations(id,family_id,token_hash,expires_at,created_by)
     VALUES ($1,$2,$3,now()+interval '1 hour',$4)`,
    [conflictInvitationId, ids.familyA, tokenHash(conflictToken), ids.membershipAdminA],
  );
  await mustReject(() =>
    withActorTransaction(runtimePool, ids.candidate, (client) =>
      client.query('SELECT * FROM public.accept_invitation($1)', [tokenHash(conflictToken)]),
    ),
  );
  const conflictState = await owner.query('SELECT consumed_at FROM invitations WHERE id=$1', [
    conflictInvitationId,
  ]);
  assert.equal(
    conflictState.rows[0].consumed_at,
    null,
    'existing membership conflict preserves invitation',
  );

  const concurrentToken = `synthetic-concurrent-${randomUUID()}`;
  const concurrentInvitationId = randomUUID();
  await owner.query(
    `INSERT INTO invitations(id,family_id,token_hash,expires_at,created_by)
     VALUES ($1,$2,$3,now()+interval '1 hour',$4)`,
    [concurrentInvitationId, ids.familyA, tokenHash(concurrentToken), ids.membershipAdminA],
  );
  const concurrentResults = await Promise.allSettled([
    withActorTransaction(runtimePool, ids.userB, (client) =>
      client.query('SELECT * FROM public.accept_invitation($1)', [tokenHash(concurrentToken)]),
    ),
    withActorTransaction(secondRuntimePool, ids.userB, (client) =>
      client.query('SELECT * FROM public.accept_invitation($1)', [tokenHash(concurrentToken)]),
    ),
  ]);
  assert.equal(concurrentResults.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(concurrentResults.filter((result) => result.status === 'rejected').length, 1);
  const concurrentState = await owner.query(
    'SELECT consumed_by,consumed_at FROM invitations WHERE id=$1',
    [concurrentInvitationId],
  );
  assert.equal(concurrentState.rows[0].consumed_by, ids.userB);
  assert.ok(concurrentState.rows[0].consumed_at);

  let rolledBackMember;
  await assert.rejects(
    () =>
      withActorTransaction(runtimePool, ids.adminA, async (client) => {
        const inserted = await client.query(
          'INSERT INTO members(family_id,display_name) VALUES ($1,$2) RETURNING id',
          [ids.familyA, 'Synthetic rolled back member'],
        );
        rolledBackMember = inserted.rows[0].id;
        throw new Error('synthetic rollback');
      }),
    /synthetic rollback/,
  );
  const rolledBackState = await owner.query('SELECT 1 FROM members WHERE id=$1', [
    rolledBackMember,
  ]);
  assert.equal(rolledBackState.rowCount, 0, 'failed actor transaction rolls back writes');

  const contextAfterFailure = await withActorTransaction(runtimePool, ids.memberA, (client) =>
    client.query("SELECT current_setting('app.actor_id') AS actor"),
  );
  assert.equal(contextAfterFailure.rows[0].actor, ids.memberA);
  await withActorTransaction(secondRuntimePool, ids.adminA, (client) => client.query('SELECT 1'));

  console.log(
    'PASS: tenant RLS, actor transaction context, invitation acceptance and role isolation passed.',
  );
} finally {
  await runtimePool.end();
  await secondRuntimePool.end();
  await cleanup().catch(() => undefined);
  await owner.end();
}
