# Membership and profile backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the backend of invitation, approval, claim consent and member profile editing with tested family isolation.

**Architecture:** Fastify resolves the verified actor through the authentication foundation. Domain operations use PostgreSQL runtime transactions with transaction-local actor context and RLS; public callers never receive a database connection. Narrow database helpers solve membership-policy recursion and accepting a secret invitation before membership exists. API transactions remain the trusted business-mutation boundary for audit and version checks.

**Tech Stack:** Existing TypeScript, Fastify, pg/PostgreSQL, Better Auth, Vitest integration.

**Spec:** [Membership/profile design](../specs/2026-09-08-membership-profile.md), [Privacy](../../10_PRIVACY_SECURITY.md), [Domain](../../06_DOMAIN_MODEL.md).

## Global Constraints

- Pilot 15 people. Synthetic fixtures only; no real invitations or personal data.
- User differs from Member. Client actor/role/family headers are never authoritative.
- Runtime/auth roles remain NOSUPERUSER NOBYPASSRLS, not table owners. Never use owner URL in HTTP server.
- Pending/revoked cannot read family data. Admin cannot read another linked person's self contact.
- Only the designated active candidate may preview an unlinked claim target through the dedicated claim route; no private value in general search/list/export/audit.
- Every family child FK includes family_id. No edits to applied migrations0001/0002/0003.
- Email verification is authentication, never family approval. No public bootstrap or self-admin endpoint.
- One Luna xhigh implementer at a time; reviewer independent; no child agents.
- Business UI remains behind owner visual approval; no chat/calendar/moments/AI feature expansion.

## Task 1: Tenant schema, runtime transactions and local bootstrap

**Files:**

- Create `packages/database/migrations/0004_onboarding.sql`.
- Create `packages/database/src/tenant.ts`, export from `packages/database/src/index.ts`.
- Create `packages/database/scripts/bootstrap-family.mjs`, `packages/database/scripts/test-tenant.mjs`.
- Modify root `package.json`, `docs/DEVELOPMENT.md`, `packages/database/package.json` only if new export requires it.

**Interfaces:**

- `withActorTransaction<T>(pool: Pool, actorId: string, operation: (client: PoolClient) => Promise<T>): Promise<T>` sets `app.actor_id` LOCAL via parameterized `set_config`, commits/rolls back, releases client in finally. Missing/invalid UUID rejected before queries.
- `family_memberships.version` positive integer default1; member columns familiar_name/hometown/biography nullable within spec lengths.
- New `invitations`: id, family_id, token_hash unique, intended_member_id optional, expires_at, consumed_by optional User FK, consumed_at, revoked_at, created_by same-family membership, created_at/version. New `member_claims` and `audit_entries` exactly as spec; audit has no payload private values. Claim uniqueness includes status active; expired active claims explicitly expire before replacements.
- Runtime SELECT policies: own membership status always visible to actor for me endpoint; active member can read family/members/linked identities within house; admin active can read membership queue; contacts family or own linked member only. Unlinked admin management/claim-preview is routed through dedicated checked operations, not a blanket normal-profile self-contact policy.
- Membership queue may include candidate's chosen account name and UUID, never their login email as a substitute for private profile contact. If runtime needs global users lookup, grant only SELECT(id,name), with a policy for self or exact candidate in the admin's family; never grant SELECT on password/account/session fields or auth email columns.
- Helper owner NOLOGIN BYPASSRLS has only narrow SELECT on membership/links/claims, no login/member grant to runtime, no auth/contact-value privileges. Functions return booleans, derive actor from local GUC, have fixed search_path and PUBLIC execute revoked. They cannot take an arbitrary actor argument that bypasses current actor.
- Invitation acceptance before membership uses one narrowly scoped SQL function, granted EXECUTE to runtime, that validates passed SHA256 token and actor, locks row, inserts pending membership and consumes invite atomically; return only membership id/status, no family content. Its dedicated NOLOGIN owner gets only required invitation/membership CRUD and minimal audit insert. It cannot call arbitrary SQL or choose role/user from request body.

