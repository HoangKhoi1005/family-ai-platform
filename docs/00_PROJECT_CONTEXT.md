# Bối cảnh dự án

## Sản phẩm

**Family AI** là tên làm việc cho một không gian gia đình riêng tư. Giá trị: **Biết nhau – Kết nối nhau – Lưu giữ nhau**. Trải nghiệm hướng tới phòng khách số: thấy người thân, nhớ việc nhà, trao đổi và giữ kỷ niệm.

Người dùng muốn gia phả trực quan; hồ sơ có thông tin liên hệ; bổ sung người và admin duyệt; lịch việc quan trọng có nhắc trước; AI hỏi đáp; chat realtime; chia sẻ ảnh lấy cảm hứng Locket. Giao diện tiếng Việt gần gũi, không mang cảm giác bảng quản trị. Pilot là **15 người**, mở rộng nếu chứng minh hữu ích.

## Baseline để phát triển

- Private first → thử trong nhà → đo tính hữu ích → mở rộng.
- Web/PWA trước; native/widget sau. Đây là hướng thiết kế đề xuất, không phải cam kết mọi khả năng native có trên web.
- Gia phả là nền tảng danh tính và quan hệ; ảnh, trò chuyện và lịch tạo lý do quay lại. Đây là giả thuyết cần kiểm chứng bằng pilot.
- Một nhà trong giao diện pilot, nhưng dữ liệu và authorization chuẩn bị cho nhiều nhà.
- MVP có chat nhóm chung và ảnh đơn giản. AI là giai đoạn tiếp theo trong tầm nhìn sản phẩm, không bị loại bỏ.
- Lịch âm/giỗ, cách xưng hô và khả năng dùng của người lớn tuổi là yêu cầu thiết kế chính.

## Bất biến dữ liệu

User là tài khoản, Member là người trong gia phả. Member có thể không có User. Một User có thể tham gia nhiều FamilySpace; quyền được xét theo từng nhà. Quan hệ nằm giữa Member. Không dùng LLM để xác định sự thật gia phả hoặc ngày âm.

Gia đình khác nhau không thấy dữ liệu của nhau. Trong cùng nhà, quyền cấp trường vẫn áp dụng. Admin quản trị membership và duyệt quan hệ; không mặc nhiên được đọc mọi trường riêng tư hay chat riêng.

## Phạm vi và trạng thái

Nguồn phạm vi phát hành: [MVP](04_MVP_SCOPE.md). Nguồn tiến độ: [CURRENT_STATE](../CURRENT_STATE.md). Đã có monorepo nền tảng theo [ADR-001](decisions/ADR-001-monorepo.md): npm/Turbo, TypeScript, Next.js, Fastify, PostgreSQL. Đợt onboarding email/mật khẩu, lời mời, duyệt membership và nhận hồ sơ đã được tích hợp; gói ổn định mất mạng, claim hết hạn và thu hồi quyền đang ở nhánh kiểm chứng. Auth dùng Better Auth theo [ADR-002](decisions/ADR-002-authentication.md). Hosting, storage và LLM provider chưa chọn; chưa có dữ liệu gia đình thật.

## Các giả định cần xác minh

| Giả định                                       | Cách kiểm chứng                      | Công việc vẫn có thể làm        |
| ---------------------------------------------- | ------------------------------------ | ------------------------------- |
| Người thân dùng được link/PWA                  | Thử cài trên iPhone/Android thật     | Prototype và domain             |
| Có 2 người có thể quản trị                     | Trao đổi với chủ dự án               | Thiết kế vai trò                |
| Chat nhóm chung đủ ở bản đầu                   | Theo dõi nhu cầu sau pilot           | Chat nhóm, không hứa chat riêng |
| Lịch và ảnh là lý do quay lại                  | Phản hồi trực tiếp, số liệu tổng hợp | Làm lịch và feed đơn giản       |
| Phần lớn có email hoặc cách đăng nhập thay thế | Inventory 15 người                   | Thiết kế auth độc lập provider  |

Không cần chặn việc viết spec vì chưa biết những câu trả lời này. Trước triển khai phụ thuộc, xác minh điểm cần thiết và ghi decision.

## Thành công kỳ vọng

Sau 4 tuần dùng thật: phần lớn người được mời truy cập được, các thế hệ đều có người sử dụng, ít nhất một sự kiện được tổ chức qua lịch, có chia sẻ ảnh tự phát. Mục tiêu số cụ thể ở [vision](01_PRODUCT_VISION.md) là giả thuyết đánh giá, không phải số liệu đã đạt.

## Cách chuyển sang AI khác

Gửi: “Đọc AGENTS.md, CURRENT_STATE.md và docs/00_PROJECT_CONTEXT.md; đọc spec liên quan rồi thực hiện task. Phân biệt thiết kế dự kiến với implementation. Không suy đoán tiến độ từ tài liệu.” Mẫu đầy đủ nằm trong [TASK](../templates/TASK.md).
