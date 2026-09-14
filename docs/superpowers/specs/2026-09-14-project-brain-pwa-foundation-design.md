# Project Brain sync and PWA foundation — design

**Date:** 2026-09-14  
**Status:** Approved and implemented on feature branch
**Scope:** Project Brain truthfulness, installable web app foundation, mobile install guidance  
**Out of scope:** Web push delivery, offline family data, hosting/provider selection, native app packaging

## 1. Problem

The repository has progressed beyond several Project Brain statements. The notification inbox is merged, the connected relationship graph is real, and the current pilot surface is a mobile-first connected app. Some overview documents still describe those features as missing or only present on a feature branch.

The web app also has no manifest, app icons, service-worker lifecycle, or in-product installation guidance. A family member can open the site in a browser, but the product does not yet explain how to keep “Nhà mình” on the phone like an app.

These gaps must be fixed together so the shipped capability and the project memory describe the same state.

## 2. Desired outcome

After this package:

1. Project Brain accurately distinguishes merged product behavior, preview-only behavior, and work that has not started.
2. Supported browsers can recognize the site as an installable Vietnamese family app.
3. The “Tôi” area gives calm, device-aware installation guidance without interrupting onboarding or asking for permissions automatically.
4. The PWA layer does not persist private family data and makes no offline or push claim.
5. Logout and revoked membership continue to clear connected UI state and cannot be bypassed by a service-worker response.

## 3. Product and privacy principles

- Phone is the primary product surface; web/PWA is the pilot distribution channel.
- Installation is a user action. The app never open an install prompt on page load.
- Notification permission is not part of this package and is never requested here.
- The service worker owns lifecycle only. It does not use Cache Storage, IndexedDB, local storage, background sync, or a fetch handler.
- HTML, API responses, contact data, calendar data, notifications, images, and family documents are always network/server-authorized in this package.
- The installed app starts at `/app`; the existing session and membership checks remain the gate to family content.
- Copy and visuals follow “Album gia đình Việt đương đại”: quiet hierarchy, warm paper, ink, forest and terracotta tokens, no generic app-install banner or decorative AI treatment.

## 4. Alternatives considered

### A. Next manifest + minimal first-party service worker + guidance in “Tôi” — chosen

This uses platform primitives, adds no runtime dependency, and creates the lifecycle needed for later push work. Because the worker has no fetch or cache behavior, it cannot accidentally serve stale family data.

### B. Workbox/Serwist application-shell caching — deferred

This can provide an offline shell, but it adds dependency and cache-invalidation complexity before an offline privacy model exists. It also makes revoke/logout verification harder. Reconsider only with a separate offline-data decision and threat review.

### C. Manifest only — rejected for this foundation

A manifest can be enough for installation in some current browsers, but it does not establish the controlled worker lifecycle needed for later notification delivery and browser-level verification.

## 5. Project Brain reconciliation

The implementation updates current-state documents based on merged code and test evidence. It does not rewrite historical plans or change their original decisions.

