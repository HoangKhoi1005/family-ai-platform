# Nhà mình — FR-07

## Mục tiêu

Mở app là thấy người thân và việc cần nhớ, không phải một bảng thống kê. Navigation theo [UX](../../docs/05_UX_UI_GUIDELINES.md).

## Thành phần

Lời chào theo tên hiển thị đã chọn; sự kiện quan trọng sắp tới kèm lịch âm/dương khi có; ảnh gần nhất có phân trang; nút Gửi ảnh; đường tới Lịch nhà và Trò chuyện. Avatar mở tài khoản/cài đặt; AI chỉ hiện khi feature phase 2 thực sự khả dụng, không tạo nút chết.

Mặc định ưu tiên sự kiện trong 7 ngày; không có thì thu gọn phần này. Feed theo thời gian server, không thuật toán tối ưu lượt xem. Nội dung mỗi section lấy qua API đã kiểm quyền; không tổng hợp bằng service credential rồi gửi cả payload cho client lọc.

## Nghiệm thu

- **HOME-01** Given nhà chưa có ảnh/sự kiện, Then empty state đúng và hành động theo quyền, không số liệu giả.
- **HOME-02** Given event bị hủy hoặc moment bị xóa, Then home refresh không hiển thị bản cũ như còn hiệu lực.
- **HOME-03** Given một section lỗi, Then section khác vẫn dùng được và có thử lại, không chặn toàn màn hình.
- **HOME-04** Given đổi tài khoản hoặc nhà, Then cache cũ không xuất hiện chớp nhoáng trước dữ liệu mới.
- **HOME-05** Given chế độ chữ lớn, Then nút điều hướng và hành động chính đọc/bấm được.
- **HOME-06** Given tên gọi chưa cấu hình, Then dùng tên hợp lệ hoặc lời chào chung, không AI đoán “cô/chú”.
