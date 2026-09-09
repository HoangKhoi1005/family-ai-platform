# Family AI — Monorepo · Context v1.4.0

Ngôi nhà số riêng tư cho gia đình Việt: **Biết nhau · Kết nối nhau · Lưu giữ nhau**.

Thử nghiệm đầu tiên dành cho **15 người**, phát hành web/PWA trước nhưng **điện thoại là trải nghiệm chính**; native và widget ảnh là bước sau. Đã có luồng web đăng nhập, xác minh email, lời mời/duyệt, nhận hồ sơ và chỉnh hồ sơ nối API thật. Xem [hướng dẫn dùng thử](docs/CONNECTED_ONBOARDING.md). Cây gia phả và shell mobile-primary hiện là bản minh họa, chưa có API quan hệ; chưa phải MVP đầy đủ.

## Chạy local

Cần Node **24.18+ trong dòng 24**, npm 11; Python 3 cho kiểm tra Project Brain. Docker chỉ cần khi làm database.

```sh
npm ci
npm run dev
```

Web: `http://127.0.0.1:3000`. API: `http://127.0.0.1:4000/health/live`. Worker đang chờ, chưa có job handler và không gửi thông báo. Dừng bằng Ctrl+C.

```sh
npm run env:init
npm run db:up
npm run db:migrate
npm run test:db
```

`env:init` tạo mật khẩu local ngẫu nhiên, không ghi đè `.env` có sẵn. `db:down` dừng container và giữ volume. Không dùng credential database owner của local cho runtime production.

## Cấu trúc

```text
apps/
  web/          Next.js App Router, trang giới thiệu responsive
  api/          Fastify, health và error contract
  worker/       Process lifecycle cho background jobs tương lai
packages/
  domain/       Business types và policy primitives
  contracts/    DTO / JSON Schema dùng chung
  config/       Kiểm tra biến môi trường server
  database/     PostgreSQL client, migration có checksum, integration test
  ui/           React primitives và CSS sinh từ design tokens
tests/e2e/      Playwright desktop/mobile viewport
.github/        CI, dependency updates, PR template
docs/           Project Brain và hướng dẫn phát triển
```

Không tạo mobile app giả; khi đến phase native, thêm `apps/mobile` và dùng lại contracts/domain theo decision.

## Lệnh kiểm tra

| Lệnh                      | Chức năng                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `npm run check`           | Boundaries, tokens, lint, format, typecheck, unit/API test, Brain, production build |
| `npm run build`           | Build các workspace theo dependency graph                                           |
| `npm test`                | Vitest cho config, policy và API qua inject                                         |
| `npm run test:db`         | PostgreSQL integration, rollback dữ liệu giả sau kiểm thử                           |
| `npm run test:e2e`        | Playwright khởi động bản web đã build; cần Chromium                                 |
| `npm run format`          | Định dạng các file được quản lý                                                     |
| `npm run tokens:generate` | Sinh CSS từ `design/tokens.json`                                                    |

Lần đầu chạy E2E: `npx playwright install chromium`; sau đó `npm run build` và `npm run test:e2e`. CI cài browser tự động. Không có tác vụ tự deploy.

Chi tiết biên package, môi trường và troubleshooting: [Development guide](docs/DEVELOPMENT.md). Lý do chọn stack: [ADR-001](docs/decisions/ADR-001-monorepo.md).

## Bắt đầu

Đã thiết lập Superpowers skills và quy trình subagents: [hướng dẫn sử dụng/cài trên máy khác](docs/SUPERPOWERS.md). Bản cài cá nhân không tự đi theo Git clone; repo lưu revision cố định và script setup.

1. Đọc [AGENTS.md](AGENTS.md) để biết quy trình làm việc.
2. Đọc [bối cảnh dự án](docs/00_PROJECT_CONTEXT.md) và [trạng thái thực tế](CURRENT_STATE.md).
3. Tra [mục lục và nguồn sự thật](docs/INDEX.md), rồi đọc spec liên quan.
4. Xem [đánh giá đề xuất đầu vào](docs/PROJECT_BRAIN_REVIEW.md) để hiểu những điều đã điều chỉnh.

## Nội dung

- [Yêu cầu sản phẩm](docs/03_PRODUCT_REQUIREMENTS.md), [phạm vi MVP](docs/04_MVP_SCOPE.md), [lộ trình](docs/13_ROADMAP.md).
- [UX/UI](docs/05_UX_UI_GUIDELINES.md), [design tokens](design/tokens.json).
- [Domain](docs/06_DOMAIN_MODEL.md), [schema dự kiến](docs/07_DATABASE_SCHEMA.md), [kiến trúc](docs/08_SYSTEM_ARCHITECTURE.md).
- [AI](docs/09_AI_ARCHITECTURE.md), [quyền và riêng tư](docs/10_PRIVACY_SECURITY.md), [API dự kiến](docs/11_API_CONTRACTS.md).
- [Feature specs](specs/README.md), [mẫu task](templates/TASK.md), [mẫu nghiệm thu](templates/ACCEPTANCE_TEST.md).
- [Bộ đánh giá AI mẫu](evals/README.md), [chiến lược kiểm thử](tests/README.md).

## Kiểm tra tài liệu

Chạy `python scripts/validate_brain.py` từ thư mục repo. Script kiểm tra liên kết Markdown nội bộ, JSON, phiên bản context và tính nhất quán cơ bản của bộ đánh giá AI. Đây **không phải** kiểm thử ứng dụng, bảo mật hoặc độ chính xác của mô hình AI.

Không đưa dữ liệu thật của người thân, ảnh riêng, số điện thoại hay khóa bí mật vào Git. Chỉ dùng dữ liệu giả trong ví dụ và kiểm thử.
