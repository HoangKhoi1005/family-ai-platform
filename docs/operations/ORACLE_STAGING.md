# Oracle Always Free staging

## 1. Gate tài khoản và quota

- Chọn **home region** sau khi kiểm tra khả năng cấp Ampere A1; home region khó đổi và Always Free capacity có thể hết.
- Chỉ tạo compute có nhãn **Always Free-eligible**, tổng tối đa **2 OCPU/12 GB RAM** cho cấu hình này. Nếu console không cấp được shape miễn phí, dừng lại; không chọn paid shape hoặc bật auto-scaling.
- Kiểm tra boot volume và outbound bandwidth trong hạn mức tài khoản thực tế. Tạo budget/usage notification ở mức thấp nhất console cho phép và ghi ngày cùng ảnh chụp trang quota không chứa tenancy/user identifier.
- Không nhập thẻ hoặc nâng cấp tài khoản chỉ để vượt capacity trong quy trình này.

## 2. VM và mạng

Tạo Ubuntu 24.04 ARM64 bằng SSH public key. Network Security Group chỉ cho SSH từ IP quản trị cần thiết; không mở `3200`, `4010` hoặc `5432`. Giữ một phiên SSH đang hoạt động khi chỉnh SSH, đặt `PasswordAuthentication no`, chạy `sudo sshd -t`, rồi reload dịch vụ. Không khóa phiên hiện tại trước khi xác nhận một phiên key-only mới đăng nhập được.

Cập nhật gói hệ thống. Cài Docker Engine/Compose plugin và Tailscale theo tài liệu Ubuntu chính thức của từng nhà cung cấp. Thêm operator vào group Docker chỉ khi chấp nhận group này có quyền tương đương root; đăng xuất/đăng nhập lại rồi kiểm tra:

```sh
docker version
docker compose version
tailscale version
```

Kết nối VM vào tailnet bằng tài khoản dành cho gia đình. Trong Tailscale admin, bật HTTPS và Funnel theo policy hẹp cho máy này. Funnel chỉ trỏ tới `127.0.0.1:3200`.

## 3. Source và secret

Clone repository không chứa secret vào `/opt/family-ai/repo`, checkout commit hoặc release tag cần triển khai, và xác nhận SHA:

```sh
cd /opt/family-ai/repo
git fetch --tags --prune
git checkout REPLACE_WITH_RELEASE_TAG_OR_SHA
git rev-parse HEAD
npm run deploy:check
npm run backup:check
```

Tạo secret directory và template ngoài repository:

```sh
sudo install -d -m 0700 -o "$USER" -g "$USER" /opt/family-ai/secrets
install -m 0600 deploy/staging.env.example /opt/family-ai/secrets/staging.env
```

Thay toàn bộ `REPLACE_WITH_*`. Password đặt trong PostgreSQL URL phải URL-encode. Dùng commit SHA làm `IMAGE_TAG`; không dùng `latest`. Giữ `ALLOW_STAGING_PROVISION=false` ngoài đúng một lệnh provisioning.

## 4. R2 và Resend

Trong Cloudflare:

1. Tạo media bucket và backup bucket riêng, tắt public access cho cả hai.
2. Áp dụng [CORS mẫu](../../deploy/r2-cors.json) cho media bucket sau khi thay đúng hostname HTTPS `*.ts.net`; không dùng wildcard origin.
3. Tạo media token chỉ có quyền object cần thiết trên media bucket. Tạo backup token riêng chỉ có quyền trên backup bucket.
4. Đặt lifecycle xóa `postgres/` trong backup bucket sau 30 ngày.

Trong Resend, xác minh sender/domain và tạo SMTP credential cho staging. Đặt `smtp.resend.com`, port `587`, `SMTP_SECURE=false`, `SMTP_USER=resend`; API key chỉ nằm ở `SMTP_PASSWORD`. Gửi một thư tới địa chỉ kiểm thử do chủ dự án quản lý trước synthetic onboarding, không ghi người nhận hoặc verification URL vào evidence.

## 5. Build, database và khởi động

Xác thực Compose, build image từ source hiện tại và khởi động PostgreSQL:

```sh
cd /opt/family-ai/repo
docker compose --env-file /opt/family-ai/secrets/staging.env -f deploy/compose.staging.yaml config --quiet
docker compose --env-file /opt/family-ai/secrets/staging.env -f deploy/compose.staging.yaml build api worker web migrate backup
docker compose --env-file /opt/family-ai/secrets/staging.env -f deploy/compose.staging.yaml up -d postgres
```

Migration/provision là command một lần. Cờ xác nhận chỉ tồn tại trong process này:

```sh
ALLOW_STAGING_PROVISION=true docker compose --env-file /opt/family-ai/secrets/staging.env -f deploy/compose.staging.yaml --profile migrate run --rm migrate
```

Khởi động app và xác nhận health:

```sh
docker compose --env-file /opt/family-ai/secrets/staging.env -f deploy/compose.staging.yaml up -d postgres api worker web
docker compose --env-file /opt/family-ai/secrets/staging.env -f deploy/compose.staging.yaml ps
curl --fail --silent http://127.0.0.1:3200/health/ready
tailscale funnel --bg --https=443 http://127.0.0.1:3200
```

Mở `https://REPLACE_WITH_TS_NET_HOST/app` và chỉ dùng tài khoản/dữ liệu hư cấu. Chạy onboarding, revoke membership, lịch/inbox, media upload/processing, Moment và Memory smoke theo [checklist](STAGING_ACCEPTANCE.md).

## 6. Update và rollback

Trước update, tạo encrypted backup và ghi SHA/image digest hiện tại. Checkout SHA mới, chạy static gates và build; chạy migration/provision trước khi thay app container. Chỉ coi deploy thành công khi web readiness và synthetic smoke đạt.

Nếu app mới lỗi, checkout release SHA trước và chạy lại `build`/`up` cho `api worker web`. Không sửa hoặc rollback migration SQL đã apply; schema cần sửa bằng migration tiến về phía trước. Nếu database bị hỏng, dừng app và làm restore drill theo [runbook backup](BACKUP_RESTORE.md) trước mọi quyết định phục hồi. Không restore đè database đang phục vụ.
