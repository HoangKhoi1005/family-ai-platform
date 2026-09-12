# Tree Relationship Actions and Family Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver approved add/edit/remove/cancel relationship workflows from a tree node, including atomic creation of a new Member, and a deterministic layout that groups current partners and places children beneath their parent unit.

**Architecture:** Extend the existing `change_requests` workflow with a typed `member_create` payload and an actor-scoped list mode. Keep all writes behind server authorization and admin approval. Split the web wizard and pending-request list from the existing sheet, while the pure interactive-tree model owns partner-unit and child alignment.

**Tech Stack:** PostgreSQL migrations, Fastify, TypeScript contracts, React 19, Next.js 16, React Flow, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-tree-relationship-actions-and-layout-design.md`

## Global Constraints

- Mobile is the primary experience; the pilot remains 15 people.
- `User !== Member`; a new Member has no account link and no contacts by default.
- Every canonical Member and Relationship write is server-authorized and family-scoped.
- A new-person proposal creates Member and Relationship atomically only after admin approval.
- Pending requests never render as approved graph edges.
- Node positions and layout remain local and never mutate relationship truth.
- Use Vietnamese UTF-8 copy, design tokens, visible focus, and minimum 44px controls.
- Work inline in the existing `feat/interactive-family-tree` worktree to save context.

---

### Task 1: Member-create change-request contract and migration

**Files:**
- Create: `packages/database/migrations/0011_member_create_change_requests.sql`
- Modify: `packages/contracts/src/relationships.ts`
- Modify: `packages/contracts/src/relationships.test.ts`
- Modify: `packages/database/scripts/test-relationships.mjs`

**Interfaces:**
- Produces: `CreateMemberWithRelationshipPayload`, `MemberCreateChangeRequestInput`, and `scope: 'all' | 'mine'` query validation.
- Preserves: all existing relationship request DTO fields and route URLs.

- [ ] **Step 1: Write failing contract tests**

```ts
expect(await inject('/change-request', {
  type: 'member_create',
  payload: {
    member: { display_name: 'Trần Ngọc Hà', birth_year: 1990 },
    relationship: { anchor_member_id: idA, kind: 'child', subtype: 'biological' },
  },
})).toBe(200);
expect(await inject('/change-request', {
  type: 'member_create',
  payload: { member: { display_name: 'A', contacts: [] }, relationship: {} },
})).toBe(400);
```

- [ ] **Step 2: Run the contract tests and confirm RED**

Run: `npx vitest run packages/contracts/src/relationships.test.ts`
Expected: the valid `member_create` body is rejected.

- [ ] **Step 3: Add the typed schema and migration**

```ts
export interface CreateMemberWithRelationshipPayload {
  member: Pick<CreateMemberInput, 'display_name' | 'familiar_name' | 'hometown' | 'birth_year' | 'deceased'>;
  relationship: {
    anchor_member_id: string;
    kind: 'parent' | 'child' | 'partner';
    subtype: RelationshipSubtype;
  };
}
```

Migration `0011` must replace only the `change_requests` type/shape checks so `member_create` requires `target_id IS NULL`, `base_version IS NULL`, and object payload. Keep RLS and grants unchanged.

- [ ] **Step 4: Verify contract and migration checks**

Run: `npx vitest run packages/contracts/src/relationships.test.ts`
Run: `npm run test:database`
Expected: contract and database scripts pass, including the new type/shape case.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/relationships.ts packages/contracts/src/relationships.test.ts packages/database/migrations/0011_member_create_change_requests.sql packages/database/scripts/test-relationships.mjs
git commit -m "feat(family): define new-relative proposals"
```

### Task 2: Authorized creation, own-list, cancellation, and atomic approval

**Files:**
- Modify: `apps/api/src/family/change-requests.ts`
- Modify: `apps/api/src/family/routes.ts`
- Modify: `apps/api/tests/relationships.integration.test.ts`
- Modify: `apps/api/src/family/relationship-routes.test.ts`

**Interfaces:**
- Consumes: `CreateRelationshipChangeRequestInput` including `member_create`.
- Produces: `listPendingRelationshipChangeRequests(client, { familyId, actorId, scope })` where `scope='all'` requires admin and `scope='mine'` filters the actor membership.
- Approval creates an unlinked Member and one approved Relationship in the same transaction.

- [ ] **Step 1: Write failing integration tests**

```ts
it('creates a new relative only after atomic admin approval', async () => {
  const proposed = await member.post('/change-requests', memberCreateBody);
  expect(await graph()).not.toContainName('Trần Ngọc Hà');
  await admin.post(`/change-requests/${proposed.id}/decision`, { decision: 'approved', version: 1 });
  expect(await graph()).toContainName('Trần Ngọc Hà');
});
```

Add cases for cross-family anchors, `scope=mine` isolation, cancelling another actor's request, rejection, stale version, and a forced relationship-write failure leaving no Member row.

- [ ] **Step 2: Run integration tests and confirm RED**

Run: `npm run test:integration -- --run apps/api/tests/relationships.integration.test.ts`
Expected: `member_create` and `scope=mine` cases fail before implementation.

