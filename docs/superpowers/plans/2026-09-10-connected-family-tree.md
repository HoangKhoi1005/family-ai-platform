# Connected Family Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the connected app's directory-only Gia phả destination with an approved relationship graph, member profile access, relationship proposals, and mobile admin decisions backed by the existing API.

**Architecture:** A pure web model converts `RelationshipGraphResponse` into deterministic generation rows and labels without inferring Vietnamese kinship from names. A connected tree component owns graph/profile/proposal network state while the existing directory remains an equivalent view. Relationship review is isolated inside the existing admin destination. The later pan/pinch renderer can consume the same model and contracts.

**Tech Stack:** TypeScript, React 19, Next.js App Router, CSS Modules, shared `@family/contracts`, Vitest, Playwright.

**Spec:** `specs/family-tree/README.md` and `docs/superpowers/specs/2026-09-10-family-relationship-backend-design.md`

## Global Constraints

- Mobile is the primary experience; desktop expands the same information architecture.
- Graph data contains only approved relationships and member summaries. Contacts require the existing profile endpoint.
- Pending proposals never render as canonical edges.
- Directory and profile links remain usable without drag or zoom.
- Relationship labels come from explicit edge direction and subtype; the UI never infers kinship or gender from a name.
- A drag interaction is not introduced in this slice. Graph pan/pinch and saved layout remain package D.

---

### Task 1: Deterministic connected graph model

**Files:**

- Create: `apps/web/app/_connected/relationship-tree-model.ts`
- Create: `apps/web/app/_connected/relationship-tree-model.test.ts`
- Modify: `apps/web/app/_connected/types.ts`

**Interfaces:**

- Consumes: `RelationshipGraphResponse`, `RelationshipDto`, and `MemberSummaryDto` from `@family/contracts`.
- Produces: `buildTreeRows(graph)`, `connectionsFor(graph, memberId)`, `relationshipProposal(selectedId, targetId, kind, subtype)`.

- [x] **Step 1: Write failing tests.** Cover parent above child, partner on the same level, adoptive labels, deterministic order, disconnected fallback, and proposal direction for parent/child/partner.
- [x] **Step 2: Run the focused Vitest file and confirm failure because the model does not exist.** Run `npm test -- apps/web/app/_connected/relationship-tree-model.test.ts`.
- [x] **Step 3: Implement the minimal pure model.** Traverse only supplied graph nodes/edges, anchor the root at level zero, use explicit edge direction, and return stable rows without mutating the API response.
- [x] **Step 4: Re-run the focused tests and refactor only after green.**
- [x] **Step 5: Commit as `feat(web): model connected family relationships` after the repository diff is clean.**

### Task 2: Connected tree, directory fallback, profile and proposal

**Files:**

- Create: `apps/web/app/_connected/relationship-tree.tsx`
- Create: `apps/web/app/_connected/relationship-tree.module.css`
- Modify: `apps/web/app/_connected/family-app.tsx`
- Modify: `tests/e2e/connected-mobile-experience.spec.ts`

**Interfaces:**

- Consumes: `base`, `rootMemberId`, `members`, and the existing `request`/`explain` helper.
- Produces: a Gia phả destination with `Sơ đồ` and `Danh bạ` views, profile disclosure, and a create-only relationship proposal flow.

- [x] **Step 1: Add a failing Playwright scenario.** Mock `GET /relationships`, open Gia phả, assert the graph root and an approved edge appear, open a node profile, switch to directory, and submit a relationship proposal with the expected payload.
- [x] **Step 2: Run only that Playwright test and confirm the connected app still shows the old directory message.**
- [x] **Step 3: Implement graph loading and required states.** Show loading, retryable network error, one-person guidance, revoked access propagation, bounded three-level rows, and a truthful message when no linked profile exists.
- [x] **Step 4: Implement profile and directory views.** Fetch the selected member through `/members/:id`; keep contact visibility server-controlled and keep accent-insensitive search.
- [x] **Step 5: Implement the proposal review sheet.** Choose parent, child, or partner; choose an existing member; choose the explicit subtype; show the resulting direction in Vietnamese; POST `relationship_create`; show server-confirmed pending status.
- [x] **Step 6: Run the focused Playwright scenario at 390×844 and the connected unit tests.** Confirm no horizontal document overflow and 44px controls.
- [x] **Step 7: Commit as `feat(web): connect family tree to approved graph` after focused checks pass.**

### Task 3: Mobile relationship approval in Quản trị

**Files:**

- Create: `apps/web/app/_connected/relationship-admin.tsx`
- Modify: `apps/web/app/_connected/admin-panel.tsx`
- Modify: `apps/web/app/_connected/types.ts`
- Modify: `tests/e2e/connected-mobile-experience.spec.ts`

**Interfaces:**

- Consumes: `RelationshipChangeRequestListResponse`, member summaries, `/change-requests`, and `/change-requests/:id/decision`.
- Produces: pending proposal rows with resolved member names and approve/reject actions using the request version.

- [x] **Step 1: Add a failing admin Playwright scenario.** Mock one pending create request, assert both member names and subtype are readable, approve it, and verify the exact decision payload.
- [x] **Step 2: Run the focused scenario and confirm failure because relationship review is absent.**
- [x] **Step 3: Implement independent loading, empty, conflict, and decision states.** Do not hide membership administration if relationship loading fails.
- [x] **Step 4: Refresh the pending list after a successful decision and expose one callback so the tree reloads the next time it opens.**
- [x] **Step 5: Re-run focused browser tests and commit as `feat(web): review family relationship proposals` after green.**

### Task 4: Regression, documentation and branch gate

**Files:**

- Modify: `CURRENT_STATE.md`
- Modify: `docs/11_API_CONTRACTS.md`
- Modify: `specs/family-tree/README.md`
- Modify: `tests/e2e/connected-mobile-experience.spec.ts`

**Interfaces:**

- Consumes: all deliverables from Tasks 1–3.
- Produces: current implementation truth and release evidence for the feature branch.

- [x] **Step 1: Add revoked/offline/empty graph regression coverage where it exercises distinct product behavior.**
- [x] **Step 2: Run `npm run check`, `npm run test:auth`, and `npm run test:e2e`.** Record actual counts only from the final code.
- [x] **Step 3: Run the connected flow against local PostgreSQL/Mailpit when fixtures can create an approved relationship; otherwise state the exact remaining integration gap without inventing evidence.**
- [x] **Step 4: Inspect the live UI at 390×844 and 1280×900, including long Vietnamese names, missing photos, one-person tree, pending status and admin decisions.**
- [x] **Step 5: Update Project Brain with implemented behavior, verification evidence, and the remaining pan/pinch renderer work.** Run `python scripts/validate_brain.py`.
- [ ] **Step 6: Use the finishing-development-branch workflow. Push/create a PR only after the user-authorized integration action and fresh green verification.**
