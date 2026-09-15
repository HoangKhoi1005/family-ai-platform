# Oracle Always Free Pilot Readiness — Thiết kế

**Ngày:** 2026-09-15  
**Trạng thái:** Confirmed  
**Phạm vi:** staging cloud miễn phí cho pilot 15 người, cấu hình production-safe, migration, backup/restore, HTTPS, email và monitoring  
**Ngoài phạm vi:** dữ liệu gia đình thật, custom domain trả phí, high availability, Chat, push, AI và phát hành production

## 1. Kết quả cần đạt

Tạo một staging có thể truy cập qua HTTPS trên Oracle Cloud Always Free mà không cần máy chủ tại nhà và không làm thay đổi domain model hiện hành. Staging chạy đầy đủ Next.js web, Fastify API, notification/media worker và PostgreSQL; media nằm trong Cloudflare R2 private; email xác minh/khôi phục đi qua Resend SMTP.

Gói hoàn thành khi một máy Oracle ARM64 mới có thể được dựng lại từ repo, migration 0001–0032 chạy sạch và chạy lần hai là no-op, các application role vẫn bị giới hạn, luồng onboarding cùng upload/processing media hoạt động qua HTTPS, và một bản backup PostgreSQL đã được khôi phục thành công vào database tách biệt.

Staging chỉ dùng dữ liệu hư cấu. Việc mời 15 người dùng thật là một gate riêng sau kiểm thử thiết bị và restore drill.

## 2. Phương án đã chọn

### Compute và mạng

- Một Oracle Cloud Ampere A1 Always Free VM, tối đa trong hạn mức 2 OCPU/12 GB RAM hiện hành, dùng Ubuntu 24.04 LTS ARM64.
- Docker Compose production chạy `web`, `api`, `worker` và `postgres` trong một private bridge network.
- Chỉ web gateway được xuất bản. PostgreSQL, API và worker không mở cổng trực tiếp ra Internet.
- Tailscale Funnel cấp hostname `*.ts.net`, kết thúc TLS và proxy về web. Next.js giữ same-origin `/api` rewrite tới API bằng Docker DNS nội bộ.
- SSH dùng key, tắt password login. Firewall chỉ mở luồng quản trị cần thiết; Funnel không yêu cầu mở PostgreSQL hoặc API.

Tailscale Funnel là lựa chọn hostname miễn phí cho staging. Khi có domain riêng, Caddy/custom DNS có thể thay lớp ingress mà không đổi web/API contract.

### Dữ liệu và media

- PostgreSQL 17 chạy trên volume riêng của VM. Owner credential chỉ có trong migration/backup command; không truyền vào web, API hoặc worker.
- API dùng hai URL riêng cho `family_auth` và `family_runtime`; worker chỉ dùng `family_worker`.
- Cloudflare R2 Standard là object storage chính cho media, với bucket private, public access tắt và CORS chỉ cho staging origin.
- Presigned upload tối đa 600 giây và read URL tối đa 60 giây giữ nguyên. R2 key không chứa filename, email hoặc dữ liệu người thân.
- Backup dùng bucket hoặc credential tách khỏi media runtime để mất một key không mở cả media và backup.

### Email

- Resend SMTP dùng `smtp.resend.com:587`, STARTTLS, username `resend` và API key lấy từ secret runtime.
- `MAIL_FROM` dùng sender/domain đã được Resend xác minh. Staging không log địa chỉ nhận, URL xác minh, reset token hoặc nội dung thư.
- Mail delivery vẫn bất đồng bộ trong process API ở gói này; durable mail outbox là phạm vi sau nếu pilot chứng minh cần.

### Monitoring

- Docker healthcheck giám sát web, API và PostgreSQL; `/health/live` chỉ phản ánh process, `/health/ready` kiểm tra các database role cần thiết trước khi nhận traffic.
- OCI Monitoring theo dõi CPU, RAM, disk và instance availability. Log ứng dụng là structured event allowlist gồm level, event code, request ID và entity ID không nhạy cảm.
- Không gửi email, số điện thoại, contact, token, signed URL, caption, story, message hoặc SQL parameters vào log.
- Cảnh báo staging tối thiểu gồm VM không truy cập được, container restart loop, disk cao, backup thất bại và worker job vượt retry.

## 3. Cấu hình môi trường