- [ ] **Step 3: Implement normalization, listing, and approval**

```ts
if (request.type === 'member_create') {
  const created = await createMember(client, { familyId, actorId, member: request.proposed_payload.member });
  const relationship = relationshipForNewMember(created.id, request.proposed_payload.relationship);
  return insertApprovedRelationship(client, familyId, relationship);
}
```

Resolve `anchor_member_id` inside the family at proposal time and approval time. Set `member_management` only for the Member insert and `relationship_decision` for the Relationship insert; keep both in the route transaction and family advisory lock.

- [ ] **Step 4: Run route and integration tests to confirm GREEN**

Run: `npx vitest run apps/api/src/family/relationship-routes.test.ts`
Run: `npm run test:integration -- --run apps/api/tests/relationships.integration.test.ts`
Expected: all relationship API tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/family/change-requests.ts apps/api/src/family/routes.ts apps/api/tests/relationships.integration.test.ts apps/api/src/family/relationship-routes.test.ts
git commit -m "feat(api): approve new relatives atomically"
```

### Task 3: Mobile proposal wizard and pending requests

**Files:**
- Create: `apps/web/app/_connected/relationship-proposal-wizard.tsx`
- Create: `apps/web/app/_connected/relationship-pending-list.tsx`
- Modify: `apps/web/app/_connected/relationship-tree.tsx`
- Modify: `apps/web/app/_connected/relationship-tree-model.ts`
- Modify: `apps/web/app/_connected/relationship-tree-model.test.ts`
- Modify: `apps/web/app/_connected/relationship-tree.module.css`
- Modify: `tests/e2e/connected-mobile-experience.spec.ts`

**Interfaces:**
- Produces: `RelationshipProposalWizard` with `selected`, `members`, `onSubmit`, and `onCancel` props.
- Produces: `RelationshipPendingList` using `GET ?status=pending&scope=mine` and the existing cancel endpoint.
- Preserves: existing profile sheet focus trap and directory fallback.

- [ ] **Step 1: Write failing browser tests**

```ts
await page.getByRole('button', { name: 'Thêm người thân cho Nguyễn Minh Anh' }).click();
await page.getByLabel('Quan hệ với Minh Anh').selectOption('child');
await page.getByRole('button', { name: 'Tiếp tục' }).click();
await page.getByLabel('Người mới').check();
await page.getByLabel('Họ và tên').fill('Trần Ngọc Hà');
await page.getByRole('button', { name: 'Xem lại đề xuất' }).click();
await expect(page.getByText('Nguyễn Minh Anh là cha / mẹ của Trần Ngọc Hà')).toBeVisible();
```

Add existing-person, cancel, edit, remove, long-name, keyboard-focus, and 320px no-overflow cases.

- [ ] **Step 2: Run targeted Playwright and confirm RED**

Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --grep "relative proposal|relationship edit|pending proposal" --project=mobile-chromium`
Expected: new controls are absent.

- [ ] **Step 3: Implement the three-stage wizard and request list**

```ts
type ProposalDraft =
  | { source: 'existing'; targetMemberId: string; choice: RelationshipProposalChoice }
  | { source: 'new'; member: ProposedMemberInput; choice: RelationshipProposalChoice };
```

Render one primary action in the member sheet, explicit Back/Continue controls, a review sentence generated by the pure model, and local error/status regions. Reload `scope=mine` after submit or cancel.

- [ ] **Step 4: Implement edit/remove proposal review**

Use the selected confirmed `RelationshipDto.id` and `version`. Send `relationship_update` with type-valid fields or `relationship_remove` with no payload. Keep the current approved edge visible until admin approval.

- [ ] **Step 5: Run model and browser tests to confirm GREEN**

Run: `npx vitest run apps/web/app/_connected/relationship-tree-model.test.ts`
Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --project=chromium --project=mobile-chromium`
Expected: model and connected browser suite pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/_connected/relationship-proposal-wizard.tsx apps/web/app/_connected/relationship-pending-list.tsx apps/web/app/_connected/relationship-tree.tsx apps/web/app/_connected/relationship-tree-model.ts apps/web/app/_connected/relationship-tree-model.test.ts apps/web/app/_connected/relationship-tree.module.css tests/e2e/connected-mobile-experience.spec.ts
git commit -m "feat(web): complete relationship proposal workflow"
```

### Task 4: Admin review detail and graph refresh

**Files:**
- Modify: `apps/web/app/_connected/relationship-admin.tsx`
- Modify: `apps/web/app/_connected/admin-panel.tsx`
- Modify: `apps/web/app/_connected/family-app.tsx`
- Modify: `tests/e2e/connected-mobile-experience.spec.ts`

**Interfaces:**
- Consumes: all `RelationshipChangeRequestDto` payload variants.
- Produces: resolved, type-specific review text and `onGraphChanged()` after approval.

- [ ] **Step 1: Write failing browser test**

