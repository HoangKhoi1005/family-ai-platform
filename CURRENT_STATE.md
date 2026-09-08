# Trạng thái dự án

- Cập nhật: 2026-09-08.
- Context version: **1.2.0**, nguồn máy đọc: [context.json](docs/context.json).
- Pilot: 15 người; hiện là nền tảng và backend onboarding, chưa phải MVP sử dụng đầy đủ.
- Nhánh đang làm: `feat/family-onboarding`, worktree `.worktrees/onboarding`. Chưa push đợt này, chưa merge hoặc deploy.

## Đã hoàn tất và review

- Monorepo npm workspaces/Turborepo, Next.js, Fastify, PostgreSQL và worker skeleton; TypeScript, ESLint, Prettier, Vitest, Playwright và workflow CI.
- Project Brain, feature specs, design tokens, 24 ca eval AI khởi đầu và quy trình Superpowers. Chưa chạy eval với LLM.
- Bản mẫu `/design-preview` và `/design-preview/profile`: giao diện tiếng Việt, dữ liệu giả, kiểm tra desktop/mobile/320px và chữ phóng lớn. Đã review code; **chưa được chủ dự án duyệt trực quan**. Ảnh local ở `.superpowers/design-preview-evidence`.
- Auth commit `04008ce`: Better Auth email/password, xác minh email, reset password, session phía server, proxy cùng origin và Mailpit local. Xem [ADR-002](docs/decisions/ADR-002-authentication.md).
- Schema membership commit `1fa6a0a`: migrations 0006/0007, runtime RLS theo actor/membership, transaction context, bootstrap admin local, invitation acceptance và claim isolation. Đã sửa findings và review độc lập sạch.

## Đang thực hiện

Theo [spec onboarding](docs/superpowers/specs/2026-09-08-onboarding.md), [spec membership/profile](docs/superpowers/specs/2026-09-08-membership-profile.md) và [plan backend](docs/superpowers/plans/2026-09-08-membership-backend.md).

Task 2 API membership đã qua review độc lập và kiểm chứng, đang chốt commit:

- Mời, nhận lời mời vào trạng thái chờ, duyệt và thu hồi membership.
- Đề nghị nhận hồ sơ, xem trước có kiểm quyền, xác nhận hoặc từ chối; version, expiry, contact visibility và audit cùng transaction.
- Migration additive 0008 chỉ cung cấp metadata claim để xử lý stale; không trả thông tin liên hệ riêng tư.
- Validation từ chối trường ngoài hợp đồng trước khi AJV có thể loại bỏ chúng; kiểm Origin cho mutation.
- Đã sửa finding thiếu rate limit: preview và revoke có bucket theo actor trước transaction. Test rate limit dùng app instance riêng để không ảnh hưởng kịch bản claim khác. Reviewer kiểm tra lại sạch; không tìm thấy lộ dữ liệu trong các đường stale/expired/revoked/linked/cross-family đã xem.

## Kiểm chứng có bằng chứng

- Integration chung `npm run test:auth`: implementer chạy lại **2 files, 8/8 tests đạt** sau sửa rate limit và fixture isolation; supervisor đọc report, reviewer kiểm tra code/test. Lần supervisor chạy trước sửa fixture là 7 đạt/1 lỗi do test dùng chung bucket; kết quả 7/7 trước đó không thay thế bộ mới.
- Supervisor chạy lại `npm run test:tenant` với migration 0008: PASS tenant RLS, actor transaction context, invitation acceptance và role isolation.
- Quality gate toàn repo ở mốc auth đã đạt: unit 36, typecheck 12 tasks, build 8 tasks; E2E 6/6. Đây là kết quả trước API membership, không thay thế gate hiện tại.
- Supervisor chạy lại `npm run check` lúc 21:49 sau bản sửa rate limit: **PASS** boundaries, tokens, lint, format, typecheck 12 tasks, unit 38/38, Brain 46 Markdown files và build 8 tasks (7 từ cache). Đã sửa định dạng và gom các checkpoint cũ của file này trước lần chạy đạt.
- Migrations 0001–0008 đã được áp dụng trong database onboarding local; không sửa migration đã chạy, dùng migration bổ sung.
- Chưa xác minh CI trên GitHub, chưa kiểm thử điện thoại thật, restore backup hoặc production mail. Chưa chạy HTTP two-process proxy smoke riêng cho Task 2; smoke auth trước đó đã đạt.

## Bước tiếp theo

1. Hoàn tất review độc lập API membership, sửa findings và chạy quality gate; commit phạm vi đã đạt.
2. Triển khai Task 3 danh bạ/hồ sơ backend với quyền xem liên hệ, version và kiểm thử chéo nhà/thu hồi quyền.
3. Chủ dự án duyệt trực quan bản mẫu trước khi triển khai hàng loạt UI nghiệp vụ; backend độc lập được phép tiếp tục.
4. Kiểm chứng toàn đợt, chia commit và push nhánh feature theo phạm vi đã duyệt; không merge main hoặc deploy.

## Chưa triển khai và giới hạn

- Danh bạ/hồ sơ API Task 3; UI onboarding thực; cây gia phả, lịch âm, chat realtime, khoảnh khắc, private storage, outbox/push, PWA service worker, AI, native/widget.
- Hosting, storage, thư viện lịch âm và LLM chưa chọn. Email chỉ dùng local catcher. Không có dữ liệu gia đình thật.
- Chưa biết tỷ lệ iPhone/Android, ngân sách vận hành và nhu cầu chat riêng.
- Runtime DB connection được tin cậy để thiết lập actor; RLS không bảo vệ trước việc đánh cắp credential runtime và giả mạo actor context. Rate limiter API hiện theo process; cần đánh giá lại khi triển khai nhiều instance.

## Môi trường và quy trình

- Node 24.18.0, npm 11.16.0; Windows. Sandbox từng chặn child process bằng `spawn EPERM`; kiểm tra cần quyền phù hợp, không tắt test.
- Compose riêng `family-ai-onboarding`: PostgreSQL 54339, SMTP 1035, Mailpit UI 8035. Không dùng hoặc xóa volume của checkout chính.
- Subagents GPT-5.6 Luna xhigh; một implementer tại một thời điểm, review độc lập. Supervisor giữ phạm vi và tích hợp.
- Các lần quota/automatic approval bị từ chối trước đây không phải lỗi ứng dụng. Chỉ ghi nhận kiểm chứng khi lệnh thực sự chạy và có kết quả.
