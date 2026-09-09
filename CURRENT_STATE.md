# Trạng thái dự án

- Cập nhật: 2026-09-09. Context version: **1.4.0**.
- Pilot 15 người. Gói onboarding và ổn định đã được merge vào `main` tại `9854d39` qua PR #9.
- GitHub `Monorepo CI / quality (push)` của merge commit đạt 1/1. Gói trải nghiệm đang ở worktree `.worktrees/product-experience-foundation`, nhánh `feat/product-experience-foundation`; preview đã chuyển sang mobile-primary và đang chờ chủ dự án duyệt trực quan trước khi chuyển vào `/app`.
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

## Trải nghiệm mobile-primary và cây gia phả

- Chủ dự án xác nhận điện thoại là ứng dụng chính. Pilot vẫn phát hành web/PWA trước; desktop dùng rail để mở rộng cùng năm đích **Nhà · Khoảnh khắc · Gia phả · Trò chuyện · Tôi**. Quản trị nằm dưới Tôi.
- `/design-preview` dùng app bar, tab bar cố định có safe-area và Home theo nhịp dùng hằng ngày: lời chào, ngày gần nhất, moments, gửi ảnh nhanh, nhắc việc và lối vào cây. Empty state vẫn có.
- `/design-preview/moments` có feed riêng tư và composer dạng sheet hoạt động cục bộ. `/design-preview/chat` có thread Cả nhà và gửi tin local với nhãn chưa đồng bộ. `/design-preview/me` gom hồ sơ, thông báo, quyền riêng tư và lối duyệt thành viên.
- Hướng thị giác vẫn là **Album gia đình Việt đương đại**: nền giấy ấm, chữ màu mực, xanh lá trầm, điểm nhấn đất nung, con người/câu chuyện quyết định bố cục. Font serif token dùng fallback có glyph tiếng Việt ổn định trong Windows và Chromium CI.
- Hồ sơ có quick actions Gọi/Nhắn/Email và view/edit/saving/error/conflict. Quản trị có pending/empty/conflict, quyết định cục bộ và state lưu trong URL.
- `/design-preview/tree` dùng 15 người hư cấu và relationship fixtures tường minh. Cây có ba thế hệ, zoom cục bộ, “Về tôi”, URL-backed selection, reload/deep-link, danh bạ tìm không dấu và member bottom sheet có focus/backdrop trên mobile.
- Chưa có pan/pinch/drag graph thật, thêm/sửa quan hệ hoặc lưu bố cục; các phần này chờ graph API và spike thư viện.
- Đây là ứng viên thiết kế, chưa phải UI cuối và chưa được chủ dự án nghiệm thu. `/app` vẫn giữ nguyên hành vi kết nối hiện tại.

## Kiểm chứng mới nhất

- `npm run check`: đạt sau cập nhật context 1.4.0; boundaries, tokens, lint, Prettier, typecheck, **40/40 unit tests**, brain validation 55 Markdown files và build 8 workspace đều đạt.
- Integration với PostgreSQL/Mailpit local: **12/12 tests đạt**. `.env` ignored đã được bổ sung cấu hình local còn thiếu, migrations 0002–0009 đã áp dụng và hai role giới hạn đã được provision.
- `npm run test:e2e`: **74 đạt, 2 skip đúng theo project** trên Chromium desktop và Pixel 7 emulation. Bao gồm connected onboarding, năm tab, composer Moments, chat local, chữ 200%, viewport matrix, URL state và focus/đóng bottom sheet.
- Sáu ảnh mobile 390×844 đã được chụp và kiểm bằng mắt: Home, Moments, Tree, member sheet, Chat và Tôi. Đã loại ảnh sai từ build cũ; bản đúng cho thấy app bar/tab bar, nội dung và bottom sheet không chồng nhau.
- `verify-connected-onboarding.mjs`: đạt qua web/API/PostgreSQL/Mailpit thật trên cổng kiểm thử riêng 3220/4020 với hai tài khoản hư cấu. Đã kiểm đăng ký, xác minh, lời mời, pending, duyệt, claim, lưu hồ sơ, cây minh họa, logout, reset password và revoke; script cleanup dữ liệu của lần chạy.
- Workflow CI có gate browser thật; run của merge commit `9854d39` đạt trên GitHub trong khoảng 2 phút.

## Tiếp theo

1. Chủ dự án mở bản mobile-primary tại `/design-preview` và duyệt Home, Moments, Tree + bottom sheet, Chat và Tôi ở điện thoại trước.
2. Sau khi duyệt, chuyển shell, Home, Profile, Directory và Admin vào `/app` với API hiện có; Moments/Chat giữ trạng thái chưa kết nối cho đến khi có backend tương ứng.
3. Triển khai `Relationship`/`ChangeRequest`, audit và graph API bằng migration mới sau `0009`, rồi thay fixture cây bằng dữ liệu server đã kiểm quyền.
4. Spike thư viện graph cho pan, pinch/wheel zoom, kéo khung nhìn, “Về tôi”, thu/mở nhánh và luồng đề nghị thêm người từ cây.
5. Chọn mail production, hosting/storage và quy trình bootstrap admin trước pilot gia đình thật.

## Giới hạn

Chưa phải MVP production: email hiện qua Mailpit local, chưa deploy, chưa có quan hệ gia phả thật, thông báo, chat realtime, moments hoặc AI. Moments/Chat trong preview chỉ là tương tác cục bộ có nhãn. Danh bạ pilot lấy tối đa 100 hồ sơ và chưa phân trang UI. Claim hiện do admin chỉ định rồi người nhận xác nhận; chưa có self-service request. Chỉ bổ sung migration mới sau 0009.