```ts
await page.getByRole('button', { name: 'Duyệt thêm Trần Ngọc Hà' }).click();
await page.getByRole('button', { name: 'Người thân', exact: true }).click();
await expect(page.getByRole('button', { name: 'Mở hồ sơ Trần Ngọc Hà' })).toBeVisible();
```

- [ ] **Step 2: Run the admin scenario and confirm RED**

Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --grep "admin approves a new relative" --project=mobile-chromium`
Expected: the admin row cannot yet describe or approve the new Member proposal.

- [ ] **Step 3: Implement review descriptions and revision refresh**

```ts
if (decision === 'approved') onGraphChanged();
```

Show the new person's minimal fields and the explicit anchor-relative sentence. Existing update/remove rows must include both resolved names and the proposed change before enabling approval.

- [ ] **Step 4: Run connected browser tests to confirm GREEN**

Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --project=chromium --project=mobile-chromium`
Expected: connected desktop and mobile scenarios pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/_connected/relationship-admin.tsx apps/web/app/_connected/admin-panel.tsx apps/web/app/_connected/family-app.tsx tests/e2e/connected-mobile-experience.spec.ts
git commit -m "feat(web): review and refresh family changes"
```

### Task 5: Partner units and parent-aligned children

**Files:**
- Modify: `apps/web/app/_connected/interactive-tree-model.ts`
- Modify: `apps/web/app/_connected/interactive-tree-model.test.ts`
- Modify: `apps/web/app/_connected/interactive-tree-canvas.tsx`
- Modify: `apps/web/app/_connected/relationship-tree.module.css`
- Modify: `tests/e2e/connected-mobile-experience.spec.ts`

**Interfaces:**
- Produces: deterministic `buildInteractiveTreeLayout()` positions with active-partner unit spacing and child preferred centers.
- Preserves: node/edge IDs, drag behavior, collapse behavior, relationship labels, and approved-only input.

- [ ] **Step 1: Write failing layout tests**

```ts
const layout = buildInteractiveTreeLayout(remarriageFixture, new Set());
expect(gap(layout, 'parent-a', 'current-partner')).toBeLessThan(gap(layout, 'parent-a', 'former-partner'));
expect(center(layout, 'child')).toBeCloseTo(midpoint(layout, 'parent-a', 'current-partner'));
expect(hasOverlap(buildInteractiveTreeLayout(denseFixture, new Set()).nodes)).toBe(false);
```

- [ ] **Step 2: Run model tests and confirm RED**

Run: `npx vitest run apps/web/app/_connected/interactive-tree-model.test.ts`
Expected: partner-unit and child-alignment assertions fail with row-alphabetical layout.

- [ ] **Step 3: Implement deterministic family-unit packing**

```ts
interface FamilyUnit {
  memberIds: string[];
  preferredCenter: number;
  width: number;
}
```

Build same-level connected components from active partnership edges, derive each unit's preferred center from known parents in the prior generation, sort deterministically, and pack with `PARTNER_GAP` inside units and `FAMILY_GAP` between units. Historical partners stay in separate units.

- [ ] **Step 4: Verify dense/mobile rendering**

Run: `npx vitest run apps/web/app/_connected/interactive-tree-model.test.ts`
Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --grep "family units|interactive family tree" --project=chromium --project=mobile-chromium`
Expected: deterministic layout, no overlap, and no page overflow.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/_connected/interactive-tree-model.ts apps/web/app/_connected/interactive-tree-model.test.ts apps/web/app/_connected/interactive-tree-canvas.tsx apps/web/app/_connected/relationship-tree.module.css tests/e2e/connected-mobile-experience.spec.ts
git commit -m "feat(web): group family units in tree layout"
```

### Task 6: Project Brain, full verification, and PR update

**Files:**
- Modify: `CURRENT_STATE.md`
- Modify: `docs/07_DATABASE_SCHEMA.md`
- Modify: `docs/11_API_CONTRACTS.md`
- Modify: `docs/14_DECISION_LOG.md` only if a new durable decision is introduced
- Modify: `specs/family-tree/README.md`
- Modify: this plan checkboxes

**Interfaces:**
- Records: migration `0011`, request behavior, evidence, remaining physical-phone limits, and next slice.

- [ ] **Step 1: Update docs from implemented behavior**

```text
Document member_create approval atomicity, scope=mine/all, the mobile wizard,
update/remove/cancel behavior, graph refresh, and family-unit layout limits.
```

- [ ] **Step 2: Run focused security and database verification**

Run: `npm run test:database`
Run: `npm run test:integration`
Expected: all database and integration tests pass.

- [ ] **Step 3: Run full repository verification**

Run: `$env:API_INTERNAL_URL='http://127.0.0.1:4010'; npm run check`
Run: `npm run test:e2e`
Run: `git diff --check`
Expected: all quality gates pass; only project-configured E2E skips remain.

- [ ] **Step 4: Commit and push**

```bash
git add CURRENT_STATE.md docs specs
git commit -m "docs: record complete family tree workflow"
git push
```

- [ ] **Step 5: Update PR #13 and verify CI**

Update the PR title/body around the final implementation and verify every required check on the latest head commit. Keep the worktree for review feedback.
