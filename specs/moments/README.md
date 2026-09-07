# Khoảnh khắc — FR-06

## Mục tiêu và phạm vi

Gửi một ảnh cho gia đình trong vài thao tác, tạo kết nối nhẹ nhàng. MVP audience duy nhất **Cả nhà**, một ảnh, caption tối đa 500 ký tự, reaction một/người và thay đổi được. Không có followers, bảng xếp hạng hoặc widget native trong PWA.

## Luồng

Nhà mình → Gửi ảnh → camera hoặc thư viện → xem trước và nhãn Cả nhà → tải lên có tiến trình → server xử lý/kiểm ảnh → publish → feed. Từ chối camera vẫn chọn được ảnh. Không hiện nút chia sẻ nhánh/circle chưa triển khai.

Baseline giới hạn input 10 MB/ảnh; MIME cho phép xác định khi chọn image pipeline, tối thiểu JPEG/PNG/WebP. HEIC phổ biến trên điện thoại phải có xử lý đã thử hoặc thông báo chuyển định dạng rõ, không nhận file rồi lỗi im lặng. Tạo thumbnail, bỏ EXIF vị trí, kiểm số pixel và signature; cleanup orphan upload lỗi theo lịch vận hành. Media không public.

## Nghiệm thu

- **MOM-01** Given active A, When publish audience=family, Then chỉ active member A nhận/xem; B không truy cập qua API, URL, realtime hoặc cache.
- **MOM-02** Given member pending/revoked, Then không nhận feed/media mới.
- **MOM-03** Given upload gián đoạn, Then thấy trạng thái và retry; cùng client_request_id không tạo hai bài.
- **MOM-04** Given file quá giới hạn/giả MIME, Then server từ chối; không chỉ dựa kiểm client.
- **MOM-05** Given ảnh có EXIF GPS, Then bản được chia sẻ không chứa GPS.
- **MOM-06** Given người đăng xóa bài, Then feed/source media không còn được truy cập theo policy, jobs liên quan bị vô hiệu.
- **MOM-07** Given người dùng thay reaction, Then cập nhật một reaction, không tăng đếm mỗi lần retry.
- **MOM-08** Given body gửi audience=selected_people khi MVP chưa hỗ trợ, Then validation từ chối, không âm thầm chia cả nhà.
- **MOM-09** Given không có ảnh, Then lời mời gửi ảnh thân thiện, không dùng ảnh giả khiến người dùng tưởng người thân đã đăng.

Giai đoạn sau: chia nhóm tùy biến phải có recipients snapshot/dynamic policy rõ; chuyển thành Memory không tự mở rộng audience. Widget cần native spec riêng.
