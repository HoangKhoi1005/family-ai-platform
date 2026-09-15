# Trạng thái dự án

- Cập nhật: 2026-09-15. Context version: **1.6.0**.
- Pilot 15 người. Gói onboarding và ổn định đã được merge vào `main` tại `9854d39` qua PR #9.
- GitHub `Monorepo CI / quality (push)` của merge commit đạt 1/1. Gói trải nghiệm mobile-primary và backend quan hệ đã được merge vào `main`; PR #11 hiện ở `579fb82`.
- Gói connected family tree đã merge vào `main` tại `ccabad3` qua PR #12. Gói cây tương tác và thao tác quan hệ đã merge tại `a67371a` qua PR #13. Calendar Core và Mobile Calendar đã merge vào `main` tại `00e826c` qua PR #14–#15; notification schema/contracts đã merge tại `76e976c` qua PR #16; Event-to-outbox và worker inbox đã merge tại `b0d939d` qua PR #17. Task 11 API và inbox mobile đã merge vào `main` tại `0cc7f0f` qua PR #18; CI của merge commit đạt. Chat và AI chưa có backend hoàn chỉnh.
- Gói đồng bộ Project Brain và PWA foundation riêng tư đã merge vào `main` tại `ac8fb16` qua PR #19. Manifest, launcher icons, service-worker lifecycle và hướng dẫn cài đặt trong Tôi đã có code và browser test; push, offline data và production hosting vẫn chưa triển khai.
- Gói A+B+C, private media, Moments và Memories đã merge vào `main` tại `fc60ad5` qua PR #21. Sau các PR dependency #23–#28, `main` hiện ở `f8c8d97`, đồng bộ `origin/main`; CI gần nhất đạt sau khi chạy lại lỗi registry bên ngoài.
- Chủ dự án đã chọn staging cloud miễn phí: Oracle Ampere A1 Always Free + Docker Compose ARM64, Cloudflare R2 private, Resend SMTP và Tailscale Funnel HTTPS theo PAD-024. Gói source, cấu hình và runbook đã hoàn thành trên nhánh `impl/oci-free-pilot-readiness`; chưa tạo tài nguyên Oracle/R2/Resend/Tailscale, chưa deploy và chưa đưa dữ liệu thật lên cloud.

## Gói OCI Free Pilot Readiness — source đã hoàn thành

- Runtime phân biệt `local`, `staging` và `production`; staging/production bắt buộc origin HTTPS, URL PostgreSQL có mật khẩu, cặp SMTP auth đầy đủ và endpoint object storage HTTPS. API dùng `API_PORT` độc lập với cổng web.
- API có `/health/live` cho trạng thái tiến trình và `/health/ready` kiểm cả auth/runtime PostgreSQL; lỗi readiness trả phản hồi `503` cố định, không lộ dependency hoặc chi tiết kết nối. Next proxy cùng origin cho cả `/api` và `/health/ready`.
- Provision role staging fail closed: chỉ chấp nhận đúng host/database của owner, yêu cầu `ALLOW_STAGING_PROVISION=true`, từ chối production và không in mật khẩu/target. Migration vẫn chạy lặp an toàn trước khi provision role giới hạn.
- Deployment package có image targets `api`, `web`, `worker`, `tools`, Compose private topology, PostgreSQL volume, healthcheck, resource limits và `no-new-privileges`. Chỉ Web mở `127.0.0.1:3200`; database/API/worker không publish cổng. CI build cả bốn target cho `linux/arm64` và image backup riêng.
- Backup PostgreSQL được mã hóa bằng `age` trước khi tải lên bucket R2 backup riêng; file tạm nằm trong tmpfs và bị dọn bằng trap. Restore chỉ chạy ở staging, chỉ vào database mới có hậu tố `_restore_drill`, sau đó kiểm migration, role giới hạn và RLS.
- Runbook đã mô tả Oracle Always Free, Tailscale Funnel, R2 private/CORS, Resend SMTP, deploy/rollback, sự cố và checklist nghiệm thu không chứa PII/secret.
- Source gate gần nhất đạt: typecheck **15/15 Turbo tasks**, **203/203 unit tests trong 42 file**, Project Brain **83 Markdown / 4 JSON / 24 seed cases**, production build đủ **9 workspace**. Playwright đạt **193 pass, 3 skip đúng theo project** trên Chromium desktop và Pixel 7.
- PostgreSQL/Mailpit/MinIO local đã chạy migration hai lần, provision role, auth schema, tenant, relationships, calendar, notification, Moments/Memories, media worker/storage và Better Auth integration; mọi suite đều đạt. Image API ARM64 đã build thành công. Web/Worker/Tools/Backup ARM64 còn chờ chạy lại vì Docker Hub timeout và phiên cấp quyền Docker bị ngắt; chưa được ghi nhận là đạt.

