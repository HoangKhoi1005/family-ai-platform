# Gia phả — FR-03

## Mục tiêu

Nhìn được quan hệ, tìm người và bổ sung thông tin có kiểm soát trên điện thoại. Nguồn chuẩn là Member/Relationship đã duyệt, không phải lời AI hoặc bố cục của sơ đồ.

## Luồng và biểu diễn

Mở “Quanh tôi” khi có account link; nếu chưa có, chọn người gốc trong nhà → mở các thế hệ → chạm hồ sơ. Có “Cả nhà” với thu gọn nhánh và danh bạ thay thế. API giới hạn độ sâu/phân trang, không bắt tải mọi node khi mở rộng.

Đề xuất thêm người/quan hệ → form nêu loại quan hệ và các đối tượng → pending → admin xem thay đổi → kiểm chu trình/trùng/cross-family → duyệt → graph cập nhật. Không vẽ đề xuất như cạnh chính thức. Phân biệt parent_child biological/adoptive/unspecified và partnership có hiệu lực/lịch sử.

MVP hiển thị đường nối và quan hệ gần khi đủ dữ liệu. Không hứa engine tự suy ra mọi cách xưng hô; khi nhiều đường hoặc thiếu dữ kiện, hiển thị đường quan hệ và cho phép tên gọi thủ công theo cặp.

## Nghiệm thu

- **TREE-01** Given A là cha/mẹ B và B là cha/mẹ C, When thêm C là cha/mẹ A, Then transaction bị từ chối, kể cả hai thao tác đồng thời gây chu trình.
- **TREE-02** Given Member A/B khác nhà, When tạo cạnh, Then server/constraint từ chối.
- **TREE-03** Given cạnh self hoặc cạnh trùng, Then không lưu; partner A–B tương đương B–A khi xét trùng.
- **TREE-04** Given một người tái hôn, Then giữ được partnership cũ kết thúc và partnership mới; không ghi đè lịch sử.
- **TREE-05** Given quan hệ cha mẹ nuôi, Then không hiển thị thành huyết thống.
- **TREE-06** Given đề xuất pending/rejected, Then graph chính không thay đổi; approved có audit và version mới.
- **TREE-07** Given đường C là cha của B và B là cha của A đã xác minh, Then có căn cứ gọi C là ông nội của A; nếu thiếu vai trò/gender của đường nối, không suy ra nội/ngoại chỉ từ tên.
- **TREE-08** Given chỉ một người trong cây, Then hiển thị thẻ và gợi ý bổ sung phù hợp quyền; không lỗi layout.
- **TREE-09** Given người không dùng được kéo/zoom, Then danh bạ và liên kết hồ sơ cung cấp lối truy cập tương đương.

Mở rộng sau: thuật ngữ họ hàng vùng miền đầy đủ, GEDCOM, export sơ đồ in lớn. Chưa có thư viện graph/layout đã chọn.

## Trạng thái triển khai 2026-09-10

Backend C1–C4 đã có trên nhánh `feat/family-relationships`: migration 0010, graph read, create/update/remove request, cancel, admin list/approve/reject, audit và kiểm chu trình đồng thời. Tab Gia phả trong `/app` chưa nối contract này; thư viện graph và thao tác pan/pinch/drag vẫn thuộc gói D.
