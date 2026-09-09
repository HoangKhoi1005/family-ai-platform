# Trải nghiệm mobile-primary — Thiết kế

**Trạng thái:** Confirmed ngày 2026-09-09; chủ dự án yêu cầu điện thoại là ứng dụng chính

**Phạm vi:** Design preview dưới `/design-preview`; chưa thay `/app` hoặc API thật

## Vấn đề cần sửa

Bản preview trước đã tìm được ngôn ngữ hình ảnh ấm, riêng tư và có tính gia đình, nhưng cấu trúc vẫn là một trang web biên tập được thu nhỏ. Tiêu đề quá lớn, thanh điều hướng nằm trên cùng, màn Nhà thiên về đọc dài và cây gia phả không chiếm vai trò của một công cụ tương tác trên điện thoại.

Phiên bản này giữ bảng màu giấy ấm, xanh lá trầm, cam đất và cách ưu tiên con người; đồng thời xây lại toàn bộ nhịp sử dụng từ màn hình điện thoại 390×844. Desktop mở rộng cùng mô hình điều hướng và nội dung, không tạo một sản phẩm khác.

## Kiến trúc ứng dụng

Năm đích chính luôn nhất quán:

1. **Nhà** — tình hình gia đình hôm nay.
2. **Khoảnh khắc** — xem và gửi ảnh thân mật.
3. **Gia phả** — sơ đồ và danh bạ người thân.
4. **Trò chuyện** — các cuộc trò chuyện gia đình.
5. **Tôi** — hồ sơ, quyền riêng tư và lối vào quản trị.

Trên điện thoại, năm đích nằm trong thanh tab cố định ở đáy, có vùng an toàn và nhãn chữ rõ. Trên desktop, cùng năm đích chuyển thành rail bên trái. Quản trị không phải tab chính; nó nằm dưới Tôi và chỉ xuất hiện với người có quyền.

Luồng nhận lời mời/onboarding ở ngoài shell đã đăng nhập. Bản preview vẫn giữ nhãn dữ liệu minh họa, nhưng nhãn này không chiếm hai hàng điều hướng của ứng dụng.

## Nhà

Nhà là màn mở hằng ngày, không phải tạp chí hay dashboard. Thứ tự ưu tiên:

1. Lời chào và nhận diện nhà.
2. Ngày quan trọng gần nhất với số ngày còn lại.
3. Khoảnh khắc mới của người thân và nút gửi ảnh nhanh.
4. Sinh nhật/việc sắp tới.
5. Lối vào cây gia phả khi cần tìm người.

Nội dung vừa một nhịp cuộn điện thoại, tiêu đề không lấn át hành động, không dùng lưới card đồng dạng hoặc số liệu giả.

## Khoảnh khắc

Feed ảnh riêng tư theo thời gian, mỗi mục cho biết người gửi, thời điểm và phạm vi chia sẻ. Nút “Gửi khoảnh khắc” mở composer dạng sheet; chọn ảnh chỉ được mô phỏng cục bộ. Preview không tải tệp và không gọi API. Reaction không hiển thị số đếm công khai.

## Gia phả

Sơ đồ chiếm phần lớn viewport. Toolbar nổi cung cấp tìm kiếm/danh bạ và “Về tôi”; điều khiển zoom có nhãn rõ. Chọn một nút mở hồ sơ dạng bottom sheet trên mobile và cột liền kề trên desktop. URL vẫn là nguồn trạng thái để deep link/reload hoạt động. Phiên bản này tạo hình thức và hành vi cơ bản của canvas; pan/pinch/drag graph thật thuộc gói triển khai graph tiếp theo.

## Trò chuyện

Màn đầu là danh sách trò chuyện ngắn, ưu tiên nhóm Cả nhà. Chọn cuộc trò chuyện mở luồng tin và ô soạn. Preview cho phép gửi một tin cục bộ để đánh giá nhịp tương tác, không gọi API và không giả vờ đã đồng bộ realtime.

## Tôi và hồ sơ

Tôi hiển thị nhận diện bản thân, các mục hồ sơ, quyền riêng tư, cài đặt thông báo và liên kết quản trị. Hồ sơ người thân dùng header vừa phải, hành động Gọi/Nhắn/Email dễ chạm, rồi đến quan hệ, ngày quan trọng và câu chuyện. Chỉnh sửa là một màn/sheet tập trung, không dùng form desktop hai cột trên điện thoại.

## Tiêu chí nghiệm thu

- Ở 390×844, năm tab đáy hiện rõ, tab hiện tại được đánh dấu và vẫn thấy sau khi cuộn.
- Nhà, Khoảnh khắc, Gia phả, Trò chuyện và Tôi đều là route hoạt động, không có tab chết.
- Quản trị không nằm trong điều hướng chính và có thể mở từ Tôi.
- Không route preview nào gọi `/api/*`.
- Cây dùng vùng làm việc gần toàn màn hình; chọn người mở dialog/bottom sheet trên điện thoại, đóng trả focus về cây.
- Composer Khoảnh khắc và gửi tin nhắn hoạt động cục bộ, có trạng thái rõ và dùng bàn phím được.
- Không tràn ngang ở 320, 390, 768 và 1280 px; target chính tối thiểu 44×44 px; reduced motion được tôn trọng.
- Visual review kiểm tra tiếng Việt dài, thiếu ảnh, trạng thái rỗng/lỗi và cảm giác app điện thoại trước khi chuyển sang `/app`.
