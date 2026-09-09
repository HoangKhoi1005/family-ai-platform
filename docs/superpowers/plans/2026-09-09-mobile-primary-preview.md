# Mobile-primary design preview — Kế hoạch triển khai

**Mục tiêu:** Chuyển design preview từ bố cục web biên tập sang ứng dụng điện thoại hoàn chỉnh với năm bề mặt dùng hằng ngày.

**Spec:** `docs/superpowers/specs/2026-09-09-mobile-primary-experience-design.md`

## Task 1 — Khóa contract bằng browser tests

- [x] Mở rộng danh sách route với Moments, Chat và Tôi.
- [x] Kiểm tra năm tab chính, trạng thái active, tab cố định trên mobile và Quản trị chỉ nằm dưới Tôi.
- [x] Kiểm tra composer Khoảnh khắc, gửi tin cục bộ và bottom sheet cây.
- [x] Chạy focused E2E để ghi nhận RED trước implementation.

## Task 2 — Xây shell mobile-primary

- [x] Thay top navigation bằng app bar gọn và bottom tab bar ở mobile.
- [x] Dùng cùng năm đích trong desktop rail.
- [x] Thêm safe-area, khoảng trống nội dung và active state theo pathname.
- [x] Giữ onboarding ngoài app navigation.

## Task 3 — Xây lại Nhà và thêm ba bề mặt còn thiếu

- [x] Nhà: lời chào, ngày gần nhất, moments, gửi nhanh, nhắc việc.
- [x] Khoảnh khắc: feed và composer local.
- [x] Trò chuyện: thread list, conversation và composer local.
- [x] Tôi: hồ sơ, privacy, notification, admin entry.

## Task 4 — Chuyển Gia phả và Hồ sơ sang interaction mobile

- [x] Thu gọn masthead, tăng diện tích canvas, thêm toolbar và zoom cục bộ.
- [x] Member profile là bottom sheet có backdrop/dialog ở mobile.
- [x] Hồ sơ chính có contact actions và nội dung theo section ngắn.

## Task 5 — Kiểm chứng và tài liệu

- [x] Chạy lint, typecheck, build và focused E2E.
- [x] Chụp/kiểm tra Home, Moments, Tree, member sheet, Chat và Tôi ở 390×844.
- [x] Cập nhật UX guideline, decision log, context 1.4.0 và CURRENT_STATE bằng kết quả thực tế.
- [x] Chạy lại `npm run check` và toàn bộ E2E sau cập nhật tài liệu: 40 unit tests và 74 browser tests đạt; 2 browser tests skip đúng theo project.
- [x] Commit code/tests và tài liệu thành hai nhóm reviewable; chưa push/merge.
