# Vào nhà và nhận hồ sơ — phạm vi đã duyệt

Ngày: 2026-09-08. Trạng thái: chủ dự án đã duyệt triển khai; hướng thị giác cần duyệt trên bản mẫu.

## Kết quả cần đạt

Đăng nhập bằng email/mật khẩu qua thư viện xác thực được duy trì; xác minh email, đăng xuất và đặt lại mật khẩu. Email local đi vào hộp thư thử nghiệm, không gửi người thật. Admin đầu tiên được tạo qua thao tác CLI có kiểm soát, không có endpoint công khai tự nhận quyền.

Admin tạo lời mời có hạn, thu hồi được. Người nhận xác thực và chấp nhận lời mời thành pending; admin xác minh và duyệt active. Nhận lời mời không tự nhận hồ sơ. Liên kết hồ sơ cần xác nhận ownership/visibility và duyệt; transaction cùng unique constraints ngăn nhận trùng. Không cho thu hồi admin active cuối cùng.

Danh bạ tìm tên tiếng Việt, xem hồ sơ và chỉnh hồ sơ chính mình theo quyền; admin quản lý hồ sơ chưa liên kết với audit. Contact mới mặc định self, admin không được đọc contact self người khác. Dữ liệu từng nhà được kiểm quyền tại API và PostgreSQL runtime role NOBYPASSRLS. Membership pending/revoked không đọc dữ liệu gia đình.

## Giao diện

Hướng thử: Album gia đình Việt đương đại theo [UX](../../05_UX_UI_GUIDELINES.md). Tạo bản mẫu Nhà mình và hồ sơ với dữ liệu hư cấu có nhãn, responsive, nội dung có chủ đích. Chờ chủ dự án duyệt thị giác trước khi áp dụng hàng loạt cho đăng nhập/chờ duyệt/danh bạ/hồ sơ/quản trị. Backend độc lập tiếp tục trong thời gian này.

## Nghiệm thu

- Build/lint/typecheck/tests phù hợp; kiểm integration bằng PostgreSQL thật.
- Người chưa đăng nhập/pending/revoked không đọc dữ liệu nhà; thay family/object ID không vượt quyền.
- Admin không đọc self contact của người khác qua payload/tìm kiếm.
- Invite hết hạn/đã dùng/thu hồi bị từ chối; hai request đồng thời chỉ consume một lần.
- Claim và approval đồng thời không liên kết trùng; stale profile version trả conflict.
- Reset dùng token có hạn, consume một lần; email verification kiểm expiry và replay không cấp thêm quyền/session, ghi rõ semantics thư viện. Logout vô hiệu session.
- E2E trình duyệt đăng nhập → mời → chờ → duyệt → nhận hồ sơ → chỉnh thông tin theo quyền.
- Review độc lập spec/code và visual review desktop/mobile; báo rõ giới hạn thiết bị thật.

## Điều phối và bàn giao

Luna xhigh khảo sát/triển khai/review theo task giới hạn; một implementer tại một thời điểm, không agent con. Supervisor sở hữu quyết định contracts/migrations/lockfile và tích hợp. Giữ tiến độ trong CURRENT_STATE và ledger của từng plan.

Làm trên nhánh feat/family-onboarding. Commit theo phần có kiểm chứng, push nhánh khi các gate tương ứng đạt; không merge main hoặc production deploy. Chưa có hosting, người dùng/dữ liệu thật hay lời mời thật.

Ngoài đợt này: sơ đồ gia phả tương tác, moments thật, lịch âm, chat, AI, OAuth/SMS, native/widget. Bản mẫu Nhà mình có thể mô tả nội dung tương lai nhưng không đánh dấu các tính năng đó đã triển khai.
