# Hướng dẫn phát triển monorepo

## Thiết lập

Đọc [README](../README.md) để chạy. Một lockfile npm ở gốc; dùng `npm ci` để tái tạo đúng phiên bản. Không chạy install riêng trong từng app. Thêm dependency: `npm install <package> --workspace @family/api --save-exact`; dependency tooling chung thêm `-D` ở root. Không dùng npm/pnpm/yarn lẫn nhau.

Node theo [.node-version](../.node-version); npm theo packageManager. Không cần env để mở web giới thiệu hoặc API liveness. Docker/Python là phụ thuộc riêng theo tác vụ, không cần nhà cung cấp bên ngoài để build.

## Packages và graph

Web → ui (và contracts/domain khi dùng); API → config/contracts, có thể domain/database khi có feature; worker → config, có thể domain/database; domain/contracts độc lập framework và không secret. Biên manifest được kiểm bởi `boundaries:check`; ESLint chặn web/UI/domain/contracts import database. Đây là guardrail development, không thay authorization hoặc sandbox runtime.

Tất cả package private. Không deep-import source package khác; dùng export public. Server packages dùng ESM NodeNext với import extension `.js`; web dùng moduleResolution Bundler. UI dùng TSX source được Next transpile. Chưa có API client vì chưa có authenticated API cần gọi; không tạo wrapper rỗng.

## Development và build

`npm run dev` build prerequisites rồi mở watch cho shared packages, web/API/worker. Khi chỉ làm một app: `npm run build` trước rồi `npm run dev --workspace @family/web` hoặc `@family/api`. API uses `HOST` and `API_PORT` (default 127.0.0.1:4010 when auth is configured); web uses `PORT` (default 127.0.0.1:3200). Không tự bind mạng LAN; chỉ mở khi thử thiết bị và hiểu phạm vi.

Turbo cache dist/.next; env ảnh hưởng build phải được khai báo trong turbo.json khi thêm. Chưa có build-time secret. Secrets runtime không chuyển thành NEXT_PUBLIC. Có thể tắt telemetry công cụ qua NEXT_TELEMETRY_DISABLED=1 và TURBO_TELEMETRY_DISABLED=1 trong môi trường; CI đã đặt.

## Database

`env:init` tạo .env local ngẫu nhiên, giữ file có sẵn. Compose dùng port 54329 trên loopback, volume riêng. `db:down` không xóa volume. Không thêm lệnh reset phá dữ liệu mặc định. Khi đổi mật khẩu trong .env, volume PostgreSQL đã khởi tạo không tự đổi password — sửa có chủ ý, không xóa volume để “fix”.

`db:migrate` giữ advisory lock, xác minh checksum migration cũ, mỗi migration trong transaction. Lần chạy lại là no-op. Không sửa file đã apply; sửa bằng migration mới. `db:status` yêu cầu đã migrate. Migration 0001 chỉ identity/member/contact, chưa có relationship graph hoặc outbox.

`test:db` chỉ chạy local/test với owner có quyền tạo role để kiểm RLS, mọi bản ghi/role test trong transaction được rollback. Không chạy bằng URL production. RLS runtime hiện deny-all (không policy), kể cả khi SELECT đã được cấp; superuser bypass là lý do tuyệt đối không dùng local owner làm role ứng dụng.

Trước feature auth: chọn provider, tạo runtime role NOSUPERUSER/NOBYPASSRLS, thiết kế identity context tin cậy, policies membership/contact và test actor. Không lấy `x-user-id` hay `x-family-id` làm căn cứ truy cập. Policy primitive trong domain chưa giải quyết quản trị hồ sơ chưa liên kết; quy trình đó phải được test trong task riêng.

## Kiểm chứng

`npm run check` là gate local. PostgreSQL và E2E tách riêng vì cần dịch vụ/browser. E2E dùng bản production web và hai viewport; chưa thay thử iPhone/Android thật. Chạy `npx playwright install chromium` trước lần đầu. Playwright không tái sử dụng server đang chạy để tránh test nhầm bản. E2E dùng cổng 3100 riêng với dev 3000; đổi bằng biến `E2E_PORT` nếu cổng test bận.

CI gồm quality, production build, migrate hai lần, integration constraints/RLS và Playwright. Workflow được tạo nhưng chỉ có kết quả GitHub sau khi push/PR thực sự chạy; kết quả local không phải CI xanh trên GitHub.

### Auth foundation local services