## Hệ thống trải nghiệm mobile A+B+C — đã merge vào `main`

- A đã vào `/app`: shell mobile/desktop dùng tokens mới, Nhà lấy tên nhà, thành viên, lịch, thông báo và Khoảnh khắc gần nhất từ API thật; có loading/error/empty/revoke và không dùng preview fixture.
- C đã vào Gia phả thật: lớp “Quanh người thân” chỉ đọc quan hệ đã duyệt từ relationship API, mở hồ sơ thật khi chạm; canvas React Flow, tìm kiếm, zoom, kéo node, thu nhánh và luồng đề xuất/duyệt quan hệ được giữ nguyên.
- B đã có contracts, migration, API, private S3-compatible storage, media worker và UI `/app`. Thành viên có thể tải một ảnh, đăng Khoảnh khắc cho Cả nhà, phản ứng “Thương”, lưu thành Kỷ niệm, thêm lời kể chữ hoặc bản ghi âm và phát âm thanh bằng thao tác chủ động. Draft không vào browser storage; content URL được cấp tối đa 60 giây.
- Media đi qua `pending → processing → ready/rejected → deleted`. Runtime không thể tự giả trạng thái ready; helper database kiểm actor cho upload completion và soft-delete. Ảnh được decode/re-encode để bỏ metadata, audio được kiểm signature/thời lượng. Raw quarantine được purge sau xử lý; upload pending quá một giờ, media rejected và media không còn parent đều được xếp hàng xóa. Worker kiểm lại parent ngay trước claim, dùng lease và retry có giới hạn.
- MinIO local đã khởi động thành công trên loopback; bài tích hợp thật đã upload bằng presigned URL, HEAD/read bằng URL 60 giây rồi xóa object. Schema/RLS, Moments/Memories API, worker processing/cleanup và browser flow mobile đều đạt ở lần kiểm chứng gần nhất trước khi merge.
- Toàn bộ Playwright đạt **193 pass, 3 skip đúng theo project** trên Chromium desktop và Pixel 7. Luồng mới bao phủ upload ảnh, đăng Khoảnh khắc, xuất hiện lại ở Nhà, lưu thành Kỷ niệm, thêm lời kể chữ/audio, phát audio theo thao tác, kéo node có phản hồi và các trạng thái offline/revoke.
- Full `npm run check` đạt ngày 2026-09-14: boundaries, tokens, PWA safety, lint, format, typecheck **15/15 Turbo tasks**, **189/189 unit tests trong 41 file**, Project Brain **76 Markdown / 4 JSON / 24 seed cases** và production build đủ 9 workspace. Review độc lập đã phát hiện rồi xác nhận sửa race Moment→Memory/delete, quyền đọc metadata draft và cleanup quarantine; schema/RLS, API, worker và browser flow liên quan đều đạt lại.

