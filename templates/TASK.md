# Task: <tên cụ thể>

## Đọc trước

- AGENTS.md
- CURRENT_STATE.md
- docs/00_PROJECT_CONTEXT.md
- <spec và nguồn domain/security/UX liên quan>

## Kết quả cần đạt

<Hành vi người dùng hoặc lỗi cụ thể; ví dụ trước/sau.>

## Phạm vi

Bao gồm: <...>

Không thuộc task: <...>

Baseline cần giữ: <decision IDs, quyền, navigation liên quan; không sao chép toàn bộ docs>.

## Trước thực hiện

Đọc implementation hiện có, xác định tác động/phụ thuộc/xung đột, nêu kế hoạch ngắn rồi thực hiện phần được giao. Chỉ hỏi khi thiếu thông tin quyết định, không hỏi lại quyền đã có.

## Nghiệm thu và kiểm chứng

- <AC IDs từ spec>
- <Test/lệnh phù hợp; nếu chưa tồn tại thì ghi cần tạo, không bịa lệnh>
- <Thiết bị/dữ liệu giả/phạm vi đo nếu liên quan>

## Khi xong

Cập nhật CURRENT_STATE, spec/contract nếu hành vi đổi, decision nếu có lựa chọn mới. Báo kết quả thực và giới hạn; không đánh dấu “pass” khi chưa chạy. Triển khai theo context version trong docs/context.json.
