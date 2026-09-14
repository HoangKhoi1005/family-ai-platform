# Moments, Memories, and Media Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây schema, authorization, S3-compatible storage, media processing và API thật cho Khoảnh khắc/Kỷ niệm family-only.

**Architecture:** PostgreSQL là nguồn chuẩn và RLS chặn cross-family. API phát upload grant ngắn hạn vào quarantine; worker xác minh và chuẩn hóa media trước khi chuyển `ready`. Moments/Memories chỉ tham chiếu media ready và cấp content URL sau khi kiểm quyền parent.

**Tech Stack:** PostgreSQL 17, Fastify 5, TypeScript, MinIO/S3-compatible API, worker process, Vitest và database integration scripts.

**Spec:** `docs/superpowers/specs/2026-09-14-connected-family-experience-design.md`

## Global Constraints

- MVP chỉ nhận `audience=family`; giá trị khác phải bị từ chối.
- Media URL có TTL tối đa 60 giây; object key và credential không xuất hiện trong DTO/log.
- Ảnh tối đa 10 MB, JPEG/PNG/WebP; HEIC bị từ chối rõ. Audio tối đa 25 MB và 10 phút.
- Pending/revoked/cross-family không được list, mutate hoặc nhận content URL.
- Không commit/push cho đến khi chủ dự án giao rõ việc Git.

---

### Task 1: Contracts cho media, Moments và Memories

**Files:**

- Create: `packages/contracts/src/media.ts`
- Create: `packages/contracts/src/moments.ts`
- Create: `packages/contracts/src/memories.ts`
- Create: `packages/contracts/src/media.test.ts`
- Create: `packages/contracts/src/moments.test.ts`
- Create: `packages/contracts/src/memories.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Produces: DTO/input và JSON Schema cho upload, complete, feed, reaction, memory create/item create và cursor query.

- [ ] **Step 1:** Viết failing contract tests cho unknown keys, audience khác `family`, caption >500, MIME/bytes ngoài giới hạn, invalid memory item và cursor limit >100.
- [ ] **Step 2:** Run `npx vitest run packages/contracts/src/media.test.ts packages/contracts/src/moments.test.ts packages/contracts/src/memories.test.ts`; expected FAIL vì exports chưa có.
- [ ] **Step 3:** Implement discriminated unions và schemas với `additionalProperties:false`; không expose `object_key`.
- [ ] **Step 4:** Chạy lại contract tests và `npm run typecheck --workspace @family/contracts`; expected PASS.

### Task 2: Migration 0025 và RLS

**Files:**

- Create: `packages/database/migrations/0025_moments_memories_media.sql`
- Create: `packages/database/scripts/test-moments-memories-schema.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: `media_assets`, `moments`, `moment_reactions`, `memories`, `memory_items`, RLS/policies/grants và cleanup outbox rows.

- [ ] **Step 1:** Viết integration script seed hai family, active/pending/revoked và kiểm literal PostgreSQL codes cho cross-family FK/RLS, duplicate client request, reaction uniqueness, source Moment uniqueness và invalid item shape.
- [ ] **Step 2:** Run `npm run test:moments-schema`; expected FAIL vì script/migration chưa tồn tại.
- [ ] **Step 3:** Viết migration với composite unique keys `(id,family_id)`, composite FKs, CHECK enums/shape, indexes cho stable cursor và RLS dùng active membership helpers hiện có.
- [ ] **Step 4:** Thêm grants tối thiểu cho `family_runtime` và claim/delete grants riêng cho `family_worker`; không cấp object key qua view công khai.
- [ ] **Step 5:** Chạy migrate trên database test mới rồi `npm run test:moments-schema`; expected PASS.

### Task 3: Storage abstraction và local MinIO

**Files:**