- Chủ dự án duyệt **A — Nhà đang sống** làm nền tảng cho Nhà/Khoảnh khắc, **B — Dòng ký ức** cho Kỷ niệm và **C — Quanh người thân** cho Gia phả. Quyết định ở PAD-023 và spec ngày 2026-09-14; năm tab chính không đổi, Kỷ niệm mở theo ngữ cảnh.
- `feat/mobile-experience-redesign` đã đổi tokens sang sans-serif hệ thống, nền trung tính ấm, xanh lá trầm và đỏ sơn mài; màu manifest/theme bar PWA đã đồng bộ. Home preview có lời chào, hàng người vừa cập nhật, một Khoảnh khắc chính, hành động gửi, ngày gần nhất và lối vào Kỷ niệm/Gia phả.
- Route `/design-preview/memories` dùng timeline ảnh/lời kể/sự kiện có nguồn hư cấu và nút voice chỉ mô phỏng trạng thái, không giả phát âm thanh hay gọi API. Gia phả có lớp định hướng quan hệ trực tiếp quanh người được chọn trước canvas; graph, directory, URL selection và member sheet giữ nguyên.
- Visual review ở 390×844 và 1280×900 phát hiện rồi sửa prefix `/memories` bị nhận nhầm là tab Tôi và hero desktop đẩy hành động chính khỏi màn hình đầu. Sáu ảnh review không tràn ngang và không phát sinh request `/api/*`; browser matrix tiếp tục đạt ở 320/390/768/1280.
- Full `npm run check` đạt trên nhánh: boundaries, tokens, PWA safety, lint, format, typecheck **13/13 Turbo tasks**, **152/152 unit tests trong 31 file**, Project Brain **71 Markdown / 4 JSON / 24 seed cases** và production build đủ 8 workspace. Bốn E2E suite liên quan đạt **57 pass, 3 skip đúng theo project** trên Chromium desktop/Pixel 7; route Kỷ niệm được đưa vào kiểm tra dữ liệu hư cấu, không gọi API và viewport matrix.

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
- `/design-preview` dùng app bar, tab bar cố định có safe-area và Home theo hướng Nhà đang sống: lời chào, người vừa cập nhật, một Khoảnh khắc chính, gửi ảnh gọn, ngày gần nhất và lối vào Kỷ niệm/Gia phả. Empty state vẫn có.
- `/design-preview/moments` có feed riêng tư, đối tượng nhận thay đổi theo lựa chọn, phản hồi “Thương”, trả lời riêng và composer dạng sheet hoạt động cục bộ. `/design-preview/chat` mở được thread Cả nhà hoặc Minh Anh và gửi tin local với nhãn chưa đồng bộ. `/design-preview/me` gom đúng hồ sơ Gia Bảo, thông báo, giải thích phạm vi riêng tư và lối duyệt thành viên.
- Hướng thị giác hiện hành là **Nhà đang sống + Dòng ký ức + Quanh người thân**: sans-serif tiếng Việt ổn định, ảnh/câu chuyện quyết định bố cục, xanh lá trầm và đỏ sơn mài dùng có tiết chế. Không dùng giant serif heading, nhãn chữ hoa và đường kẻ như công thức chung cho mọi màn hình.
- Hồ sơ có quick actions Gọi/Nhắn/Email và view/edit/saving/error/conflict. Quản trị có pending/empty/conflict, quyết định cục bộ và state lưu trong URL.
- `/design-preview/tree` dùng 15 người hư cấu và 22 relationship fixtures tường minh. SVG sinh một cạnh cho mỗi quan hệ đã xác nhận; Hoàng An chưa rõ nhánh chỉ ở danh bạ. Cây có ba thế hệ, zoom cục bộ, “Về tôi”, URL-backed selection, reload/deep-link, danh bạ tìm không dấu và member bottom sheet có focus trap, Escape, backdrop và trả focus đúng nút trên mobile. Desktop dùng vùng bổ trợ liền kề.
- Graph thật trong `/app` đã dùng `@xyflow/react`: kéo nền, pinch/wheel zoom, **Thu nhỏ**, **Phóng to**, **Vừa cây**, **Về tôi**, kéo node bằng tay nắm riêng và thu/mở nhánh. Thanh điều khiển bám dưới app bar trên mobile; node, chữ và màu tiếp tục dùng ngôn ngữ album gia đình thay vì giao diện mặc định của trình sửa sơ đồ.
- Membership active trong `/app` đã dùng app bar, tab bar mobile có safe-area và desktop rail. Home hiển thị tên nhà, danh tính, thành viên, lịch và Khoảnh khắc từ API thật. Gia phả tải graph đã duyệt quanh hồ sơ đang liên kết, giữ danh bạ làm lối tương đương, mở hồ sơ đã lọc liên hệ phía server và gửi đề xuất quan hệ chờ duyệt. Moments/Memories đã nối API và private storage; Chat vẫn là trạng thái chưa sẵn sàng trung thực. Guest, invitation, pending và revoked vẫn dùng luồng truy cập đã ổn định.
- Đây vẫn chưa phải UI cuối. A+B+C đã được nối vào `/app` và qua visual review tự động ở Pixel 7; pan/pinch, camera/micro và khả năng hiểu luồng của người lớn tuổi vẫn cần thử trên điện thoại thật trước pilot.

