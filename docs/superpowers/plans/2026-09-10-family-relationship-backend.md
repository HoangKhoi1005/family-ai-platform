# Family Relationship Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tenant-isolated relationship graph and audited relationship change-request lifecycle for the family pilot.

**Architecture:** PostgreSQL stores only approved relationships in `relationships` and pending work in `change_requests`. Fastify services normalize inputs and execute graph reads or approval transactions under the existing actor-scoped connection; the API publishes explicit DTOs from `@family/contracts`.

**Tech Stack:** TypeScript 5.9, Fastify 5, PostgreSQL 17, Vitest 5, npm workspaces/Turborepo

**Spec:** `docs/superpowers/specs/2026-09-10-family-relationship-backend-design.md`

## Global Constraints

- Preserve `family_id` and server-side tenant authorization on every table and query.
- `User` and `Member` remain distinct; relationships reference only `Member`.
- Pending relationships never appear in the approved graph.
- The LLM and graph layout never create or verify genealogy facts.
- Relationship approval uses the family advisory lock before cycle and duplicate checks.
- Add migration `0010`; never edit migrations `0001`–`0009`.
- Keep node summaries free of biography and contacts; cap graph reads at 100 nodes and depth 4.

---

### Task 1: Machine-readable relationship contracts

**Files:**

- Create: `packages/contracts/src/relationships.ts`
- Create: `packages/contracts/src/relationships.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Produces: `RelationshipDto`, `RelationshipGraphResponse`, `RelationshipChangeRequestDto`, `CreateRelationshipChangeRequestInput`, `RelationshipDecisionInput`, `relationshipGraphQuerySchema`, `createRelationshipChangeRequestBodySchema`, `relationshipDecisionBodySchema`, `relationshipVersionBodySchema`.
- Consumes: `MemberSummaryDto` from `packages/contracts/src/profile.ts`.

- [ ] **Step 1: Write failing contract tests.** Assert that graph query accepts UUID root and depth 1–4; create payload accepts the three parent-child subtypes and two partnership subtypes; update requires target/base version; remove rejects a payload; all schemas reject unknown keys and malformed dates.
- [ ] **Step 2: Run RED.** Run `npx vitest run packages/contracts/src/relationships.test.ts`; expect failure because `relationships.ts` and its exports do not exist.
- [ ] **Step 3: Add exact DTOs and JSON schemas.** Define discriminated TypeScript unions for create/update/remove, explicit nullable dates in DTOs, and `additionalProperties: false` at every object level.
- [ ] **Step 4: Run GREEN.** Run `npx vitest run packages/contracts/src/relationships.test.ts` and `npm run typecheck --workspace @family/contracts`; expect both to pass.
- [ ] **Step 5: Commit.** Commit the three files as `feat(contracts): define family relationship APIs`.

### Task 2: Tenant-isolated relationship schema

**Files:**

- Create: `packages/database/migrations/0010_relationships.sql`
- Create: `packages/database/scripts/test-relationships.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: `relationships` and `change_requests` tables, their RLS policies and narrow `family_runtime` grants.
- Consumes: `public.actor_uuid()`, `public.actor_active_member(uuid)` and `public.actor_active_admin(uuid)` from migration `0006`.

- [ ] **Step 1: Write the failing database test.** The script provisions two synthetic families and active/pending/revoked actors, then asserts table presence, same-family composite FKs, self-edge rejection, member read/admin decision visibility, and denial for pending/revoked/cross-family actors.
- [ ] **Step 2: Run RED.** Copy or point the worktree at the local test `.env`, then run migrations only through `0009` in a disposable database and run `node --env-file=.env packages/database/scripts/test-relationships.mjs`; expect missing relation `relationships`.
- [ ] **Step 3: Add migration `0010`.** Create both tables, checks, normalized partnership indexes, active duplicate indexes, lookup indexes, RLS policies and column-level grants. Use composite family FKs for both member endpoints, request actor, reviewer and target relationship.
- [ ] **Step 4: Extend the database test for history and concurrency prerequisites.** Verify an ended partnership permits a later active partnership; direct cross-family endpoints fail; ordinary members cannot update requests into approved state; runtime cannot delete relationships.
- [ ] **Step 5: Run GREEN.** Run `npm run db:migrate`, `npm run test:relationships`, `npm run test:tenant` and `npm run db:status`; expect all to pass and migration status to include `0010_relationships.sql`.
- [ ] **Step 6: Commit.** Commit as `feat(database): add audited family relationships`.

### Task 3: Bounded approved-graph reader

**Files:**

- Create: `apps/api/src/family/relationships.ts`
- Create: `apps/api/src/family/relationships.test.ts`
- Modify: `apps/api/src/family/routes.ts`

**Interfaces:**

