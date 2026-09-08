# Trạng thái dự án

- Context version: **1.2.0**, nguồn máy đọc: [context.json](docs/context.json).
- Pilot: 15 người. Backend onboarding/danh bạ đã triển khai; chưa phải MVP sử dụng đầy đủ.
- Main baseline: `fe0adae`, gồm PR onboarding #6 và năm PR dependency đã merge. Chủ dự án xác nhận CI tốt.
- Đợt hiện tại: `feat/member-directory-profiles`, worktree `.worktrees/onboarding`; đang chốt commit và PR, không tự merge/deploy.

## Đã hoàn tất

- Monorepo npm/Turborepo, Next.js, Fastify, PostgreSQL, worker skeleton; Project Brain, tokens, CI và kiểm thử.
- Auth Better Auth email/password, email verification/reset qua Mailpit local, session server và proxy cùng origin; xem [ADR-002](docs/decisions/ADR-002-authentication.md).
- Membership/invitation/claim APIs, actor transaction, runtime RLS, audit và bootstrap admin local đã merge.
- Task 3 backend: danh bạ tìm tên có/không dấu, phân trang theo tên/ID, profile với liên hệ lọc quyền; admin tạo/quản lý người chưa liên kết, chủ hồ sơ tự sửa kể cả admin.
- PATCH có optimistic version, tăng version khi đổi contacts, audit atomic; claim cũ bị stale sau sửa dữ liệu. Ngày chỉ có năm không sinh ngày giả; hỗ trợ năm 0001–0099, chặn 0000.
- Cursor ràng buộc family và từ khóa chuẩn hóa. Không tìm qua contact riêng tư.
- Migration 0009 bổ sung unaccent; migrations 0001–0009 đã áp dụng local, không sửa migration đã chạy.
- Review độc lập Task 3 và vòng sửa cuối sạch: đã sửa quyền admin-own, low-year date, cursor scope, thêm test API contact PATCH làm claim stale và sửa cleanup FK.

## Kiểm chứng Task 3

- Supervisor integration auth/membership/profile sau sửa cuối: **3 files, 11/11 đạt**, exit 0.
- Supervisor `npm run check` bản cuối: PASS boundaries, tokens, lint, format, typecheck, unit, Brain và build 8 tasks (7 cached). Bộ unit hiện 38 ca.
- `test:tenant` PASS với migration 0009; `db:migrate` chạy lại thành công không áp dụng lại.
- E2E giao diện hiện có **6/6 đạt**: desktop/mobile, text 200%. Đây là preview/home, không phải UI onboarding hoặc kiểm thử điện thoại thật.
- Project Brain: 46 Markdown files, liên kết và 24 seed eval hợp lệ. Chưa chạy eval với LLM.
- CI nhánh mới chỉ được xác nhận sau push; kết quả local không thay cho CI GitHub.

## Bước tiếp theo đã duyệt

1. Commit/push backend danh bạ/hồ sơ và mở PR, theo dõi CI. Merge và deploy báo riêng.
2. Trình lại bản mẫu Nhà mình/hồ sơ và luồng vào nhà để chủ dự án duyệt trực quan, giữ tiêu chí tránh AI slop.
3. Sau duyệt UI: nối đăng nhập, lời mời, chờ duyệt, nhận hồ sơ, danh bạ và chỉnh sửa hồ sơ với backend; kiểm thử toàn hành trình bằng dữ liệu giả.

## Chưa triển khai và giới hạn

- UI onboarding/danh bạ nghiệp vụ; cây gia phả, lịch âm, chat realtime, moments, private storage, outbox/push, PWA service worker, AI, native/widget.
- Bản mẫu `/design-preview` và `/design-preview/profile` đã review code nhưng chưa được chủ dự án duyệt trực quan. Ảnh local trong `.superpowers/design-preview-evidence`.
- Hosting, storage, lịch âm và LLM chưa chọn; chưa production mail, deploy, restore backup hoặc dữ liệu gia đình thật.
- Runtime connection được tin cậy thiết lập actor; RLS không bảo vệ credential runtime bị đánh cắp và giả actor. Rate limiter hiện theo process, cần đánh giá khi nhiều instance.
- Chưa biết tỷ lệ iPhone/Android, ngân sách và nhu cầu chat riêng.

## Môi trường

- Node 24.18.0, npm 11.16.0, Vitest 5; Windows. Dùng UTF-8 và không in secret.
- Compose riêng `family-ai-onboarding`: PostgreSQL 54339, SMTP 1035, Mailpit HTTP 8035; API 4010/web 3200. CI Mailpit HTTP 8025 qua MAILPIT_PORT.
- Subagents Luna xhigh; một implementer rồi reviewer độc lập, không agent con. Supervisor quản lý migration/contracts và tích hợp.
- Các lỗi quota trước đã được ghi nhận nhưng không đồng nghĩa tài khoản hết hạn mức. Kết quả mới ở trên thay thế các checkpoint chưa chạy trước đó.