## Quan hệ gia đình và canvas — đã merge

- Migration `0010_relationships.sql` tạo `relationships` và `change_requests` với composite foreign key cùng nhà, RLS, optimistic version, cạnh partnership có lịch sử và dấu loại bỏ riêng với ngày kết thúc.
- `GET /relationships` đọc graph đã duyệt quanh một root, depth 1–4 và tối đa 100 node. DTO node chỉ có member summary, không có biography hoặc contact.
- Thành viên active có thể tạo và hủy đề xuất của mình. Admin active có thể xem pending, duyệt hoặc từ chối; create/update/remove được apply cùng audit trong transaction.
- Approval khóa advisory theo `family_id`, kiểm lại duplicate, version và chu trình. Integration test hai approval đối nghịch đồng thời chứng minh chỉ một cạnh được lưu.
- `/app` gọi graph API này với root là hồ sơ đã nhận. Thành viên có thể thao tác canvas, mở hồ sơ, xem nhãn quan hệ tường minh, chuyển sang danh bạ và gửi đề xuất tạo cha/mẹ, con hoặc bạn đời. Quản trị viên xem tên hai hồ sơ rồi duyệt/từ chối trong Quản trị dưới Tôi. Pending không được vẽ thành cạnh chính thức.
- Tài khoản chưa liên kết hồ sơ không gọi graph; lỗi graph giữ phạm vi trong tab và không làm mất danh bạ. Cây một người có hướng dẫn bổ sung thay vì tự sinh cạnh.

## Kiểm chứng mới nhất

- Trên `feat/project-brain-pwa-foundation`, `/manifest.webmanifest` dùng tiếng Việt, mở tại `/app`, `display: standalone` và có icon 192/512 cùng maskable icon. Worker production chỉ xử lý install/activate, được phục vụ bằng no-store/CSP và không có fetch/cache/IndexedDB/API/push/sync. Development không đăng ký và dọn registration cùng origin còn lại. Safety checker cùng fixture tự kiểm tra đã được đưa vào root quality gate.
- Mục Tôi có hướng dẫn cài đặt theo bốn trạng thái: đã cài, Chromium có prompt, Safari trên iPhone/iPad và fallback. Prompt chỉ chạy sau thao tác bấm; không xin quyền thông báo. Visual review desktop/Pixel 7 giữ bố cục album gia đình; kiểm tra 320 px với chữ 200% không tràn ngang.
- PWA E2E đạt **14/14** trên Chromium desktop và Pixel 7 emulation, gồm manifest/icon/header thật, worker registration, Cache Storage rỗng, lưu prompt xuất hiện trước khi mở Tôi, prompt theo thao tác, fallback khi trình duyệt từ chối, hướng dẫn iPhone, standalone và 320 px/200%. Hồi quy logout/revoke chọn lọc đạt **10/10**. Toàn bộ Playwright đạt **179 pass, 3 skip đúng theo project** trong 182 lượt.
- Full `npm run check` đạt ngày 2026-09-14: boundaries, design tokens, PWA safety/checker fixtures, lint, format, typecheck **13/13 Turbo tasks**, **152/152 unit tests trong 31 file**, Project Brain **69 Markdown / 4 JSON / 24 seed cases** và production build đủ 8 workspace.