- Produces: `getRelationshipGraph(client, { familyId, rootMemberId, depth }): Promise<RelationshipGraphResponse>` and the GET `/relationships` route.
- Consumes: Task 1 DTOs, Task 2 tables, existing `requireFamily`, `assertUuid`, `withActorTransaction` and family error mapping.

- [ ] **Step 1: Write failing service tests.** Use a recording PoolClient to assert root/family/depth parameters, stable DTO mapping, no contact columns, and explicit `GRAPH_TOO_LARGE` when the node query returns 101 rows.
- [ ] **Step 2: Run RED.** Run `npx vitest run apps/api/src/family/relationships.test.ts`; expect failure because the service does not exist.
- [ ] **Step 3: Implement the graph reader.** Validate depth 1–4, verify the root within `family_id`, use a recursive CTE that traverses active edges in both directions with path-cycle protection, group by minimum distance, and fetch only edges whose endpoints are in the returned node set.
- [ ] **Step 4: Register the GET route.** Parse with `relationshipGraphQuerySchema`, require a verified active actor, run inside `withActorTransaction`, and return sanitized family errors.
- [ ] **Step 5: Run GREEN.** Run the focused service test, `npm run typecheck --workspace @family/api`, then the existing API unit suite.
- [ ] **Step 6: Commit.** Commit as `feat(api): expose bounded family relationship graph`.

### Task 4: Relationship proposal and approval lifecycle

**Files:**

- Create: `apps/api/src/family/change-requests.ts`
- Create: `apps/api/src/family/change-requests.test.ts`
- Modify: `apps/api/src/family/audit.ts`
- Modify: `apps/api/src/family/routes.ts`

**Interfaces:**

- Produces: `createRelationshipChangeRequest`, `listPendingRelationshipChangeRequests`, `decideRelationshipChangeRequest`, `cancelRelationshipChangeRequest` and four route handlers.
- Consumes: Task 1 normalized unions, Task 2 schema, `lockFamily`, `requireFamily`, `writeAudit` and the graph-compatible DTO mapper from Task 3.

- [ ] **Step 1: Write failing normalization tests.** Assert partnership endpoint normalization, parent-child direction preservation, date ordering, subtype/type compatibility and update/remove target requirements.
- [ ] **Step 2: Run RED.** Run `npx vitest run apps/api/src/family/change-requests.test.ts`; expect failure because the service does not exist.
- [ ] **Step 3: Implement create/list/cancel.** Resolve the actor membership server-side, validate both members or target inside the family, preflight duplicate/cycle checks, insert normalized pending payload, list pending requests for admins, and cancel only the requester’s pending request with matching version.
- [ ] **Step 4: Implement decisions.** Require admin, acquire the family lock, select the request and target `FOR UPDATE`, revalidate versions and business rules, apply create/update/remove, mark the request once, and write relationship/request audit entries in the same transaction.
- [ ] **Step 5: Register mutation routes.** Add same-origin JSON checks, unknown-key guards, UUID schemas, per-actor bounded rate limiting, 201 for create and standard conflict mapping.
- [ ] **Step 6: Run GREEN.** Run the focused tests and API typecheck; expect all to pass.
- [ ] **Step 7: Commit.** Commit as `feat(api): add relationship approval workflow`.

### Task 5: Real-database business rules and documentation

**Files:**

- Create: `apps/api/tests/relationships.integration.test.ts`
- Modify: `vitest.integration.config.ts`
- Modify: `docs/07_DATABASE_SCHEMA.md`
- Modify: `docs/11_API_CONTRACTS.md`
- Modify: `specs/family-tree/README.md`
- Modify: `CURRENT_STATE.md`

**Interfaces:**

- Produces: executable evidence for TREE-01–06 and updated Project Brain state.
- Consumes: all previous tasks and the existing Better Auth/database integration fixture pattern.

- [ ] **Step 1: Write integration scenarios before finalizing behavior.** Cover unauthenticated/pending/revoked/cross-family reads, contact omission, depth limiting, create then approve and reload, reject/cancel, stale request and target versions, duplicate symmetric partnership, remarriage history, adoptive subtype and pending exclusion.
- [ ] **Step 2: Add the concurrent-cycle scenario.** Submit edges A→B and B→A, approve concurrently through two application instances/connections, and assert exactly one succeeds while the other returns 409 and the persisted graph remains acyclic.
- [ ] **Step 3: Run the integration suite.** Run `npm run test:auth`; fix production behavior until all relationship and existing auth/profile cases pass without weakening assertions.
- [ ] **Step 4: Update the documentation.** Mark the exact relationship routes as implemented, record schema/RLS/cycle behavior and remaining connected-tree UI work, and leave graph interaction/pan/zoom in gói D.
- [ ] **Step 5: Verify the repository.** Run `npm run check`, `npm run test:db`, `npm run test:auth` and `python scripts/validate_brain.py`; all must pass before completion is claimed.
- [ ] **Step 6: Commit.** Commit as `test(api): verify family relationship isolation`.
