# ADR-001 — Monorepo TypeScript

- Ngày: 2026-09-08.
- Trạng thái: **Baseline, đã triển khai nền tảng**.
- Thẩm quyền: người dùng yêu cầu tiến hành monorepo đầy đủ; lựa chọn stack do agent thực hiện trong phạm vi đó, không coi từng provider đã được chủ dự án xác nhận.
- Thay thế PAD-010 ở mức lựa chọn database; không thay đổi phạm vi pilot 15 người.

## Quyết định

npm workspaces + Turborepo, Node 24, TypeScript strict; Next.js App Router cho web; Fastify cho API; worker Node riêng để sau này chạy outbox; PostgreSQL 17 local bằng Docker Compose. Dùng SQL migration có thứ tự/checksum/transaction và pg client; chưa thêm ORM. Vitest, ESLint, Prettier, Playwright, GitHub Actions và dependency update configuration.

npm đã có trên máy, một package manager/lockfile giúp onboarding ít bước. Turbo lập thứ tự build theo graph và watch workspace trong development. Next.js tạo nền tảng web/mobile responsive và hướng PWA sau; API riêng cho phép mobile dùng cùng contract, đồng thời có process phù hợp realtime sau này. [Next installation](https://nextjs.org/docs/app/getting-started/installation), [Fastify v5](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/).

Dependency exact/resolution nằm trong package-lock.json; không phụ thuộc nhãn latest lúc CI chạy. Shared UI dùng source TSX qua Next transpilation, các server/domain packages build thành ESM và declarations. Cấm web import database; domain không phụ thuộc framework/provider. CI build/test trước merge, không tự deploy.

## Phương án đã cân nhắc

- pnpm: phù hợp monorepo nhưng thêm yêu cầu cài công cụ trên máy hiện có npm; chưa có lợi ích đủ lớn cho 8 workspace.
- Backend trong Next: ít process hơn nhưng API/worker độc lập thuận tiện hơn cho mobile/realtime và boundary quyền.
- NestJS: module convention đầy đủ nhưng thêm framework/decorators khi domain còn nhỏ. Fastify + domain modules đủ ở giai đoạn này.
- ORM: tiện type-safe query, nhưng migration SQL cho constraints/RLS rõ ràng trước khi chọn abstraction.
- Native/Redis/vector database: chưa có tính năng cần ngay; không tạo dịch vụ rỗng hoặc tăng vận hành.

## Hệ quả và giới hạn

Phải build shared ESM packages trước server; Turbo thực hiện và watch ở dev. Shared UI không phải cam kết reuse native UI. Migration local dùng owner/superuser, không dùng credential đó cho runtime. RLS deny-all chưa phải hệ thống authorization hoàn chỉnh: auth adapter, role riêng và policy phải được làm trước endpoint gia đình. Worker không có handler, API liveness không phải readiness database. Trang giới thiệu chưa có service worker/push, không tuyên bố PWA hoàn chỉnh.

Chưa chọn hosting, auth, private storage, push, lịch âm hoặc LLM provider. Xem lại khi yêu cầu triển khai thực, kỹ năng người duy trì hoặc hiệu năng/chi phí thay đổi. Context tăng 1.1.0.
