# Incident runbook

Chỉ ghi timestamp UTC, release SHA, container/service, event code, request ID không nhạy cảm, trạng thái và hành động. Không chép request body, email, số điện thoại, member/family name, token, signed URL, caption, story, message, object URL hoặc database row vào log/issue.

| Event code                      | Dấu hiệu                              | Hành động đầu tiên                                                                  |
| ------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `OPS_VM_UNREACHABLE`            | VM/SSH và readiness đều mất           | Kiểm tra OCI instance/boot volume/quota; không tự tạo paid replacement.             |
| `OPS_DISK_PRESSURE`             | Disk vượt 75% hoặc PostgreSQL ghi lỗi | Dừng deploy, kiểm tra Docker/log/tmp; không xóa volume hoặc backup chưa xác minh.   |
| `OPS_DATABASE_UNAVAILABLE`      | `/health/ready` 503, API restart      | Giữ web khỏi traffic, kiểm tra PostgreSQL health và restricted role; không log URL. |
| `OPS_R2_UNAVAILABLE`            | Upload/read thất bại                  | Xác nhận endpoint, bucket private, token scope/CORS; giữ object quarantine.         |
| `AUTH_EMAIL_DELIVERY_FAILED`    | Xác minh/reset không tới              | Kiểm tra Resend status/sender/quota; không log người nhận hoặc verification URL.    |
| `worker_batch_failed`           | Reminder batch retry                  | Kiểm tra database readiness và lease; không chỉnh row trực tiếp.                    |
| `media_worker_batch_failed`     | Media processing retry                | Kiểm tra R2/object metadata và worker limit; không tải nội dung vào issue.          |
| `OPS_WORKER_RETRY_EXHAUSTED`    | Job vượt retry policy                 | Cô lập job bằng ID không nhạy cảm, sửa dependency, dùng workflow replay được duyệt. |
| `OPS_SECRET_EXPOSURE_SUSPECTED` | Key/token có thể đã lộ                | Thu hồi/rotate key ngay, rotate role password liên quan, invalidate session.        |
| `OPS_MEMBERSHIP_REVOKE`         | Cần chặn một tài khoản                | Revoke membership bằng luồng admin, xác nhận request kế tiếp bị từ chối.            |
| `OPS_BACKUP_FAILED`             | Job không có `BACKUP_COMPLETED`       | Giữ backup tốt gần nhất, kiểm tra disk/R2/age, chạy lại và xác nhận checksum.       |

Nếu nghi lộ owner database credential, dừng API/worker nếu cần, rotate owner và toàn bộ restricted role passwords bằng command provisioning được bảo vệ, rồi xác nhận role/RLS trước khi mở lại traffic. Nếu media hoặc backup key lộ, thu hồi token đúng bucket để tránh mở rộng blast radius.

Sau sự cố, ghi nguyên nhân và biện pháp bằng metadata kỹ thuật. Dữ liệu người thân chỉ được mô tả bằng loại dữ liệu và phạm vi ảnh hưởng, không bằng giá trị thực. Một incident chưa có restore/checksum evidence không được dùng làm lý do bỏ qua gate pilot.
