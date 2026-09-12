# Trạng thái dự án

- Cập nhật: 2026-09-12. Context version: **1.4.0**.
- Pilot 15 người. Gói onboarding và ổn định đã được merge vào `main` tại `9854d39` qua PR #9.
- GitHub `Monorepo CI / quality (push)` của merge commit đạt 1/1. Gói trải nghiệm mobile-primary và backend quan hệ đã được merge vào `main`; PR #11 hiện ở `579fb82`.
- Nhánh `feat/connected-family-tree` đang nối graph đã duyệt, hồ sơ, đề xuất quan hệ và quyết định quản trị vào `/app`. Lịch âm, chat, moments, notifications và AI chưa có backend.

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
6. Người đã được duyệt vào shell năm đích, xem danh bạ API thật trong Gia phả và quản lý hồ sơ trong Tôi. Preview dữ liệu hư cấu không còn được liên kết từ `/app`.

Endpoint `GET /api/v1/families/:familyId/onboarding` chỉ trả link/claim của chính actor active. Guest trả 401; pending, revoked và cross-family trả 404 để che tài nguyên. Token lời mời nhận qua URL fragment hoặc được dán thủ công, giữ tạm trong `sessionStorage` của tab và xóa khỏi URL; không lưu hồ sơ, liên hệ hay mật khẩu trong browser storage.

Tài khoản đã xác minh nhưng chưa có nhà không còn rơi vào trang trống: có thể dán link/token mời, xem lại tài khoản trước khi nhận hoặc sao chép lời nhắn xin mời. Pending có tiến trình ba bước, tự kiểm tra và thời điểm kiểm tra gần nhất; revoked giải thích cần lời mời mới. Tên nhà và dữ liệu thành viên vẫn được che trước khi admin duyệt.

Hướng dẫn chạy và thử hai người: [docs/CONNECTED_ONBOARDING.md](docs/CONNECTED_ONBOARDING.md).

## Trải nghiệm mobile-primary và cây gia phả

- Chủ dự án xác nhận điện thoại là ứng dụng chính. Pilot vẫn phát hành web/PWA trước; desktop dùng rail để mở rộng cùng năm đích **Nhà · Khoảnh khắc · Gia phả · Trò chuyện · Tôi**. Quản trị nằm dưới Tôi.
- `/design-preview` dùng app bar, tab bar cố định có safe-area và Home theo nhịp dùng hằng ngày: lời chào, ngày gần nhất, moments, gửi ảnh gọn, nhắc việc và lối vào cây. Empty state vẫn có.
- `/design-preview/moments` có feed riêng tư, đối tượng nhận thay đổi theo lựa chọn, phản hồi “Thương”, trả lời riêng và composer dạng sheet hoạt động cục bộ. `/design-preview/chat` mở được thread Cả nhà hoặc Minh Anh và gửi tin local với nhãn chưa đồng bộ. `/design-preview/me` gom đúng hồ sơ Gia Bảo, thông báo, giải thích phạm vi riêng tư và lối duyệt thành viên.
- Hướng thị giác vẫn là **Album gia đình Việt đương đại**: nền giấy ấm, chữ màu mực, xanh lá trầm, điểm nhấn đất nung, con người/câu chuyện quyết định bố cục. Font serif token dùng fallback có glyph tiếng Việt ổn định trong Windows và Chromium CI.
- Hồ sơ có quick actions Gọi/Nhắn/Email và view/edit/saving/error/conflict. Quản trị có pending/empty/conflict, quyết định cục bộ và state lưu trong URL.
- `/design-preview/tree` dùng 15 người hư cấu và 22 relationship fixtures tường minh. SVG sinh một cạnh cho mỗi quan hệ đã xác nhận; Hoàng An chưa rõ nhánh chỉ ở danh bạ. Cây có ba thế hệ, zoom cục bộ, “Về tôi”, URL-backed selection, reload/deep-link, danh bạ tìm không dấu và member bottom sheet có focus trap, Escape, backdrop và trả focus đúng nút trên mobile. Desktop dùng vùng bổ trợ liền kề.
- Chưa có pan/pinch/drag graph thật hoặc lưu bố cục; các phần này thuộc spike thư viện tiếp theo.
- Membership active trong `/app` đã dùng app bar, tab bar mobile có safe-area và desktop rail. Home chỉ hiển thị tên nhà, danh tính và số thành viên từ API thật. Gia phả tải graph đã duyệt quanh hồ sơ đang liên kết, giữ danh bạ làm lối tương đương, mở hồ sơ đã lọc liên hệ phía server và gửi đề xuất quan hệ chờ duyệt. Moments và Chat là trạng thái chưa sẵn sàng trung thực, không gửi API giả hoặc trộn fixture. Guest, invitation, pending và revoked vẫn dùng luồng truy cập đã ổn định.
- Đây vẫn chưa phải UI cuối. Ba bề mặt connected Home, Gia phả/danh bạ và Tôi đã được kiểm trực quan ở Pixel 7; cần tiếp tục thử với thành viên gia đình thật trước khi mở rộng các tính năng giữ chân.

## Quan hệ gia đình — backend đã merge, web đang ở nhánh tính năng

