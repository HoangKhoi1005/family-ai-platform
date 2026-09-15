# Vận hành staging

Bộ runbook này dành cho staging miễn phí của pilot 15 người. Môi trường chỉ dùng dữ liệu hư cấu cho đến khi toàn bộ checklist nghiệm thu được ký. Bắt đầu tại [Oracle staging](ORACLE_STAGING.md), sau đó chạy [backup và restore drill](BACKUP_RESTORE.md), ghi kết quả vào [staging acceptance](STAGING_ACCEPTANCE.md), và dùng [incident runbook](INCIDENTS.md) khi có sự cố.

Các tài liệu dùng placeholder `REPLACE_WITH_*`; không thay chúng trong Git. Secret thật chỉ nằm tại `/opt/family-ai/secrets/staging.env` trên VM với mode `0600`, trong R2 token, Resend và age identity tương ứng. Không chép email, tên thành viên, số điện thoại, token, signed URL, nội dung ảnh hoặc database row vào issue, log hay biên bản nghiệm thu.

Thứ tự chuẩn:

1. Xác nhận quota miễn phí, tạo VM và khóa SSH.
2. Tạo hai R2 bucket private, CORS chính xác và Resend sender.
3. Build image ARM64 từ commit cố định.
4. Migrate hai lần, provision restricted roles, rồi khởi động dịch vụ.
5. Kiểm tra readiness qua cổng web và bật Tailscale Funnel.
6. Chạy synthetic onboarding/media smoke.
7. Tạo encrypted backup, restore vào database `_restore_drill`, và lưu metadata không nhạy cảm.
8. Theo dõi alert trong bảy ngày trước khi đề xuất pilot thật.