- Task 11 trên `main` đọc inbox theo active recipient, phân trang bằng cursor gắn family, giữ unread count, mark-read bằng `COALESCE` để retry không đổi thời điểm đầu và đọc/cập nhật preferences của chính actor. Cấu hình chưa lưu dùng version 0; lần đầu tạo version 1 nên request cũ không thể ghi đè. Cross-family và revoked trả 404. UI có chuông app bar/desktop rail, unread dot nhẹ, sheet mobile, ba mốc nhắc, deep link occurrence, tải trang cũ, giữ dữ liệu tốt gần nhất khi mất mạng và xóa dữ liệu UI khi quyền bị thu hồi. Push chưa hiển thị khi capability chưa tồn tại.
- Full `npm run check` của Task 11 đạt với **140/140 unit tests trong 28 file**, Project Brain **67 Markdown / 4 JSON / 24 seed cases** và production build đủ 8 workspace. Ba integration suite PostgreSQL cho notification schema/RLS, worker và API đều đạt. Toàn bộ Playwright đạt **165 pass, 3 skip đúng theo project**; riêng inbox có 10 lượt kiểm tra trên Chromium desktop và Pixel 7, gồm read → calendar → reload, preferences, offline, revoke và viewport 320 px với chữ 200%. Sheet mobile và rail desktop đã được kiểm trực quan theo hướng album gia đình hiện tại.

- Trên `feat/notification-event-outbox`, Event create/update/cancel đã nối outbox trong cùng transaction. Fanout chỉ tạo `in_app` job cho membership active và offset người nhận cho phép; không xếp lại backlog đã quá hạn. Sửa Event hủy pending/leased job của revision cũ rồi tạo revision mới, hủy Event giữ hàng lịch sử ở trạng thái cancelled. Integration test chứng minh retry không nhân job, enqueue lỗi rollback cả Event/Occurrence/idempotency/audit, người pending/revoked không nhận và quy tắc cùng ngày chạy lúc 09:00 hoặc lùi 07:00 cho Event bắt đầu sớm.
- Worker inbox đã có credential `family_worker` riêng không đọc bảng trực tiếp, claim/lease theo batch, kiểm lại quyền/revision/preference/due/expiry, dời quiet hours, upsert inbox và backoff tối đa năm attempt. Job không hợp lệ bị hủy trước khi xét quiet hours; retry và worker cạnh tranh không nhân notification. Log chỉ có ID worker, số lượng và mã lỗi cố định, không ghi title/note/contact. Migration rerun, env-init, auth-role, Calendar schema/API, notification schema/worker đều đạt. Full `npm run check` đạt với **133/133 unit tests trong 27 file**, Project Brain hợp lệ và build đủ 8 workspace.

- Trên `feat/notification-delivery-schema`, contracts notification đạt **3/3**. Migration 0015–0018 và integration test PostgreSQL chứng minh inbox chỉ recipient active đọc/đánh dấu đã đọc, admin không đọc inbox riêng của người khác, pending/revoked và revision cũ bị chặn, recipient opt-out được tôn trọng, push cần opt-in, dedupe không nhân job, hai worker không claim cùng hàng và lease hết hạn được lấy lại. Runtime không đọc/cập nhật outbox trực tiếp; creator/admin hủy job qua helper có phạm vi hẹp. Auth-role và Calendar schema regression suites đạt. Full `npm run check` đạt với **123/123 unit tests trong 24 file**, Project Brain hợp lệ và build đủ 8 workspace.

