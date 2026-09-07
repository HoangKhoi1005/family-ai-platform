# Hồ sơ người thân — FR-02

## Mục tiêu

Tìm đúng người, hiểu họ là ai, liên hệ bằng thông tin được phép. Hồ sơ tồn tại dù người đó không có tài khoản.

## Dữ liệu và luồng

Tên hiển thị bắt buộc; tên thường gọi, ảnh, ngày/năm sinh, tình trạng đã mất, quê quán, giới thiệu ngắn và contact tùy chọn. Ngày chưa rõ giữ null; không ép giới tính hay trạng thái hôn nhân để tạo hồ sơ. Phone/email/Facebook là thông tin liên hệ, không thu mật khẩu Facebook.

Danh bạ/tìm kiếm → hồ sơ → thao tác gọi hoặc mở liên kết. Chủ hồ sơ đã liên kết chỉnh thông tin mình; quan hệ đi qua ChangeRequest. Admin quản lý hồ sơ chưa có account theo policy, có audit. Contact mới mặc định self, người sở hữu chọn chia sẻ với gia đình; hồ sơ chưa liên kết không tự công bố contact.

Kiểm phone/email theo định dạng nhưng không dùng validation để tuyên bố thông tin đã được xác minh; URL chỉ cho scheme an toàn http/https, nút gọi dùng số đã chuẩn hóa. Tên tiếng Việt giữ dấu; tìm kiếm không dấu không làm thay dữ liệu gốc.

## Nghiệm thu

- **MEM-01** Given người đã mất hoặc trẻ nhỏ, When tạo Member, Then không yêu cầu User/email đăng nhập.
- **MEM-02** Given contact self, When người khác kể cả admin xem/search/export/hỏi AI, Then value không xuất hiện.
- **MEM-03** Given người sở hữu xem hồ sơ đã liên kết, Then xem/sửa contact self được và lưu visibility rõ ràng.
- **MEM-04** Given hai người cùng tên, When tìm kiếm, Then có lựa chọn phân biệt bằng thông tin được phép; không tự gộp hồ sơ.
- **MEM-05** Given phiên bản hồ sơ đã đổi, When gửi patch cũ, Then 409 và UI cho tải lại, không ghi đè im lặng.
- **MEM-06** Given birth_year nhưng thiếu ngày, Then không hiện sinh nhật 01/01 hoặc tạo reminder giả.
- **MEM-07** Given User thuộc hai nhà, Then liên kết/hồ sơ/quyền mỗi nhà độc lập, không tự đồng bộ contact.
- **MEM-08** Given font phóng lớn, Then tên/nút gọi không bị cắt và hồ sơ dùng được không cần sơ đồ.

Ngoài phạm vi: đồng bộ Facebook, tự quét danh bạ thiết bị, import dữ liệu người thân từ Internet.
