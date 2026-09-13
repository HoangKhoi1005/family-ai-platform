# ADR-003 — Bộ chuyển đổi âm lịch Việt Nam

Ngày: 2026-09-13. Trạng thái: Baseline đã triển khai cho Calendar Core; cần đối chiếu thêm với lịch Việt Nam đáng tin cậy trước pilot thật.

## Quyết định

Dùng `@dqcai/vn-lunar` phiên bản ghim `1.0.1` bên trong adapter của `@family/domain`. Fastify, database và UI chỉ phụ thuộc interface `CalendarConverter`; không gọi package trực tiếp. Mỗi occurrence âm lịch sẽ lưu chuỗi version `@dqcai/vn-lunar@1.0.1` để có thể truy vết và tạo lại khi thuật toán thay đổi.

Package có giấy phép MIT, không có dependency runtime, công khai mã TypeScript và khai báo khoảng năm 1200–2199. Probe trên Node 24.18 xác nhận hai chiều dương ↔ âm cho Tết 2024, hai tháng 6 thường/nhuận năm 2025 và Tết 2026. Adapter không tin output một chiều: nó kiểm định dạng đầu vào, chuyển ngược để xác minh đúng ngày/tháng/năm/cờ nhuận và trả `CALENDAR_UNAVAILABLE` nếu ngày không tồn tại, ngoài range hoặc provider lỗi.

## Dữ liệu kiểm chứng

Fixture [`vietnamese-lunar-reference.json`](../../packages/domain/test-data/vietnamese-lunar-reference.json) chép các expected date đã được công bố riêng từ:

- [`lunar.h`](https://github.com/hnthap/lunar.h): bảng đầu tháng năm 2025, gồm tháng 6 thường, tháng 6 nhuận và ví dụ ngày 6 tháng 6 nhuận;
- [`lunar-vn`](https://github.com/junkeythong/amlichvietnam): mùng 1 Tết 2026;
- [`Lịch Ta`](https://github.com/zeforc/lichta): mùng 1 Tết 2024.

Các implementation trên được xuất bản riêng nhưng phần lớn cùng dựa trên dòng thuật toán Hồ Ngọc Đức. Vì vậy chúng giúp phát hiện lỗi tích hợp, leap flag, range và regression; chúng chưa phải ba phép tính thiên văn hoàn toàn độc lập. Trước khi dùng với ngày giỗ thật, cần nhờ một người trong gia đình đối chiếu các ngày pilot với lịch Việt Nam tin cậy và lưu bộ expected đã xác nhận.

## Phương án đã xem xét

- `@nghiavuive/lunar_date_vi@2.0.1`: mã nguồn và lịch sử tốt hơn, nhưng probe trên Node 24.18 cho thấy dương → âm đúng còn `LunarDate.toSolarDate()` ném `Invalid date` ở toàn bộ ca kiểm thử hai chiều. Không chọn cho runtime hiện tại.
- `@lichta/core@2.2.2`: package mới, API rõ và đóng gói ESM/CJS tốt, nhưng repository công khai chỉ chứa build output/tài liệu và nói mã nguồn nằm ở private repository. Chỉ dùng một expected example, không dùng làm dependency.
- `lunar-calendar-ts-vi@1.0.2`: TypeScript/MIT nhưng hoạt động và phát hành cũ hơn, ít bằng chứng bảo trì.
- Tự chép thuật toán vào repo: giảm dependency nhưng chuyển trách nhiệm kiểm định toàn bộ thuật toán cho dự án; chưa hợp lý ở pilot.

## Hệ quả và giới hạn

Dependency còn trẻ và có ít lịch sử commit, nên phải giữ adapter hẹp, version ghim và golden fixture trong repo. Nâng package là thay đổi có kiểm soát: chạy lại toàn bộ dataset, kiểm tra tháng nhuận/giao năm/ngày 29–30 và tạo lại occurrence tương lai bằng revision mới. LLM không được tham gia chuyển đổi hoặc sửa kết quả.