- Calendar Core local đạt **101/101 unit tests trong 21 file**. Full quality gate đạt đủ boundaries, tokens, lint, format, typecheck, Project Brain và production build. Hai integration suite PostgreSQL đạt cho schema/RLS và API CRUD/idempotency/revision/RSVP; lỗi converter được trả `503 CALENDAR_UNAVAILABLE`, pending/revoked/cross-family không đọc được timeline. Review độc lập không có lỗi Critical; bốn phát hiện Important về biên cuối tháng, range list, năm nguồn âm lịch và RLS RSVP đã được sửa và kiểm thử lại. PR #14 đã merge; head `f143c9c` nằm trong merge commit `00e826c` của PR #15.

- Calendar Mobile có client typed cho list/detail/create/update/cancel/RSVP, giữ timeline tốt gần nhất khi mất mạng và chặn response cũ ghi đè mutation mới. Home hiển thị tối đa ba ngày gần nhất; timeline giữ occurrence trong URL, dùng bottom sheet trên mobile và detail rail trên desktop.
- Wizard ba bước hỗ trợ ngày dương, ngày âm Việt Nam, policy 29/2, tháng nhuận, ngày 30, giờ/nơi gặp/ghi chú/lời nhắc và xem trước occurrence đã xác minh. Creator/admin sửa hoặc hủy; conflict tải bản mới trước khi sửa tiếp. Lỗi `CALENDAR_UNAVAILABLE` không đóng form hoặc làm mất bản nháp.
- **20/20 Calendar E2E** đạt trên Chromium desktop và Pixel 7 emulation, gồm create → reload → edit → cancel, RSVP, deep link, offline, revoke, conflict, âm lịch không hợp lệ, dịch vụ lịch lỗi, mutation/lỗi trả muộn khi đổi nhà, viewport 320/390/768/1280 và chữ 200%. Full `npm run check` đạt với **120/120 unit tests trong 23 file**, boundaries, tokens, lint, format, typecheck, Project Brain và production build của 8 workspace. Toàn bộ Playwright đạt **155 pass, 3 skip đúng theo project**; 40 onboarding E2E đạt lại sau khi cô lập endpoint Calendar mới trong fixture.
- Sau gate trên, E2E mới đã tái hiện mutation RSVP của nhà cũ hoàn tất sau lúc đổi nhà. Guard theo family hiện hành và cleanup URL đã được thêm; ca race, full gate và production build đều đạt trước khi merge qua PR #15.

- Trên `feat/interactive-family-tree`, quality gate đạt: boundaries, design tokens, lint, Prettier, typecheck **12/12 task**, **73/73 unit tests** trong 17 file, Project Brain **64 Markdown files / 4 JSON assets / 24 seed cases**, và build **8/8 workspace** đều đạt.
- Suite integration PostgreSQL/Mailpit đạt **19/19**. Toàn bộ `npm run test:e2e` đạt **135 test, 3 skip đúng theo project** trên Chromium desktop và Pixel 7 emulation. Browser tests chứng minh zoom, **Về tôi**, thu/mở nhánh, viewport 320px, kéo node không mở nhầm hồ sơ, graph error cục bộ, danh bạ fallback, workflow proposal/approval và các luồng onboarding không bị hồi quy. Pan/pinch vật lý vẫn cần thử trên điện thoại thật.
- PR #13 đạt **2/2 GitHub checks** trên head `eeb2e0c` và đã merge vào `main` tại `a67371a`. GitHub Monorepo CI run #48 của merge commit đạt trong 3 phút 5 giây.