| Source                                                        | Required correction                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CURRENT_STATE.md`                                            | Record Task 11 as merged on `main`; add the PWA foundation package and its verification evidence.                                                |
| `README.md`                                                   | Replace the stale “inbox UI unfinished” statement with the current merged capability and honest remaining limits.                                |
| `specs/README.md`                                             | Replace the global “ready for implementation” claim with a small status index: implemented, preview-only, planned.                               |
| `docs/00_PROJECT_CONTEXT.md`                                  | Replace the stale “next package” description with the current pilot stage and ordered next outcomes.                                             |
| `docs/10_PRIVACY_SECURITY.md`                                 | Remove the stale statement that relationship APIs are absent; add the PWA no-private-cache rule.                                                 |
| `docs/CONNECTED_ONBOARDING.md`                                | Describe the connected relationship API/canvas accurately and keep fixture-only preview clearly separated.                                       |
| `docs/context.json`                                           | Change the stage from `mobile-primary-preview` to `pilot-core-pwa-foundation`; keep context version `1.4.0` because no product decision changes. |
| `docs/13_ROADMAP.md`                                          | Mark completed foundation work from merged evidence and leave realtime, media, AI, hosting, push and operations open.                            |
| `docs/superpowers/plans/2026-09-09-project-review-roadmap.md` | Mark only the PWA-foundation acceptance items proved by this package. Historical task detail remains intact.                                     |

The validator remains structural in this package. Semantic freshness is enforced by the explicit status index and review checklist rather than a brittle prose parser.

## 6. PWA architecture

### 6.1 Manifest and metadata

Create `apps/web/app/manifest.ts` using Next.js `MetadataRoute.Manifest` with:

- `name`: `Nhà mình · Không gian riêng của gia đình`
- `short_name`: `Nhà mình`
- Vietnamese description and `lang: vi`
- `start_url: /app` and `scope: /`
- `display: standalone`
- warm paper background and forest theme values sourced from existing design tokens
- 192 × 192 and 512 × 512 PNG icons
- a maskable 512 × 512 icon whose important mark stays inside the platform safe zone

Export Next `Viewport` metadata from the root layout for the matching theme color and light color scheme. Keep search indexing disabled.

### 6.2 Identity assets

Add one source SVG and generated PNG sizes under `apps/web/public/icons`. The mark is a compact “NM”/home monogram drawn from the existing wordmark proportions and palette. It must remain recognizable at launcher size and avoid stock house, robot, sparkle, chat-bubble, gradient, or glass effects.

The committed PNG files are deterministic outputs of the source SVG. The package does not introduce a runtime image dependency.

### 6.3 Service worker

Add `apps/web/public/sw.js` with lifecycle handlers only:

- call `skipWaiting()` during install;
- claim existing clients during activate;
- do not register `fetch`, `push`, `notificationclick`, `sync`, or `periodicsync` handlers;
- do not call Cache Storage, IndexedDB, or any application API.

Register `/sw.js` from a small client component mounted by the root layout only when `NODE_ENV === 'production'` and service workers are supported. Registration failure is silent for the product UI and may use a fixed, non-PII development console message.

Serve `/sw.js` with:

- `Content-Type: application/javascript; charset=utf-8`
- `Cache-Control: no-cache, no-store, must-revalidate`
- `Content-Security-Policy: default-src 'self'; script-src 'self'`

### 6.4 Installation guidance

Add a compact “Cài Nhà mình trên điện thoại” section under the connected “Tôi” destination.

The component models four states:

1. **Already installed/standalone:** confirm the app is on this device; no install button.
2. **Chromium install event available:** show one explicit `Cài ứng dụng` button; call the saved `beforeinstallprompt` event only after the tap; clear the event after use.
3. **iPhone/iPad Safari:** show short numbered steps using Share → Add to Home Screen → Add.
4. **Other/unsupported browser:** explain that the user can keep using the browser and may use the browser menu if it offers installation.

The section must not be a modal, popup, floating button, or home-feed card. It remains discoverable in “Tôi”, works at 320 px and 200% text, and does not store dismissal or device information.

## 7. Security behavior

- No private response is cached by the service worker.
- A cold start without a network connection is not supported and must not be marketed as offline access.
- Existing in-memory last-good-data behavior during a temporary connection failure is unchanged.
- Logout and membership revocation still depend on network authorization and connected-app cleanup; the worker cannot answer those routes.
- Invite fragments and session credentials remain outside worker messages and storage.
- Push subscription, device tokens, notification permission, background delivery and notification text are explicitly deferred.

## 8. Implementation boundaries

Expected production changes:

- `apps/web/app/manifest.ts`
- `apps/web/app/layout.tsx`
- `apps/web/app/pwa-registration.tsx`
- `apps/web/public/sw.js`
- `apps/web/public/icons/*`
- `apps/web/next.config.ts`
- a focused install component/model under the existing connected app surface
- focused styles using current tokens
- root/package checks for PWA privacy invariants
- Project Brain documents listed in section 5

Avoid broad refactors of `family-app.tsx`, the relationship tree, calendar, routes, or shared stylesheet. Extraction is allowed only where needed to mount and test the install section cleanly.

## 9. Acceptance criteria

### Project Brain

- **BRAIN-01:** Every current-state statement about inbox, relationships, calendar and PWA matches merged code.
- **BRAIN-02:** Feature documentation distinguishes implemented, preview-only and planned work.
- **BRAIN-03:** `docs/context.json` uses the current stage and passes the existing validator.
- **BRAIN-04:** Context version remains `1.4.0`; no new product decision is invented.

### PWA

- **PWA-01:** `/manifest.webmanifest` is valid, Vietnamese, starts at `/app`, uses standalone display, and references available 192/512 icons.
- **PWA-02:** `/sw.js` has strict no-store/security headers and contains no private-cache or application-data logic.
- **PWA-03:** production registers the worker; development does not leave a worker behind.
- **PWA-04:** the “Tôi” install section shows the correct standalone, Chromium, iOS or fallback state.
- **PWA-05:** install UI invokes a browser prompt only after the user taps; notification permission is never requested.
- **PWA-06:** logout and membership-revocation flows still remove family UI state; no worker cache contains private data.
- **PWA-07:** the section has no horizontal overflow at 320/390 px, remains usable at 200% text, and uses keyboard-visible focus.
- **PWA-08:** opening the installed app at `/app` reaches the existing auth/membership router without bypass.

## 10. Verification strategy

1. Unit-test manifest values, install-state detection and prompt behavior.
2. Add a static `pwa:check` guard that rejects Cache Storage, IndexedDB, application API paths and fetch handlers in `public/sw.js`; include it in root `check`.
3. Test Next headers for `/sw.js`.
4. Add Playwright coverage for manifest/icon availability, production registration, device-specific install copy, standalone state, 320 px/200% layout, logout and revoked membership regression.
5. Run `npm run brain:check`, focused tests, full `npm run check`, then the relevant browser suite.
6. Perform visual review on Pixel 7 and desktop before calling the UI complete.

## 11. Delivery sequence

1. Reconcile Project Brain and add failing safety/manifest/install-model tests.
2. Add manifest, identity assets, worker, registration and headers.
3. Add the mobile install section under “Tôi”.
4. Add browser regression tests and visual evidence.
5. Update `CURRENT_STATE.md` with exact results, split reviewable commits, push the branch and open a PR only when explicitly requested or already authorized.
