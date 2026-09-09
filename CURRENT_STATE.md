# Trạng thái dự án

- Cập nhật: 2026-09-09. Context version: **1.3.0**.
- Pilot 15 người. Gói onboarding và ổn định đã được merge vào `main` tại `9854d39` qua PR #9.
- GitHub `Monorepo CI / quality (push)` của merge commit đạt 1/1. Gói B đang ở worktree `.worktrees/product-experience-foundation`, nhánh `feat/product-experience-foundation`; design spec đã được duyệt và implementation plan design preview đang được thực hiện.
- Backend đã có Better Auth, membership, lời mời/duyệt/thu hồi, claim hồ sơ, danh bạ và hồ sơ. Chưa có backend quan hệ gia phả, lịch âm, chat, moments, notifications hoặc AI.

## Gói A — ổn định onboarding

- Lỗi mạng/timeout được phân biệt với 401, 403 và lỗi HTTP. Refresh mất mạng giữ session, family scope và bản nháp hồ sơ đang nhập; 401 mới kết thúc session.
- Refresh sau khi app lấy lại focus đóng chi tiết danh bạ đang cache để contact vừa đổi quyền không tiếp tục hiện. Membership bị thu hồi xóa family scope và form đang mở.
- Claim dùng version trong identity của panel. Claim đổi version được tải lại; claim hết hạn/biến mất hủy preview đang chờ và không còn nút xác nhận. Claim đã xác nhận được ẩn ngay cả khi lần refresh kế tiếp mất mạng.
- Phản hồi hồ sơ được áp dụng theo version tăng dần, nên một GET cũ hoàn tất muộn không thể ghi đè dữ liệu vừa PATCH thành công.
- Request helper có timeout mặc định 15 giây, nhận `AbortSignal` và phân loại timeout, caller cancellation và network failure.
- Web dùng shared `OnboardingStateResponse` từ `@family/contracts`; form state vẫn nằm ở web.
- Root `npm test` build dependency graph của API trước Vitest để một checkout mới không phụ thuộc vào `dist` cũ.
- CI có thêm browser flow thật sau integration và E2E mock: khởi động API/web, kiểm readiness/PID, chạy Chromium với PostgreSQL và Mailpit, dùng dữ liệu hư cấu rồi cleanup.

## Luồng vào nhà đã nối

1. Đăng ký, xác minh email, đăng nhập, gửi lại thư xác minh.
2. Quên mật khẩu và đặt lại mật khẩu bằng liên kết email một lần.
3. Nhận lời mời trong đúng tab, chờ quản trị viên duyệt và kiểm tra lại trạng thái.
4. Quản trị viên tạo/thu hồi lời mời, duyệt/thu hồi membership, tạo Member và chỉ định hồ sơ.
5. Người nhận xem trước, xác nhận hoặc từ chối claim; sau khi nhận có thể cập nhật hồ sơ và visibility từng liên hệ.
6. Người đã được duyệt vào Nhà mình, xem danh bạ API thật và đi sang cây gia phả minh họa.

Endpoint `GET /api/v1/families/:familyId/onboarding` chỉ trả link/claim của chính actor active. Guest trả 401; pending, revoked và cross-family trả 404 để che tài nguyên. Token lời mời nhận qua URL fragment, giữ tạm trong `sessionStorage` của tab và xóa khỏi URL; không lưu hồ sơ, liên hệ hay mật khẩu trong browser storage.

Hướng dẫn chạy và thử hai người: [docs/CONNECTED_ONBOARDING.md](docs/CONNECTED_ONBOARDING.md).

## Cây gia phả và thiết kế

- `/design-preview/tree` vẫn dùng 15 người hư cấu, tách khỏi danh bạ thật. Chưa có API quan hệ nên không ghép Member thật với quan hệ giả.
- Bản cây hỗ trợ chọn người, chuyển nhánh, quay lại, về tôi, tìm tên không dấu và hồ sơ cạnh cây/thu gọn trên mobile. Chưa có pan/zoom nâng cao, kéo node, thêm/sửa quan hệ hoặc lưu bố cục.
- Giao diện onboarding đáp ứng luồng chức năng và responsive 390/1280 px. Đây chưa phải thiết kế thẩm mỹ cuối và chưa được chủ dự án nghiệm thu. Tiếp tục giữ tiêu chí tránh AI slop/generic dashboard.

## Kiểm chứng mới nhất

- `npm run check`: đạt; boundaries, tokens, lint, Prettier, typecheck, **40/40 unit tests**, brain validation 51 Markdown files và build 8 workspace đều đạt.
- Integration với PostgreSQL/Mailpit local: **12/12 tests đạt**. `.env` ignored đã được bổ sung cấu hình local còn thiếu, migrations 0002–0009 đã áp dụng và hai role giới hạn đã được provision.
- `npm run test:e2e`: **50/50 tests đạt** trên Chromium desktop và Pixel 7 emulation, gồm 32 ca connected onboarding trên hai viewport.
- `verify-connected-onboarding.mjs`: đạt qua web/API/PostgreSQL/Mailpit thật trên cổng kiểm thử riêng 3220/4020 với hai tài khoản hư cấu. Đã kiểm đăng ký, xác minh, lời mời, pending, duyệt, claim, lưu hồ sơ, cây minh họa, logout, reset password và revoke; script cleanup dữ liệu của lần chạy.
- Workflow CI có gate browser thật; run của merge commit `9854d39` đạt trên GitHub trong khoảng 2 phút.

## Tiếp theo

1. Chủ dự án review [design spec gói B](docs/superpowers/specs/2026-09-09-product-experience-foundation-design.md).
2. Sau khi spec được duyệt, viết implementation plan và nâng cấp design preview cho Nhà mình, cây + hồ sơ, profile editor, admin và auth trên desktop/mobile.
3. Sau khi bản chạy được được duyệt trực quan, chuyển shell/route đã duyệt vào `/app`; giữ toàn bộ onboarding regression xanh.
4. Tiếp theo triển khai Relationship/ChangeRequest và API cây thật, rồi thay fixture trong cây.
5. Chọn mail production, hosting/storage và quy trình bootstrap admin trước pilot gia đình thật.

## Giới hạn

Chưa phải MVP production: email hiện qua Mailpit local, chưa deploy, chưa có quan hệ gia phả thật, thông báo, chat realtime, moments hoặc AI. Danh bạ pilot lấy tối đa 100 hồ sơ và chưa phân trang UI. Claim hiện do admin chỉ định rồi người nhận xác nhận; chưa có self-service request. Chỉ bổ sung migration mới sau 0009.
