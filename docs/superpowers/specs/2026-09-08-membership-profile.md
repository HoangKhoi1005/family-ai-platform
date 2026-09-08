# Membership và hồ sơ — thiết kế triển khai của đợt onboarding

Trạng thái: thiết kế trong phạm vi đã duyệt, chưa triển khai. Phụ thuộc authentication foundation. User đã xác minh email không tự được vào nhà. API prefix và error contract theo [API](../../11_API_CONTRACTS.md).

## Luồng mời và duyệt

Admin active tạo lời mời, hạn mặc định 7 ngày, tối đa 30 ngày; token ngẫu nhiên ít nhất 32 bytes, chỉ lưu SHA-256. Token thô chỉ trả khi tạo; giao diện cho sao chép link, không tự gửi email người thật. Link mang token ở fragment để tránh HTTP access log/referrer; web chỉ gửi token trong POST body khi người nhận chủ động nhận lời mời. Trang mời chưa xác thực không tải thông tin nhà.

Accept chạy transaction, khóa invitation, kiểm expiry/revoked/consumed, tạo membership pending và đánh dấu consumed cùng lúc. Membership existing pending/active/revoked không bị tự thay đổi do link mới; trả conflict để admin xử lý rõ. Một token chỉ nhận bởi một user. Phản hồi chỉ trạng thái chờ, không tên nhà/danh bạ/Member/contact trước duyệt.

Admin xem hàng chờ, xác nhận người được mời và optional intended Member. Approve kiểm version, trạng thái và cùng nhà, ghi audit rồi active. Revoke kiểm role/admin cuối bằng khóa chung theo nhà, ghi audit; request kế tiếp mất quyền. Hai admin cùng thao tác không ghi đè trạng thái mới. Không cung cấp endpoint role escalation trong đợt này.

## Nhận hồ sơ sau khi được vào nhà

Để không lộ private contact cho pending user, việc xem thông tin nhận hồ sơ diễn ra **sau membership active**. Admin duyệt quyền nhận một Member cụ thể (claim authorization), có audit, cùng nhà và chưa được liên kết. Không tự chọn Member vì email hoặc tên trùng.

Người đã được admin chỉ định có thể xem bản xem trước đúng hồ sơ đó, gồm contact/visibility cần xác nhận; đây là quyền hẹp phục vụ nhận hồ sơ, không mở self contact của hồ sơ khác. UI giải thích quyền xem này rõ ràng. Người nhận xác nhận ownership và visibility bằng request có version. Transaction khóa claim, Member và account links; kiểm membership vẫn active, Member chưa liên kết và version chưa đổi; tạo link và consume claim. Quyền quản lý tạm của admin kết thúc ngay.

Một membership có tối đa một Member, một Member có tối đa một membership. Claim bị revoke hoặc membership bị revoke không xem/confirm được. Trước khi chuyển quyền, người nhận có thể từ chối; không thay link hay visibility im lặng. Contact self vẫn giữ self nếu không có lựa chọn công bố rõ ràng.

`member_claims` lưu UUID, family_id, membership_id, member_id, status, expires_at, member_version, created_by và timestamps; composite FK cùng nhà, tối đa một claim active theo membership và Member. Admin chỉ tạo claim sau membership active; approve membership không tạo link. Claim mặc định hạn 7 ngày, không gia hạn ngầm; endpoint preview không nhận member_id thay thế. Không cấp quyền private fields này cho danh bạ/search/profile thông thường.

## Hồ sơ và danh bạ

Active member xem danh bạ có phân trang và tìm tên không dấu; truy vấn chỉ qua display_name/familiar_name, không dùng contact self làm nguồn tìm kiếm. Trả DTO giới hạn thay vì toàn bộ row. Hai người trùng tên được phân biệt bằng thông tin được phép như năm sinh/quê quán; không tự gộp.

Owner đã liên kết chỉnh hồ sơ/contact của mình. Admin quản lý hồ sơ chưa liên kết với audit theo policy đã có; không được sửa hoặc đọc self contact hồ sơ đã liên kết của người khác. Hồ sơ không ảnh dùng initials; upload ảnh thật thuộc private media phase sau, không lưu URL ảnh tùy ý để tránh request ngoài.

Input: display_name 1–120 ký tự; familiar_name tối đa120; hometown tối đa200; biography tối đa1000; ngày/năm sinh optional và nhất quán; deceased boolean. Contact tối đa10; value tối đa320; kind phone/email/facebook; visibility self/family. Chỉ scheme https/http cho Facebook URL, không script/data; số gọi chuẩn hóa có quy tắc, không xem định dạng là xác minh sở hữu. PATCH bắt buộc version, conflict409 khi cũ.

## Cơ chế quyền và audit

Runtime role không bypass RLS. Mỗi operation chạy transaction với actor từ session và family scope sau kiểm membership. Helpers membership nếu cần SECURITY DEFINER phải có search_path cố định, owner/grants hẹp và không trả PII; không dùng function generic SQL.

RLS đối chiếu actor và active membership từ database, không chỉ current_setting family_id. Không nhận actor/role từ request. Quyền trên bảng liên kết/approval không mở mutation trực tiếp tùy ý; API transaction thực thi các bước có audit. Bảng auth không được runtime đọc. Unknown/out-of-scope family/object trả404 không tiết lộ tồn tại.

Narrow lookup helper có thể cần owner NOLOGIN BYPASSRLS để tránh recursion do FORCE RLS; owner này chỉ có SELECT trên membership/link/claim cần thiết, không quyền auth/password/contact value, và không được cấp membership cho runtime. Chỉ helper boolean có search_path cố định được EXECUTE bởi runtime. Đây là ngoại lệ kỹ thuật của helper, không thay bất biến runtime/auth NOBYPASSRLS. Reviewer phải kiểm grants thực và không có đường SET ROLE từ runtime sang helper owner.

Audit chỉ actor/action/target/time và version hoặc tên trường thay đổi; không chép contact/token/password. Pending/revoked không đọc audit. Admin được xem audit cùng nhà, không private value.

## Bootstrap local

CLI nhận UUID của User đã xác minh và tên nhà, tạo nhà + admin membership trong một transaction, audit nguồn operator. Không tạo password qua CLI và không in PII/secret. Không tạo public endpoint bootstrap. Lệnh yêu cầu explicit local environment, owner URL loopback; không tự chạy với người dùng thật. Tạo admin giả phục vụ integration có cleanup giới hạn fixture.

## Kiểm chứng bắt buộc

Hai nhà, một user ở cả hai, pending/revoked, contact family/self, admin và admin cuối. Gọi API thực với cookies; query trực tiếp bằng runtime login cho RLS; thử giả actor/family headers. Kiểm hai request đồng thời cho accept/approve/claim/revoke-last-admin; đọc lại committed state. Kiểm rollback audit nếu mutation thất bại, stale profile update và quyền admin mất sau claim. Browser E2E sau duyệt thiết kế, không dùng test-only auth bypass.

Tài liệu này bổ sung quyền claim hẹp để thực hiện ADM-08; cần reviewer kiểm với privacy matrix trước triển khai. Đây không phải quyền self-contact mặc định cho thành viên active.
