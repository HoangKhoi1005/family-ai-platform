# Quyền và riêng tư

Ma trận dưới đây là baseline sản phẩm. Auth/session, membership/invitation/claim và danh bạ/hồ sơ đã có API, runtime RLS và luồng web được kiểm thử; cây quan hệ thật, chat, media, export, push và AI chưa triển khai, không coi toàn bộ ma trận đã được thực thi. **Deny by default**, kiểm server-side ở từng đường truy cập. UI ẩn nút không phải authorization.

## Ma trận pilot

| Hành động                     | Chưa duyệt / đã thu hồi | Thành viên active               | Admin active                                                        |
| ----------------------------- | ----------------------- | ------------------------------- | ------------------------------------------------------------------- |
| Xem dữ liệu nhà               | Không                   | Dữ liệu nhà theo quyền          | Như thành viên, không tự mở trường riêng                            |
| Xem contact visibility=family | Không                   | Có                              | Có                                                                  |
| Xem contact visibility=self   | Không                   | Chỉ hồ sơ đã liên kết của mình  | Chỉ hồ sơ của mình; không nhờ role admin                            |
| Sửa hồ sơ bản thân            | Không                   | Có, trừ quan hệ và account link | Có, cùng ràng buộc                                                  |
| Quản lý hồ sơ chưa có account | Không                   | Gửi đề xuất                     | Có, audit; contact chưa công bố mặc định                            |
| Thêm người / đổi quan hệ      | Không                   | Đề xuất                         | Duyệt và audit, có thể tự duyệt                                     |
| Mời/duyệt/thu hồi membership  | Không                   | Không                           | Có; không tự xóa admin active cuối cùng                             |
| Ảnh/chat nhóm                 | Không                   | Đọc/gửi; xóa nội dung mình      | Như thành viên, có moderation và audit                              |
| Tạo sự kiện / RSVP            | Không                   | Có; sửa sự kiện mình, RSVP mình | Sửa/hủy sự kiện có audit                                            |
| Export                        | Không                   | Dữ liệu được phép của mình      | Export dữ liệu nhà được phép, không gồm self contact của người khác |

Hồ sơ chưa có account: admin đóng vai người quản lý, chịu trách nhiệm chỉ nhập dữ liệu cần thiết và có sự đồng ý phù hợp. Contact ban đầu không công bố; trước liên kết account, người nhận xem/xác nhận các trường mình sẽ sở hữu và visibility. Quyền quản lý tạm thời kết thúc sau liên kết. Trẻ nhỏ không có đăng nhập bắt buộc; baseline chỉ hồ sơ tối thiểu, không đưa trường học/địa chỉ chi tiết lên feed.

## Điểm thực thi bắt buộc

### Quyền hẹp khi nhận hồ sơ, thiết kế đợt onboarding

Để thực hiện bước xác nhận ownership/visibility trong ADM-08, một membership **active** được admin chỉ định bằng claim còn hạn có thể xem trước contact của đúng Member chưa liên kết đó qua endpoint claim-preview riêng. Quyền này không mở danh bạ/search/export/AI hoặc endpoint hồ sơ thông thường với contact self, không áp dụng cho pending/revoked, không suy ra chỉ từ role admin. Claim hết hạn/thu hồi/từ chối/consume hoặc Member đã liên kết làm quyền preview kết thúc. Người nhận xác nhận version và visibility trước khi link được tạo atomically. Xem [thiết kế chi tiết](superpowers/specs/2026-09-08-membership-profile.md). Backend claim đã triển khai và được kiểm thử real-cookie cho quyền candidate, expiry, stale version, thu hồi và xác nhận atomic. UI nhận hồ sơ revalidate theo claim version, hủy preview cũ khi claim biến mất và xóa dữ liệu nhà khỏi màn hình khi membership bị thu hồi.

### Kiểm quyền trên mỗi đường truy cập

- Session/token phải được xác minh; invitation token lưu hash, có expiry, dùng một lần, revoke được. Duyệt và consume link có transaction để tránh hai người nhận một hồ sơ.
- Mọi object ID resolve trong family được quyền; API ngoài phạm vi dùng phản hồi không tiết lộ object tồn tại. Field bị cấm không xuất hiện trong payload, search snippet, AI hoặc export.
- Realtime subscribe/publish xác thực membership. Khi revoke, ngắt subscription hoặc ngừng fanout ngay; endpoint fetch vẫn từ chối dù client còn cache.
- Media theo quyền parent. Ưu tiên media gateway kiểm quyền mỗi request; nếu signed URL thì TTL tối đa đề xuất 60 giây và phải ghi rõ revoke không thu hồi bản đã tải hoặc URL còn hạn. Không tuyên bố có thể xóa bản sao trên thiết bị người khác.
- Push chỉ dùng câu chung mặc định, không contact/chat preview nhạy cảm; kiểm membership trước send, token thiết bị tách user, clear association khi logout.
- Service credential không đến browser. Secret manager/env ngoài Git. Rate limit auth/invite/upload/AI. Escape/sanitize text, kiểm MIME và chữ ký file, giới hạn kích thước; bỏ EXIF vị trí khỏi ảnh được chia sẻ.
- Audit giới hạn quyền admin, ghi actor/action/target/time và thay đổi tối thiểu; không sao chép nội dung chat hoặc contact private để “debug”.

## Vòng đời dữ liệu, baseline vận hành

- Thu hồi membership chặn lần truy cập kế tiếp và job chưa gửi; giữ hồ sơ gia phả theo chính sách riêng, không tự xóa người khỏi cây.
- Yêu cầu xóa contact/nội dung xử lý ở DB, media, chỉ mục AI, cache và queued jobs. Đề xuất hoàn thành active storage trong 7 ngày; backup luân chuyển tối đa 30 ngày, cần xác nhận khi chọn provider. Khi restore phải chạy lại deletion ledger trước mở phục vụ.
- Log vận hành không PII, giữ đề xuất 14 ngày; audit tối thiểu giữ đề xuất 90 ngày. Chưa là cam kết dịch vụ, phải cấu hình và kiểm thử trước dữ liệu thật.
- Export là tác vụ có kiểm quyền tại thời điểm tạo và tải, URL có hạn; không email tự động bản dữ liệu riêng tư.
- Trước bật AI, làm rõ dữ liệu gửi nhà cung cấp và cài đặt lưu giữ; không dùng chat/dữ liệu gia đình cho training mặc định.

## Kiểm thử quyền tối thiểu

Hai nhà A/B; người cùng lúc ở A/B; người đã revoke; pending; contact self của người khác; worker đặc quyền; giả family_id; URL ảnh; realtime reconnect; cache đổi nhà; AI tổng hợp/count/snippet; export; mời hết hạn và duyệt đồng thời. Không phát hành chỉ vì test role admin/member happy path đã qua.