- Migration `0010_relationships.sql` tạo `relationships` và `change_requests` với composite foreign key cùng nhà, RLS, optimistic version, cạnh partnership có lịch sử và dấu loại bỏ riêng với ngày kết thúc.
- `GET /relationships` đọc graph đã duyệt quanh một root, depth 1–4 và tối đa 100 node. DTO node chỉ có member summary, không có biography hoặc contact.
- Thành viên active có thể tạo và hủy đề xuất của mình. Admin active có thể xem pending, duyệt hoặc từ chối; create/update/remove được apply cùng audit trong transaction.
- Approval khóa advisory theo `family_id`, kiểm lại duplicate, version và chu trình. Integration test hai approval đối nghịch đồng thời chứng minh chỉ một cạnh được lưu.
- `/app` trên `feat/connected-family-tree` gọi graph API này với root là hồ sơ đã nhận. Thành viên có thể mở hồ sơ, xem nhãn quan hệ tường minh, chuyển sang danh bạ và gửi đề xuất tạo cha/mẹ, con hoặc bạn đời. Quản trị viên xem tên hai hồ sơ rồi duyệt/từ chối trong Quản trị dưới Tôi. Pending không được vẽ thành cạnh chính thức.
- Tài khoản chưa liên kết hồ sơ không gọi graph; lỗi graph giữ phạm vi trong tab và không làm mất danh bạ. Cây một người có hướng dẫn bổ sung thay vì tự sinh cạnh.

## Kiểm chứng mới nhất

- `npm run check`: đạt ngày 2026-09-12 trên `feat/connected-family-tree`; boundaries, tokens, lint, Prettier, typecheck, **61/61 unit tests**, brain validation 60 Markdown files và build 8 workspace đều đạt.
- Integration với PostgreSQL/Mailpit local: **17/17 tests đạt**. Migration `0010_relationships.sql`, database constraint/RLS test và tenant test đều đạt; hai role giới hạn vẫn được provision đúng.
- `npm run test:e2e`: **127 đạt, 3 skip đúng theo project** trên Chromium desktop và Pixel 7 emulation. Ngoài preview, test connected xác nhận graph đã duyệt, mọi cạnh đều có mô tả tường minh, đề xuất/duyệt quan hệ, fallback danh bạ, cây một người, lỗi graph cục bộ, tài khoản chưa link, phản hồi hồ sơ cũ không ghi đè người mới, focus trap, tên tiếng Việt dài, quyền contact sau focus, đổi family, các trạng thái chưa có nhà/pending/revoked, dán link mời, viewport 320/390/768/1280 và không tràn ngang.
- Bảy bề mặt connected mới đã được chụp và kiểm bằng mắt ở 390×844 và 1280×900: graph có cạnh, cây một người, hàng duyệt với tên dài, desktop rail cùng ba trạng thái chưa có nhà, pending và revoked. Giao diện giữ hướng album gia đình, không dùng card dashboard chung; node thiếu ảnh dùng monogram có chủ đích. Font tiêu đề trạng thái vào nhà dùng token serif đã kiểm glyph tiếng Việt. Bottom navigation cố định vẫn cần kiểm thêm trên điện thoại thật với thanh trình duyệt động.
- `verify-connected-onboarding.mjs`: đạt lại qua web/API/PostgreSQL/Mailpit thật trên cổng kiểm thử riêng 3220/4020 với hai tài khoản hư cấu. Ngoài đăng ký, xác minh, lời mời, pending, duyệt membership, claim và lưu hồ sơ, script tạo hồ sơ thứ hai, gửi/duyệt quan hệ và đọc cạnh vừa duyệt trong graph trước khi kiểm logout, reset password và revoke; script cleanup cả relationship/change request của lần chạy.
- Workflow CI có gate browser thật; run của merge commit `9854d39` đạt trên GitHub trong khoảng 2 phút.

## Tiếp theo

1. Đưa `feat/connected-family-tree` qua PR khi được chủ dự án yêu cầu; sau khi merge, chạy lại CI trên merge commit.
2. Chủ dự án thử `/app` trên điện thoại với dữ liệu pilot, đặc biệt graph quanh tôi, mở hồ sơ, đề xuất và duyệt quan hệ; ghi nhận ngôn ngữ hoặc nhịp thao tác còn gượng.
3. Spike thư viện graph cho pan, pinch/wheel zoom, kéo khung nhìn, “Về tôi” và thu/mở nhánh mà không thay nguồn dữ liệu chuẩn.
4. Sau khi cây thật ổn định, chọn vertical slice giữ chân đầu tiên giữa Moments và Ngày quan trọng/nhắc ngày; Chat realtime chỉ bắt đầu khi có contract retry, delivery và privacy rõ.
5. Chọn mail production, hosting/storage và quy trình bootstrap admin trước pilot gia đình thật.

## Giới hạn

Chưa phải MVP production: email hiện qua Mailpit local và chưa deploy. Cây connected hiện xếp theo hàng thế hệ có cuộn ngang, chưa có pan/pinch/drag, thu nhánh hoặc lưu bố cục. Luồng web mới tạo đề xuất quan hệ; update/remove vẫn cần bề mặt quản trị tiếp theo. Chưa có thông báo, chat realtime, moments hoặc AI. Moments/Chat trong preview chỉ là tương tác cục bộ có nhãn. Danh bạ pilot lấy tối đa 100 hồ sơ và chưa phân trang UI. Claim hiện do admin chỉ định rồi người nhận xác nhận; chưa có self-service request. Migration tiếp theo phải được thêm sau `0010`.
