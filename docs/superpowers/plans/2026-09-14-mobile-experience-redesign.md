# Mobile Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai hệ thống UX mobile đã duyệt với Nhà/Khoảnh khắc theo A, Kỷ niệm theo B và Gia phả theo C, bắt đầu ở design preview rồi mới nối vào dữ liệu thật.

**Architecture:** Giữ nguyên năm route chính và các workflow hiện có. Tách phần trình bày mới thành component nhỏ trong `design-preview`, dùng fixture hư cấu và CSS module; không thay đổi API, auth, permission hay graph model. Design tokens là nguồn màu, typography và interaction dùng lại.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, `@xyflow/react`, Playwright, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-14-mobile-experience-redesign-design.md`

## Global Constraints

- Mobile 390×844 là bề mặt gốc; kiểm tra 320, 768 và 1280 px.
- Năm đích chính giữ nguyên: Nhà · Khoảnh khắc · Gia phả · Trò chuyện · Tôi.
- Kỷ niệm không trở thành tab thứ sáu trong pilot.
- Preview không gọi `/api/*`; fixture luôn được ghi rõ là dữ liệu minh họa.
- Target tối thiểu 44×44 px, focus rõ, chữ 200% không tràn ngang, tôn trọng reduced motion.
- Không đổi auth, permission, family scope, calendar API hoặc relationship model trong gói này.

---

### Task 1: Ghi nhận hướng thiết kế và token nền

**Files:**

- Modify: `design/tokens.json`
- Modify: `packages/ui/src/tokens.css` bằng `npm run tokens:generate`
- Modify: `docs/05_UX_UI_GUIDELINES.md`
- Modify: `docs/14_DECISION_LOG.md`

**Interfaces:**

- Consumes: token generator hiện có và PAD-020.
- Produces: token sans-serif, surface/spacing dùng chung và PAD mới cho mô hình A+B+C.

- [x] **Step 1:** Cập nhật token nguồn: font title/person dùng cùng sans-serif hệ thống; tinh chỉnh nền, surface, xanh lá và đỏ sơn mài theo spec.
- [x] **Step 2:** Chạy `npm run tokens:generate` và xác nhận CSS sinh ra thay đổi đúng từ JSON.
- [x] **Step 3:** Cập nhật UX guideline, thay trạng thái “Album gia đình Việt đương đại đang thử” bằng hướng A+B+C đã duyệt; ghi rõ Kỷ niệm không phải tab mới.
- [x] **Step 4:** Thêm PAD-023 Confirmed, dẫn đến spec mới.
- [x] **Step 5:** Chạy `npm run tokens:check` và `python scripts/validate_brain.py`; kỳ vọng cả hai đạt.

### Task 2: Shell và Nhà theo hướng A

**Files:**

- Create: `apps/web/app/design-preview/home/home-moment.tsx`
- Create: `apps/web/app/design-preview/home/home-pulse.tsx`
- Modify: `apps/web/app/design-preview/page.tsx`
- Modify: `apps/web/app/design-preview/preview-shell.tsx`
- Modify: `apps/web/app/design-preview/mobile.module.css`
- Test: `tests/e2e/mobile-primary-preview.spec.ts`
- Test: `tests/e2e/design-preview.spec.ts`

**Interfaces:**

- Consumes: `PreviewMember`, `previewGathering`, route composer `/design-preview/moments?compose=true`.
- Produces: Home có heading `Chào Gia Bảo, nhà mình có gì mới?`, link `Gửi Khoảnh khắc`, main moment và contextual entries.

- [x] **Step 1:** Thêm browser assertions cho heading mới, link `Gửi Khoảnh khắc`, tên người gửi, ngày gần nhất và trạng thái không gọi API.
- [x] **Step 2:** Chạy `npx playwright test tests/e2e/mobile-primary-preview.spec.ts tests/e2e/design-preview.spec.ts --project=mobile-chromium`; test mới thất bại vì heading và daily action chưa có.
- [x] **Step 3:** Tạo `HomePulse` cho hàng cập nhật và `HomeMoment` cho một nội dung chính; cả hai nhận props typed, không đọc dữ liệu toàn cục.
- [x] **Step 4:** Ghép lại `page.tsx` theo thứ tự A: lời chào → pulse → Khoảnh khắc → ngày gần nhất → Kỷ niệm/Gia phả; giữ empty state trung thực.
- [x] **Step 5:** Làm gọn app bar và cập nhật CSS mobile/desktop, bảo toàn navigation/focus/safe-area.
- [x] **Step 6:** Chạy lại hai spec trên; 15/15 test đạt ở mobile Chromium.

### Task 3: Kỷ niệm theo hướng B

**Files:**

- Create: `apps/web/app/design-preview/memories/page.tsx`
- Create: `apps/web/app/design-preview/memories/memories.module.css`
- Modify: `apps/web/app/design-preview/fixtures.ts`
- Modify: `apps/web/app/design-preview/page.tsx`
- Test: `tests/e2e/mobile-primary-preview.spec.ts`

**Interfaces:**

- Consumes: preview members và fixture kỷ niệm hư cấu.
- Produces: route `/design-preview/memories`, timeline đọc được, một voice-story control có trạng thái preview rõ và lối quay lại Nhà.

- [x] **Step 1:** Viết test mở Kỷ niệm từ Nhà, thấy timeline, nguồn đóng góp và nhãn dữ liệu minh họa; xác nhận không gọi API.
- [x] **Step 2:** Chạy test; test thất bại vì route chưa tồn tại.
- [x] **Step 3:** Thêm fixture typed cho Kỷ niệm và triển khai route timeline; nút phát giọng kể chỉ đổi trạng thái local, không giả phát âm thanh.
- [x] **Step 4:** Thêm lối vào Kỷ niệm theo ngữ cảnh trên Nhà, không sửa năm tab chính.
- [x] **Step 5:** Chạy test và kiểm tra keyboard/focus; test đạt trên mobile Chromium.

### Task 4: Gia phả theo hướng C

**Files:**

- Create: `apps/web/app/design-preview/tree/relationship-orbit.tsx`
- Modify: `apps/web/app/design-preview/tree/tree-preview.tsx`
- Modify: `apps/web/app/design-preview/tree/tree.module.css`
- Test: `tests/e2e/tree-preview.spec.ts`

**Interfaces:**

- Consumes: `previewRelationships`, selected `PreviewMember`, tree model và URL state hiện có.
- Produces: lớp định hướng “Quanh người thân” với quan hệ gần đã duyệt; canvas, directory và member sheet không đổi contract.

- [x] **Step 1:** Viết test chọn một người và thấy quan hệ gần trong lớp định hướng, sau đó vẫn mở được canvas/hồ sơ.
- [x] **Step 2:** Chạy test; test thất bại vì lớp định hướng chưa có.
- [x] **Step 3:** Dùng `getConnections` hiện có để chỉ lấy quan hệ trực tiếp từ fixture đã duyệt và tạo `RelationshipOrbit` với button có accessible name.
- [x] **Step 4:** Tích hợp lớp định hướng gọn trước canvas; trên mobile các quan hệ cuộn ngang và không thay contract của canvas.
- [x] **Step 5:** Chạy toàn bộ `tree-preview.spec.ts`; 7/7 test đạt trên mobile Chromium.

### Task 5: Review trực quan và đồng bộ Project Brain

**Files:**

- Modify: `CURRENT_STATE.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/context.json`
- Modify: `README.md`

**Interfaces:**

- Consumes: kết quả implementation và test ở Task 1–4.
- Produces: Context 1.5.0 và trạng thái triển khai có bằng chứng.

- [x] **Step 1:** Chạy Playwright ở 320, Pixel 7, 768 và desktop; chụp Nhà, Kỷ niệm và Gia phả ở 390×844 cùng 1280×900.
- [x] **Step 2:** Kiểm tra focus, 200% text, tên dài, thiếu ảnh, empty state, reduced motion và không có request `/api/*`.
- [x] **Step 3:** Dùng checklist `web-design-guidelines` rà soát source; sửa navigation prefix và mật độ hero desktop bằng browser test tái hiện.
- [x] **Step 4:** Cập nhật Context 1.5.0 cùng trạng thái thực tế; `/app` được ghi rõ chưa rollout giao diện mới.
- [x] **Step 5:** Chạy `npm run check` và các E2E liên quan; ghi đúng số pass/skip và giới hạn còn lại vào `CURRENT_STATE.md`.
