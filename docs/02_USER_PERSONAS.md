# Người dùng và hành trình

Các persona dưới đây là giả định thiết kế, không phải hồ sơ người thật.

| Persona                  | Nhu cầu                        | Khó khăn                         | Thiết kế hỗ trợ                                         |
| ------------------------ | ------------------------------ | -------------------------------- | ------------------------------------------------------- |
| Ông/bà ít dùng công nghệ | Xem ảnh con cháu, biết lịch    | Chữ nhỏ, quên thao tác đăng nhập | Chữ lớn, nhãn rõ, giữ phiên an toàn, trợ giúp trực tiếp |
| Người lo việc gia đình   | Nhắc giỗ, tập hợp tham dự      | Thông tin trôi trong chat        | Lịch âm/dương, RSVP, ghim sự kiện                       |
| Người trẻ ở xa           | Gửi ảnh nhanh, hiểu người thân | Ít động lực mở ứng dụng mới      | Feed ảnh ngắn, thả cảm xúc, gia phả quanh tôi           |
| Admin gia đình           | Mời đúng người, sửa cây        | Trùng hồ sơ, duyệt nhầm          | So sánh thay đổi, chống nhận nhầm hồ sơ, audit          |

## Hành trình chính

1. **Gia nhập:** nhận link mời có hạn → xác thực → thấy trạng thái chờ → admin duyệt membership và liên kết hồ sơ → Nhà mình. Link bị thu hồi có thông báo dễ hiểu, không lộ tên/thành viên của nhà.
2. **Tìm người:** Gia phả hoặc danh bạ → tìm tên có/không dấu → chọn hồ sơ → xem quan hệ và thông tin được phép → gọi điện/mở liên kết.
3. **Nhớ việc:** mở Lịch nhà → xem cả lịch âm/dương → mở chi tiết → xác nhận tham dự → tùy chọn nhắc.
4. **Chia sẻ:** Nhà mình → Gửi ảnh → xem trước và nhãn “Cả nhà” → gửi → tiến trình upload → thành công hoặc thử lại không nhân đôi.
5. **Tra cứu AI, giai đoạn 2:** nhập câu hỏi → kết quả từ dữ liệu được phép → bấm nguồn → nếu thiếu thì yêu cầu người có quyền bổ sung.

## Khảo sát tối thiểu trước pilot

Ghi loại máy/OS/trình duyệt, phương thức đăng nhập khả dụng, mức chữ mong muốn, vùng xưng hô, thói quen ngày giỗ và thời gian nhận nhắc. Không thu mật khẩu hoặc thông tin không cần cho trải nghiệm.
