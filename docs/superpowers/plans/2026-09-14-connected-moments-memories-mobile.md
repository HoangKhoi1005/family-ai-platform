# Connected Moments and Memories Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nối bề mặt Khoảnh khắc và Kỷ niệm B trên `/app` với media/Moments/Memories API thật bằng trải nghiệm mobile đã duyệt.

**Architecture:** API helpers giữ transport; reducers/state models xử lý retry/stale responses; component trình bày nhận typed props. File preview chỉ sống trong memory của tab, upload trực tiếp bằng grant và service worker không cache media/API.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, browser File/Audio APIs, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-14-connected-family-experience-design.md`

## Global Constraints

- Chỉ hiển thị dữ liệu API thật; không import preview fixtures hoặc illustration giả làm ảnh gia đình.
- Audience UI duy nhất là `Cả nhà`.
- Draft file/audio không vào localStorage, IndexedDB, Cache Storage hoặc service worker.
- Không autoplay audio; reaction không có public count.
- Không commit/push cho đến khi chủ dự án giao rõ việc Git.

---

### Task 1: Web API clients và state models

**Files:**

- Modify: `apps/web/app/_connected/api.ts`
- Create: `apps/web/app/_connected/moments-state.ts`
- Create: `apps/web/app/_connected/moments-state.test.ts`
- Create: `apps/web/app/_connected/memories-state.ts`
- Create: `apps/web/app/_connected/memories-state.test.ts`

**Interfaces:**

- Produces: typed list/create/delete/react/upload/complete/poll functions và reducers chống stale family response.

- [ ] **Step 1:** Viết failing reducer tests cho initial load, load-more dedupe, optimistic reaction rollback, family switch, revoke clear và upload retry giữ client request ID.
- [ ] **Step 2:** Run focused Vitest; expected FAIL vì modules chưa có.
- [ ] **Step 3:** Implement API wrappers dùng shared contracts và request helper hiện có; upload PUT nhận explicit `AbortSignal`.
- [ ] **Step 4:** Implement reducers bằng family generation/request sequence, không giữ Blob/File trong serializable reducer state.
- [ ] **Step 5:** Chạy tests và web typecheck; expected PASS.

### Task 2: Composer và upload UX

**Files:**

- Create: `apps/web/app/_connected/moment-composer.tsx`
- Create: `apps/web/app/_connected/moments.module.css`
- Modify: `apps/web/app/_connected/family-app.tsx`
- Test: `tests/e2e/connected-moments-memories.spec.ts`

**Interfaces:**

- Consumes: upload/create API callbacks.
- Produces: bottom sheet states `idle | selected | uploading | processing | publishing | failed | complete`.

- [ ] **Step 1:** Viết failing browser test chọn file thật, thấy preview/Cả nhà/progress, retry với cùng request ID và không có browser storage key chứa file/caption.
- [ ] **Step 2:** Run mobile Playwright; expected FAIL vì Moments còn unavailable state.
- [ ] **Step 3:** Implement accessible sheet, file validation trước upload, object URL cleanup, abort khi bỏ draft và polling có deadline.
- [ ] **Step 4:** Implement camera/library fallback qua file input; HEIC/oversize báo lỗi trước request nhưng server vẫn là nguồn validation.
- [ ] **Step 5:** Chạy test; expected PASS.

### Task 3: Feed và reaction

**Files:**

- Create: `apps/web/app/_connected/moments-feed.tsx`
- Modify: `apps/web/app/_connected/moments.module.css`
- Modify: `apps/web/app/_connected/family-app.tsx`
- Test: `tests/e2e/connected-moments-memories.spec.ts`

**Interfaces:**

- Consumes: `MomentListResponse`, load-more/delete/react callbacks.
- Produces: feed, honest empty/error/loading states và link `Lưu thành Kỷ niệm` khi actor có quyền.

- [ ] **Step 1:** Viết failing tests cho empty feed, private image endpoint, optimistic `Thương`, rollback, author delete và revoke clear.
- [ ] **Step 2:** Run RED; expected FAIL vì feed chưa có.
- [ ] **Step 3:** Implement feed không public count, không autoplay/infinite surprise; cursor load-more chỉ sau user action.
- [ ] **Step 4:** Nối state vào `FamilyApp`, abort request khi family đổi và clear object/content URLs khi revoke.
- [ ] **Step 5:** Run GREEN; expected PASS.

### Task 4: Dòng Kỷ niệm và audio

**Files:**

- Create: `apps/web/app/_connected/memories-timeline.tsx`
- Create: `apps/web/app/_connected/memories.module.css`
- Create: `apps/web/app/_connected/memory-editor.tsx`
- Modify: `apps/web/app/_connected/family-app.tsx`
- Modify: `apps/web/app/_connected/connected-app-shell.tsx`
- Test: `tests/e2e/connected-moments-memories.spec.ts`

**Interfaces:**

- Consumes: Memory APIs, media upload workflow và contextual navigation from Home/Moment.
- Produces: timeline, conversion confirmation, text/audio item add và explicit audio controls.

- [ ] **Step 1:** Viết failing browser tests chuyển Moment thành Memory, retry không duplicate, mở timeline từ Home và phát audio chỉ sau click.
- [ ] **Step 2:** Run RED; expected FAIL vì route/state chưa có.
- [ ] **Step 3:** Implement contextual `memory` destination không thêm bottom tab; Back quay đúng Home/Moment context.
- [ ] **Step 4:** Implement timeline/item rendering, contribution/source labels và deleted/unavailable state không tiết lộ nội dung.
- [ ] **Step 5:** Implement audio record/file selection khi browser hỗ trợ, upload qua `memory_audio`, play/pause/error và cleanup object URL.
- [ ] **Step 6:** Run GREEN; expected PASS.

### Task 5: Browser matrix, PWA privacy và docs

**Files:**

- Modify: `tests/e2e/connected-moments-memories.spec.ts`
- Modify: `tests/e2e/pwa-install.spec.ts` hoặc PWA safety fixture hiện hành nếu cần behavior assertion.
- Modify: `CURRENT_STATE.md`
- Modify: `docs/05_UX_UI_GUIDELINES.md`
- Modify: `docs/11_API_CONTRACTS.md`

**Interfaces:**

- Produces: bằng chứng mobile/desktop, offline/revoke và tài liệu trạng thái.

- [ ] **Step 1:** Test 320/390/768/1280, chữ 200%, keyboard, reduced motion, tên dài, thiếu ảnh và empty/error/loading.
- [ ] **Step 2:** Test Cache Storage/IndexedDB/localStorage không chứa media hoặc Moment/Memory payload sau upload, reload, logout và revoke.
- [ ] **Step 3:** Chạy browser suite desktop/mobile; expected PASS.
- [ ] **Step 4:** Visual review ảnh thật tổng hợp riêng tư ở Home, feed, composer, Memory timeline và Tree; sửa hierarchy/overflow có test tái hiện.
- [ ] **Step 5:** Cập nhật Project Brain rồi chạy `python scripts/validate_brain.py && npm run check`; expected PASS.
