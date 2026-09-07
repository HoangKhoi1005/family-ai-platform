# Phạm vi MVP

## Có trong pilot

Một FamilySpace cho 15 người, tối thiểu hai vai trò quản trị/thành viên; mời và duyệt; hồ sơ cho cả người không có tài khoản; cây quan hệ đã duyệt; hồ sơ và danh bạ có quyền cấp trường; lịch âm/dương và RSVP; nhắc trong app và push trên thiết bị hỗ trợ; chat nhóm chung; ảnh khoảnh khắc cho cả nhà; Nhà mình; backup/export qua quy trình admin có kiểm quyền.

Khoảnh khắc MVP: một ảnh mỗi bài, caption tối đa 500 ký tự, cảm xúc không xếp hạng. Chat: text, một ảnh mỗi tin, reply và trạng thái gửi. Lịch: nhắc cố định trước 7 ngày, 1 ngày và trong ngày có tùy chọn tắt. Đây là giới hạn baseline để triển khai có thể kiểm thử.

## Hoãn

AI tra cứu đến giai đoạn kế tiếp khi dữ liệu/quyền ổn định; không yêu cầu RAG ngay. Chat riêng, gọi thoại/video, widget, app native, chia sẻ theo circle, voice story, nhập gia phả hàng loạt, thanh toán, quản trị nhiều nhà và mạng xã hội công khai không thuộc pilot.

Household/Branch/Memory/Document có định nghĩa để tránh nhầm nhưng chưa yêu cầu bảng/màn hình đầy đủ. Quan hệ có thể biểu diễn tái hôn và cha mẹ nuôi trong thiết kế; chưa xây engine xưng hô toàn bộ Việt Nam.

## Điều kiện mời gia đình dùng thật

- FR-01 đến FR-07 qua nghiệm thu liên quan; không còn lỗi quyền nghiêm trọng.
- Đã thử trên ít nhất một iPhone và một Android đại diện cho người dùng thực; nếu thiếu thiết bị ghi rõ hạn chế và điều chỉnh phạm vi mời.
- Push được thử khi app đóng và sau thu hồi quyền; giao diện vẫn có lịch/nhắc trong app khi push bị tắt.
- Lịch âm qua bộ ngày tham chiếu đã được kiểm chứng, có tháng nhuận và giao năm.
- Backup đã khôi phục được trong môi trường thử; không lưu PII trong repo/log.
- Chủ dự án được xem bản cụ thể và quyết định thời điểm mời 15 người. Không biến mục này thành yêu cầu xin duyệt mọi task code.
