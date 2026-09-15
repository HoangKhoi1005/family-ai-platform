# Lộ trình theo điều kiện hoàn thành

Chưa ước lượng ngày phát hành khi chưa chọn hosting và năng lực vận hành. Các phase là thứ tự phụ thuộc; tiến độ thực tế được ghi riêng trong [CURRENT_STATE](../CURRENT_STATE.md).

| Phase                     | Kết quả                                                        | Điều kiện đi tiếp                                                 |
| ------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0 — Project Brain         | Tài liệu, spec, dữ liệu giả, giả định rõ                       | Link/JSON hợp lệ; baseline không mâu thuẫn                        |
| 1 — Prototype và nền tảng | Chọn stack, prototype mobile, auth/membership, private storage | Thử người lớn tuổi; test tenant/role/field; backup plan           |
| 2 — Pilot core            | Hồ sơ, gia phả, lịch/nhắc, chat nhóm, khoảnh khắc, Nhà mình    | Gate MVP, thiết bị thật, restore thử                              |
| 3 — Học từ 15 người       | 4 tuần phản hồi, sửa điểm khó dùng                             | Đánh giá mục tiêu vision và lý do người dùng quay lại/bỏ dùng     |
| 4 — AI và kỷ niệm         | Structured Q&A có nguồn, sau đó tư liệu nếu cần                | Eval gate, provider/privacy, quota; spec kỷ niệm trước code       |
| 5 — Native và mở rộng     | Widget, nhiều nhà trong UI, vận hành lớn hơn                   | Nhu cầu chứng minh, chi phí bền vững, test isolation và phân phối |

## Trạng thái hiện tại — 2026-09-15

- Đã triển khai trên `main`: stack/ADR, auth và tenant isolation, onboarding, hồ sơ/account link, quan hệ/duyệt, cây tương tác, lịch/âm lịch/RSVP, outbox/worker, inbox trong app, PWA foundation, private media, Moments, Memories và rollout A+B+C vào `/app`.
- Đã kiểm chứng gần nhất: 15/15 Turbo typecheck tasks, 189/189 unit tests trong 41 file, production build 9 workspace, Project Brain 76 Markdown/4 JSON/24 seed cases và Playwright 193 pass/3 skip theo project.
- Preview có nhãn, chưa có backend thật: Chat. Moments/Kỷ niệm trong `/app` đã dùng API và storage adapter thật.
- Đang chuẩn bị triển khai thiết kế staging miễn phí đã chọn: Oracle Ampere A1, R2 private, Resend, Tailscale Funnel, backup/restore, monitoring và pilot thiết bị thật.
- Chưa triển khai: realtime/Chat, push, AI runtime, readiness production hoàn chỉnh và pilot 15 người.

## Thứ tự tiếp theo

Dựng staging Oracle/R2/Resend/Tailscale → diễn tập migration và backup/restore → thử thiết bị thật → realtime/Chat → push trên HTTPS → pilot 15 người → đánh giá AI.

## Kiểm soát phạm vi

Mỗi ý tưởng mới ghi mục tiêu, ai dùng, tần suất, ảnh hưởng riêng tư và tiêu chí thử; phân loại thay thế hay bổ sung MVP. Không tăng scope chỉ vì công nghệ hỗ trợ. Nhóm chat có thể tiếp tục dùng công cụ quen trong lúc thử, nhưng app vẫn phải hoàn thành chat nhóm đã cam kết trong pilot trước công bố core hoàn chỉnh.
