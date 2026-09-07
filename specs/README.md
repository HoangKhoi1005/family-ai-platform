# Feature specs

Tất cả spec hiện ở trạng thái **Ready for implementation planning**, chưa có code nghiệm thu. Đọc domain, security và UX liên quan trước khi làm; criteria dưới đây là hợp đồng hành vi mong muốn.

| Spec                                 | Yêu cầu          | Phụ thuộc                            |
| ------------------------------------ | ---------------- | ------------------------------------ |
| [Admin và truy cập](admin/README.md) | FR-01            | Auth adapter, membership, audit      |
| [Hồ sơ](member-profile/README.md)    | FR-02            | Admin, contact policy                |
| [Gia phả](family-tree/README.md)     | FR-03            | Hồ sơ, approval                      |
| [Lịch](calendar/README.md)           | FR-04            | Membership, calendar service, worker |
| [Chat](chat/README.md)               | FR-05            | Membership, media, realtime          |
| [Khoảnh khắc](moments/README.md)     | FR-06            | Membership, media                    |
| [Nhà mình](home/README.md)           | FR-07            | Khoảnh khắc, occurrence, hồ sơ       |
| [AI](family-ai/README.md)            | FR-08, phase sau | Quyền và dữ liệu đã ổn định          |

Thêm tính năng qua [template](../templates/FEATURE_SPEC.md). Không tạo implementation cho feature hoãn chỉ vì thư mục/spec tồn tại.
