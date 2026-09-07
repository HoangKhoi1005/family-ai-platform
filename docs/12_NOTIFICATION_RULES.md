# Lịch và thông báo

## Mô hình ngày

Event giữ ngày gốc và loại lịch; Occurrence là ngày cụ thể đã tính. Giữ nguyên ngày âm và chính sách nhuận; không biến năm nào cũng thành một ngày dương cố định. Lịch Việt tính theo múi giờ của lịch Việt; timezone sự kiện quyết định giờ nhắc hiển thị/gửi. Baseline nhà dùng Asia/Ho_Chi_Minh.

Ngày không rõ không tạo nhắc giả. Sinh nhật thiếu ngày/tháng chỉ hiển thị năm đã biết. Lặp dương 29/2 cần policy rõ `feb28` hoặc `mar1`, UI cho chọn, baseline đề xuất feb28. Với ngày âm 30 trong tháng chỉ 29 ngày, `missing_day=last_day` là mặc định đề xuất, hiển thị cho người tạo.

`month_mode` âm lịch:

- `regular`: chỉ tháng thường, kể cả năm có tháng nhuận trùng số; mặc định đề xuất cho ngày giỗ.
- `leap_only`: chỉ tháng nhuận tương ứng; năm không có thì không tạo occurrence.
- `both`: tạo hai occurrence nếu có cả thường và nhuận; người dùng phải chủ động chọn.

Không tự chọn phong tục cho mọi gia đình. Ngày gốc thuộc tháng nhuận phải được người tạo xác nhận quy tắc lặp. Chọn thư viện/service dựa trên đối chiếu ngày tham chiếu đáng tin; lưu version thuật toán, range năm hỗ trợ và chính sách khi ngoài range. Chưa chọn nguồn nên không bịa ngày quy đổi trong fixtures.

## Quy tắc nhắc pilot

- Offsets tùy chọn: trước 7 ngày, 1 ngày và trong ngày; mặc định nhắc 09:00 giờ sự kiện cho all-day. Sự kiện có giờ phải không nhắc sau lúc bắt đầu.
- Quiet hours baseline 21:00–07:00 theo người nhận. Dời tới cuối quiet hours nếu còn trước hạn hữu ích; nếu đã quá thì bỏ push, vẫn để sự kiện trong lịch.
- Nhắc trong app là bản ghi nguồn; push là kênh cố gắng gửi, không hứa người dùng chắc chắn nhìn thấy. Bị tắt quyền push vẫn dùng lịch và inbox.
- Không gửi bù toàn bộ nhắc quá hạn khi worker phục hồi. Baseline bỏ push nhắc quá 2 giờ so với due_at hoặc sự kiện đã bắt đầu, tùy mốc đến trước.
- Nội dung mặc định: “Nhà mình có một ngày quan trọng sắp tới”. Deep link luôn xác thực lại.
- Sửa ngày/scope hoặc hủy sự kiện: tăng revision, hủy jobs cũ, tạo jobs mới; job cũ kiểm revision trước gửi.

## Delivery

Outbox ghi trong transaction thay đổi dữ liệu. Dedupe theo family + recipient + occurrence + event revision + offset + channel. Worker dùng lock/lease tránh xử lý song song, kiểm membership, preferences và nguồn còn hiệu lực; ghi attempts, provider response và trạng thái.

Retry lỗi tạm thời với backoff, tối đa 5 lần trong cửa sổ hữu ích; token không hợp lệ thì disable. Không claim exactly-once push khi provider đã nhận nhưng worker mất acknowledgment: dùng khóa thay thế/collapse nếu provider hỗ trợ và chấp nhận rủi ro trùng hiếm. Bản ghi inbox duy nhất bằng unique dedupe key.

Chat push gộp theo thread, mute được; không đẩy từng reaction. Khoảnh khắc mặc định thông báo gộp, người dùng tùy chọn. Không đăng ký kênh SMS/email tự động khi chưa chọn provider và chưa được người dùng đồng ý.

## Ca kiểm thử bắt buộc

Giao năm âm/dương, tháng nhuận regular/leap_only/both, ngày 30 không tồn tại, sinh nhật 29/2, đổi timezone, nhắc trong quiet hours, worker chạy lại, retry sau provider timeout, sửa/hủy sát giờ, revoke membership giữa enqueue và send. Test dùng clock cố định và các ngày tham chiếu đã xác minh; không dùng output của cùng thuật toán làm expected duy nhất.
