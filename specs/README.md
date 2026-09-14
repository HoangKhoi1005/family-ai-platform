# Feature specs

Spec là hợp đồng hành vi; trạng thái dưới đây phản ánh code đã merge vào `main`, không suy ra chỉ từ việc có tài liệu. Đọc domain, security và UX liên quan trước khi thay đổi.

| Spec                                 | Trạng thái trên `main`                     | Phụ thuộc còn mở                    |
| ------------------------------------ | ------------------------------------------ | ----------------------------------- |
| [Admin và truy cập](admin/README.md) | Đã triển khai cho pilot                    | Mail/hosting production             |
| [Hồ sơ](member-profile/README.md)    | Đã triển khai cho pilot                    | Media/avatar thật                   |
| [Gia phả](family-tree/README.md)     | Đã triển khai graph, đề xuất và duyệt      | Thử nhánh lớn trên thiết bị thật    |
| [Lịch](calendar/README.md)           | Đã triển khai lịch, inbox và preferences   | Push và bổ sung occurrence dài hạn  |
| [Chat](chat/README.md)               | Planned; preview chỉ tương tác cục bộ      | Media, realtime và retry            |
| [Khoảnh khắc](moments/README.md)     | Planned; preview chỉ tương tác cục bộ      | Private storage và media processing |
| [Nhà mình](home/README.md)           | Connected shell tối thiểu; preview mở rộng | Moments và dữ liệu hoạt động thật   |
| [AI](family-ai/README.md)            | Planned cho phase sau                      | Permission tools, provider và eval  |

Thêm tính năng qua [template](../templates/FEATURE_SPEC.md). Không tạo implementation cho feature hoãn chỉ vì thư mục/spec tồn tại.
