# Trạng thái dự án

- Cập nhật: 2026-09-08
- Context version: **1.2.0**, nguồn máy đọc: [context.json](docs/context.json).
- Giai đoạn: monorepo foundation, chưa phải MVP gia đình.
- Quy mô pilot: 15 người trong một gia đình.

## Đã có

- npm workspaces/Turborepo; 3 apps web/API/worker và 5 packages domain/contracts/config/database/ui.
- Next.js trang giới thiệu responsive tiếng Việt; CSS sinh từ design tokens, shared UI.
- Fastify `/health/live`, error envelope và no-store; không có dev-auth bypass.
- Worker process lifecycle, chưa có job handler.
- PostgreSQL local; migration identity/member/contact, composite FK, RLS deny-all; runner checksum/advisory lock/transaction.
- TypeScript strict, ESLint, Prettier, Vitest, Playwright; GitHub CI/dependency updates được cấu hình.

- Bộ Project Brain: bối cảnh, yêu cầu, UX, domain, schema/API dự kiến, kiến trúc, riêng tư, thông báo, roadmap và decision log.
- Feature specs cho truy cập/quản trị, hồ sơ, gia phả, lịch, chat, khoảnh khắc và AI.
- Design tokens đã sinh CSS dùng trên trang giới thiệu; task/spec/acceptance/decision templates.
- Fixture giả và 24 ca đánh giá AI khởi đầu; chưa chạy với LLM.
- Script kiểm tra tính nhất quán của tài liệu; kết quả lần chạy được ghi ở phần kiểm chứng khi có.
- Đã cài 14 Superpowers skills cá nhân từ commit cố định; repo có lock, script cài trên máy khác và [hướng dẫn subagents](docs/SUPERPOWERS.md). Không cài marketplace hooks. Xem lượt mới để nhận diện skills.

## Chưa triển khai

API authentication, policies runtime theo membership, API nghiệp vụ, UI gia phả/lịch/chat, lịch âm, private storage, outbox/delivery, push/PWA service worker, AI, native/widget. Chưa có hosting/deploy, dữ liệu gia đình thật, GitHub CI run hoặc diễn tập restore backup.

## Tiếp theo

Đợt đã được duyệt ngày 2026-09-08: [Vào nhà và nhận hồ sơ](docs/superpowers/specs/2026-09-08-onboarding.md), trên nhánh `feat/family-onboarding`, worktree `.worktrees/onboarding`. Bản mẫu đã qua review code; schema xác thực đã có và đang sửa theo review, chưa có API auth hoàn tất. Chủ dự án yêu cầu duyệt trực quan bản mẫu Nhà mình/hồ sơ trước khi triển khai hàng loạt màn hình. Backend độc lập được phép tiếp tục. Subagents dùng GPT-5.6 Luna xhigh; supervisor điều phối và review.

- Đã chọn baseline [Better Auth và biên quyền](docs/decisions/ADR-002-authentication.md); [plan auth](docs/superpowers/plans/2026-09-08-auth-foundation.md) và [thiết kế membership/profile](docs/superpowers/specs/2026-09-08-membership-profile.md) đã được viết; mới có schema/local services, chưa có API backend nghiệp vụ.
- Bản mẫu `/design-preview` và `/design-preview/profile` đã qua review độc lập và vòng sửa ngày minh họa/chữ phụ/320px; chưa được chủ dự án duyệt thị giác. Không nối dữ liệu thật hay đánh dấu các tính năng calendar/chat/moments đã có. Build8/8, focused E2E4/4 sau sửa; trước đó E2E toàn bộ6/6. Ảnh desktop/mobile/320px đã được xem, lưu local tại `.superpowers/design-preview-evidence`.
- Worktree mới: npm ci thành công, npm test 15/15; web dev cổng3200 Ready và HTTP200 có nội dung tiếng Việt, đã dừng tiến trình smoke của agent. Kết quả này không khẳng định mọi lỗi dev trước đây cùng nguyên nhân.
- Schema auth commit `ab932a0` đã review độc lập, đang sửa quyền role có sẵn và initializer cấu hình: migration 0002, auth/runtime roles, provisioning local, Mailpit 1.30.4 và môi trường tách biệt. Migration replay, test auth-schema/original DB, login thực bằng roles, env idempotence, lint/typecheck/format và 15 unit tests đã qua theo report; chưa có API đăng nhập. PostgreSQL 54339, SMTP 1035, mail UI 8035 thuộc compose family-ai-onboarding, riêng với checkout chính.