`APP_ENV` hỗ trợ `local`, `staging` và `production`. Local tiếp tục bắt buộc loopback cho web, API, PostgreSQL và SMTP. Staging/production áp dụng các điều kiện sau:

- `WEB_ORIGIN` là HTTPS origin công khai, không credential/path/query/hash.
- `API_INTERNAL_URL` là HTTP(S) origin nội bộ, không credential/path/query/hash; không được dùng làm public trust origin.
- `AUTH_DATABASE_URL`, `RUNTIME_DATABASE_URL` và `WORKER_DATABASE_URL` phải là PostgreSQL URL có username/password/database; staging cho phép Docker hostname nội bộ.
- `BETTER_AUTH_SECRET` tối thiểu 32 ký tự và khác local.
- SMTP production yêu cầu username/password, STARTTLS hoặc implicit TLS theo port; secret không có default.
- R2 endpoint phải dùng HTTPS ngoài local; `forcePathStyle=false`, region `auto` và CORS chỉ chứa `WEB_ORIGIN`.
- Service bind `0.0.0.0` trong container và dùng `PORT` do runtime cấp; local giữ port hiện hành.

Biến bí mật nằm trong file ngoài repo với quyền đọc hẹp hoặc secret store của OCI. `.env.example` chỉ chứa placeholder và không đưa credential thật vào Git, CI artifact hoặc image layer.

## 4. Image và triển khai ARM64

- Dùng Dockerfile multi-stage dựa trên Node 24 image có ARM64, cài dependency bằng `npm ci`, build đúng workspace graph rồi chạy bằng user không phải root.
- Web, API và worker có image/stage riêng nhưng dùng cùng source tree để giữ npm workspaces.
- Production Compose ghim version image cơ sở theo major/minor phù hợp repo, dùng read-only filesystem nơi khả thi, `no-new-privileges`, restart policy và resource limit vừa với VM.
- PostgreSQL volume và dữ liệu tạm của media processor không nằm trong image. Raw media vẫn ở R2 quarantine, không trở thành persistent file trên container.
- Migration là command một lần có advisory lock/checksum. Web/API/worker không tự chạy DDL khi khởi động.

Deploy staging theo trình tự: build image → start PostgreSQL → migration/provision roles → start API/worker/web → readiness → browser smoke. Nếu readiness thất bại, giữ container cũ và không tuyên bố deploy thành công.

## 5. Provisioning database

Script provisioning được mở rộng từ local nhưng vẫn fail closed:

1. Xác nhận rõ `APP_ENV=staging` và database target; không chấp nhận target production trong staging command.
2. Chạy migration bằng owner URL trong process quản trị riêng.
3. Tạo/rotate `family_auth`, `family_runtime`, `family_worker` với password từ secret runtime.
4. Chạy `assertSafeApplicationRoles` và test quyền tối thiểu trước khi khởi động app.
5. Chạy migration lần hai để chứng minh checksum/no-op.
6. Bootstrap một FamilySpace và admin hư cấu bằng command có audit; không seed PII thật.

Không đưa owner URL vào service definition của API/worker/web.

## 6. Backup và restore

Ba lớp bảo vệ áp dụng cho staging/pilot:

1. Volume/block-volume snapshot của OCI theo khả năng Always Free và quota thực tế.
2. `pg_dump --format=custom --no-owner` hằng ngày, mã hóa phía client bằng public key trước khi upload vào R2 backup bucket.
3. Restore drill vào database/container tách biệt trước pilot và lặp lại sau thay đổi migration quan trọng.

Backup R2 giữ tối đa 30 ngày. Job xóa bản quá hạn không dùng media runtime credential. Temporary dump bị xóa sau upload thành công hoặc thất bại; tên file chỉ có timestamp và environment, không có family/member data.

Restore drill kiểm tra:

- `pg_restore` hoàn tất không lỗi;
- migration status và checksum đúng;
- application roles không có `SUPERUSER`/`BYPASSRLS` hoặc quyền owner;
- tenant/RLS smoke test đạt;
- deletion ledger được chạy lại trước khi database phục hồi được phép phục vụ;
- ghi nhận RPO thực tế, thời gian restore và checksum backup, không ghi dữ liệu hàng.

## 7. Thay đổi dự kiến trong repo

