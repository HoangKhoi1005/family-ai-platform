# Connected Home and Tree Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa ngôn ngữ thiết kế A vào `/app` và thêm lớp C vào Gia phả bằng dữ liệu API thật, giữ nguyên onboarding, calendar và proposal workflow.

**Architecture:** `FamilyApp` tiếp tục điều phối request và biến dữ liệu server thành view model thuần. Home và relationship orbit là component trình bày nhỏ, không gọi API và không import fixture; React Flow vẫn là canvas đầy đủ.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, `@xyflow/react`, Vitest, Playwright.

**Status 2026-09-14:** Implemented on `feat/connected-family-experience`. Home uses real family/member/calendar/notification/Moment data; Tree includes the approved direct-relationship orbit and retains React Flow interactions. Unit, production build and focused desktop/mobile browser checks pass. Physical-device pan/pinch and family usability remain pilot validation.

**Spec:** `docs/superpowers/specs/2026-09-14-connected-family-experience-design.md`

## Global Constraints

- Không import bất kỳ module nào dưới `design-preview` vào `_connected`.
- Mobile 390×844 là bề mặt gốc; kiểm tra thêm 320, 768 và 1280 px, chữ 200%.
- `401` kết thúc session; `403/404` family resource xóa family state; network error giữ dữ liệu tốt gần nhất.
- Chỉ quan hệ đã duyệt từ `RelationshipGraphResponse` được hiển thị.
- Giữ năm đích chính và toàn bộ proposal/admin flow hiện có.

---

### Task 1: Khóa hành vi Home A bằng browser test

**Files:**

- Modify: `tests/e2e/connected-mobile-experience.spec.ts`
- Modify: `apps/web/app/_connected/home-model.test.ts`
- Modify: `apps/web/app/_connected/home-model.ts`

**Interfaces:**

- Consumes: `Member[]`, `EventOccurrenceDto[]`, `linkedMemberId`.
- Produces: `ConnectedHomeModel` với `people`, `nextOccurrence`, `hasLinkedProfile`; callback người thân mang đúng member ID.

- [ ] **Step 1: Viết test thất bại cho việc chọn đúng người thân**

```ts
test('home opens the selected real member in the family tree', async ({ page }) => {
  await mockActiveFamily(page, 'member', calendarOccurrences);
  await page.goto('/app');
  await page.getByRole('button', { name: 'Xem Nguyễn Minh Anh trong Gia phả' }).click();
  await expect(page.getByRole('dialog', { name: /Nguyễn Minh Anh/ })).toBeVisible();
});
```

- [ ] **Step 2: Chạy RED**

Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --project=mobile-chromium -g "home opens the selected"`

Expected: FAIL vì Home hiện chỉ chuyển tab, không truyền member ID.

- [ ] **Step 3: Bổ sung selected-member intent vào coordinator**

Thêm `treeSelectionRequest: { memberId: string; nonce: number } | null` trong `FamilyApp`; `ConnectedHome.onOpenPerson(memberId)` đặt request rồi chuyển `directory`. Không đổi API.

- [ ] **Step 4: Chạy GREEN và unit test model**

Run: `npx vitest run apps/web/app/_connected/home-model.test.ts`

Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --project=mobile-chromium -g "home opens the selected"`

Expected: PASS.

### Task 2: Đồng bộ shell và Home với nền tảng A

**Files:**

- Modify: `apps/web/app/_connected/connected-app-shell.tsx`
- Modify: `apps/web/app/_connected/connected-home.tsx`
- Modify: `apps/web/app/_connected/connected-home.module.css`
- Modify: `apps/web/app/_connected/connected.module.css`
- Modify: `tests/e2e/connected-mobile-experience.spec.ts`

**Interfaces:**

- Consumes: design tokens, `ConnectedHomeModel`, calendar state, callbacks thật.
- Produces: shell A với app bar gọn, people row, honest Moment empty state, ngày gần nhất và lối vào Gia phả.

- [ ] **Step 1: Viết browser assertions cho hierarchy và empty state**

```ts
await expect(
  page.getByRole('heading', { name: 'Chào Gia Bảo, nhà mình có gì mới?' }),
).toBeVisible();
await expect(page.getByRole('region', { name: 'Khoảnh khắc trong nhà' })).toContainText(
  'Chưa có Khoảnh khắc nào',
);
await expect(page.getByText('Bữa cơm nhà')).toHaveCount(0);
```

