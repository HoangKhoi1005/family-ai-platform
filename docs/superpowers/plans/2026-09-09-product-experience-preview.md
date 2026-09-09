# Product Experience Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a coherent, responsive design preview for Nhà mình, member profile, family tree with adjacent profile, onboarding states, and admin states so the owner can approve the product experience before it is migrated into `/app`.

**Architecture:** Keep this iteration entirely under `/design-preview` with synthetic data and no API calls. Split fixtures, shared preview shell, reusable identity components, and the interactive tree into focused modules; preserve the connected `/app` behavior until the visual review gate passes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, existing generated design tokens, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-product-experience-foundation-design.md`

## Global Constraints

- Pilot remains 15 people; all preview people and content are explicitly synthetic.
- Do not import preview fixtures into `/app` or call `/api/*` from a preview route.
- Use the “Album gia đình Việt đương đại” direction; avoid generic card grids, purple-blue gradients, glassmorphism, decorative emoji, fake metrics, floating AI actions, and dead buttons.
- Use Vietnamese UTF-8 copy and existing glossary terms: Nhà mình, Gia phả, Người thân, Hồ sơ, Quản trị nhà.
- Body text remains at least 16px and primary targets at least 44×44 CSS px.
- Support 320, 390, 768, and 1280px widths, browser text zoom 200%, visible keyboard focus, and reduced motion.
- Missing photos use deterministic monograms; do not fetch random portraits or add real family data.
- This plan does not change relationship schema, API contracts, `/app` navigation, or connected onboarding behavior.

---

### Task 1: Lock preview safety and navigation behavior with tests

**Files:**

- Modify: `tests/e2e/design-preview.spec.ts`
- Modify: `tests/e2e/tree-preview.spec.ts`
- Create: `tests/e2e/product-experience-preview.spec.ts`

**Interfaces:**

- Consumes: existing `/design-preview`, `/design-preview/profile`, `/design-preview/tree`, and `/design-preview/join` routes.
- Produces: browser acceptance coverage for route navigation, synthetic-data boundaries, responsive layout, tree selection, directory fallback, and non-networked preview behavior.

- [ ] **Step 1: Add a failing safety and shell test.** Track requests whose pathname starts with `/api/`, open each preview route, and assert the list remains empty. Assert the shell exposes working links named `Nhà mình`, `Gia phả`, `Hồ sơ`, `Vào nhà`, and `Quản trị`.

```ts
test('preview stays synthetic and every shell destination works', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
  });

  for (const route of [
    '/design-preview',
    '/design-preview/tree',
    '/design-preview/profile',
    '/design-preview/join',
    '/design-preview/admin',
  ]) {
    await page.goto(route);
    await expect(page.getByText('Dữ liệu minh họa', { exact: false }).first()).toBeVisible();
  }
  expect(apiCalls).toEqual([]);
});
```

- [ ] **Step 2: Add failing tree URL and directory tests.** Select a node and assert `person` appears in the URL; reload and assert the same profile remains open. Search `ngoc lan` in directory mode and open the matching person without interacting with the graph.

```ts
await page.goto('/design-preview/tree');
await page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Minh Đức' }).click();
await expect(page).toHaveURL(/person=minh-duc/);
await page.reload();
await expect(page.getByRole('heading', { name: 'Nguyễn Minh Đức' })).toBeVisible();
await page.getByRole('button', { name: 'Mở danh bạ' }).click();
await page.getByRole('searchbox', { name: 'Tìm người thân' }).fill('ngoc lan');
await page.getByRole('link', { name: /Đỗ Ngọc Lan/ }).click();
await expect(page).toHaveURL(/person=ngoc-lan/);
```

- [ ] **Step 3: Add failing responsive and accessibility checks.** For 320/390/768/1280 widths, assert no document horizontal overflow. At 320px, double rendered text sizes and check Home, Profile, Tree, Join, and Admin headings/actions remain visible. Emulate reduced motion and assert interactive elements do not expose transitions longer than 1ms.

- [ ] **Step 4: Run the focused tests and confirm RED.**

Run: `npm run build --workspace @family/web && npm run test:e2e -- tests/e2e/product-experience-preview.spec.ts tests/e2e/tree-preview.spec.ts`

Expected: FAIL because `/design-preview/admin`, the complete shell navigation, URL-backed tree selection, and directory fallback do not exist.

- [ ] **Step 5: Keep the tests uncommitted until Tasks 2–4 make them green.** This preserves one reviewable preview feature commit instead of committing a knowingly red branch.

### Task 2: Establish tokens, synthetic content model, and shared shell

**Files:**

- Modify: `design/tokens.json`
- Regenerate: `packages/ui/src/tokens.css`
- Modify: `apps/web/app/design-preview/fixtures.ts`
- Create: `apps/web/app/design-preview/preview-identity.tsx`
- Modify: `apps/web/app/design-preview/preview-shell.tsx`
- Modify: `apps/web/app/design-preview/preview.module.css`

**Interfaces:**

- Produces: `PreviewMember`, `PreviewEvent`, `previewMembers`, `previewEvents`, `memberBySlug(slug)`, `MemberMonogram`, and `PreviewShell({ current, children })`.
- Consumed by: Home, Profile, Tree, Join, and Admin preview routes.

- [ ] **Step 1: Extend token roles minimally.** Add semantic `canvas`, `paper`, `ink`, `inkMuted`, `familyGreen`, `terracotta`, `focus`, `success`, `warning`, and `danger` colors while retaining old keys until connected screens migrate. Add typography sizes only when shared by two preview components.

```json
"experienceColor": {
  "canvas": "#F5F0E7",
  "paper": "#FFFCF6",
  "ink": "#253128",
  "inkMuted": "#667168",
  "familyGreen": "#315D47",
  "terracotta": "#A24F35",
  "focus": "#165DFF",
  "success": "#356B4B",
  "warning": "#8A5A13",
  "danger": "#A33A32"
}
```

- [ ] **Step 2: Regenerate CSS and verify token consistency.**

Run: `npm run tokens:generate && npm run tokens:check`

Expected: both commands exit 0 and `packages/ui/src/tokens.css` contains `--experience-color-*` variables.

- [ ] **Step 3: Replace loose fixtures with typed synthetic records.** Each member has a stable slug, display name, familiar name, optional year/date, deceased flag, hometown, biography, relationship labels supplied by fixture, and optional permitted contacts. Include a long Vietnamese name, missing photo, deceased member, adopted relationship label, and isolated member.

```ts
export interface PreviewMember {
  slug: string;
  displayName: string;
  familiarName: string;
  birthYear?: number;
  deceased?: boolean;
  hometown?: string;
  biography?: string;
  contacts: ReadonlyArray<{ kind: 'phone' | 'email' | 'facebook'; label: string; href: string }>;
  synthetic: true;
}
```

- [ ] **Step 4: Implement deterministic identity rendering.** `MemberMonogram` derives at most two visible initials from `familiarName`, uses `slug` to select one of a fixed accessible palette, includes an explicit accessible label, and marks deceased status with text rather than opacity.

- [ ] **Step 5: Rebuild the shell.** `PreviewShell` renders a narrow synthetic notice, house wordmark, active route marker, five working destinations, and a compact mobile navigation. Use text labels and simple repo-native SVG icons only where they improve recognition.

- [ ] **Step 6: Run token, lint, and type checks.**

Run: `npm run tokens:check && npm run lint && npm run typecheck`

Expected: exit 0 with no stale generated CSS and no TypeScript errors.

### Task 3: Redesign Home and member profile as distinct experiences

**Files:**

- Modify: `apps/web/app/design-preview/page.tsx`
- Modify: `apps/web/app/design-preview/profile/page.tsx`
- Create: `apps/web/app/design-preview/profile/profile-preview.tsx`
- Modify: `apps/web/app/design-preview/preview.module.css`
- Modify: `tests/e2e/design-preview.spec.ts`

**Interfaces:**

- Consumes: `PreviewShell`, `MemberMonogram`, `previewMembers`, `previewEvents`.
- Produces: editorial Home preview and separate profile view/edit states selected through `?mode=view|edit|saving|error|conflict`.

- [ ] **Step 1: Implement Home hierarchy.** Render house identity and greeting, one slim upcoming-event band, one dominant family story composition, and a short people strip. Provide working links to Profile and Tree. Add `?state=empty` that removes synthetic story/event content and displays a useful empty state without fake counters or dead actions.

- [ ] **Step 2: Implement profile view.** Show familiar and full name, monogram, respectful deceased label where applicable, biography, year-only birth formatting, hometown, and only fixture contacts that exist. Use valid `tel:`, `mailto:`, and `https:` links with explicit accessible names.

- [ ] **Step 3: Implement profile edit state.** A client component switches between view and form using query state. Fields are display name, familiar name, birth year, hometown, biography, and contact visibility examples. `saving`, `error`, and `conflict` are deterministic preview states; buttons either change query state or return to view and never call an API.

- [ ] **Step 4: Give Home and Profile different layout grammar.** Home uses broad editorial rhythm and image/content asymmetry. Profile uses identity masthead, readable detail rules, and a contained editing sheet. Shared colors/spacing come from tokens; do not wrap every section in the same rounded container.

- [ ] **Step 5: Run focused Home/Profile tests.**

Run: `npm run build --workspace @family/web && npm run test:e2e -- tests/e2e/design-preview.spec.ts`

Expected: Home/Profile navigation, 200% text, empty state, contact links, and edit/conflict states pass on desktop and mobile projects.

### Task 4: Rebuild the tree around URL state and adjacent profile

**Files:**

- Modify: `apps/web/app/design-preview/tree/page.tsx`
- Create: `apps/web/app/design-preview/tree/tree-model.ts`
- Create: `apps/web/app/design-preview/tree/tree-canvas.tsx`
- Create: `apps/web/app/design-preview/tree/tree-directory.tsx`
- Create: `apps/web/app/design-preview/tree/member-sheet.tsx`
- Modify: `apps/web/app/design-preview/tree/tree.module.css`
- Modify: `tests/e2e/tree-preview.spec.ts`

**Interfaces:**

- `tree-model.ts` produces `TreeNode`, `TreeEdge`, `previewTree`, `visibleTree(rootSlug)`, and accent-insensitive `searchTree(query)`.
- `tree-canvas.tsx` consumes visible nodes/edges and calls `onSelect(slug)`; it does not mutate relationships.
- `tree-directory.tsx` consumes all members and produces links with `person` query parameters.
- `member-sheet.tsx` consumes one `PreviewMember` plus fixture relationship labels and emits `onClose`/`onFocusBranch`.

- [ ] **Step 1: Extract the tree model.** Replace array-index identity with stable member slugs. Store explicit fixture edges with `parent_child` or `partnership` type and optional `adoptive`/`unspecified` label. Keep layout coordinates as preview-only data; they are not genealogy truth.

- [ ] **Step 2: Make URL search parameters authoritative.** Use `person`, `root`, and `view=tree|directory`. Invalid slugs fall back to the default root without throwing. Selecting a node updates the URL; browser back, reload, and a copied deep link restore the same context.

- [ ] **Step 3: Build the tree canvas.** Use semantic buttons positioned in a bounded, horizontally scrollable canvas with SVG lines marked `aria-hidden`. Nodes show monogram, name, supplied relationship context, deceased text, and selected state. This task does not implement pan, pinch zoom, or drag.

- [ ] **Step 4: Build the adjacent profile.** Desktop reserves a right-hand profile column. Mobile opens a bottom sheet with a visible close button and returns focus to the selected node. Show fixture-provided relationship labels, profile facts, and permitted contact actions.

- [ ] **Step 5: Add directory fallback.** A clear `Mở danh bạ` action switches to a full keyboard-readable list. Search is accent-insensitive, empty results are explicit, and selecting a result returns to tree view with that person selected.

- [ ] **Step 6: Represent edge cases.** Render the adopted edge with a textual legend, show an isolated person in directory results, and render deceased identity respectfully. No pending relationship is drawn as an approved edge.

- [ ] **Step 7: Run focused tree tests.**

Run: `npm run build --workspace @family/web && npm run test:e2e -- tests/e2e/tree-preview.spec.ts tests/e2e/product-experience-preview.spec.ts`

Expected: URL persistence, back/reload, profile open/close, directory fallback, name search, overflow, keyboard, and synthetic-data checks pass.

### Task 5: Add admin and onboarding review states

**Files:**

- Create: `apps/web/app/design-preview/admin/page.tsx`
- Create: `apps/web/app/design-preview/admin/admin-preview.tsx`
- Create: `apps/web/app/design-preview/admin/admin.module.css`
- Modify: `apps/web/app/design-preview/join/join-flow.tsx`
- Modify: `apps/web/app/design-preview/join/join.module.css`
- Modify: `tests/e2e/product-experience-preview.spec.ts`

**Interfaces:**

- Consumes: `PreviewShell`, synthetic membership/claim fixtures, and the existing join scenario query contract.
- Produces: admin queue states `?state=pending|empty|conflict` and visually aligned invite/pending/claim onboarding states.

- [ ] **Step 1: Add the admin preview route.** Present separate editorial lists for invitations, pending memberships, and profile claims. Default state has one synthetic review item; `empty` explains that no action is needed; `conflict` closes stale actions and exposes a working `Tải lại bản mẫu` link.

- [ ] **Step 2: Keep actions deterministic and local.** Approve/reject controls update local preview state only, display a `Dữ liệu minh họa` notice, and never send a request. Avoid dashboard metrics and repeated card tiles.

- [ ] **Step 3: Align join/onboarding visuals.** Reuse shell identity, tokens, typography, focus, and status treatment without changing its fixture-only flow or auth contract. Preserve expired/revoked/offline scenario controls already covered by existing tests.

- [ ] **Step 4: Run preview safety and onboarding tests.**

Run: `npm run build --workspace @family/web && npm run test:e2e -- tests/e2e/product-experience-preview.spec.ts tests/e2e/onboarding-preview.spec.ts`

Expected: admin states work, no preview API calls occur, and all existing onboarding preview scenarios remain green.

### Task 6: Visual QA, documentation, and review checkpoint

**Files:**

- Modify: `CURRENT_STATE.md`
- Modify: `docs/05_UX_UI_GUIDELINES.md`
- Modify: `docs/superpowers/plans/2026-09-09-product-experience-preview.md`
- Evidence only, ignored: `test-results/product-experience-preview/`

**Interfaces:**

- Consumes: completed preview routes and automated tests.
- Produces: reviewed screenshots, an accurate implementation ledger, and a running preview for owner approval.

- [ ] **Step 1: Run the complete repository gates.**

Run: `$env:API_INTERNAL_URL='http://127.0.0.1:4010'; npm run check`

Run: `npm run test:e2e`

Expected: all lint, format, typecheck, unit tests, Brain validation, builds, and both Playwright viewport projects pass.

- [ ] **Step 2: Capture the required visual matrix.** Save full-page screenshots for Home normal/empty, Profile view/edit/conflict, Tree selected/directory, Admin pending/empty, and Join pending at desktop 1280×900 and mobile 390×844.

- [ ] **Step 3: Inspect screenshots rather than trusting tests.** Check hierarchy, Vietnamese line wrapping, overlap, horizontal overflow, monogram consistency, focus, empty/error states, and whether Home/Profile/Tree have distinct composition. Fix visible defects and repeat only affected checks.

- [ ] **Step 4: Update docs with evidence only.** Mark implemented preview behaviors in `CURRENT_STATE.md`, retain the statement that this is not final UI until owner approval, and record any design-token or UX rule that changed. Check off completed plan tasks with actual command results.

- [ ] **Step 5: Commit the implementation in reviewable groups.**

```powershell
git add design packages/ui apps/web/app/design-preview tests/e2e
git commit -m "feat(web): redesign product experience preview"
git add CURRENT_STATE.md docs/05_UX_UI_GUIDELINES.md docs/superpowers/plans/2026-09-09-product-experience-preview.md
git commit -m "docs: record product experience preview"
```

- [ ] **Step 6: Start a local preview for owner review.** Build with `API_INTERNAL_URL=http://127.0.0.1:4010`, run Next on a free loopback port, and provide the exact `/design-preview` URL. Do not migrate the design into `/app` until the owner explicitly approves the running preview.