- `npm run check`: đạt ngày 2026-09-12 trên `feat/connected-family-tree`; boundaries, tokens, lint, Prettier, typecheck, **61/61 unit tests**, brain validation 60 Markdown files và build 8 workspace đều đạt.
- Integration với PostgreSQL/Mailpit local: **17/17 tests đạt**. Migration `0010_relationships.sql`, database constraint/RLS test và tenant test đều đạt; hai role giới hạn vẫn được provision đúng.
- `npm run test:e2e`: **127 đạt, 3 skip đúng theo project** trên Chromium desktop và Pixel 7 emulation. Ngoài preview, test connected xác nhận graph đã duyệt, mọi cạnh đều có mô tả tường minh, đề xuất/duyệt quan hệ, fallback danh bạ, cây một người, lỗi graph cục bộ, tài khoản chưa link, phản hồi hồ sơ cũ không ghi đè người mới, focus trap, tên tiếng Việt dài, quyền contact sau focus, đổi family, các trạng thái chưa có nhà/pending/revoked, dán link mời, viewport 320/390/768/1280 và không tràn ngang.
- Bảy bề mặt connected mới đã được chụp và kiểm bằng mắt ở 390×844 và 1280×900: graph có cạnh, cây một người, hàng duyệt với tên dài, desktop rail cùng ba trạng thái chưa có nhà, pending và revoked. Giao diện giữ hướng album gia đình, không dùng card dashboard chung; node thiếu ảnh dùng monogram có chủ đích. Font tiêu đề trạng thái vào nhà dùng token serif đã kiểm glyph tiếng Việt. Bottom navigation cố định vẫn cần kiểm thêm trên điện thoại thật với thanh trình duyệt động.
- `verify-connected-onboarding.mjs`: đạt lại qua web/API/PostgreSQL/Mailpit thật trên cổng kiểm thử riêng 3220/4020 với hai tài khoản hư cấu. Ngoài đăng ký, xác minh, lời mời, pending, duyệt membership, claim và lưu hồ sơ, script tạo hồ sơ thứ hai, gửi/duyệt quan hệ và đọc cạnh vừa duyệt trong graph trước khi kiểm logout, reset password và revoke; script cleanup cả relationship/change request của lần chạy.
- Workflow CI có gate browser thật; run của merge commit `9854d39` đạt trên GitHub trong khoảng 2 phút.

## Tiếp theo

1. Hoàn tất build Web/Worker/Tools/Backup ARM64, sau đó đẩy nhánh và để GitHub CI xác nhận lại cả source gate lẫn image gate.
2. Chủ dự án đăng nhập Oracle, Cloudflare, Resend và Tailscale; tạo đúng tài nguyên miễn phí theo runbook, không chọn paid fallback.
3. Deploy staging chỉ với dữ liệu tổng hợp, chạy migration/provision role, HTTPS readiness, onboarding và private-media smoke test.
4. Chạy backup thật rồi restore vào database `_restore_drill`; ghi checksum, RPO và thời lượng vào checklist nghiệm thu.
5. Duyệt A+B+C trên iPhone/Android thật, theo dõi cảnh báo trong bảy ngày rồi mới mời pilot 15 người.
6. Sau khi pilot foundation đạt, thiết kế Chat realtime thành vertical slice tiếp theo; AI bắt đầu khi permission/RAG và golden dataset đủ dùng.

## Calendar Core và Mobile Calendar — đã merge