- [ ] **Step 1: RED real-role tests.** Seed two families with active/pending/revoked users, one user in both, members/contacts self+family and existing account links. Assert seeded visibility as owner before runtime checks. Query through actual RUNTIME_DATABASE_URL with actor-local context, assert same-family reads, no cross-family reads, no self contact leakage to admin, no role switch to helper owner, no auth-account read, rollback and pooled context isolation. Initial missing withActorTransaction/policies expected to fail.

```ts
export async function withActorTransaction<T>(
  pool: Pool,
  actorId: string,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

Add UUID validation and do not mask original failure if rollback fails; discard broken client. Test real pool reuse after successful and failed transactions.

- [ ] **Step 2: Migration and bootstrap.** Add grants/policies consistent with matrix. Bootstrap takes `--user-id` existing verified User UUID, `--family-id` explicit UUID and `--name` nonempty family name, checks APP_ENV local and owner loopback, creates house/admin/audit transaction; never accepts a password, sets email_verified, or registers a public route. Reject repeat bootstrap for the same explicit family UUID rather than creating duplicates accidentally. Preserve existing synthetic fixtures and migrations. API code uses runtime only; bootstrap owner is CLI-only.

- [ ] **Step 3: GREEN.** Run migration twice, baseline DB tests, auth-schema tests and new tenant tests. Verify helper role cannot be assumed and user context does not leak after rollback. Report SQL role/grant checks and commit via supervisor `feat(database): enforce tenant membership and contact isolation` after review.

## Task 2: Invitation, admin and claim endpoints

### Reviewed SQL and mutation contracts

- The acceptance routine also has fixed `search_path`, fully qualified identifiers, PUBLIC EXECUTE revoked and EXECUTE granted only to `family_runtime`. Derive actor from transaction-local `app.actor_id`, never an arbitrary actor argument. The same security attributes apply to every bypass helper without exception.
- `member_claims.version` is positive integer default1, incremented on consumed/declined/revoked/expired transitions; `member_version` remains the original Member snapshot. Preview returns both; confirmation compares both under locks. An elapsed expires_at denies immediately even before a cleanup transition records expired.

- Membership predicates are explicitly `SECURITY DEFINER`, owned by the dedicated NOLOGIN BYPASSRLS lookup role, with fixed `search_path`, qualified tables and revoked PUBLIC EXECUTE. Runtime cannot assume either helper role. Predicates return only booleans for the current transaction actor.
- Invitation acceptance is `SECURITY DEFINER`, owned by a separate NOLOGIN BYPASSRLS role with only required table privileges. Discover family from token without locking, acquire the family advisory lock, then lock and revalidate the invitation. Never lock invitation before family. Always insert `role='member', status='pending'`; no client-controlled role. Existing pending/active/revoked membership yields generic409 without changing either membership or consuming invitation. Approval never changes role.
- Runtime DML is granted only where needed: invitations INSERT/UPDATE for active admin; memberships UPDATE(status,version) for active admin; claims INSERT/UPDATE for active admin or designated candidate as appropriate; members INSERT for admin and UPDATE of profile/version fields for linked owner or admin-unlinked; contacts INSERT/UPDATE/DELETE for linked owner or admin-unlinked; account links INSERT only for the current actor's authorized active claim. No runtime DELETE on memberships, members, claims, invitations or account links; no runtime UPDATE of identity/family/role columns. Use command-specific USING/WITH CHECK predicates and column grants, including same-family checks. Narrow acceptance routine handles pre-membership INSERT. Task1 must implement these grants/policies before Task2 consumers.
- Audit runtime access is INSERT and active-admin SELECT only, never UPDATE/DELETE. INSERT checks current actor, active membership and matching family; the acceptance routine handles pending-entry audit. API transactions remain trusted for truthful action/target/version and atomic pairing with writes; RLS cannot prove an audit describes a real operation. Test wrong actor/family and unauthorized DML directly, and test audit truth/rollback through API. Do not claim resistance to a fully compromised runtime connection setting arbitrary actor GUCs.
- Claim confirmation DTO is `{version, member_version, accept_ownership: true, contact_visibilities?: [{id, visibility: 'self'|'family'}]}`. Both versions must match the reviewed snapshot; IDs must belong to the exact target, with no duplicates. Omitted visibility preserves current value; changing to family requires an explicit entry. Apply visibility edits, increment Member version if changed, create link, consume claim and audit in one transaction.
- Claim-preview contact predicate requires purpose fixed by server, exact claim ID, current actor's active candidate membership in same family, active unexpired claim, exact target Member, unlinked target and matching member version. A stale snapshot returns409 without private payload; admin must replace stale authorization. Purpose alone grants nothing.
- Add real concurrent accept-versus-revoke test, existing-membership tests for all three states, attempted role injection/promotion tests, fabricated audit actor/family tests and stale claim-preview/visibility consent tests. Concurrent operations must terminate with consistent committed state rather than hang in opposing lock order.

**Files:**

- Create `apps/api/src/family/routes.ts`, `authorization.ts`, `invitations.ts`, `memberships.ts`, `claims.ts`, `audit.ts`.
- Modify `apps/api/src/app.ts`, `server.ts`, `auth/session.ts`, `packages/contracts/src/index.ts` (or focused `onboarding.ts` exported there), `apps/api/package.json` for internal package wiring only.
- Create `apps/api/tests/membership.integration.test.ts`.

**Interfaces:**

- `registerFamilyRoutes(app, { auth, runtimePool, webOrigin })` uses existing verified-session guard; exact TypeScript types derived from implemented auth factory.
- `requireFamily(client, actorId, familyId): Promise<{id:string; role:'admin'|'member'}>` resolves active membership through runtime;404 absent/inactive/out-of-scope,403 admin-only operation for known active member.
- Family routes: POST `/invitations`, POST `/invitations/{id}/revoke`, GET `/memberships`, POST `/memberships/{id}/approve`, POST `/memberships/{id}/revoke`, POST `/member-claims`, GET `/member-claims/{id}/preview`, POST `/member-claims/{id}/confirm`, POST `/member-claims/{id}/decline`, POST `/member-claims/{id}/revoke` under `/api/v1/families/{familyId}`.
- Global POST `/api/v1/invitations/accept` accepts `{token:string}` only. GET `/api/v1/me` now returns own membership summaries; pending/revoked summaries contain id/status only, not house name or Member/contact. Active summaries may include family_id/name and own role, not other-house data.
- JSON schemas additionalProperties false, UUID path validation, version positive integer for approval/revoke/claim confirm. Invite token <=256 chars; SHA256 compare stored hash, randomBytes32 at creation;7-day default and30-day max TTL. Return raw token only from create, never audit/log/list.
- Mutating custom routes require exact Origin=webOrigin and application/json; reject missing/foreign Origin with403. Rate-limit invitation accept/create and claims by verified actor at server boundary; allowlist no arbitrary forwarding headers. Reuse a bounded store for single local API instance and document multi-instance limitation, or database rate counters; no per-request unbounded Map keys.

- [ ] **Step 1: RED real HTTP tests.** Obtain real verified cookies with auth helper from preceding integration tests; no fake actor header bypass. Assert pending cannot list members, foreign Origin fails, expired/revoked/consumed invite unavailable, concurrent accept one winner, two admins approving one pending request one winner, member cannot admin, last-admin revoke blocked even two concurrent requests, revoked membership denied on next request with same cookie. Claims preview only candidate, no target-ID substitution, expired claim denied, concurrent confirm cannot duplicate link, self contact stays self by default, stale member version conflict409, post-link admin temporary access ends. Audit row exists once per success and none from rolled-back failure.

```ts
const results = await Promise.all(
  [cookieA, cookieB].map((cookie) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      headers: { cookie, origin: webOrigin, 'content-type': 'application/json' },
      payload: { token },
    }),
  ),
);
expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
const pendingCount = await owner.query(
  'SELECT count(*)::int AS n FROM family_memberships WHERE family_id=$1 AND status=$2',
  [familyId, 'pending'],
);
expect(pendingCount.rows[0].n).toBe(1);
```

Use independent clients for concurrent transaction tests, not one serial queue. Token invalid/historical failures use a consistent generic conflict response without leaking family.

- [ ] **Step 2: Implement transaction boundaries.** Lock order is family advisory lock → membership → claim/invite → Member → account links for operations touching those sets; consistent ordering across approve/revoke/claim/profile prevents deadlock. Accept SQL routine handles invite locking and memberships within same order where family is known. Revalidate actor and target after lock. Claim confirm sets link/consumed/audit atomically and checks claim version and member_version under locks; decline changes claim state only. Last-admin test counts current active admins inside same family lock. Responses are explicit DTOs and sanitized errors, no raw SQL or contact-bearing audit.

- [ ] **Step 3: GREEN and review.** Run focused membership integration plus tenant RLS tests, auth integration regression if guard changed, lint/typecheck. Inspect rate-limit/CSRF tests and concurrency committed state, then supervisor commit `feat(api): add private family invitations approval and profile claims`.

## Task 3: Directory, profile editing and backend integration gate

**Files:**

- Create `apps/api/src/family/members.ts`, `apps/api/tests/member-profile.integration.test.ts`.
- Modify family routes, contracts, CI integration command, `docs/07_DATABASE_SCHEMA.md`, `docs/11_API_CONTRACTS.md`, `CURRENT_STATE.md`.

**Interfaces:**

- GET `/members` supports q<=120, limit default20/max100, opaque cursor with stable display_name/id sort; only display/familiar names searched, Vietnamese accent-fold preserving originals. GET `/members/{id}` includes only contact values permitted for actor.
- Read date-only fields as `birth_date::text` in DTO queries so pg/JS timezone conversion cannot shift birthday dates. Accent-fold search may use PostgreSQL `unaccent` installed by owner migration, verified against official PostgreSQL docs; keep plain indexed family/name ordering and parameterized literal substring queries. At pilot size, no separate search service or full-text infrastructure.
- GET `/members/{id}/management` is a dedicated admin-active/unlinked-only view for temporary contact management. Normal profile route never opens another person's self contact. Inside the checked transaction, server may set static `app.purpose='member_management'`; RLS additionally verifies admin active and target unlinked. Claim preview similarly uses fixed `app.purpose='claim_preview'` plus exact authorized claim id; neither purpose value is accepted from client input.
- PATCH `/members/{id}` accepts version and allowed profile fields plus contact replacements up to10; owner linked or admin unlinked policy only. No family_id/member_id/user_id/relationship mutation. Check date/year consistency, lengths, safe contact URL schemes and typed visibility. POST `/members` admin-only creates unlinked person with audit; no User requirement. Contact default self.
- Contact parsing returns normalized safe call/email/FB values but never claims verified identity; no fetched external profile or media upload in scope.

- [ ] **Step 1: RED tests.** Create deceased/child member without User; duplicate names remain distinct; accentless query finds accented name without changing stored name; unknown-year-only stays null date. Test owner edit, other active user denied, linked admin denied self contact read/edit, unlinked admin allowed only management path; q never matches private contact. Old version409 preserves newest row; malformed URL/script/date/role field400; foreign ID404; revoked same cookie denied. Test pagination no duplicates and invalid cursor400.

```ts
const denied = await app.inject({
  method: 'GET',
  url: `/api/v1/families/${familyId}/members/${privateMemberId}`,
  headers: { cookie: otherCookie },
});
expect(denied.body).not.toContain('private-contact-value');
const stale = await app.inject({
  method: 'PATCH',
  url: profilePath,
  headers: { cookie: ownerCookie, origin: webOrigin },
  payload: { version: 1, display_name: 'Tên cũ' },
});
expect(stale.statusCode).toBe(409);
const current = await app.inject({
  method: 'GET',
  url: profilePath,
  headers: { cookie: ownerCookie },
});
expect(current.json().display_name).toBe('Tên mới');
```

- [ ] **Step 2: Implement and integrate.** Validate DTO before transaction, lock/version check inside transaction, filtered readback before response. Parent Member version increments when contacts change so claim consent stale checks cover private fields too. Query only allowed columns, no SELECT* serialization. Extend API/schema docs distinguishing implemented routes from future design. Add CI integration tests and user-facing local bootstrap/run instructions.

- [ ] **Step 3: Backend gate.** Run auth, tenant, invitation, claim and profile integration plus `npm run check`, existing E2E preview/home and migration replay. Capture updated test counts and unresolved device/UI approval limits. Final independent backend review covers entire branch (including authentication), then supervisor commits `feat(api): add permission-aware family directory and profiles`. Push feature branch only after gates pass; no merge/deploy. Browser onboarding E2E waits until owner-approved business UI is implemented; do not claim full onboarding complete from backend tests alone.
