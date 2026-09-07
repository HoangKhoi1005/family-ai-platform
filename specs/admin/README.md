# Truy cập và quản trị — FR-01

## Mục tiêu và phạm vi

Chỉ người được mời và duyệt được vào nhà. Admin quản lý membership, nhận hồ sơ và duyệt thay đổi; không mở quyền đọc contact self của người khác. Pilot một nhà, tối thiểu một admin active, khuyến khích hai người quản trị.

## Luồng

Admin tạo link mời có hạn, có thể nhắm một Member → người nhận xác thực và nhận lời mời → pending → admin kiểm danh tính/liên kết → approved active. Không coi ai có link cũng là đúng người được nhắm; tên/email trùng chỉ là gợi ý.

Admin xem hàng chờ với phần thay đổi trước/sau, người đề xuất, thời gian và version. Duyệt chạy validation lại và apply trong một transaction. Link mời, quyết định và thu hồi ghi audit tối thiểu. Cách bootstrap admin đầu tiên phải được chọn trong task auth, không mở endpoint công khai tự nhận admin.

## Trạng thái lỗi

Hết hạn/đã dùng/thu hồi link; hồ sơ đã liên kết; membership đang chờ; version conflict; không được xóa admin cuối cùng. Nội dung lỗi trước duyệt không lộ danh bạ nhà.

## Nghiệm thu

- **ADM-01** Given người chưa đăng nhập, When mở link, Then không đọc được cây/ảnh/chat trước xác thực và duyệt.
- **ADM-02** Given token expired/revoked/consumed, When accept, Then không tạo active membership.
- **ADM-03** Given hai request nhận cùng link đồng thời, When commit, Then chỉ một lần consume thành công; không liên kết một Member với hai User.
- **ADM-04** Given member A, When sửa familyId hoặc ID sang B, Then API không trả dữ liệu B.
- **ADM-05** Given pending hoặc revoked, When gọi API/subscribe realtime/media/AI, Then từ chối theo policy; job push chưa gửi bị bỏ.
- **ADM-06** Given hai admin duyệt cùng ChangeRequest, Then chỉ apply một lần; request sau nhận conflict/kết quả đã xử lý, không tạo cạnh trùng.
- **ADM-07** Given admin cuối cùng, When tự revoke hoặc hạ role, Then không thực hiện.
- **ADM-08** Given hồ sơ chưa liên kết có contact, When nhận hồ sơ, Then xác nhận ownership/visibility và chấm dứt quyền quản lý tạm của admin.

## Chưa thuộc phạm vi

KYC, duyệt hai lớp bắt buộc, quản trị nhiều nhà trong UI, mời hàng loạt qua SMS. Gửi lời mời thực tế chỉ khi người dùng thực hiện hoặc giao rõ tác vụ gửi.
