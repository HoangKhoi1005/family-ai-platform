# Kỷ niệm — FR-07

## Mục tiêu và phạm vi

Giữ những câu chuyện gia đình cần nhớ lâu theo một dòng thời gian riêng tư. Kỷ niệm có thể được tạo từ một Khoảnh khắc hoặc tạo thủ công, gồm tối đa 50 phần nội dung dạng ảnh, lời kể chữ hoặc âm thanh. Pilot chỉ có audience **Cả nhà** và Kỷ niệm là đích theo ngữ cảnh, không thêm tab thứ sáu.

## Luồng pilot

Khoảnh khắc → **Lưu thành Kỷ niệm** → timeline → **Thêm lời kể** → viết hoặc thu/chọn bản ghi → upload riêng tư → worker xác minh → gắn item bằng optimistic version. Audio chỉ phát sau thao tác của người dùng; tệp nháp chỉ ở memory của tab.

Giới hạn âm thanh: WebM/MP4/MP3/Ogg, tối đa 25 MB và 10 phút theo metadata đã kiểm ở server. Nội dung ảnh dùng cùng pipeline bỏ metadata như Khoảnh khắc. Một media có thể được Moment và Memory cùng tham chiếu; xóa một parent không được xóa object khi parent khác còn sống.

## Nghiệm thu

- **MEM-01** Given active member, When mở timeline, Then chỉ thấy Memory của đúng nhà và item theo `position`.
- **MEM-02** Given Moment đã publish, When lưu hai lần, Then nhận cùng một Memory thay vì tạo bản sao.
- **MEM-03** Given Memory version cũ, When thêm item, Then trả conflict và không ghi item rời.
- **MEM-04** Given media chưa ready, sai purpose, sai owner hoặc khác nhà, Then server từ chối gắn item.
- **MEM-05** Given audio hợp lệ, Then worker xác minh signature/thời lượng và UI không autoplay.
- **MEM-06** Given membership bị revoke, Then timeline/content endpoint không còn trả dữ liệu; draft browser bị xóa khỏi state.
- **MEM-07** Given Moment bị xóa nhưng Memory còn dùng ảnh, Then ảnh vẫn mở được từ Memory.
- **MEM-08** Given parent cuối cùng bị xóa, Then media bị ẩn ngay và job xóa object được enqueue idempotent.
- **MEM-09** Given nhà chưa có Kỷ niệm hoặc request lỗi, Then UI có trạng thái rỗng/lỗi thật, không chèn chuyện hay ảnh fixture.

## Chưa thuộc lát cắt này

Biên tập lại thứ tự item, cộng tác nhiều người trên cùng bản nháp, transcript AI, audience theo nhánh/nhóm, export và phục hồi từ backup cần spec/quyền riêng trước khi triển khai.
