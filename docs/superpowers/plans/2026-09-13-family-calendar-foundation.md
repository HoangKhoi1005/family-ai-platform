# Kế hoạch triển khai Ngày quan trọng và lời nhắc

**Goal:** đưa FR-04 từ tài liệu thành vertical slice mobile dùng dữ liệu thật: xem ngày sắp tới, tạo/sửa/hủy, RSVP, inbox nhắc và nền push an toàn.

**Design:** [Thiết kế nền tảng Ngày quan trọng](../specs/2026-09-13-family-calendar-foundation-design.md)

**Specs:** [Lịch nhà](../../../specs/calendar/README.md), [quy tắc thông báo](../../12_NOTIFICATION_RULES.md)

**Baseline:** PAD-004, PAD-005, PAD-008, PAD-011, PAD-014, PAD-020, PAD-022
**Stack:** TypeScript, Fastify, PostgreSQL, Next.js, worker hiện có; không thêm microservice.

**Trạng thái 2026-09-14:** Calendar Core và Mobile Calendar đã merge vào `main` qua PR #14–#15; notification schema/contracts đã merge qua PR #16 tại `76e976c`, CI đạt. Task 9 Event-to-outbox và Task 10 worker inbox đã triển khai local trên `feat/notification-event-outbox`; inbox web theo sau. PR 4 chưa bắt đầu.

## Nguyên tắc thực hiện

- Làm trực tiếp mặc định; chỉ dùng reviewer độc lập cho migration/RLS, calendar correctness hoặc worker delivery.
- TDD cho converter, contract, quyền, revision và dedupe trước implementation.
- Mỗi PR giữ một vertical slice có thể review; coordinator giữ migration, contracts và lockfile.
- Chỉ chọn package/service lịch sau khi kiểm tài liệu chính thức, license, timezone Việt Nam, range và tháng nhuận.
- Không đánh dấu push hoàn thành khi chưa thử app đóng trên thiết bị thật.

## PR 1 — Calendar core

### Task 1. Bộ ngày tham chiếu và adapter

**Files:** `packages/domain/src/calendar.ts`, test cùng package, fixture mới dưới `packages/domain/test-data` hoặc `tests/fixtures`, ADR nếu chọn dependency.

1. Thu thập dataset ngày dương ↔ âm độc lập, gồm giao năm, tháng nhuận, ngày 29/30 và range pilot.
2. Viết test adapter đỏ cho `regular`, `leap_only`, `both`, missing day và ngoài range.
3. Spike package/service bằng tài liệu chính thức; ghi license, version, timezone, range và failure mode.
4. Implement interface `CalendarConverter`, không để Fastify/UI phụ thuộc trực tiếp provider.
5. Chạy unit tests; ghi rõ dataset chứng minh và phần chưa chứng minh.

### Task 2. Contracts Event/Occurrence/RSVP

**Files:** `packages/contracts/src/calendar.ts`, `index.ts`, tests.

1. Viết contract tests cho Gregorian/Lunar discriminated union và policy bắt buộc.
2. Định nghĩa create/update/cancel, list/detail, occurrence và RSVP DTO.
3. Từ chối field thừa, year/date không hợp lệ, timezone sai và actor/family fields trong body.
4. Build contracts và chạy test targeted.

### Task 3. Migration calendar core

**Files:** migration kế tiếp sau `0011`, database provision/test scripts, schema docs.

1. Viết integration test đỏ cho same-family FK, RLS, unique occurrence và RSVP upsert.
2. Tạo `events`, `event_occurrences`, `event_rsvps`; thêm revision/status/index.
3. Thêm role grants tối thiểu và policies active membership.
4. Test migration từ schema hiện tại và rerun idempotent migration runner.
5. Review riêng cross-family, creator/admin ownership và rollback.

### Task 4. Calendar service và routes

**Files:** `apps/api/src/family/calendar.ts`, route registration, API tests/integration.

1. Viết test đỏ cho create/list/detail/update/cancel/RSVP.
2. Resolve family/actor phía server; creator/admin guard cho update/cancel.
3. Tạo occurrence cửa sổ 30 ngày trước/18 tháng sau trong transaction.
4. Tăng revision và vô hiệu occurrence cũ khi sửa; giữ audit.
5. Dùng idempotency key cho create và optimistic version cho write.
6. Test cross-family, pending/revoked, retry RSVP và converter unavailable.

**Gate PR 1:** unit/contract/integration đạt; dataset lịch được review; graph/onboarding không hồi quy; API chưa cần UI giả.

## PR 2 — Mobile Calendar experience

### Task 5. API client và state

**Files:** `apps/web/app/_connected/api.ts`, `types.ts`, `family-app.tsx`, tests.

1. Thêm methods typed cho upcoming, detail, CRUD và RSVP.
2. Giữ last good timeline khi network lỗi; 401/revoke xóa family state.
3. Chặn stale response ghi đè create/update mới bằng revision/request ordering.

