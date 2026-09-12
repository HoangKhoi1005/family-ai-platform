# Dùng thử luồng vào nhà

Luồng tài khoản, membership, danh bạ, claim và cập nhật hồ sơ gọi API thật. Cây ở `/design-preview/tree` vẫn dùng 15 người hư cấu và có link trở về ứng dụng. Không ghép người thật với quan hệ giả. Chưa có API quan hệ.

## Mở ứng dụng local

- Web: `http://127.0.0.1:3200/login`.
- Email local: `http://127.0.0.1:8035`. Mailpit chỉ là hộp thư phát triển, không dùng ngoài môi trường local.
- Đăng ký email/mật khẩu (12–128 ký tự), mở thư xác minh, đăng nhập. Tài khoản mới chưa có quyền vào nhà.
- Admin đầu tiên cần bootstrap có kiểm soát. Với tài khoản đã xác minh, mở `/api/v1/me` trong cùng trình duyệt để lấy `user.id`. Dùng CLI hiện có theo [DEVELOPMENT](DEVELOPMENT.md); không có nút công khai tự nhận admin.

```powershell
npm run db:bootstrap-family -- --user-id <UUID-user-da-xac-minh> --family-id <UUID-moi> --name "Nhà của mình"
```

Lệnh phải chạy ở worktree onboarding với `.env` local đúng. Không chia sẻ `.env`, mật khẩu hoặc token. CLI không thay quyền một nhà đã tồn tại.

## Luồng hai người

1. Admin đăng nhập `/app`, mở Quản trị nhà, tạo link lời mời rồi tự chia sẻ cho đúng người. App không tự gửi tin/email mời.
2. Người nhận mở link, đăng ký/xác minh hoặc đăng nhập, rồi xem lại trước khi bấm Nhận lời mời. Tài khoản đã xác minh nhưng chưa có nhà cũng có thể dán nguyên link hoặc token vào `/app`. Trang chờ chỉ hiển thị trạng thái của chính tài khoản.
3. Admin tải lại danh sách và duyệt. Trang người nhận tự kiểm tra mỗi 15 giây khi đang hiển thị, khi quay lại cửa sổ, hoặc qua nút Kiểm tra trạng thái.
4. Admin chọn hồ sơ sẵn có hoặc tạo hồ sơ mới, chỉ định cho tài khoản đã duyệt. Claim chỉ định chỉ có một người nhận; server từ chối hồ sơ trùng/đã liên kết.
5. Người nhận mở Hồ sơ của tôi, kiểm tra thông tin, chọn visibility từng liên hệ, xác nhận ownership hoặc từ chối.
6. Hồ sơ đã nhận có thể chỉnh tên, tên thường gọi, quê quán, tiểu sử và tối đa 10 liên hệ. Quyền mặc định của liên hệ mới là Chỉ mình tôi. Có version để từ chối ghi đè thông tin đã thay đổi.
7. Nhà mình liên kết danh bạ thật và cây minh họa riêng. Đăng xuất vô hiệu session; quên mật khẩu gửi liên kết qua Mailpit và đặt lại mật khẩu vô hiệu session cũ.

## Lời mời và riêng tư

Token lời mời dùng URL fragment rồi được xóa khỏi URL và giữ tạm trong sessionStorage của tab; token dán thủ công cũng đi qua cùng bộ kiểm tra định dạng và vùng lưu này. Không lưu mật khẩu, hồ sơ hoặc liên hệ trong browser storage. Nhận lời mời/đăng xuất xóa token. Nếu mở thư xác minh ở tab khác, quay lại tab lời mời, mở lại link mời hoặc dán link tại `/app` để tiếp tục. Không coi tên nhà là đã xác thực trước khi server cho phép xem.

`GET /api/v1/families/:familyId/onboarding` trả `{ member_id, claims: [{ id, version }] }` cho đúng actor active. Endpoint không trả contacts hoặc claim của tài khoản khác. RLS và requireFamily áp dụng trước truy vấn. Membership pending/revoked/cross-family trả 404 theo quy tắc che tài nguyên; guest trả 401.

## Kiểm chứng

```powershell
npm run check
npm run test:auth
node --env-file=.env scripts/verify-connected-onboarding.mjs
```

Browser verification yêu cầu API/web đang chạy đúng WEB_ORIGIN local và Mailpit/PostgreSQL local. Script tạo hai tài khoản hư cấu, xác minh qua thư thật trong Mailpit, tạo riêng một nhà thử nghiệm, chạy toàn luồng và dọn dữ liệu của chính lần chạy trong finally. Không sửa tài khoản hoặc nhà khác. Email thử vẫn còn trong Mailpit; không tự xóa thư của người dùng. Ảnh local ở `.superpowers/ui-preview-evidence`.

## Giới hạn hiện tại

Chưa deploy, chưa mail production, chưa cây dữ liệu thật hoặc mobile native. Danh bạ pilot lấy tối đa 100 hồ sơ; chưa phân trang UI cho nhà lớn. Chưa có màn tự gửi đề nghị nhận hồ sơ từ thành viên; luồng hiện tại là admin chỉ định rồi người nhận xác nhận. Giao diện chức năng mới chưa được chủ dự án nghiệm thu thẩm mỹ.
