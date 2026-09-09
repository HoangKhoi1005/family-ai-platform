# Trạng thái dự án

- Cập nhật: 2026-09-09. Context version: **1.3.0**.
- Pilot 15 người. Gói onboarding và ổn định đã được merge vào `main` tại `9854d39` qua PR #9.
- GitHub `Monorepo CI / quality (push)` của merge commit đạt 1/1. Gói B đang ở worktree `.worktrees/product-experience-foundation`, nhánh `feat/product-experience-foundation`; design preview đã triển khai xong và đang chờ chủ dự án duyệt trực quan trước khi chuyển vào `/app`.
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

- `/design-preview` có shell chung và năm bề mặt review: Nhà mình, Gia phả, Hồ sơ, Vào nhà và Quản trị. Tất cả dùng fixture hư cấu, có nhãn rõ và được kiểm không gọi `/api/*`.
- Hướng thị giác đang trình duyệt là **Album gia đình Việt đương đại**: nền giấy ấm, chữ màu mực, xanh lá trầm, điểm nhấn đất nung, bố cục biên tập theo người/câu chuyện thay vì card-grid. Font serif token dùng fallback có glyph tiếng Việt ổn định trong Windows và Chromium CI.
- Nhà mình có bản nội dung và empty state. Hồ sơ có view/edit/saving/error/conflict cùng liên kết `tel:`/`mailto:` chỉ khi fixture cho phép. Quản trị có pending/empty/conflict, quyết định cục bộ và state lưu trong URL.
- `/design-preview/tree` dùng 15 người hư cấu và relationship fixtures tường minh, tách khỏi danh bạ thật. Cây có ba thế hệ, URL-backed selection, reload/deep-link, danh bạ tìm không dấu, người đã mất, quan hệ nuôi dưỡng, người chưa rõ nhánh và hồ sơ liền kề. Trên mobile, chọn người đưa focus đến hồ sơ và có thể đóng để về cây.
- Chưa có pan/zoom nâng cao, kéo node, thêm/sửa quan hệ hoặc lưu bố cục; các phần này chờ graph API và gói D.
- Đây là ứng viên thiết kế, chưa phải UI cuối và chưa được chủ dự án nghiệm thu. `/app` vẫn giữ nguyên hành vi kết nối hiện tại.

## Kiểm chứng mới nhất

- `npm run check`: đạt; boundaries, tokens, lint, Prettier, typecheck, **40/40 unit tests**, brain validation 53 Markdown files và build 8 workspace đều đạt.
- Integration với PostgreSQL/Mailpit local: **12/12 tests đạt**. `.env` ignored đã được bổ sung cấu hình local còn thiếu, migrations 0002–0009 đã áp dụng và hai role giới hạn đã được provision.
- `npm run test:e2e`: **66/66 tests đạt** trên Chromium desktop và Pixel 7 emulation, gồm connected onboarding, contact theo fixture, URL state, viewport matrix và focus/đóng hồ sơ mobile.
- Ma trận 20 ảnh đã được chụp và kiểm bằng mắt tại 1280×900 và 390×844: Home normal/empty, Profile view/edit/conflict, Tree selected/directory, Admin pending/empty và Join pending. Đã sửa lỗi glyph tiếng Việt của serif fallback và độ rộng hàng cây từ bằng chứng ảnh.
- `verify-connected-onboarding.mjs`: đạt qua web/API/PostgreSQL/Mailpit thật trên cổng kiểm thử riêng 3220/4020 với hai tài khoản hư cấu. Đã kiểm đăng ký, xác minh, lời mời, pending, duyệt, claim, lưu hồ sơ, cây minh họa, logout, reset password và revoke; script cleanup dữ liệu của lần chạy.
- Workflow CI có gate browser thật; run của merge commit `9854d39` đạt trên GitHub trong khoảng 2 phút.

## Tiếp theo

1. Chủ dự án mở bản chạy `/design-preview` và duyệt cá tính, phân cấp, cây + hồ sơ trên desktop/mobile.
2. Ghi nhận các chỉnh sửa thẩm mỹ cần thiết; chỉ khi chủ dự án duyệt mới lập kế hoạch chuyển shell, Home, Profile, Directory và Admin vào `/app` với API hiện có.
3. Triển khai `Relationship`/`ChangeRequest`, audit và graph API bằng migration mới sau `0009`, rồi thay fixture cây bằng dữ liệu server đã kiểm quyền.
4. Spike thư viện graph cho pan, pinch/wheel zoom, kéo khung nhìn, “Về tôi”, thu/mở nhánh và luồng đề nghị thêm người từ cây.
5. Chọn mail production, hosting/storage và quy trình bootstrap admin trước pilot gia đình thật.

## Giới hạn

Chưa phải MVP production: email hiện qua Mailpit local, chưa deploy, chưa có quan hệ gia phả thật, thông báo, chat realtime, moments hoặc AI. Danh bạ pilot lấy tối đa 100 hồ sơ và chưa phân trang UI. Claim hiện do admin chỉ định rồi người nhận xác nhận; chưa có self-service request. Chỉ bổ sung migration mới sau 0009.
