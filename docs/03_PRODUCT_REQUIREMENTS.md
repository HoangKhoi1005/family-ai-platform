# Yêu cầu sản phẩm

P0 = cần cho pilot; P1 = sau pilot đầu, vẫn thuộc định hướng; P2 = mở rộng. “Có spec” không đồng nghĩa đã triển khai.

| ID    | Yêu cầu                                                         | Ưu tiên | Spec                                       |
| ----- | --------------------------------------------------------------- | ------- | ------------------------------------------ |
| FR-01 | Vào nhà theo lời mời, admin duyệt, thu hồi quyền                | P0      | [Admin](../specs/admin/README.md)          |
| FR-02 | Hồ sơ độc lập tài khoản; liên hệ và quyền cấp trường            | P0      | [Hồ sơ](../specs/member-profile/README.md) |
| FR-03 | Gia phả trực quan, quanh tôi, danh bạ, đề xuất quan hệ          | P0      | [Gia phả](../specs/family-tree/README.md)  |
| FR-04 | Lịch âm/dương, giỗ, sinh nhật, họp mặt, RSVP, nhắc trước        | P0      | [Lịch](../specs/calendar/README.md)        |
| FR-05 | Chat nhóm gia đình realtime, ảnh, trả lời, phân trang lịch sử   | P0      | [Chat](../specs/chat/README.md)            |
| FR-06 | Khoảnh khắc ảnh cả nhà, cảm xúc, xóa bài của mình               | P0      | [Khoảnh khắc](../specs/moments/README.md)  |
| FR-07 | Nhà mình ưu tiên ảnh và việc sắp tới                            | P0      | [Nhà mình](../specs/home/README.md)        |
| FR-08 | AI tra cứu có nguồn, kiểm quyền, thiếu dữ liệu thì từ chối đoán | P1      | [AI](../specs/family-ai/README.md)         |
| FR-09 | Kỷ niệm dài hạn, voice story, tài liệu                          | P1/P2   | Chưa có spec triển khai                    |
| FR-10 | Native, widget, nhiều nhà trong UI, nhóm chia sẻ tùy biến       | P2      | Chưa có spec triển khai                    |

## Yêu cầu phi chức năng

- **NFR-01 Quyền:** server kiểm membership và quyền đối tượng/trường ở mọi đường truy cập, kể cả realtime/storage/AI. Test âm tính với hai nhà là điều kiện phát hành.
- **NFR-02 Dễ dùng:** UI tiếng Việt, hỗ trợ chữ lớn, thao tác cảm ứng tối thiểu 44×44 CSS px, dùng được bàn phím, nhãn cho trình đọc màn hình; kiểm tra thực tế thay vì chỉ dựa vào token.
- **NFR-03 Độ tin cậy:** retry không tạo trùng tin nhắn/nhắc; hiển thị trạng thái offline, upload lỗi, thiếu quyền và dữ liệu rỗng.
- **NFR-04 Hiệu năng:** ngân sách đề xuất cho pilot: nội dung đầu màn hình dưới 3 giây, tin nhắn đến người đang online p95 dưới 2 giây trong bài đo có mạng ổn định; ghi thiết bị/mạng/cỡ mẫu. Đây là mục tiêu cần đo, chưa phải SLA.
- **NFR-05 Vận hành:** backup và thử khôi phục trước nhận dữ liệu thật; log không chứa PII/nội dung chat; có cách thu hồi truy cập và xử lý xóa dữ liệu.
- **NFR-06 Khả chuyển:** tài liệu trong Git, dữ liệu có cách export, schema có migration khi triển khai; tránh gắn domain vào API riêng của nhà cung cấp.

Các tiêu chí chi tiết nằm trong spec; không hoàn thành yêu cầu nếu chỉ làm happy path.