- [ ] **Step 2: Chạy RED trên mobile**

Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --project=mobile-chromium -g "living home"`

Expected: FAIL ở nhãn/hierarchy mới.

- [ ] **Step 3: Triển khai component và CSS tối thiểu**

Giữ copy tự nhiên, bỏ eyebrow chữ hoa không cần thiết, dùng token surface/brand/accent đã xác nhận, target 44 px và safe-area. Không đưa illustration preview vào `/app`.

- [ ] **Step 4: Kiểm tra lỗi vùng và trạng thái rỗng**

Mở rộng E2E để calendar failure vẫn giữ people/Moment CTA; family revoke làm toàn bộ product shell biến mất.

- [ ] **Step 5: Chạy GREEN**

Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --project=mobile-chromium -g "living home|empty family|revocation"`

Expected: PASS.

### Task 3: Thêm ConnectedRelationshipOrbit

**Files:**

- Create: `apps/web/app/_connected/connected-relationship-orbit.tsx`
- Modify: `apps/web/app/_connected/relationship-tree.tsx`
- Modify: `apps/web/app/_connected/relationship-tree.module.css`
- Modify: `apps/web/app/_connected/relationship-tree-model.test.ts`
- Modify: `tests/e2e/connected-mobile-experience.spec.ts`

**Interfaces:**

- Consumes: `connectionsFor(graph, selectedId)` và `ReadonlyMap<string, RelationshipGraphNodeDto>`.
- Produces: `ConnectedRelationshipOrbit` với `onSelectMember(memberId, opener)`; không suy luận edge mới.

- [ ] **Step 1: Viết unit test thất bại cho remarriage/adoptive/unspecified**

```ts
expect(connectionsFor(graph, 'selected')).toEqual([
  expect.objectContaining({ member_id: 'adopted-child', label: 'Con nuôi' }),
  expect.objectContaining({ member_id: 'former-partner', label: 'Bạn đời trước đây' }),
]);
```

- [ ] **Step 2: Chạy RED và chỉ sửa model nếu thiếu hành vi**

Run: `npx vitest run apps/web/app/_connected/relationship-tree-model.test.ts`

Expected: test mới FAIL nếu nhãn/ordering chưa đúng; nếu hành vi đã tồn tại, thay test bằng browser behavior chưa tồn tại để giữ chu kỳ RED thật.

- [ ] **Step 3: Viết browser test orbit**

```ts
await expect(page.getByRole('navigation', { name: 'Quanh người thân' })).toBeVisible();
await page.getByRole('button', { name: /Cha \/ mẹ · Nguyễn Minh Anh/ }).click();
await expect(page.getByRole('dialog', { name: /Nguyễn Minh Anh/ })).toBeVisible();
```

- [ ] **Step 4: Chạy RED**

Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --project=mobile-chromium -g "relationship orbit"`

Expected: FAIL vì orbit chưa tồn tại.

- [ ] **Step 5: Triển khai orbit typed và tích hợp selection request từ Home**

Orbit lấy selected ID từ state của `RelationshipTree`; khi request từ Home đến, mở đúng profile sau khi graph tải. Mỗi item là button có label quan hệ và tên đầy đủ.

- [ ] **Step 6: Chạy GREEN**

Run: `npx vitest run apps/web/app/_connected/relationship-tree-model.test.ts`

Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --project=mobile-chromium -g "relationship orbit|home opens the selected|approved tree"`

Expected: PASS.

### Task 4: Responsive, accessibility và hồi quy

**Files:**

- Modify: `tests/e2e/connected-mobile-experience.spec.ts`
- Modify: `CURRENT_STATE.md`
- Modify: `docs/context.json`
- Modify: `docs/INDEX.md`

**Interfaces:**

- Consumes: Connected A+C hoàn chỉnh.
- Produces: bằng chứng rollout và Project Brain đồng bộ.

- [ ] **Step 1: Viết viewport matrix cho Home và Tree**

Kiểm tra `scrollWidth <= innerWidth + 1`, target 44 px, tab bar không che nội dung, 200% text và `prefers-reduced-motion` tại 320/390/768/1280.

- [ ] **Step 2: Chạy browser suite desktop/mobile**

Run: `npx playwright test tests/e2e/connected-mobile-experience.spec.ts --project=chromium --project=mobile-chromium`

Expected: PASS.

- [ ] **Step 3: Visual review Home và Tree**

Chụp 390×844 và 1280×900; kiểm tra tên dài, thiếu ảnh, nhà một người, lỗi mạng và revoke. Sửa lỗi bằng test tái hiện trước.

- [ ] **Step 4: Cập nhật Project Brain**

Ghi Connected A+C đã rollout, số test thực tế và giới hạn Moments chưa có backend. Chỉ tăng context version nếu contract/decision thay đổi.

- [ ] **Step 5: Chạy quality gate**

Run: `python scripts/validate_brain.py`

Run: `npm run check`

Expected: tất cả PASS.
