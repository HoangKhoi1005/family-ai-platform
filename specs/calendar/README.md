# Lịch nhà — FR-04

## Mục tiêu và luồng

Nhớ sinh nhật, ngày giỗ và cuộc gặp; người tạo nhìn thấy quy tắc lặp trước lưu. Lịch nhà có danh sách sắp tới và chế độ tháng; ngày âm/dương hiển thị rõ nhãn.

Tạo → chọn loại sự kiện và âm/dương → ngày gốc → quy tắc lặp/nhuận → nơi tổ chức/ghi chú/giờ → xem trước lần sắp tới → lưu. Occurrence và reminder do calendar service/worker tạo. Chỉ cho lưu cấu hình lịch nằm trong range đã hỗ trợ, không dùng quy đổi phỏng đoán để vượt lỗi service.

Mỗi occurrence có RSVP của người dùng hiện tại; sửa/hủy sự kiện yêu cầu creator/admin. Job tuân thủ [notification rules](../../docs/12_NOTIFICATION_RULES.md). Khả năng thêm liên kết địa điểm đủ cho MVP; không cần bản đồ nội bộ hoặc theo dõi vị trí.

## Nghiệm thu

- **CAL-01** Given ngày giỗ lặp âm, When chuyển năm, Then giữ ngày âm/policy, tính occurrence dương bằng nguồn đã kiểm chứng.
- **CAL-02** Given tháng nhuận, Then regular/leap_only/both đúng chính sách; UI mô tả rõ sự khác biệt.
- **CAL-03** Given ngày 30 trong tháng âm 29 ngày hoặc 29/2 năm không nhuận, Then áp policy đã lưu, không tự đổi âm thầm.
- **CAL-04** Given event sửa/hủy khi reminder đang chờ, Then revision cũ không gửi và lịch không còn occurrence cũ hoạt động.
- **CAL-05** Given worker retry, Then inbox không trùng; ghi nhận giới hạn dedupe push theo provider.
- **CAL-06** Given người dùng tắt push hoặc thiết bị không hỗ trợ, Then lịch/inbox vẫn dùng được; không lặp xin quyền.
- **CAL-07** Given quiet hours hoặc job trễ, Then dời/bỏ theo rule, không gửi nhắc sau lúc bắt đầu sự kiện.
- **CAL-08** Given hai nhà có cùng ngày sự kiện, Then danh sách, RSVP và reminder không giao nhau.
- **CAL-09** Given RSVP gửi lại, Then upsert cùng actor/occurrence, không nhân đôi người tham dự.
- **CAL-10** Given service lịch ngoài range/lỗi, Then báo không thể xác nhận ngày, không nhờ AI tính thay.

Chưa có bộ expected dates âm lịch được chứng thực; task calendar phải bổ sung nguồn độc lập và test trước khi đánh dấu feature xong.