- Create: `packages/media/package.json`
- Create: `packages/media/tsconfig.json`
- Create: `packages/media/src/index.ts`
- Create: `packages/media/src/storage.ts`
- Create: `packages/media/src/storage.test.ts`
- Modify: `scripts/check-boundaries.mjs`
- Modify: `compose.yaml`
- Modify: `.env.example`
- Modify: `scripts/init-env.mjs`
- Modify: `turbo.json`
- Modify: `apps/api/package.json`
- Modify: `apps/worker/package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Produces: `MediaStorage`, `S3MediaStorage`, `readMediaStorageConfig` và MinIO service/bucket bootstrap.

- [ ] **Step 1:** Viết failing tests bằng fake S3 HTTP endpoint cho key generation, upload expiry ≤600 giây, read expiry ≤60 giây và không log credential/object body.
- [ ] **Step 2:** Run `npx vitest run packages/media/src/storage.test.ts`; expected FAIL vì workspace chưa có.
- [ ] **Step 3:** Đăng ký workspace boundary: API/worker được phụ thuộc `@family/media`; package media chỉ phụ thuộc external SDK/config, không phụ thuộc app.
- [ ] **Step 4:** Cài AWS S3 client/presigner với version khóa trong lockfile, implement adapter và config validation.
- [ ] **Step 5:** Thêm MinIO vào compose với port chỉ bind `127.0.0.1`, volume riêng và healthcheck; `env:init` sinh local access/secret không commit secret.
- [ ] **Step 6:** Chạy storage tests, boundaries, typecheck; expected PASS.

### Task 4: Media API và processing worker

**Files:**

- Create: `apps/api/src/family/media.ts`
- Create: `apps/api/src/family/media.test.ts`
- Create: `apps/worker/src/media-processor.ts`
- Create: `apps/worker/src/media-processor.test.ts`
- Create: `apps/worker/src/postgres-media-store.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/family/routes.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/config.ts`

**Interfaces:**

- Produces: upload/complete/metadata/content handlers, idempotent processing claims và image/audio validation result.

- [ ] **Step 1:** Viết failing API tests cho active owner, pending/revoked/cross-family, fake MIME, oversized file, complete missing object và repeated complete.
- [ ] **Step 2:** Viết failing worker tests với literal JPEG/PNG/WebP headers, GPS-bearing test image, invalid signature và audio over-duration metadata.
- [ ] **Step 3:** Run focused Vitest; expected FAIL vì handlers/processor chưa có.
- [ ] **Step 4:** Implement route handlers bằng `withActorTransaction`, `requireFamily`, purpose-specific rate limit và adapter injection qua `AppOptions`.
- [ ] **Step 5:** Implement worker claim → fetch → validate/decode → re-encode without metadata → put processed → mark ready/rejected. Repeated claim không tạo processed object thứ hai.
- [ ] **Step 6:** Implement content authorization: owner draft hoặc active member với visible non-deleted parent; TTL hard-cap 60 giây.
- [ ] **Step 7:** Chạy unit/API/integration tests; expected PASS.

### Task 5: Moments API

**Files:**

- Create: `apps/api/src/family/moments.ts`
- Create: `apps/api/src/family/moments.test.ts`
- Modify: `apps/api/src/family/routes.ts`
- Create: `packages/database/scripts/test-moments-api.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: list/create/delete/react services và routes theo contract.

- [ ] **Step 1:** Viết failing tests cho stable cursor, only-ready owned media, idempotency retry/body conflict, cross-family 404, revoked denial, soft delete và reaction upsert/remove.
- [ ] **Step 2:** Run focused unit/integration tests; expected FAIL vì routes chưa tồn tại.
- [ ] **Step 3:** Implement SQL DTO mapping không serialize row trực tiếp; author Member summary được lọc và `my_reaction` lấy theo actor.
- [ ] **Step 4:** Implement create/delete/reaction trong transaction với audit và orphan cleanup enqueue.
- [ ] **Step 5:** Chạy tests; expected PASS.

### Task 6: Memories API

**Files:**

- Create: `apps/api/src/family/memories.ts`
- Create: `apps/api/src/family/memories.test.ts`
- Modify: `apps/api/src/family/routes.ts`
- Create: `packages/database/scripts/test-memories-api.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: timeline/create/from-Moment/add-item/delete routes và DTO mapping.

- [ ] **Step 1:** Viết failing tests cho manual Memory, conversion ownership/admin, duplicate conversion, source deleted, optimistic version, media purpose/readiness và ordered items.
- [ ] **Step 2:** Run focused tests; expected FAIL vì routes chưa tồn tại.
- [ ] **Step 3:** Implement services với transaction, same-family validation và source audience preservation.
- [ ] **Step 4:** Implement cursor `occurred_on DESC,id DESC`, soft delete và cleanup chỉ khi media không còn parent.
- [ ] **Step 5:** Chạy tests; expected PASS.

### Task 7: Foundation verification và docs

**Files:**

- Modify: `docs/06_DOMAIN_MODEL.md`
- Modify: `docs/10_PRIVACY_SECURITY.md`
- Modify: `docs/11_API_CONTRACTS.md`
- Modify: `specs/moments/README.md`
- Create: `specs/memories/README.md`
- Modify: `CURRENT_STATE.md`

**Interfaces:**

- Produces: Project Brain khớp code và bằng chứng security/media.

- [ ] **Step 1:** Chạy toàn bộ schema/API/worker tests mới trên database mới migrate.
- [ ] **Step 2:** Chạy `npm run check`; expected PASS.
- [ ] **Step 3:** Cập nhật docs bằng contract thực đã triển khai, TTL/limit, HEIC behavior và giới hạn production provider chưa chọn.
- [ ] **Step 4:** Run `python scripts/validate_brain.py`; expected PASS.
