# Hướng dẫn phát triển monorepo

## Thiết lập

Đọc [README](../README.md) để chạy. Một lockfile npm ở gốc; dùng `npm ci` để tái tạo đúng phiên bản. Không chạy install riêng trong từng app. Thêm dependency: `npm install <package> --workspace @family/api --save-exact`; dependency tooling chung thêm `-D` ở root. Không dùng npm/pnpm/yarn lẫn nhau.

Node theo [.node-version](../.node-version); npm theo packageManager. Không cần env để mở web giới thiệu hoặc API liveness. Docker/Python là phụ thuộc riêng theo tác vụ, không cần nhà cung cấp bên ngoài để build.

## Packages và graph

Web → ui (và contracts/domain khi dùng); API → config/contracts, có thể domain/database khi có feature; worker → config, có thể domain/database; domain/contracts độc lập framework và không secret. Biên manifest được kiểm bởi `boundaries:check`; ESLint chặn web/UI/domain/contracts import database. Đây là guardrail development, không thay authorization hoặc sandbox runtime.

Tất cả package private. Không deep-import source package khác; dùng export public. Server packages dùng ESM NodeNext với import extension `.js`; web dùng moduleResolution Bundler. UI dùng TSX source được Next transpile. Chưa có API client vì chưa có authenticated API cần gọi; không tạo wrapper rỗng.

## Development và build

`npm run dev` build prerequisites rồi mở watch cho shared packages, web/API/worker. Khi chỉ làm một app: `npm run build` trước rồi `npm run dev --workspace @family/web` hoặc `@family/api`. `HOST`/`PORT` cấu hình API; default 127.0.0.1:4000. Web 127.0.0.1:3000, cấu hình CLI Next khi cần. Không tự bind mạng LAN; chỉ mở khi thử thiết bị và hiểu phạm vi.

Turbo cache dist/.next; env ảnh hưởng build phải được khai báo trong turbo.json khi thêm. Chưa có build-time secret. Secrets runtime không chuyển thành NEXT_PUBLIC. Có thể tắt telemetry công cụ qua NEXT_TELEMETRY_DISABLED=1 và TURBO_TELEMETRY_DISABLED=1 trong môi trường; CI đã đặt.

## Database

`env:init` tạo .env local ngẫu nhiên, giữ file có sẵn. Compose dùng port 54329 trên loopback, volume riêng. `db:down` không xóa volume. Không thêm lệnh reset phá dữ liệu mặc định. Khi đổi mật khẩu trong .env, volume PostgreSQL đã khởi tạo không tự đổi password — sửa có chủ ý, không xóa volume để “fix”.

`db:migrate` giữ advisory lock, xác minh checksum migration cũ, mỗi migration trong transaction. Lần chạy lại là no-op. Không sửa file đã apply; sửa bằng migration mới. `db:status` yêu cầu đã migrate. Migration 0001 chỉ identity/member/contact, chưa có relationship graph hoặc outbox.

`test:db` chỉ chạy local/test với owner có quyền tạo role để kiểm RLS, mọi bản ghi/role test trong transaction được rollback. Không chạy bằng URL production. RLS runtime hiện deny-all (không policy), kể cả khi SELECT đã được cấp; superuser bypass là lý do tuyệt đối không dùng local owner làm role ứng dụng.

Trước feature auth: chọn provider, tạo runtime role NOSUPERUSER/NOBYPASSRLS, thiết kế identity context tin cậy, policies membership/contact và test actor. Không lấy `x-user-id` hay `x-family-id` làm căn cứ truy cập. Policy primitive trong domain chưa giải quyết quản trị hồ sơ chưa liên kết; quy trình đó phải được test trong task riêng.

## Kiểm chứng

`npm run check` là gate local. PostgreSQL và E2E tách riêng vì cần dịch vụ/browser. E2E dùng bản production web và hai viewport; chưa thay thử iPhone/Android thật. Chạy `npx playwright install chromium` trước lần đầu. Playwright không tái sử dụng server đang chạy để tránh test nhầm bản. E2E dùng cổng 3100 riêng với dev 3000; đổi bằng biến `E2E_PORT` nếu cổng test bận.

CI gồm quality, production build, migrate hai lần, integration constraints/RLS và Playwright. Workflow được tạo nhưng chỉ có kết quả GitHub sau khi push/PR thực sự chạy; kết quả local không phải CI xanh trên GitHub.

## Troubleshooting

- Thiếu dist shared package: chạy root build/dev qua Turbo, không gọi node dist khi chưa build.
- Docker permission/daemon: mở Docker Desktop hoặc dùng quyền được cấp; không đổi filesystem/volume tùy tiện.
- npm báo only-if-cached: môi trường có thể ép offline; dùng `--offline=false` và cache writable khi đã được phép network. Không lưu cấu hình riêng máy vào lockfile.
- Tiếng Việt hiện sai ở Windows PowerShell: đọc file bằng `Get-Content -Encoding UTF8`; không chuyển toàn repo sang ANSI.
- API trả 404 cho /families: đúng trạng thái scaffold; auth/nghiệp vụ chưa triển khai.

Kết thúc task cập nhật [CURRENT_STATE](../CURRENT_STATE.md), spec/contract liên quan và decision khi cần. Không ghi done cho feature chỉ vì thư mục tồn tại.
