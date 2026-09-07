# Trò chuyện realtime — FR-05

## Phạm vi

Một thread chung mỗi nhà. Text tối đa baseline 4.000 ký tự, một ảnh mỗi tin, reply, cảm nhận trạng thái đang gửi/đã lưu/lỗi, xóa của mình và moderation admin có audit. Không gọi video, chat riêng, read receipt từng người hoặc tóm tắt AI mặc định.

## Luồng tin nhắn

Client tạo client_message_id → optimistic “Đang gửi” → server xác thực membership, thread, media/reply → transaction persist và sequence → ack → fanout sau commit. Người nhận dedupe theo message/event ID. Kết nối lại lấy các tin thiếu bằng cursor. “Đã gửi” nghĩa server đã lưu, không nghĩa mọi người đã đọc.

Upload ảnh theo private media flow; UI không tạo tin ảnh hỏng trước ready. Reply chỉ trỏ tin cùng thread; tin bị xóa giữ tombstone tối thiểu để không đứt lịch sử nhưng không lộ body/media đã xóa. Người mới được duyệt xem lịch sử thread chung theo baseline; giải thích trong onboarding.

## Nghiệm thu

- **CHAT-01** Given hai client online cùng nhà, When gửi tin, Then cả hai thấy cùng message ID và thứ tự server.
- **CHAT-02** Given mất ack rồi retry cùng client_message_id, Then một tin duy nhất; body khác với key cũ trả conflict.
- **CHAT-03** Given offline/reconnect, Then bổ sung tin còn thiếu, không mất/nhân đôi hoặc đảo thứ tự do giờ client.
- **CHAT-04** Given giả thread ID nhà B, Then không subscribe/read/write được.
- **CHAT-05** Given quyền bị thu hồi khi socket còn mở, Then ngừng nhận nội dung mới và fetch bị từ chối.
- **CHAT-06** Given reply trỏ khác thread hoặc media của người khác chưa được phép, Then từ chối.
- **CHAT-07** Given tin đã xóa, Then payload/history/media theo parent không còn trả nội dung; ghi rõ bản đã tải không thu hồi được.
- **CHAT-08** Given text chứa HTML/script, Then hiển thị an toàn, không chạy script.
- **CHAT-09** Given push chat, Then mặc định không hiện text nhạy cảm, có mute/gộp.
- **CHAT-10** Given câu hỏi AI yêu cầu đọc chat, Then không đưa thread chung hoặc riêng vào tool mặc định.

Đo mục tiêu latency theo NFR-04 trên môi trường xác định; không gọi chat đạt realtime chỉ vì UI polling hiển thị được một tin trong demo.
