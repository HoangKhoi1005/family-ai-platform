# Những điều phải tránh

Danh sách nhắc nhanh; quy tắc quyền đầy đủ nằm ở [privacy/security](docs/10_PRIVACY_SECURITY.md).

- Không công khai hồ sơ, ảnh, email, số điện thoại hoặc sơ đồ gia đình theo mặc định.
- Không dùng family ID từ request như bằng chứng người gọi thuộc gia đình đó.
- Không để dữ liệu chéo nhà lọt qua API, storage, realtime, tìm kiếm, AI, cache, export hoặc log.
- Không để LLM tự tạo quan hệ gia phả, tính ngày âm hoặc chạy SQL không giới hạn.
- Không mặc định đưa chat vào AI, huấn luyện hay embedding.
- Không áp dụng sửa quan hệ khi chưa có quyết định duyệt hợp lệ; admin vẫn cần audit.
- Không coi hồ sơ người đã mất là thông tin công khai, hoặc trẻ nhỏ là tài khoản bắt buộc.
- Không đưa secret, dữ liệu thật hoặc ảnh gia đình vào fixture/repo.
- Không gửi push chứa nội dung riêng tư nhạy cảm trên màn hình khóa mặc định.
- Không thêm follower, bảng xếp hạng lượt thích, quảng cáo hoặc cơ chế gây áp lực đăng bài.
- Không gọi schema dự kiến là migration đã chạy; không ghi tính năng hoàn thành khi mới có tài liệu.
- Không dùng quá trình đọc context làm lý do dừng mọi task để xin xác nhận lại.