### Task 6. Nhà mình và timeline

**Files:** component/CSS mới dưới `_connected`, design tokens chỉ khi thực sự dùng lại.

1. Viết component tests/E2E đỏ cho empty, upcoming, loading, local error và tên dài.
2. Thêm khối Ngày gần nhất và tối đa ba mục trên Home.
3. Tạo màn timeline mở từ Home; URL giữ occurrence đang chọn.
4. Sheet mobile/detail rail desktop; RSVP thao tác một chạm với saving/error.
5. Review 320/390/768/1280, 200% text, focus/back/Escape và reduced motion.

### Task 7. Wizard tạo/sửa/hủy

1. Ba bước theo design; preview ngày kế tiếp trước lưu.
2. Hiển thị policy 29/2, tháng nhuận và ngày 30 rõ bằng tiếng Việt.
3. Conflict version cho xem bản mới trước khi gửi lại.
4. Creator/admin có edit/cancel; thành viên khác chỉ xem/RSVP.
5. E2E create → reload → edit → cancel; lunar unavailable không lưu.

**Gate PR 2:** người dùng hoàn thành xem ngày, tạo Event và RSVP trên mobile mà không cần giải thích; UI được review trực quan, không card-grid/dashboard generic.

## PR 3 — Inbox và outbox worker

### Task 8. Schema delivery

**Files:** migration kế tiếp, contracts notification, database tests.

1. Tạo `notification_preferences`, `notifications`, `outbox_jobs` với composite FK/RLS/index.
2. Unique dedupe key đúng family/recipient/occurrence/revision/offset/kind.
3. Test revoke, revision cũ, lease timeout và hai worker cạnh tranh.

### Task 9. Enqueue trong transaction

1. Event create/update/cancel ghi job tương ứng cùng transaction.
2. Sửa/hủy vô hiệu job cũ; không xóa audit/history.
3. Tạo inbox job cho active recipients theo preferences.
4. Test rollback: Event lỗi không để job mồ côi; enqueue lỗi không commit Event nửa vời.

### Task 10. Worker

**Files:** `apps/worker/src/calendar-reminders.ts`, worker entry/config/tests.

1. Claim job bằng lease/lock; giới hạn batch và thời gian.
2. Recheck membership, Event/Occurrence revision, due window và quiet hours.
3. Upsert notification inbox, ghi attempts/status; retry tối đa 5 trong cửa sổ hữu ích.
4. Không log title/note/contact; dùng ID/request correlation đã lọc.
5. Test worker restart, concurrent workers, provider timeout giả và revoked recipient.

### Task 11. Inbox web

1. Chuông app bar mở inbox; unread state nhẹ, mark read idempotent.
2. Deep link vào occurrence và tải lại quyền.
3. Preferences bật/tắt ba offset; push toggle chỉ hiện khi capability sẵn sàng.
4. E2E notification → read → reload, offline và revoke.

**Gate PR 3:** retry không nhân notification; sửa/hủy không gửi revision cũ; revoked không nhận; inbox dùng được không cần push.

## PR 4 — Push pilot

### Task 12. Chọn provider và PWA subscription

1. Kiểm lại hỗ trợ browser/iOS/Android bằng tài liệu chính thức tại thời điểm làm.
2. Chọn provider/standard Web Push phù hợp hosting; ghi ADR, chi phí và key rotation.
3. Thêm manifest/icons/install guidance và service worker tối thiểu; không cache dữ liệu riêng tư mặc định.
4. Endpoint subscription xác thực owner device; token invalid tự disable.

### Task 13. Delivery adapter và device verification

1. Adapter nhận notification reference, resolve nội dung chung và deep link có quyền.
2. Dedupe/collapse theo khả năng provider; ghi giới hạn exactly-once.
3. Test push app đóng, push off, token invalid, retry timeout và revoke trên thiết bị hỗ trợ.
4. Ghi thiết bị/OS/browser và bằng chứng; nếu thiếu iPhone/Android, để trạng thái giới hạn thay vì đánh dấu xong.

**Gate PR 4:** push app đóng đạt trên thiết bị mục tiêu; inbox vẫn là fallback; không lộ title riêng tư trên lockscreen mặc định.

## Kiểm chứng cuối gói

- `npm run check`
- PostgreSQL/Mailpit integration và database/RLS tests mới.
- `npm run test:e2e` trên Chromium desktop và Pixel 7 emulation.
- Browser connected flow mở rộng bằng create Event, occurrence, RSVP, reminder inbox và revoke.
- `python scripts/validate_brain.py`
- Manual iPhone/Android cho timezone, bottom bar động, permission prompt và push app đóng.

## Điểm dừng bắt buộc

- Dừng trước chọn converter nếu không có dataset độc lập đủ kiểm tháng nhuận/giao năm.
- Dừng trước push nếu chưa chọn hosting/domain HTTPS hoặc chưa có thiết bị thật.
- Không mở Moments/Chat như backend thật trong cùng migration/PR calendar.
