# Đánh giá đề xuất đầu vào

## Giữ lại

Markdown trong Git là bộ nhớ bền vững; tách User/Member; phân vùng theo FamilySpace; feature spec có nghiệm thu; AI kiểm quyền trước truy xuất; lịch âm do phần mềm lịch xử lý; decision log và CURRENT_STATE dựa trên bằng chứng. Những phần này hữu ích ngay cho việc đổi coding agent.

## Điều chỉnh trong v1.0

| Đề xuất đầu vào                      | Đánh giá và cách xử lý                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Pilot 30–100 người                   | Không khớp yêu cầu: dùng 15 người. Mở rộng chỉ là định hướng.                                                            |
| 30–50 trang bắt buộc                 | Độ dài không đo chất lượng. Tạo tài liệu có chủ đề rõ và tiêu chí kiểm chứng, tránh lặp.                                 |
| Khóa mọi quyết định ngay             | Phân biệt Confirmed, Baseline, Proposed; không coi gợi ý của AI là người dùng đã phê duyệt.                              |
| PostgreSQL/Supabase đã hoàn thành    | Repo chưa có code. PostgreSQL chỉ là schema tham chiếu; Supabase chưa chọn.                                              |
| Mọi bảng có family_id                | Áp dụng cho dữ liệu thuộc nhà. User là global; ràng buộc liên bảng mới ngăn được dữ liệu chéo nhà.                       |
| Một family_id cố định                | Không hardcode vào authorization; dùng ít nhất hai gia đình giả trong test.                                              |
| Năm tab, bỏ Lịch khỏi tab chính      | Baseline bốn mục: Nhà mình, Gia phả, Lịch nhà, Trò chuyện. Khoảnh khắc nằm ở Nhà mình; hồ sơ ở avatar; AI là ô hỏi.      |
| Circle/Household/Branch ngay MVP     | Hoãn nhóm chia sẻ tùy biến; MVP khoảnh khắc chia sẻ cả nhà, nhãn phạm vi rõ ràng.                                        |
| DB + RAG cho mọi câu hỏi             | Tra dữ liệu có cấu trúc trước. RAG chỉ thêm khi có kho tài liệu được phép và nhu cầu thực.                               |
| 200–500 câu AI ngay                  | Bắt đầu 24 ca giả có kiểm quyền, không đủ để chứng nhận production; mở rộng sau khi có use case thật.                    |
| Locket ngay trên web                 | Feed ảnh làm ở PWA; widget hệ điều hành thuộc giai đoạn native.                                                          |
| Đọc trước rồi chờ duyệt mọi task     | Đọc và lập kế hoạch ngắn rồi thực hiện trong phạm vi được giao. Approval sản phẩm khác với approval thao tác phát triển. |
| Nhiều agent theo sơ đồ tổ chức       | Chưa cần cho quy mô hiện tại. Chỉ phân công khi có yêu cầu và công việc độc lập.                                         |
| Tạo sẵn frontend/backend/mobile rỗng | Không tạo cấu trúc giả khi chưa chọn stack. Chỉ tạo tài liệu, specs, tokens và tài sản kiểm thử hữu ích.                 |

## Hạn chế của Project Brain

AGENTS.md không bảo đảm mọi công cụ tự đọc. Khi chuyển công cụ, đưa đường dẫn AGENTS.md và CURRENT_STATE.md trong prompt mở đầu; nếu công cụ có file chỉ dẫn riêng, dùng file cầu nối ngắn trỏ về đây. Không sao chép nguyên bộ quy tắc thành nhiều bản.

Tài liệu không tự thực thi bảo mật. Cần constraints, authorization, test tích hợp và kiểm thử thiết bị khi có code. Thuật ngữ “nguồn sự thật” chỉ có giá trị nếu tài liệu được cập nhật cùng thay đổi.
