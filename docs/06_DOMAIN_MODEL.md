# Domain model

Nguồn chuẩn cho nghĩa dữ liệu; schema tham chiếu ở [07](07_DATABASE_SCHEMA.md).

| Thực thể                | Định nghĩa và ranh giới                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| User                    | Tài khoản xác thực toàn hệ thống, không chứa cạnh gia phả                                             |
| FamilySpace             | Không gian riêng tư của một gia đình/dòng họ                                                          |
| FamilyMembership        | User tham gia FamilySpace, có role và trạng thái pending/active/revoked                               |
| Member                  | Một người được ghi nhận trong gia phả của một nhà; có thể không có tài khoản, có thể đã mất           |
| MemberAccountLink       | Liên kết đã xác minh giữa membership và hồ sơ chính mình; không tạo chỉ vì tên/email giống            |
| Relationship            | Cạnh có kiểu giữa hai Member cùng nhà; parent_child hoặc partnership, kèm loại/hiệu lực               |
| ChangeRequest           | Đề xuất tạo/sửa người hoặc quan hệ, trạng thái và quyết định duyệt                                    |
| Household               | Nhóm gia đình sinh hoạt chung; không thay thế quan hệ huyết thống; hoãn MVP                           |
| Branch                  | Nhãn nhánh được quản trị xác định; nội/ngoại có thể phụ thuộc người đang xem; hoãn quản lý riêng      |
| Event / EventOccurrence | Định nghĩa sự kiện và lần diễn ra cụ thể sau tính lịch/lặp                                            |
| Moment                  | Ảnh chia sẻ gần thời điểm hiện tại, không mặc định tự biến mất                                        |
| Memory                  | Nội dung được chọn/lưu giữ dài hạn, có thể tham chiếu Moment; giai đoạn sau                           |
| ChatThread / Message    | Phòng trò chuyện và tin nhắn; MVP chỉ phòng chung của nhà                                             |
| Document                | Tài liệu gia đình có chủ sở hữu, quyền và nguồn; giai đoạn sau                                        |
| Notification            | Nhắc/thông báo cho một người nhận, không đồng nghĩa push đã được nhìn thấy                            |
| AIKnowledge             | Khái niệm tập dữ liệu được phép truy xuất; không phải “bản sao tất cả dữ liệu” hoặc bắt buộc một bảng |
| MediaAsset              | Đối tượng ảnh/tệp có nhà sở hữu, scope kế thừa từ nội dung, vòng đời upload/xóa                       |

## Bất biến

1. Một User có nhiều memberships, tối đa một membership mỗi nhà. Mỗi membership liên kết tối đa một Member chính mình; mỗi Member tối đa một account link đang hoạt động trong nhà. Hỗ trợ người khác cập nhật hồ sơ qua quyền, không gán họ thành chủ hồ sơ.
2. Member ở hai FamilySpace khác nhau là hai bản ghi độc lập; không tự hợp nhất toàn hệ thống hay lộ sự tồn tại ở nhà khác.
3. Relationship chỉ nối Member cùng nhà, không tự trỏ, không tạo chu trình tổ tiên. Không có giới hạn một partnership trọn đời; lưu quan hệ kết thúc/tái hôn. Parent-child có thể biological/adoptive/unspecified; không ép số cha mẹ tổng cộng bằng hai.
4. Xưng hô được tính từ đường quan hệ đã duyệt nếu đủ căn cứ, cho phép override theo cặp người xem/người được gọi. Không khẳng định nội/ngoại khi thiếu giới tính, vai trò hoặc đường nối; nhiều đường hợp lệ phải nêu sự mơ hồ.
5. Member có thể thiếu ngày sinh hoặc chỉ có năm; không tự điền 01/01. Tình trạng đã mất không mở quyền công khai.
6. Membership bị thu hồi mất quyền ngay cả khi còn Member trong gia phả. Xóa User không mặc định xóa Member hoặc cây gia phả; xử lý riêng theo yêu cầu và quyền.
7. Quan hệ chỉ trở thành dữ liệu chuẩn qua approval. Admin được tự duyệt thao tác của mình trong MVP nhưng vẫn ghi ChangeRequest và audit; baseline này cần xem lại nếu mở rộng.
8. Event ngày giỗ/sinh nhật có thể gắn Member; ngày âm giữ nguyên ngày/tháng/loại lịch và chính sách nhuận, không chỉ lưu lần quy đổi dương gần nhất.

## Trạng thái

- ChangeRequest: pending → approved/rejected/cancelled; chỉ một chuyển trạng thái cuối, phát hiện version conflict trước apply.
- Invitation: active → consumed/expired/revoked; nhận link không đồng nghĩa có quyền xem nhà.
- MediaAsset: pending → ready/failed → deleted; chưa ready không phát tán tới người nhận.
- EventOccurrence: scheduled → cancelled/completed; sửa lịch tăng revision, vô hiệu job cũ.
