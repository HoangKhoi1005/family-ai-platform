# Interactive Family Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a mobile-first interactive canvas for the approved family graph with pan, pinch/wheel zoom, explicit viewport controls, session-only node movement, and root-relative branch collapse.

**Architecture:** `@xyflow/react` owns viewport gestures and rendering while a pure local model computes deterministic positions and collapse visibility from `RelationshipGraphResponse`. Existing server contracts, profile sheet, proposal flow, textual relationship ledger, and directory remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, `@xyflow/react` 12.11.x, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-interactive-family-tree-design.md`

## Global Constraints

- Mobile is the primary experience and the pilot remains 15 people.
- Render only relationships returned by the permission-checked approved graph API.
- Do not persist dragged positions or collapsed state and do not mutate relationship truth.
- Keep the directory and approved-edge ledger as equivalent non-canvas access.
- Use Vietnamese UTF-8 copy, existing design tokens, 44px targets, visible focus, and reduced motion.
- Do not introduce generic workflow-editor styling, gradients, glassmorphism, decorative emoji, or fake data.

---

### Task 1: Renderer-neutral layout and branch visibility

**Files:**

- Create: `apps/web/app/_connected/interactive-tree-model.ts`
- Create: `apps/web/app/_connected/interactive-tree-model.test.ts`

**Interfaces:**

- Consumes: `RelationshipGraphResponse` and `buildTreeRows(graph)`.
- Produces: `buildInteractiveTreeLayout(graph, collapsedIds)` returning immutable `nodes` and `edges`; each node has deterministic coordinates, member data, root/branch flags, and connection context.

- [x] **Step 1: Write failing tests** for deterministic generation coordinates, one seed per approved edge, root-relative descendants hidden by collapse, siblings retained, and the source graph remaining unchanged.
- [x] **Step 2: Run** `node node_modules/vitest/vitest.mjs run apps/web/app/_connected/interactive-tree-model.test.ts` and verify failure because the module is absent.
- [x] **Step 3: Implement the pure model** with fixed node dimensions/gaps and a distance-increasing traversal from each collapsed node.
- [x] **Step 4: Run the targeted model tests** and verify they pass.

### Task 2: Interactive React Flow canvas

**Files:**

- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Create: `apps/web/app/_connected/interactive-tree-canvas.tsx`
- Modify: `apps/web/app/_connected/relationship-tree.tsx`
- Modify: `apps/web/app/_connected/relationship-tree.module.css`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**

- Consumes: `buildInteractiveTreeLayout`, current graph/root, and the existing `openProfile(memberId, opener)` callback.
- Produces: `InteractiveTreeCanvas({ graph, rootMemberId, onOpenProfile })`, preserving profile and proposal behavior outside the renderer.

- [x] **Step 1: Install** `@xyflow/react@12.11.6` only in `@family/web` and import its base stylesheet once from the app root layout.
- [x] **Step 2: Build a custom family node** from existing identity typography and colors. Expose native profile/collapse buttons and a separate session-only drag grip.
- [x] **Step 3: Configure the viewport** for background pan, pinch/wheel zoom, bounded zoom, non-connectable nodes, no delete behavior, and a `nodeClickDistance` that separates drag from activation.
- [x] **Step 4: Add the product toolbar** using `zoomIn`, `zoomOut`, `fitView`, and `setCenter`; localize all labels and center the root for **Về tôi**.
- [x] **Step 5: Replace generation-row markup** with the canvas while retaining intro, empty/error/loading states, edge ledger, legend, profile sheet, proposal form, and directory.
- [x] **Step 6: Add responsive and reduced-motion styles** with no page-level horizontal overflow and without generic React Flow visual defaults.

### Task 3: Browser interaction coverage

**Files:**

- Modify: `tests/e2e/connected-mobile-experience.spec.ts`

**Interfaces:**

- Consumes: existing `mockActiveFamily(page)` graph/profile fixtures.
- Produces: regression coverage for canvas controls and gestures without changing mock API contracts.

- [x] **Step 1: Add failing assertions** for the Vietnamese toolbar, zoom change, **Về tôi**, branch collapse/expand, and profile opening after canvas interaction.
- [x] **Step 2: Add a drag regression** proving movement changes the node transform without opening the profile sheet.
- [x] **Step 3: Add 320px no-overflow coverage** and retain directory fallback assertions.
- [x] **Step 4: Run** `npm run test:e2e -- --grep "approved tree|interactive family tree"` against the configured Playwright web server and fix only demonstrated interaction defects.

### Task 4: Project Brain and full verification

**Files:**

- Modify: `CURRENT_STATE.md`
- Modify: `specs/family-tree/README.md`
- Modify: `docs/14_DECISION_LOG.md`

**Interfaces:**

- Consumes: verified implementation and test evidence.
- Produces: an accurate D1 status, the React Flow decision, remaining D2 relationship operations, and device-test limitations.

- [x] **Step 1: Record** the renderer decision, session-only UI state, accessibility fallback, and deferred layout engine.
- [x] **Step 2: Run** `python scripts/validate_brain.py` and correct any documentation inconsistency.
- [x] **Step 3: Run** `$env:API_INTERNAL_URL='http://127.0.0.1:4010'; npm run check` outside the Windows sandbox if Vite reports `spawn EPERM`.
- [x] **Step 4: Run** the targeted connected mobile Playwright suite and report exact pass/fail counts plus any untested physical-device gesture behavior.
