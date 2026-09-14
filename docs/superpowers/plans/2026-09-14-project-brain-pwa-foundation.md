# Project Brain sync and PWA foundation implementation plan

> **Required workflow:** Execute task by task with test-first changes. Do not add private-response caching or notification permission to this package.

**Goal:** Make the current mobile-first web app installable, add calm device-aware installation guidance under “Tôi”, and make Project Brain accurately reflect merged behavior.

**Architecture:** Next.js owns manifest metadata and production worker registration. A first-party lifecycle-only service worker is served with strict no-store headers and is statically checked for forbidden storage/network behavior. A pure TypeScript model decides the install state; the React component only binds browser events and renders the existing Vietnamese product language. Project Brain is reconciled against `main` and final test evidence.

**Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright, existing design tokens, vanilla service worker.

**Design:** [2026-09-14-project-brain-pwa-foundation-design.md](../specs/2026-09-14-project-brain-pwa-foundation-design.md)

---

## Task 1: Reconcile Project Brain with merged code

**Files:**

- Modify: `README.md`
- Modify: `CURRENT_STATE.md`
- Modify: `specs/README.md`
- Modify: `docs/00_PROJECT_CONTEXT.md`
- Modify: `docs/10_PRIVACY_SECURITY.md`
- Modify: `docs/CONNECTED_ONBOARDING.md`
- Modify: `docs/context.json`
- Modify: `docs/13_ROADMAP.md`
- Modify: `docs/superpowers/plans/2026-09-09-project-review-roadmap.md`

**Steps:**

1. Locate every statement that describes notifications, relationships, calendar, current branch, PWA, or the next package.
2. Replace stale statements with three explicit states: implemented on `main`, preview-only, and planned.
3. Set the context stage to `pilot-core-pwa-foundation` without changing context version `1.4.0`.
4. Keep historical verification records, but put the current merged summary first.
5. Run `python scripts/validate_brain.py` and `git diff --check`.
6. Commit: `docs(brain): synchronize merged pilot capabilities`.

## Task 2: Add failing PWA contract and safety tests

**Files:**

- Create: `apps/web/app/manifest.test.ts`
- Modify: `apps/web/next.config.test.ts`
- Create: `apps/web/app/_connected/pwa-install.test.ts`
- Create: `scripts/check-pwa-safety.mjs`
- Create: `scripts/test-pwa-safety.mjs`
- Modify: `package.json`

**Steps:**

1. Write a manifest test for Vietnamese identity, `/app` start URL, `/` scope, standalone display and 192/512 icons.
2. Extend the Next config test for the exact service-worker response headers.
3. Write pure install-model tests for standalone, prompt-ready, iOS instructions and fallback states.
4. Write a safety-script test using temporary safe and unsafe worker fixtures. Unsafe cases cover `fetch`, Cache Storage, IndexedDB, API paths, push and background sync.
5. Add `pwa:check` and `test:pwa-safety` scripts; include `pwa:check` in the root quality gate.
6. Run the focused tests and confirm they fail for missing production files/functions.

## Task 3: Implement manifest, icons and lifecycle-only worker

**Files:**

- Create: `apps/web/app/manifest.ts`
- Create: `apps/web/app/pwa-registration.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/public/sw.js`
- Create: `apps/web/public/icons/nhaminh-mark.svg`
- Create: `apps/web/public/icons/icon-192.png`
- Create: `apps/web/public/icons/icon-512.png`
- Create: `apps/web/public/icons/icon-maskable-512.png`
- Create: `apps/web/public/apple-touch-icon.png`

**Steps:**

1. Implement `manifest()` with exact values required by Task 2.
2. Create the restrained “Nhà mình” source mark using existing paper/forest/terracotta colors and a maskable safe zone.
3. Generate and inspect 192/512 PNG assets from the same source mark.
4. Add the lifecycle-only `sw.js`: install/activate only, no fetch or storage APIs.
5. Add production-only registration and mount it in the root layout.
6. Export Next `Viewport` metadata with light scheme and the brand theme color.
7. Add strict `/sw.js` headers before the global header rule.
8. Run manifest, config and PWA-safety tests until they pass.
9. Build `@family/web` and request the built manifest, icons and worker locally.
10. Commit: `feat(pwa): add private install foundation`.

## Task 4: Add device-aware installation guidance under “Tôi”

**Files:**

- Create: `apps/web/app/_connected/pwa-install.ts`
- Create: `apps/web/app/_connected/install-app-panel.tsx`
- Modify: `apps/web/app/_connected/family-app.tsx`
- Modify: `apps/web/app/_connected/connected.module.css`
- Modify: `apps/web/app/_connected/pwa-install.test.ts`

**Steps:**

1. Implement pure helpers for installed-mode detection and Apple mobile-browser detection.
2. Implement the panel event lifecycle for `beforeinstallprompt` and `appinstalled`.
3. Render the four approved states with short Vietnamese copy.
4. Place the section after the privacy note and before profile editing in the “Tôi” destination.
5. Use existing tokens and editorial spacing; provide a minimum 44 px button target and `:focus-visible` treatment.
6. Keep the layout single-column at narrow widths and avoid a modal/banner/floating action.
7. Run focused model tests, lint, typecheck and format checks.
8. Commit: `feat(web): guide mobile app installation`.

## Task 5: Verify browser behavior and regressions

**Files:**

- Create: `tests/e2e/pwa-foundation.spec.ts`
- Modify only if a shared fixture needs a precise PWA route mock: `tests/e2e/connected-mobile-experience.spec.ts`

**Steps:**

1. Test manifest values and every referenced icon response.
2. Test `/sw.js` status, content type, no-store and CSP headers.
3. Verify a production page registers `/sw.js`.
4. Mock `beforeinstallprompt`; verify no automatic prompt and one prompt after the install button is pressed.
5. Verify iPhone instructions and standalone confirmation state.
6. Reuse connected membership fixtures to open “Tôi” and verify 320/390 px plus 200% text without horizontal overflow.
7. Re-run logout and revoked-membership browser regressions with the worker active; assert Cache Storage remains empty.
8. Inspect Pixel 7 and desktop screenshots for hierarchy, typography, wrapping and focus.
9. Run the focused E2E spec, then the relevant connected-mobile suite.

## Task 6: Final evidence and delivery

**Files:**

- Modify: `CURRENT_STATE.md`
- Modify as evidence requires: `docs/context.json`, `docs/13_ROADMAP.md`

**Steps:**

1. Record exact focused-test, browser-test and full-gate results without replacing prior history.
2. Run `npm run brain:check`.
3. Run `npm run check`.
4. Run `git diff --check` and confirm only intended files changed.
5. Confirm commits form the three reviewable groups promised by the design.
6. Push the branch and open a PR when authorized; report any external CI result separately from local evidence.
