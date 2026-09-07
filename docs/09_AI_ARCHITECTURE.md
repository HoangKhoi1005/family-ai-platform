# AI gia đình

Giai đoạn 2, chưa triển khai. Mục tiêu là tra cứu và hỗ trợ diễn đạt bằng tiếng Việt; AI không có quyền quyết định sự thật hoặc tự sửa dữ liệu.

## Luồng

1. Xác thực User và active FamilyMembership; kiểm hạn mức.
2. Phân loại câu hỏi; xác định mơ hồ về người/ngày, hỏi rõ khi cần.
3. Gọi tool allowlist, truyền scope từ server: tìm người, đọc contact được phép, tìm occurrence, xem đường quan hệ đã duyệt.
4. Tool lọc quyền trước query/trả trường/tổng hợp. Không đưa dữ liệu bị cấm vào prompt rồi yêu cầu mô hình giấu đi.
5. LLM diễn đạt dữ liệu được trả về; nguồn là entity/version thật từ tool. Response validator bỏ claim không có bằng chứng hoặc trả trạng thái thiếu dữ liệu.
6. Trả câu trả lời và liên kết mở lại qua API có kiểm quyền. Ghi metric không chứa nội dung riêng tư.

## Structured data và RAG

Ngày sắp tới lấy EventOccurrence từ calendar service; quan hệ lấy graph đã duyệt; contact lấy DTO đã lọc. Không embedding toàn bộ Member để thay query có cấu trúc.

Khi thêm Document/Memory: chỉ index nội dung được đồng ý dùng cho AI, kèm family_id, source_id, revision và access metadata. Filter quyền trước retrieval; kiểm lại source khi dùng; thu hồi/xóa nguồn phải vô hiệu chunk/cache. Nội dung tài liệu và chat là dữ liệu không tin cậy, không được thay system instruction hay yêu cầu gọi tool vượt quyền.

Chat, kể cả phòng chung, **không nằm trong nguồn AI mặc định**. Tính năng tóm tắt chat cần spec/quyền/đồng ý riêng; chat riêng không được mở qua quyền admin. Không fine-tune để nhớ contact hoặc gia phả. Không có tuyên bố “dữ liệu không rời hệ thống” khi chưa kiểm provider; trước pilot AI xác minh retention, training setting và chỉ gửi dữ liệu cần thiết.

## Contract hành vi

Trạng thái `answered`, `needs_clarification`, `insufficient_data`, `access_denied`, `unavailable`. Không dùng “không có người này” khi thực tế chỉ không có quyền và điều đó làm lộ phạm vi; dùng thông báo không xác nhận sự tồn tại. Câu trả lời factual có nguồn; lời chúc sáng tạo không cần nguồn nhưng không tự thêm sự kiện cá nhân.

Request sửa quan hệ/contact chỉ tạo draft khi feature được phép; phải có bước người dùng xác nhận và approval domain trước apply. MVP AI đầu chỉ đọc và soạn văn bản.

## Đánh giá

[Dataset](../evals/README.md) khởi đầu có 24 ca tổng hợp, không phải 200–500 ca đã xác thực. Đánh giá riêng đúng dữ kiện, không lộ dữ liệu, nguồn, xử lý thiếu/mơ hồ, ngày tháng và prompt injection. Không chỉ dùng accuracy trung bình.

Gate đề xuất: toàn bộ ca riêng tư/chéo nhà/injection phải qua; ca cấu trúc có expected facts phải khớp hoàn toàn; câu tự do chấm rubric. Thay model/prompt/tool/permission/retrieval chạy lại cùng fixture/clock và tập bổ sung chưa dùng để chỉnh prompt. Lưu phiên bản model, cấu hình, chi phí và báo cáo; chưa có eval runner/model result thì không nói AI đã qua gate.

Provider lỗi/timeout: trả thông báo dễ hiểu, không fallback sang query bỏ quyền. Rate limit theo người và nhà, giới hạn context/output và quota chi phí trước khi bật cho người dùng.
