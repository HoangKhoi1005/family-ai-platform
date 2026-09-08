# Bản mẫu luồng vào nhà và danh bạ

## Phạm vi được chủ dự án duyệt

Chuẩn bị bản mẫu tương tác để duyệt trực quan trước khi triển khai UI nghiệp vụ. Baseline main 3e411b7 đã merge PR7; backend không thay đổi trong đợt này.

## Luồng

- Từ bản mẫu Nhà mình có đường vào thử onboarding.
- Nhận lời mời → bước tài khoản minh họa → xác minh/chờ duyệt → xem đề nghị nhận hồ sơ và visibility → vào danh bạ.
- Danh bạ tìm tên tiếng Việt có/không dấu, tên thường gọi và mở hồ sơ mẫu.
- Có điều khiển kịch bản minh họa lời mời hết hạn, thu hồi quyền và lỗi; không giả thành trạng thái server thật.

## Ranh giới

- Routes nằm dưới /design-preview; nhãn dữ liệu giả rõ ràng.
- Không gọi API auth, gửi email, tạo membership hoặc lưu mật khẩu. Không nhập dữ liệu thật.
- UI nghiệp vụ chỉ nối backend sau khi chủ dự án duyệt trực quan. Bản mẫu không chứng minh quyền server hoặc onboarding E2E thực.
- Giữ navigation/domain/tokens; không thêm chức năng chat, lịch hoặc AI.

## UX nghiệm thu

Album gia đình Việt đương đại: nội dung và tên người quyết định phân cấp. Luồng vào nhà tập trung một bước chính mỗi lần; danh bạ ưu tiên tìm đúng người thay vì dashboard. Dùng tiếng Việt tự nhiên, không suy vai vế từ tên, không card grid đồng loạt, gradient tím xanh, emoji trang trí hoặc số liệu giả không được đánh dấu.

- Desktop/mobile không tràn ngang; tên dài và thiếu ảnh vẫn nhận diện được.
- Nhãn input, focus bàn phím, nút bấm tối thiểu44px và chữ lớn200% sử dụng được.
- Mọi nút trong bản mẫu có hành vi hoặc được giải thích rõ là minh họa.
- Kết quả giao: routes hoạt động, E2E bản mẫu, ảnh/preview để chủ dự án xem; không merge/deploy tự động.

## Điều phối

Một implementer Luna xhigh; supervisor giữ spec và trạng thái. Reviewer độc lập sau triển khai. Chủ dự án duyệt trực quan là bước riêng, không được suy ra từ build/test đạt.