1. Lập inventory điện thoại/trình duyệt và cách đăng nhập thuận tiện cho 15 người; có thể bắt đầu thiết kế với giả định trong context.
2. Prototype luồng vào nhà, Nhà mình, hồ sơ và gia phả trên điện thoại; lấy phản hồi từ ít nhất một người lớn tuổi.
3. Auth đã chọn theo [ADR-002](docs/decisions/ADR-002-authentication.md); triển khai theo plan auth rồi membership backend. Hosting chưa chọn.
4. Triển khai đăng nhập → membership → hồ sơ với runtime role NOBYPASSRLS, policies và test chéo nhà/thu hồi quyền.

## Giả định và điểm chưa chốt

- PWA trước và navigation bốn mục là baseline đề xuất cho v1.0, có thể điều chỉnh qua phản hồi.
- PostgreSQL local đã có migration nền tảng; chưa chọn dịch vụ hosting production.
- Chưa biết tỷ lệ iPhone/Android, ngân sách vận hành và nhu cầu chat riêng. Đăng nhập đợt này đã chọn email/password có xác minh.
- Chưa chọn thư viện lịch âm đã kiểm chứng hoặc provider AI; không được triển khai cách tính tạm bằng LLM.

## Kiểm chứng

- Repo ban đầu chỉ có README và Git; không có `.codegraph/` hoặc mã ứng dụng.
- Node 24.18.0 / npm 11.16.0 / Docker 29.6.2 trên Windows.
- `db:migrate` đã apply migration 0001; chạy lần hai không apply lại.
- `test:db` PASS: FK chéo nhà, membership trùng, ngày/năm sinh nhất quán, account link hợp lệ, RLS deny-all cho runtime. Dữ liệu/role test rollback.
- `npm run check` PASS: dependency boundaries, generated tokens, ESLint, Prettier, typecheck 8 workspace, 15 unit/API tests, Project Brain và production build 8 workspace.
- `test:e2e` PASS 2/2 trên Chromium desktop và mobile viewport; đã xem ảnh chụp, không thấy tràn/cắt nội dung. Đây không phải kiểm thử iPhone thật.
- `brain:check` PASS: 39 Markdown files, liên kết nội bộ, 4 JSON assets context/tokens/evals và 24 ca eval seed. `git diff --check` PASS.
- Windows sandbox ban đầu chặn tiến trình con (spawn EPERM); test/build đã chạy lại thành công bằng quyền phù hợp, không tắt kiểm tra trong code.
- Dev smoke: đã quan sát web báo Ready, API listening, worker khởi động và shared packages watch không lỗi; đã thử dừng bằng Ctrl+C. Lần đọc HTTP riêng ở chế độ dev chưa hoàn thành. Production HTTP/UI đã được Playwright kiểm tra thành công.
- Lần thử khởi động lại dev bị automatic approval review từ chối do refresh token bị thu hồi; cần đăng nhập lại môi trường trước khi thử tiếp. Không phải lỗi build ứng dụng; không bỏ qua cơ chế duyệt.
- Review độc lập trước initial push không tìm thấy lỗi chặn trong foundation. Đã bổ sung contact fixture hợp lệ để test RLS không thể pass chỉ vì bảng rỗng.
- Setup Superpowers đã kiểm thử cài đủ 14 skill vào thư mục thử; kiểm tra chạy lại từ chối ghi đè đúng dự kiến. Quality gate và database tests đã chạy lại thành công trước initial push.
- E2E chuyển sang cổng riêng 3100 (cấu hình E2E_PORT) để không xung đột với dev 3000.
- E2E trên cổng 3100 đã chạy lại PASS 2/2 desktop/mobile trước push. Bản cài thử Superpowers nằm trong .superpowers/install-verification và đã được ignore.
- Chưa thử điện thoại thật hoặc chạy đánh giá LLM; không có production deploy. Trạng thái commit/push/CI tra bằng Git và GitHub, không suy ra từ việc có file workflow.
