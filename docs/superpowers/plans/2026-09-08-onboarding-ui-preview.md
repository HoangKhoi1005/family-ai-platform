# Kế hoạch bản mẫu vào nhà và danh bạ

Spec: [Bản mẫu UI](../specs/2026-09-08-onboarding-ui-preview.md).
Baseline: main 3e411b7. Nhánh feat/onboarding-ui-preview.

## Task 1 — Bản mẫu tương tác

Một implementer Luna xhigh, không agent con. Đọc AGENTS, UX guidelines, tokens và bản mẫu hiện có trước sửa.

- Thêm routes dưới apps/web/app/design-preview cho luồng vào nhà và danh bạ; components/CSS riêng, giữ bản mẫu Nhà mình/hồ sơ.
- Luồng: lời mời, tài khoản minh họa không nhận mật khẩu thật, xác minh/chờ duyệt, nhận hồ sơ/visibility, danh bạ.
- Điều khiển kịch bản minh họa hết hạn, lỗi, thu hồi quyền; nhãn dữ liệu giả luôn rõ.
- Tìm tên có/không dấu trong fixture và mở hồ sơ mẫu; không gọi backend.
- Không đổi navigation sản phẩm, dependency, lockfile, migration hoặc API. Không ảnh/contact thật hoặc lưu thông tin nhập ra storage.

## Task 2 — Kiểm chứng và review

- Playwright cho transition, search, scenario, keyboard; desktop/mobile320 và text200 không tràn hoặc che thao tác.
- Chạy lint/typecheck/build phù hợp; giữ E2E cũ đạt.
- Chụp ảnh local các màn hình chính và xem trực quan; review độc lập phát hiện generic card grid, tương phản, tên dài, lỗi/rỗng.
- Supervisor kiểm tra, xử lý findings, cập nhật CURRENT_STATE rồi trình bản mẫu cho chủ dự án duyệt.

## Gate tiếp theo

Bản mẫu được duyệt trực quan mới bắt đầu nối UI nghiệp vụ với backend. Test đạt không thay cho duyệt thị giác. Không tự merge/deploy.