- Đã chọn `@dqcai/vn-lunar@1.0.1` sau khi kiểm tra source/giấy phép, chạy probe Node 24 và so sánh hai chiều với bộ ngày công bố riêng. Quyết định và giới hạn được ghi tại [ADR-003](docs/decisions/ADR-003-vietnamese-lunar-calendar.md).
- `@family/domain` đã có `CalendarConverter` cô lập provider, lỗi `CALENDAR_UNAVAILABLE`, kiểm tra round-trip và range 1200–2199. Không chấp nhận ngày dương sai, ngày âm không tồn tại hoặc cờ tháng nhuận không có thật.
- Bộ golden fixture bao phủ Tết 2024, tháng 6 thường/nhuận 2025, ngày trong tháng nhuận và Tết 2026. Quy tắc `regular`, `leap_only`, `both`, `last_day`, `skip` và không nuốt lỗi provider có 12 unit tests đạt trên Node 24.18.
- Dữ liệu tham chiếu công khai chủ yếu cùng dòng thuật toán Hồ Ngọc Đức; trước pilot thật vẫn phải đối chiếu các ngày gia đình dùng với lịch Việt Nam đáng tin cậy.
- Contract máy đọc Event/Occurrence/RSVP đã được thêm với union dương/âm, policy bắt buộc, kiểm tra ngày dương, whole-state update có optimistic version, cancel và RSVP tối thiểu. 10 contract tests Fastify/Ajv đạt; body không nhận `family_id`, actor, creator hay RSVP membership.
- Migration `0012_calendar_core.sql` đã tạo `events`, `event_occurrences`, `event_rsvps` với typed date parts, same-family composite FK, unique occurrence, revision/version/status và RLS. Integration test PostgreSQL chứng minh active/pending/revoked, cross-family, creator/admin, creator bị thu hồi, current revision và RSVP upsert/visibility; CI chạy riêng `test:calendar-schema`.
- Occurrence service sinh lịch dương, 29/2 và âm lịch Việt Nam trong cửa sổ 30 ngày trước/18 tháng sau; giờ địa phương được đổi sang UTC với timezone pilot đã khóa. CRUD/list/detail/cancel/RSVP routes đã nối vào Fastify, lấy actor/family phía server, dùng creator/admin guard, optimistic version, revision và audit.
- Migration `0013_calendar_idempotency.sql` giữ khóa retry theo nhà và membership. Cùng khóa/cùng body trả Event cũ; dùng lại khóa với body khác trả conflict. Integration API thật kiểm create/reload, pagination, detail, update, cancel bởi admin, RSVP retry, cô lập tenant và rollback khi converter không sẵn sàng.
- Migration `0014_calendar_rsvp_policy.sql` khóa RSVP vào route purpose và occurrence thuộc revision Event hiện hành. Cửa sổ 18 tháng đã clamp đúng ngày cuối tháng; API list cho range tối đa 600 ngày để bao trọn 30 ngày quá khứ cộng 18 tháng tương lai. Năm nguồn âm lịch nếu được cung cấp phải tự chứa ngày/tháng nhuận đã chọn.

## Giới hạn

Chưa phải MVP production: email hiện qua Mailpit local và chưa deploy. PWA có nền cài đặt nhưng chưa được thử Add to Home Screen trên thiết bị thật, không hỗ trợ cold-start offline và chưa có push. Cây connected đã có pan/pinch/wheel zoom, kéo node, thu nhánh, cụm cặp đôi và căn con theo cha mẹ; trạng thái kéo/thu và bố cục không được lưu. Lịch nhà đã có timeline, CRUD/RSVP, Event-to-outbox, worker và inbox trong app; chưa có cơ chế bổ sung occurrence khi cửa sổ thời gian trôi. Moments/Memories đã có vertical slice thật nhưng provider production, quota/rate limit, cảnh báo dead-letter và chính sách backup/retention chưa được chốt. Chưa có chat realtime hoặc AI. Moments/Chat trong preview vẫn chỉ là tương tác cục bộ có nhãn. Danh bạ pilot lấy tối đa 100 hồ sơ và chưa phân trang UI. Claim hiện do admin chỉ định rồi người nhận xác nhận; chưa có self-service request.

## Cập nhật cây tương tác 2026-09-13

- Migration `0011_member_create_change_requests.sql` mở rộng hàng đợi duyệt cho hồ sơ mới tối thiểu. Approval tạo Member không gắn tài khoản và Relationship trong cùng transaction; rejection không tạo dữ liệu chuẩn.
- API hỗ trợ `scope=mine` để người gửi xem pending của mình. Web có workflow ba bước, chọn người có sẵn hoặc tạo hồ sơ mới, xem lại, gửi, hủy, sửa subtype và đề xuất gỡ.
- Layout gom partnership active, đặt con dưới tâm cha mẹ, tách partnership lịch sử và đóng gói nhánh đông deterministic. Test bao phủ remarriage, adoptive, unspecified, tên dài và thiếu ảnh qua monogram hiện có.
- PR #13 đã merge vào `main` tại `a67371a`; head PR đạt 2/2 checks. Gói kế tiếp là Ngày quan trọng và lời nhắc theo PAD-022.