- Mở rộng config/test cho `APP_ENV`, URL, database và SMTP production.
- Bổ sung SMTP auth/TLS mà không làm thay đổi Mailpit local.
- Bổ sung `/health/ready` và healthcheck container.
- Thêm Dockerfile/stage ARM64 cho web, API, worker và production Compose.
- Thêm script deploy, migration/provision, backup, restore và smoke test không chứa secret.
- Thêm mẫu biến môi trường staging, R2 CORS mẫu và runbook Oracle/Tailscale/Resend.
- Cập nhật ADR/Decision Log, Project Brain và CI để build image cùng kiểm tra cấu hình an toàn.

Không thay migration đã áp dụng, không đổi RLS/domain model và không đưa provider SDK vào domain package.

## 8. Xử lý lỗi và rollback

- Config thiếu hoặc không an toàn làm process dừng trước khi listen.
- API readiness trả unavailable khi database role không hoạt động; response không lộ hostname hoặc credential.
- Worker retry theo lease hiện hành; dead-letter vượt ngưỡng phát event code cho monitoring.
- R2/SMTP lỗi không làm mở rộng quyền. Upload/email thất bại trả trạng thái thử lại phù hợp và không log payload nhạy cảm.
- Rollback app dùng image/tag trước đó; migration SQL chỉ tiến về phía trước bằng migration bổ sung.
- Restore database chỉ diễn ra vào target mới. Không ghi đè volume/database đang phục vụ trong drill.

## 9. Kiểm thử và nghiệm thu

### Config và image

- Local config vẫn từ chối hostname ngoài loopback và SMTP credential không cần thiết không phá Mailpit.
- Staging config từ chối HTTP public origin, URL có credential/path, secret ngắn, database thiếu user/password và R2 không HTTPS.
- SMTP test chứng minh STARTTLS/auth được truyền đúng nhưng không lộ key khi lỗi.
- Image build trên ARM64 hoặc bằng multi-platform builder; web/API/worker chạy non-root.

### Database và storage

- Fresh database chạy migration 0001–0032, provision role, status và migration replay đạt.
- Auth, tenant, relationships, calendar, notification và media schema integration đạt trên staging-like network.
- R2 presigned upload/read/delete flow đạt với bucket staging private và CORS chính xác.
- Backup mã hóa được upload; restore vào target mới đạt RLS smoke test.

### Browser và vận hành

- HTTPS mở `/app`, đăng ký, nhận email Resend, xác minh, đăng nhập và đi qua invitation/pending/approval bằng dữ liệu hư cấu.
- Upload ảnh, media processing, Moment, Memory, lịch và inbox hoạt động sau container restart.
- Không có PostgreSQL/API/worker port công khai; revoke membership vẫn chặn request tiếp theo.
- Monitoring nhận được một alert thử cho readiness hoặc backup failure mà không chứa PII.

## 10. Gate trước pilot 15 người

Staging đạt không đồng nghĩa production-ready. Chỉ mời người thân khi:

- restore drill và deletion-ledger check có bằng chứng;
- ít nhất một iPhone và một Android hoàn thành luồng cài PWA, camera, microphone, offline/revoke;
- backup và alert chạy tự động đủ bảy ngày;
- owner xem chi phí/quota console và xác nhận không có tài nguyên ngoài Always Free;
- có quyết định riêng về domain, người trực vận hành và thời điểm đưa dữ liệu thật lên hệ thống.

## 11. Rủi ro và điều kiện xem lại

- Oracle có thể thiếu capacity Always Free ở home region; không đổi sang tài nguyên trả phí tự động. Nếu không cấp được A1, dừng provisioning và đánh giá managed paid hoặc free cloud khác.
- Tailscale Funnel đang beta và hostname không mang thương hiệu. Xem lại khi chuẩn bị pilot thật hoặc cần custom domain.
- Một VM là single point of failure. Backup/restore giảm mất dữ liệu nhưng không tạo high availability.
- Free tier có thể thay đổi. Ghi quota thực tế lúc tạo tài nguyên và đặt budget/usage alert nếu OCI cho phép.
- Nếu worker/media vượt tài nguyên ARM64 hoặc gia đình dùng thường xuyên, chuyển compute sang managed hosting; PostgreSQL dump và S3-compatible media giữ đường chuyển provider.
