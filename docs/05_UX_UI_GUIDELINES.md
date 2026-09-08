# UX/UI tiếng Việt

## Cấu trúc

Baseline: **Nhà mình · Gia phả · Lịch nhà · Trò chuyện**. Khoảnh khắc nằm trên Nhà mình; avatar mở hồ sơ/cài đặt. AI giai đoạn 2 là ô “Hỏi chuyện nhà…” có thể truy cập từ Nhà mình; tránh nút nổi che thao tác.

Nhà mình ưu tiên: một lời chào ngắn → sự kiện thật sự cần chú ý → ảnh mới → hành động gửi ảnh. Không bắt người dùng đi qua thống kê. Khi có nhiều nội dung, giới hạn phần đầu, dùng “Xem thêm”. Không tự thay tên tab giữa các màn hình.

## Cá tính và tokens

Ấm áp, sáng, nhiều ảnh thật khi có sự đồng ý; nền kem, xanh lá làm màu chính, cam đất làm điểm nhấn. [Tokens](../design/tokens.json) là nguồn chuẩn, CSS tại packages/ui được sinh bằng `npm run tokens:generate` và đang dùng trên trang giới thiệu. Chưa có ảnh gia đình thật hoặc màn hình nghiệp vụ. Font hệ thống hỗ trợ tiếng Việt; không phụ thuộc tải font để đọc nội dung.

Cỡ chữ nội dung mặc định 16 px, chế độ chữ lớn 20 px; không khóa zoom. Nút chính tối thiểu 44×44 CSS px. Trạng thái không chỉ dùng màu; icon luôn có tên truy cập. Mục tiêu độ tương phản: chữ thường 4.5:1, chữ lớn 3:1; kiểm tra trên thiết kế thực, đặc biệt chữ đè lên ảnh.

## Tiêu chí tránh giao diện chung chung

Yêu cầu trực tiếp của chủ dự án ngày 2026-09-08: không AI slop, AI-generated UI hoặc generic AI app. Hướng **Album gia đình Việt đương đại** đang được thử bằng bản mẫu; chưa coi là thiết kế đã duyệt.

- Dùng nhịp bố cục có chủ đích: tên người, ảnh và câu chuyện là điểm nhấn; không xếp mọi nội dung vào các thẻ bo góc giống nhau.
- Không gradient tím xanh, hiệu ứng kính, emoji trang trí, thống kê giả hoặc lời quảng cáo sáo rỗng. Màu, kiểu chữ, khoảng cách và chuyển động dùng tokens, mỗi lựa chọn phục vụ phân cấp và thao tác.
- Hồ sơ phải giúp nhận ra và liên hệ đúng người; Nhà mình giúp biết chuyện nhà hôm nay. Không bê cùng bố cục dashboard vào cả hai màn hình.
- Dữ liệu bản mẫu hoàn toàn hư cấu và có nhãn rõ. Không bịa ảnh/ngày/sự kiện trong sản phẩm thật để làm màn hình đầy hơn.
- Không suy đoán vai vế từ tên. Ví dụ “Bác Hai” chỉ là tên thường gọi do fixture/người dùng khai báo.
- Tính năng chưa triển khai không tạo nút chết trên giao diện sản phẩm. Bản mẫu độc lập phải giải thích rõ phần nào chỉ để duyệt thiết kế.

Gate thiết kế: trình bản mẫu Nhà mình và hồ sơ trên desktop/mobile cho chủ dự án trước khi triển khai hàng loạt màn hình. Việc duyệt bản mẫu không đồng nghĩa đã kiểm chứng với người lớn tuổi hoặc thiết bị thật.

Checklist visual review: trọng tâm rõ; nội dung tiếng Việt tự nhiên; tên dài không cắt; thiếu ảnh vẫn nhận diện được; nút bấm đủ lớn; bàn phím/focus rõ; zoom 200% còn dùng được; không tràn ngang; lỗi/rỗng/chờ duyệt được thiết kế; tương phản đạt mục tiêu; không dùng màu làm dấu hiệu duy nhất.

## Câu chữ trong sản phẩm

- “Gửi ảnh cho cả nhà”, “Chờ quản trị viên duyệt”, “Bạn chưa có quyền xem thông tin này”.
- Dùng tên thường gọi đã cấu hình; không suy đoán tuổi/giới hoặc vai vế từ tên.
- Không đưa “tenant”, “RAG”, “token”, “database” vào UI người dùng.
- Dùng glossary; “Kỷ niệm” khác “Khoảnh khắc”, không thay bằng “Album” tùy ý.

## Gia phả trên điện thoại

Mặc định hiển thị quanh người được chọn, 2–3 thế hệ tùy không gian; có zoom, kéo và “Về vị trí ban đầu”. Cung cấp danh bạ tương đương để không phụ thuộc sơ đồ. Chạm thẻ mở hồ sơ, không sửa trực tiếp cạnh quan hệ. Quan hệ chưa rõ có nhãn rõ; không vẽ cạnh phỏng đoán như đã xác minh.

## Trạng thái bắt buộc

Loading, chưa có dữ liệu, lỗi thử lại, offline, quyền bị thu hồi, nội dung đã xóa, upload đang chạy, yêu cầu chờ duyệt và xung đột phiên bản. Không hiện thành công trước khi server xác nhận; optimistic UI phải đánh dấu “Đang gửi”.

## Onboarding và người lớn tuổi

Hướng dẫn ngắn theo thiết bị để mở trình duyệt hệ thống và thêm màn hình chính. Chỉ xin quyền thông báo sau giải thích lợi ích và thao tác chủ động. Có “Để sau”. Chế độ dễ dùng làm nổi bật xem ảnh, xem lịch, gọi người thân; không tạo dữ liệu hoặc quyền khác.

Không tự phát âm thanh, không ép duy trì chuỗi ngày đăng ảnh, không cuộn tự động làm mất vị trí. Tôn trọng cài đặt giảm chuyển động. Trước pilot, kiểm tra ít nhất một người lớn tuổi thực hiện hai việc chính mà không có người hướng dẫn bấm hộ.
