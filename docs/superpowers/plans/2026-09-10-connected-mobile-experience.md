# Connected Mobile Experience Implementation Plan

**Goal:** Chuyển ngôn ngữ mobile-primary đã duyệt từ `/design-preview` vào `/app` mà giữ nguyên authorization, onboarding, claim, profile và admin API hiện có.

**Architecture:** `FamilyApp` tiếp tục sở hữu session/family refresh và state bảo vệ dữ liệu. Chỉ trạng thái membership active dùng shell sản phẩm mới; guest, invitation, pending và revoked giữ luồng hiện hành. Năm tab là state trong cùng client boundary để không làm mất draft. Gia phả dùng danh bạ API thật nhưng chưa vẽ cạnh; Moments và Chat là màn trạng thái chưa kết nối, không dùng fixture và không gửi request giả.

**Tech stack:** Next.js App Router, React, TypeScript, CSS Modules, Playwright.

**Specs:** `docs/05_UX_UI_GUIDELINES.md`, `docs/superpowers/specs/2026-09-09-mobile-primary-experience-design.md`, `docs/10_PRIVACY_SECURITY.md`.

## Task 1 — Lock connected-shell behavior with browser tests

- [x] Add an active-member mock test for five mobile destinations, actual house/member identity, honest unavailable states, and no preview data.
- [x] Add an active-admin test proving Quản trị is reachable only through Tôi.
- [x] Confirm the tests fail against the four-tab connected UI.

## Task 2 — Add the authenticated mobile shell

- [x] Create a connected shell with app bar, responsive desktop rail, mobile safe-area tab bar and accessible current state.
- [x] Preserve legacy accessible navigation names used by connected security tests while showing the approved Vietnamese labels.
- [x] Keep logout and administration under Tôi; remove admin from primary navigation.

## Task 3 — Recompose connected Home and daily-use destinations

- [x] Build Home from real member/account state only: greeting, profile ownership prompt, real member count and directory entry.
- [x] Add honest Moments and Chat availability screens without fixtures, API calls or dead primary actions.
- [x] Present Gia phả as the real family directory plus a clear statement that relationship edges are not connected yet.

## Task 4 — Fit Profile and Admin into the product shell

- [x] Keep `ProfilePanel` request, version, draft and visibility behavior unchanged while updating its surrounding hierarchy.
- [x] Add a Tôi landing area with privacy explanation, logout and admin entry when authorized.
- [x] Update the real-browser verification script to enter Admin through Tôi.

## Task 5 — Verify and document

- [x] Run focused connected E2E, then `npm run check` and full `npm run test:e2e`.
- [x] Capture `/app` at Pixel 7 with active member mocks and inspect hierarchy, fixed navigation and long text.
- [x] Update `CURRENT_STATE.md` with evidence and remaining backend limits.
- [x] Keep changes uncommitted until commit/push is explicitly requested.
