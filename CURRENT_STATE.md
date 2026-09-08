# Trạng thái dự án

- Cập nhật: 2026-09-09. Context version: **1.2.0**.
- Pilot 15 người. Baseline local `3e411b7`; toàn bộ thay đổi của đợt onboarding hiện vẫn ở worktree `feat/onboarding-ui-preview`, chưa commit/push/deploy.
- Backend đã có Better Auth, membership, lời mời/duyệt/thu hồi, claim hồ sơ, danh bạ và hồ sơ. Chưa có backend quan hệ gia phả, lịch âm, chat, moments, notifications hoặc AI.

## Luồng vào nhà đã nối

Luồng web dùng API và PostgreSQL thật đã có:

1. Đăng ký, xác minh email, đăng nhập, gửi lại thư xác minh.
2. Quên mật khẩu và đặt lại mật khẩu bằng liên kết email.
3. Nhận lời mời một lần, chờ quản trị viên duyệt và tự kiểm tra lại trạng thái.
4. Quản trị viên tạo/thu hồi lời mời, duyệt/thu hồi membership, tạo Member và chỉ định hồ sơ.
5. Người nhận xem trước, xác nhận hoặc từ chối claim; sau khi nhận có thể cập nhật hồ sơ và visibility từng liên hệ.
6. Người đã được duyệt vào Nhà mình, xem danh bạ API thật và đi sang cây gia phả minh họa.

Endpoint `GET /api/v1/families/:familyId/onboarding` chỉ trả link/claim của chính actor active. Guest trả 401; pending, revoked và cross-family trả 404 để che tài nguyên. Token lời mời được nhận qua URL fragment, giữ tạm trong sessionStorage của tab và xóa khỏi URL; không lưu hồ sơ, liên hệ hay mật khẩu trong browser storage.

Hướng dẫn chạy và thử hai người nằm tại [docs/CONNECTED_ONBOARDING.md](docs/CONNECTED_ONBOARDING.md).

## Cây gia phả và thiết kế

- `/design-preview/tree` vẫn là dữ liệu 15 người hư cấu, tách rõ khỏi danh bạ thật. Chưa có API quan hệ nên không ghép Member thật với quan hệ giả.
- Bản cây hiện hỗ trợ chọn người, chuyển nhánh, quay lại, về tôi, tìm tên không dấu và hồ sơ cạnh cây/thu gọn trên mobile. Chưa có pan/zoom nâng cao, kéo node, thêm/sửa quan hệ hoặc lưu bố cục.
- Giao diện onboarding hiện đáp ứng luồng chức năng và responsive 390/1280 px. Đây chưa phải thiết kế thẩm mỹ cuối và chưa được chủ dự án nghiệm thu. Tiếp tục giữ tiêu chí tránh AI slop/generic dashboard.

## Kiểm chứng mới nhất

- `npm run check`: đạt; lint, Prettier, typecheck, unit 38 tests, brain validation 50 Markdown files và build monorepo đều đạt.
- `npm run test:auth`: 3 files, **12/12 integration tests đạt**.
- `connected-onboarding.spec.ts`: **6/6 E2E đạt** trên Chromium desktop/mobile.
- `verify-connected-onboarding.mjs`: đạt qua web/API/PostgreSQL/Mailpit thật với hai tài khoản hư cấu; đã kiểm tra đăng ký, xác minh, lời mời, pending, duyệt, claim, lưu hồ sơ, cây minh họa, logout, reset password và revoke. Script chỉ dọn dữ liệu do chính lần chạy tạo.
- Đã xem ảnh desktop/mobile của đăng ký, đăng nhập, pending, quản trị và hồ sơ. Không thấy tràn ngang ở các viewport đã kiểm tra; chưa kiểm chứng máy thật, zoom 200% hoặc người lớn tuổi.

## Tiếp theo

1. Chủ dự án rà trực quan luồng tại `http://127.0.0.1:3200/login`; chỉnh ngôn ngữ, nhịp bố cục và nhận diện trước khi nhân rộng UI.
2. Khi giao diện được chấp nhận, chia commit theo backend contract/test, web flow và docs; chỉ push/merge khi được giao.
3. Thiết kế rồi triển khai backend Relationship và API cây thật, sau đó thay dữ liệu minh họa trong `/design-preview/tree`.
4. Chọn mail production, hosting/storage và quy trình bootstrap admin trước pilot gia đình thật.

## Giới hạn

Chưa phải MVP dùng production: email hiện qua Mailpit local, chưa có deploy, quan hệ gia phả thật, thông báo, chat realtime, moments hoặc AI. Danh bạ pilot lấy tối đa 100 hồ sơ và chưa phân trang UI. Claim hiện do admin chỉ định rồi người nhận xác nhận; chưa có self-service request. Migrations 0001–0009 đã áp dụng, chỉ bổ sung migration mới.
