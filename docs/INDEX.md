# Mục lục và quản lý context

Context **1.1.0** — 2026-09-08. [Metadata](context.json) là nơi duy nhất khai báo phiên bản bằng máy.

## Đọc theo nhu cầu

Monorepo: [Development guide](DEVELOPMENT.md), [ADR-001](decisions/ADR-001-monorepo.md).

| Nguồn chuẩn                                   | Nội dung chịu trách nhiệm              |
| --------------------------------------------- | -------------------------------------- |
| [00 Context](00_PROJECT_CONTEXT.md)           | Mục tiêu, quy mô, giả định và cách đọc |
| [01 Vision](01_PRODUCT_VISION.md)             | Giá trị, vấn đề, thành công            |
| [02 Personas](02_USER_PERSONAS.md)            | Người dùng và hành trình               |
| [03 Requirements](03_PRODUCT_REQUIREMENTS.md) | Mã yêu cầu, mức ưu tiên                |
| [04 MVP](04_MVP_SCOPE.md)                     | Ranh giới phát hành                    |
| [05 UX/UI](05_UX_UI_GUIDELINES.md)            | Navigation, giọng văn, tương tác       |
| [06 Domain](06_DOMAIN_MODEL.md)               | Nghĩa thực thể và bất biến             |
| [07 Schema](07_DATABASE_SCHEMA.md)            | Thiết kế dữ liệu tham chiếu            |
| [08 Architecture](08_SYSTEM_ARCHITECTURE.md)  | Thành phần, biên tin cậy, triển khai   |
| [09 AI](09_AI_ARCHITECTURE.md)                | Tool, retrieval, đánh giá              |
| [10 Privacy](10_PRIVACY_SECURITY.md)          | Quyền truy cập, vòng đời dữ liệu       |
| [11 API](11_API_CONTRACTS.md)                 | Contract dự kiến của client/server     |
| [12 Notifications](12_NOTIFICATION_RULES.md)  | Lịch, nhắc việc và retry               |
| [13 Roadmap](13_ROADMAP.md)                   | Thứ tự và điều kiện chuyển giai đoạn   |
| [14 Decisions](14_DECISION_LOG.md)            | Lý do, trạng thái quyết định           |
| [15 Glossary](15_PRODUCT_GLOSSARY.md)         | Thuật ngữ code/UI                      |
| [Feature specs](../specs/README.md)           | Luồng và nghiệm thu chi tiết           |
| [CURRENT_STATE](../CURRENT_STATE.md)          | Điều đã làm, chưa làm, bằng chứng      |

## Tránh nhiều nguồn sự thật

Yêu cầu mới từ chủ dự án có ưu tiên hơn baseline cũ; cập nhật tài liệu chịu trách nhiệm và decision bị tác động. Không sửa im lặng tài liệu khác để che xung đột. Domain quyết định ý nghĩa dữ liệu; security quyết định quyền; UX quyết định tên và điều hướng. Spec dẫn chiếu các nguồn này thay vì sao chép toàn bộ.

Trạng thái quyết định:

- **Confirmed**: yêu cầu được người dùng nói rõ trong phiên làm việc.
- **Baseline**: lựa chọn thiết kế được bộ tài liệu này đề xuất để tiếp tục làm việc, chưa phải phê duyệt riêng của chủ dự án.
- **Proposed**: còn cần khảo sát/so sánh trước triển khai phụ thuộc.
- **Superseded**: đã thay bởi quyết định có liên kết; không xóa lịch sử.

## Cập nhật

- Sửa lỗi chữ/liên kết: không bắt buộc tăng context version.
- Thêm chi tiết tương thích: tăng patch; thay hành vi/phạm vi tương thích: tăng minor; thay domain, biên quyền hoặc mục tiêu không tương thích: tăng major.
- Khi tăng version: cập nhật context.json, dòng version trong README/INDEX/CURRENT_STATE và ghi mục thay đổi ở đây. Version context không phải version app.
- Kết thúc task: CURRENT_STATE ghi kết quả thực, spec ghi hành vi, decision chỉ ghi lựa chọn có ý nghĩa. Không lưu mọi trao đổi vào decision log.
- Khi tài liệu lớn, ưu tiên mục lục và truy xuất theo file/symbol. RAG cho development chưa cần trong pilot.

## Lịch sử context

- 1.1.0 / 2026-09-08: chọn stack monorepo và triển khai nền tảng web/API/worker, packages, CI và migration danh tính; chưa có nghiệp vụ MVP.

- 1.0.0 / 2026-09-08: tạo baseline dựa trên yêu cầu gia đình 15 người; chưa chọn stack và chưa có implementation.
