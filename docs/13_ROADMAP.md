# Lộ trình theo điều kiện hoàn thành

Chưa ước lượng ngày phát hành khi chưa chọn stack và năng lực triển khai. Các phase là thứ tự phụ thuộc, không phải tiến độ đã làm.

| Phase                     | Kết quả                                                        | Điều kiện đi tiếp                                                 |
| ------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0 — Project Brain         | Tài liệu, spec, dữ liệu giả, giả định rõ                       | Link/JSON hợp lệ; baseline không mâu thuẫn                        |
| 1 — Prototype và nền tảng | Chọn stack, prototype mobile, auth/membership, private storage | Thử người lớn tuổi; test tenant/role/field; backup plan           |
| 2 — Pilot core            | Hồ sơ, gia phả, lịch/nhắc, chat nhóm, khoảnh khắc, Nhà mình    | Gate MVP, thiết bị thật, restore thử                              |
| 3 — Học từ 15 người       | 4 tuần phản hồi, sửa điểm khó dùng                             | Đánh giá mục tiêu vision và lý do người dùng quay lại/bỏ dùng     |
| 4 — AI và kỷ niệm         | Structured Q&A có nguồn, sau đó tư liệu nếu cần                | Eval gate, provider/privacy, quota; spec kỷ niệm trước code       |
| 5 — Native và mở rộng     | Widget, nhiều nhà trong UI, vận hành lớn hơn                   | Nhu cầu chứng minh, chi phí bền vững, test isolation và phân phối |

## Thứ tự task đầu

Prototype → chọn stack/ADR → auth và tenant isolation → hồ sơ/account link → approval/quan hệ → tree UI → event occurrence/lunar tests → inbox/push worker → media → moments/chat → thử pilot. Một số việc có thể làm song song khi đã có API/domain ổn định; không cần dựng đội nhiều agent để bắt đầu.

## Kiểm soát phạm vi

Mỗi ý tưởng mới ghi mục tiêu, ai dùng, tần suất, ảnh hưởng riêng tư và tiêu chí thử; phân loại thay thế hay bổ sung MVP. Không tăng scope chỉ vì công nghệ hỗ trợ. Nhóm chat có thể tiếp tục dùng công cụ quen trong lúc thử, nhưng app vẫn phải hoàn thành chat nhóm đã cam kết trong pilot trước công bố core hoàn chỉnh.
