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

Bộ expected dates kỹ thuật đã được thêm tại [`packages/domain/test-data/vietnamese-lunar-reference.json`](../../packages/domain/test-data/vietnamese-lunar-reference.json), gồm giao năm và tháng nhuận từ các implementation công bố riêng. Các nguồn này chủ yếu cùng dòng thuật toán Hồ Ngọc Đức, nên trước pilot thật vẫn phải đối chiếu ngày gia đình dùng với một lịch Việt Nam đáng tin cậy; không đánh dấu toàn bộ feature xong chỉ dựa vào package.

Contract máy đọc cho Event/Occurrence/RSVP nằm tại [`packages/contracts/src/calendar.ts`](../../packages/contracts/src/calendar.ts). Pilot chấp nhận timezone `Asia/Ho_Chi_Minh`; mở thêm timezone phải đi cùng kiểm thử occurrence/DST thay vì chỉ nới schema.

Calendar Core hiện có CRUD/RSVP API thật, occurrence cửa sổ 30 ngày trước đến 18 tháng sau, optimistic version, revision, audit và khóa idempotency bền trong PostgreSQL.

Lát Calendar Mobile trên `feat/family-calendar-mobile` đã nối API này vào Nhà mình: tối đa ba ngày gần nhất, timeline theo tháng, occurrence giữ trong URL, detail sheet/rail, RSVP và wizard ba bước tạo/sửa/hủy. Form tách rõ Ngày âm, Tháng âm và Năm nguồn; lần diễn ra kế tiếp dùng chung converter đã kiểm chứng. Khi mất mạng, timeline giữ bản tốt gần nhất; 401/revoke xóa family scope; conflict version buộc xem bản mới. Browser tests bao phủ 320/390/768/1280, chữ 200%, create → reload → edit → cancel và `CALENDAR_UNAVAILABLE` không làm mất bản nháp.

Event-to-outbox và worker `in_app` đã merge qua PR #17: credential riêng, lease, recheck quyền/revision/preference, quiet hours, retry năm lần và inbox dedupe. Lát Task 11 có API inbox/preferences cùng sheet mobile từ app bar, mark-read idempotent, deep link Event, phân trang, offline giữ dữ liệu tốt gần nhất và xóa cache khi quyền bị thu hồi. Push vẫn thuộc lát phát hành kế tiếp; cơ chế bổ sung occurrence khi cửa sổ trôi chưa làm.
