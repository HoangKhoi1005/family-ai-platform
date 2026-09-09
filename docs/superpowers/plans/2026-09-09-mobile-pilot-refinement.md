# Mobile Pilot Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện các điểm thiếu nhất quán và khả năng sử dụng của design preview mobile trước khi chuyển thiết kế sang `/app`.

**Architecture:** Giữ route và fixture preview độc lập với API. Chuẩn hóa profile theo `person`, chuyển các tương tác demo thành state cục bộ có phản hồi thật, và dựng cạnh gia phả từ `previewRelationships` trên một canvas có tọa độ xác định. Modal mobile quản lý focus và bàn phím; desktop giữ member panel liền kề.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-mobile-primary-experience-design.md`

## Global Constraints

- Điện thoại 390×844 là bề mặt thiết kế chính; desktop mở rộng từ cùng cấu trúc.
- Preview chỉ dùng dữ liệu hư cấu và không gọi `/api/*`.
- Navigation giữ `Nhà · Khoảnh khắc · Gia phả · Trò chuyện · Tôi`.
- Không tạo cơ chế follower/like count, feed gây nghiện hoặc UI quản trị cho người dùng thường.
- Target chính tối thiểu 44×44 CSS px và nội dung chính trên mobile tối thiểu 16 px khi phù hợp.

---

### Task 1: Correct self-profile routing

**Files:**

- Modify: `apps/web/app/design-preview/me/page.tsx`
- Modify: `apps/web/app/design-preview/profile/page.tsx`
- Test: `tests/e2e/mobile-primary-preview.spec.ts`

**Interfaces:**

- Consumes: `getPreviewMember(person)`.
- Produces: `/design-preview/profile?person=gia-bao` for the viewer and the existing Dì Hương default profile.

- [x] Add a browser test that opens Hồ sơ cá nhân from Tôi, verifies Gia Bảo, enters edit mode, and never renders Dì Hương.
- [x] Run the focused test and confirm it fails because the link/profile is still hardcoded.
- [x] Make profile content derive from the selected fixture member and preserve `person` through edit state links.
- [x] Run the focused test and existing profile tests until green.

### Task 2: Complete local interactions and privacy feedback

**Files:**

- Modify: `apps/web/app/design-preview/moments/moments-preview.tsx`
- Modify: `apps/web/app/design-preview/chat/chat-preview.tsx`
- Modify: `apps/web/app/design-preview/chat/page.tsx`
- Modify: `apps/web/app/design-preview/me/page.tsx`
- Modify: `apps/web/app/design-preview/mobile.module.css`
- Test: `tests/e2e/mobile-primary-preview.spec.ts`

**Interfaces:**

- Produces: audience-specific submit copy/status, local reaction status, selectable family/private chat threads, and a visible privacy panel.

- [x] Add failing tests for audience-specific sharing, reaction feedback, opening Minh Anh chat, and the privacy panel.
- [x] Run focused tests and confirm failures are caused by missing behavior.
- [x] Implement only local preview state; label unsynced outcomes and make every visible action respond.
- [x] Run focused tests until green.

### Task 3: Make mobile dialogs keyboard complete

**Files:**

- Modify: `apps/web/app/design-preview/moments/moments-preview.tsx`
- Modify: `apps/web/app/design-preview/tree/tree-preview.tsx`
- Modify: `apps/web/app/design-preview/tree/member-sheet.tsx`
- Test: `tests/e2e/mobile-primary-preview.spec.ts`

**Interfaces:**

- Produces: Escape close, focus containment, focus return, and modal semantics only on mobile.

- [x] Add failing Playwright cases for Escape and returning focus to the exact opener.
- [x] Implement focus capture/return and Tab wrapping within each mobile dialog.
- [x] Render the desktop member panel as a complementary region and the mobile sheet as a modal dialog.
- [x] Run mobile and tree tests until green.

### Task 4: Render explicit genealogy edges

**Files:**

- Modify: `apps/web/app/design-preview/tree/tree-model.ts`
- Modify: `apps/web/app/design-preview/tree/tree-canvas.tsx`
- Modify: `apps/web/app/design-preview/tree/tree.module.css`
- Test: `tests/e2e/tree-preview.spec.ts`

**Interfaces:**

- Consumes: `previewMembers`, `previewRelationships`.
- Produces: deterministic `TreePosition` records and one SVG path per explicit fixture relationship.

- [x] Add a failing browser test asserting 22 relationship paths, including partner and adoptive kinds.
- [x] Define fixed preview positions and generate SVG elbow paths from explicit relationship records.
- [x] Position semantic member buttons over the same canvas; retain zoom and directory fallback.
- [x] Run tree tests and inspect the mobile canvas visually.

### Task 5: Improve readability and verify the complete preview

**Files:**

- Modify: `apps/web/app/design-preview/mobile.module.css`
- Modify: `apps/web/app/design-preview/tree/tree.module.css`
- Modify: `CURRENT_STATE.md`

**Interfaces:**

- Produces: mobile body/list copy at readable sizes without horizontal overflow.

- [x] Increase essential content and action text while keeping metadata visually secondary.
- [x] Capture Home, Moments, Tree, sheet, Chat, Tôi, and self-profile at 390×844 and inspect hierarchy/overlap.
- [x] Run `npm run check` and `npm run test:e2e`.
- [x] Update `CURRENT_STATE.md` with evidence and remaining limitations.
- [x] Keep code/tests/documentation reviewable in the worktree; commit, push or merge only when explicitly requested.
