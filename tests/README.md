# Chiến lược kiểm thử

Đã có Vitest cho policy/config/API, integration PostgreSQL và Playwright cho trang giới thiệu. Các business rules toàn MVP dưới đây vẫn là chiến lược tương lai; xem [CURRENT_STATE](../CURRENT_STATE.md) về kết quả thật. Không coi script kiểm tài liệu là test ứng dụng.

| Lớp                          | Các ca giá trị cao                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| Domain unit                  | Chống chu trình, kiểu quan hệ, policy ngày/lặp, version transition                   |
| Database/API integration     | Composite FK, quyền tenant/field, RLS/bypass worker, approval đồng thời, idempotency |
| Realtime/storage integration | Reconnect/dedupe, revoke socket, private media, orphan/delete, URL TTL               |
| Notification worker          | Clock cố định, quiet hours, revision cũ, retry và dedupe, revoke trước send          |
| E2E                          | Mời → duyệt → nhận hồ sơ; gửi ảnh; chat hai client; tạo sự kiện → xem lời nhắc       |
| Accessibility/device         | Chữ lớn, keyboard/screen reader, iPhone/Android thật, PWA push khi đóng app          |
| AI evaluation                | Facts/sources, thiếu/mơ hồ, chéo nhà, trường riêng, injection và stale cache         |
| Operations                   | Backup restore, deletion ledger sau restore, secrets/log không PII                   |

## Quy tắc dữ liệu

Ít nhất hai gia đình giả, một User thuộc cả hai, member không account, pending, revoked, admin và member. Không dùng dữ liệu gia đình thật. [AI fixture](../evals/fixtures.json) chỉ phục vụ eval; không thay toàn bộ fixture kiểm thử ứng dụng.

## Release gates

Các AC thuộc phạm vi qua kiểm tra phù hợp; lỗi quyền/mất dữ liệu phải xử lý trước phát hành. Ghi exact command, môi trường, seed, clock và kết quả khi test có thật. Không đặt mục tiêu coverage phần trăm thay cho kiểm business rule. Không lặp test rộng nếu không có thay đổi/rủi ro mới.

Lịch âm cần nguồn expected độc lập; kiểm cùng hàm hai lần không phải đối chiếu. AI cần eval runner thực và review ca tự do; cấu trúc JSON hợp lệ không chứng minh AI đúng.
