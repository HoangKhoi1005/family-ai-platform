# Decision log

Trạng thái theo [INDEX](INDEX.md). Ngày khởi tạo: 2026-09-08. Confirmed là yêu cầu trực tiếp của người dùng; Baseline là đề xuất của bộ tài liệu v1.0, không giả danh phê duyệt của chủ dự án.

| ID      | Trạng thái | Quyết định và lý do                                                                | Hệ quả / mở lại khi                                           |
| ------- | ---------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| PAD-001 | Confirmed  | Pilot gia đình 15 người, mở rộng nếu hữu ích                                       | Không dùng 30–100 làm scope hiện tại                          |
| PAD-002 | Confirmed  | Gia phả, liên hệ, lịch/nhắc, duyệt, chat realtime, AI, ảnh thân mật thuộc tầm nhìn | Phân phase, không ngầm loại AI                                |
| PAD-003 | Baseline   | PWA/web trước, native/widget sau                                                   | Kiểm iPhone thật; mở lại nếu widget là nhu cầu ngay           |
| PAD-004 | Baseline   | User khác Member; Membership theo nhà                                              | Quan hệ không nằm trong users                                 |
| PAD-005 | Baseline   | Isolation nhiều nhà từ đầu, không UI multi-family trong pilot                      | FK/policy/test hai nhà, không microservices                   |
| PAD-006 | Baseline   | Bốn tab: Nhà mình, Gia phả, Lịch nhà, Trò chuyện                                   | Ảnh ở Nhà mình, profile ở avatar; đổi sau usability test      |
| PAD-007 | Baseline   | Pilot chat nhóm chung và moments cả nhà                                            | Chat riêng/circle cần spec quyền riêng                        |
| PAD-008 | Baseline   | Gia phả từ dữ liệu đã duyệt, lịch từ calendar service                              | LLM không tự xác định sự thật                                 |
| PAD-009 | Baseline   | AI structured tools trước; RAG khi có tài liệu; không chat mặc định/fine-tune PII  | Cần nguồn, quyền, eval và consent trước mở rộng               |
| PAD-010 | Superseded | PostgreSQL làm relational store                                                    | Được cụ thể hóa bằng ADR-001; provider hosting vẫn mở         |
| PAD-011 | Baseline   | Modular backend, outbox worker, private media                                      | Triển khai tối giản có retry và auth, chưa chia microservices |
| PAD-012 | Baseline   | Sửa quan hệ qua approval, admin tự duyệt được nhưng audit bắt buộc                 | Có thể cần dual approval khi mở rộng                          |
| PAD-013 | Baseline   | AI phát hành sau core dữ liệu/quyền; không phải gate pilot đầu                     | Mở lại nếu chủ dự án ưu tiên AI từ lần thử đầu                |
| PAD-014 | Baseline   | Giờ/lặp âm lịch hiển thị policy, không đoán phong tục                              | Xác minh gia đình và thư viện trước calendar release          |
| PAD-015 | Baseline   | Quyền self contact không bị role admin tự vượt qua                                 | Admin quản lý hồ sơ chưa liên kết theo quy trình riêng        |

Quyết định triển khai: [ADR-001 — Monorepo stack](decisions/ADR-001-monorepo.md), Baseline đã thực hiện theo yêu cầu dựng monorepo đầy đủ của người dùng. Không đổi scope pilot.

Khi thay quyết định, thêm bản mới dùng [template](../templates/DECISION.md), đánh dấu bản cũ Superseded và chỉ ra file/spec phải đổi. Không xóa lịch sử hoặc buộc xin xác nhận lại những điều người dùng đã giao rõ.

## Đợt onboarding đã duyệt — 2026-09-08

- **PAD-016 / Confirmed:** triển khai email/mật khẩu qua thư viện xác thực được duy trì, xác minh email và khôi phục mật khẩu qua hộp thư local; OAuth/SMS sau. Admin đầu tiên qua CLI có kiểm soát. [Phạm vi](superpowers/specs/2026-09-08-onboarding.md).
- **PAD-017 / Confirmed:** tránh AI slop/generic app là tiêu chí nghiệm thu; duyệt trực quan bản mẫu Nhà mình/hồ sơ trước khi triển khai hàng loạt. Hướng Album gia đình Việt đương đại là đề xuất đang thử, không phải thiết kế đã duyệt.
- **PAD-018 / Superseded:** supervisor điều phối subagents GPT-5.6 Luna xhigh; một implementer mỗi lúc, reviewer độc lập; commit/push nhánh feature sau kiểm chứng, không merge main. Mặc định điều phối mọi feature bằng subagent được thay bởi PAD-019 để giảm chi phí context.
- **PAD-019 / Confirmed:** supervisor làm trực tiếp theo mặc định; chỉ dùng subagent cho phần độc lập hoặc review rủi ro cao có lợi ích rõ. Nếu dùng subagent, giữ lựa chọn Astra điều phối và Luna xhigh, một implementer tại một thời điểm.