Worktree onboarding uses the isolated Compose project `family-ai-onboarding` with PostgreSQL on `127.0.0.1:54339`, Mailpit SMTP on `127.0.0.1:1035`, and the Mailpit UI on `127.0.0.1:8035`. The API and web development processes use `127.0.0.1:4010` and `127.0.0.1:3200`; they are started by the Node workspaces rather than Compose. The API reads `API_PORT=4010`; Next reads `PORT=3200`. The Mailpit image is pinned to the official stable release `axllent/mailpit:v1.30.4`.

Run the local setup in this order:

````sh
npm run env:init
npm run db:up
npm run db:migrate
npm run db:provision-auth
npm run test:auth-schema
npm run test:db
npm run test:auth
```

`env:init` creates missing values in the ignored `.env` with cryptographically random local passwords and a Better Auth secret. Existing values are preserved, and a second run does not rewrite the file. `APP_ENV=local` is required for role provisioning; the owner, auth, and runtime URLs must all point to a loopback host. Provisioning checks that `family_auth` and `family_runtime` are `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, and `NOBYPASSRLS` before setting their passwords. It never prints a URL, password, or SQL statement.

Migration `0002_authentication.sql` adds Better Auth's global tables and preserves historical `users.auth_subject` rows without fabricating email values. `family_auth` has CRUD on `users` and the auth tables only. `family_runtime` has no auth-table privilege, while runtime tenant grants are constrained by actor/membership RLS in migrations 0006–0008. Auth tables use forced RLS with explicit auth-role policies; tenant authorization is implemented for membership and claim operations; directory/profile work is tracked in CURRENT_STATE.

`db:migrate` is safe to run twice: the second run verifies checksums and does not reapply migrations. `test:auth-schema` seeds only synthetic rows inside a transaction, tests actual role restrictions and legacy identity preservation, and rolls every fixture back. Do not run provisioning against a non-local URL, use the owner URL in an application process, or use `docker compose down -v`; the named volumes are intentionally retained and isolated from the main checkout.

`test:auth` runs the real Fastify/Better Auth flow against PostgreSQL and Mailpit. It requires both restricted database URLs, `WEB_ORIGIN`, `API_INTERNAL_URL`, and loopback SMTP settings. The test verifies email verification, database sessions, password reset expiry and replay, session revocation, origin checks, rate limiting, and the empty membership result after signup. Auth model IDs have database defaults in additive migrations because Better Auth 1.7.3 omits IDs for some Kysely inserts; do not edit an applied migration.

## Troubleshooting

- Thiếu dist shared package: chạy root build/dev qua Turbo, không gọi node dist khi chưa build.
- Docker permission/daemon: mở Docker Desktop hoặc dùng quyền được cấp; không đổi filesystem/volume tùy tiện.
- npm báo only-if-cached: môi trường có thể ép offline; dùng `--offline=false` và cache writable khi đã được phép network. Không lưu cấu hình riêng máy vào lockfile.
- Tiếng Việt hiện sai ở Windows PowerShell: đọc file bằng `Get-Content -Encoding UTF8`; không chuyển toàn repo sang ANSI.
- API nghiệp vụ dùng prefix /api/v1/families/{familyId}; 404 cũng có thể là tài nguyên ngoài phạm vi hoặc membership chưa active, không suy ra tài nguyên tồn tại từ mã lỗi.

Kết thúc task cập nhật [CURRENT_STATE](../CURRENT_STATE.md), spec/contract liên quan và decision khi cần. Không ghi done cho feature chỉ vì thư mục tồn tại.

## Bootstrap nhà local và kiểm thử backend

Tạo tài khoản giả và xác minh email qua Mailpit trước. Lấy UUID của tài khoản đã xác minh từ response đăng nhập/me; chọn UUID mới cho nhà thử nghiệm. Script dưới đây chỉ nhận tài khoản đã xác minh, không tạo mật khẩu hoặc public admin endpoint:

```sh
npm run db:bootstrap-family -- --user-id <verified-user-uuid> --family-id <new-family-uuid> --name <family-name>
```

Thay các placeholder bằng giá trị local; tên có khoảng trắng cần được quote theo shell. Chạy lại với cùng family ID bị từ chối. Chưa có UI onboarding hoàn chỉnh; không nhập dữ liệu thật để thử.

- npm run test:tenant: kiểm RLS, actor transaction, invitation acceptance và role isolation.
- npm run test:auth: chạy chung auth/membership/profile integration với dữ liệu giả; profile thuộc Task3 đang review.
- Mailpit HTTP test dùng MAILPIT_PORT (local8035, CI8025); SMTP_PORT là cổng gửi thư riêng.
````
