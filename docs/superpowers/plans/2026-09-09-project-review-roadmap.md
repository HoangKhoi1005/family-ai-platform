# Đánh giá hiện trạng và kế hoạch đến pilot 15 người

**Trạng thái:** đề xuất để chủ dự án duyệt; chưa bắt đầu các task dưới đây.

**Goal:** chuyển từ luồng onboarding local sang ứng dụng gia đình dùng được, có thiết kế được chấp nhận và dữ liệu gia phả thật.

**Architecture:** giữ monorepo modular, Next.js, Fastify, PostgreSQL và Better Auth. Server kiểm quyền theo nhà và theo trường. UI đọc dữ liệu chuẩn đã duyệt; worker phục vụ job có retry sau khi có outbox.

**Tech Stack:** npm workspaces/Turborepo, TypeScript và stack hiện có. Chưa chọn thêm thư viện graph, hosting, storage, lịch âm hoặc LLM trong lần rà này.

**Spec:** [bối cảnh](../../00_PROJECT_CONTEXT.md), [MVP](../../04_MVP_SCOPE.md), [UX](../../05_UX_UI_GUIDELINES.md), [gia phả](../../../specs/family-tree/README.md), [quyền](../../10_PRIVACY_SECURITY.md).

Đây là kế hoạch sản phẩm và các gói bàn giao. Mỗi hệ thống chưa có thiết kế kỹ thuật được chốt sẽ có implementation plan riêng trước khi code; không xem các đường dẫn dự kiến bên dưới là implementation đã tồn tại. Khi thực hiện dùng executing-plans, làm trực tiếp mặc định, không tự tạo dàn agents. Không commit/push/merge/deploy nếu chưa được giao.

## 1. Phạm vi bằng chứng

- Rà local main và worktree onboarding, cả hai HEAD `3e411b7`; code mới chưa commit nằm tại `.worktrees/onboarding`, nhánh `feat/onboarding-ui-preview`. Main sạch nhưng CURRENT_STATE trên main còn mô tả một đợt cũ.
- Đã đọc context, decision log, domain, UX, privacy, MVP, spec cây; cấu hình CI/Playwright; code auth UI, app state, profile, admin, API helper, onboarding endpoint/authorization và contracts hồ sơ.
- Kết quả kiểm chứng gần nhất trong phiên trước: check đạt, 38 unit, 12 integration, 6 E2E onboarding Chromium desktop/mobile, browser script toàn luồng qua API/DB/Mailpit thật đạt. Lần rà này không chạy lại toàn bộ tests, không xác minh remote CI, không phải pentest toàn repo.
- Visual căn cứ ảnh ở phiên trước; chưa có visual review mới trên máy thật. Không quy đổi số test thành phần trăm hoàn thành sản phẩm.

## 2. Đánh giá hiện tại

| Hạng mục               | Bằng chứng và đánh giá                                               | Còn thiếu để dùng thật                                                                        |
| ---------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Monorepo/Project Brain | Có scripts, CI, contracts, migrations, tests; cấu trúc phù hợp pilot | Đồng bộ tài liệu giữa worktree và main; tích hợp code mới                                     |
| Auth/onboarding        | Có UI và API thật xuyên suốt đăng ký đến nhận hồ sơ                  | Lỗi mạng, hết hạn/đa tab, draft, thiết bị thật; mail production                               |
| Quyền                  | User khác Member; actor transaction, RLS, claim/version/audit        | Review vòng đời dữ liệu client; mở rộng kiểm quyền theo từng feature mới                      |
| Danh bạ/hồ sơ          | API có tìm/phân trang, lọc contacts; UI xem/sửa đã nối               | UI tìm hiện chỉ trên 100 hồ sơ; thiếu ngày sinh/tình trạng mất trên form, avatar, nút liên hệ |
| UX/UI                  | Có các bản mẫu và responsive cơ bản                                  | Chưa nghiệm thu; nhiều hệ giao diện; chưa có hệ thiết kế nhất quán                            |
| Gia phả                | Sơ đồ quanh người chọn, hồ sơ, tìm/chuyển nhánh bằng fixture         | Relationship/approval/API thật; pan/zoom/drag; thêm người từ cây                              |
| Lịch/nhắc              | Spec và quy tắc baseline                                             | Chưa có engine lịch, occurrences, outbox, push                                                |
| Ảnh/chat               | Spec                                                                 | Chưa storage, upload, realtime, retry                                                         |
| AI                     | Domain/quyền/seed cases trong Brain                                  | Chưa tools truy xuất, provider, eval chạy thật                                                |
| Vận hành               | Docker/Mailpit local                                                 | HTTPS, mail thật, backup/restore, log, PWA và pilot thiết bị                                  |

Kết luận: nền kỹ thuật và onboarding đã tiến xa hơn bản prototype tĩnh; chưa phải MVP gia đình. Giá trị cốt lõi gia phả, nhớ việc và kết nối hằng ngày vẫn cần triển khai.

## 3. Phát hiện ưu tiên

### Cao: ổn định trải nghiệm trước khi mở rộng

1. `family-app.tsx`: bất kỳ lỗi refresh nào cũng clearFamily/setMe(null), trong khi polling chạy 15 giây. Suy luận trực tiếp từ code: một lỗi mạng khi đang sửa có thể unmount form và mất nháp. Cần tái hiện bằng E2E; không đánh đồng lỗi mạng với thu hồi quyền. Nháp chỉ giữ trong memory và phải hủy khi xác minh logout/revoke, không persist PII mặc định.
2. `DirectoryEntry` giữ chi tiết hồ sơ trong state nhưng refresh danh sách không cập nhật chi tiết đã mở. Contact vừa đổi visibility có thể còn hiển thị từ lần tải trước. Đây là cache client đã tải, không phải bằng chứng API bỏ lọc quyền. Cần quy tắc revalidate/hide rõ ràng; không hứa thu hồi được bản người dùng đã sao chép.
3. `profile-panel.tsx`: lỗi tải không reset profile/claim cũ, dependency claim chỉ có ID, chưa có version. Parent remount khi claim ID biến mất giúp một số tình huống, nhưng không chứng minh mọi stale/retry case an toàn. Viết test thay version, expiry, revoke trong lúc request chậm trước khi sửa.
4. `.github/workflows/ci.yml` chạy test:e2e nhưng không gọi script `verify-connected-onboarding.mjs`; Playwright hiện chỉ tự chạy web, các ca connected dùng mock. Luồng thật đã kiểm local chưa phải release gate CI.
5. Toàn đợt code mới còn uncommitted. Cần review và checkpoint Git, không kéo dài nhiều feature mới trên một diff lớn.

### Trung bình: tính nhất quán và sử dụng thực tế

6. Baseline navigation là Nhà mình/Gia phả/Lịch nhà/Trò chuyện; app đang có Nhà mình/Người thân/Hồ sơ của tôi/Quản trị. Đây có thể là shell tạm nhưng chưa được mô tả thành quyết định chuyển tiếp. Không thêm nút chết để khớp tài liệu.
7. CSS connected hardcode Georgia, cỡ chữ, radius/spacing trong khi tokens title dùng system font. tokens:check chỉ xác nhận file sinh, không chứng minh mọi màn dùng tokens. Typography tiếng Việt và dấu cần review trình duyệt thực.
8. Back/reload chưa giữ tab vì tab nằm trong useState. Tree nằm ở design-preview với shell khác. Liên hệ trong danh bạ là text, chưa có thao tác gọi/email/FB trực tiếp.
9. Web tự định nghĩa DTO gần giống packages/contracts; nguy cơ lệch contract. UI profile chưa tận dụng birth_date/birth_year/deceased từ API.
10. `docs/00_PROJECT_CONTEXT.md`, UX và privacy còn vài câu trạng thái cũ; decision log vẫn ghi điều phối subagents như mặc định, khác hướng làm trực tiếp ở worktree. Cần lịch sử cập nhật rõ, không xóa quyết định cũ.

## 4. Gói A — ổn định onboarding và checkpoint

**Ưu tiên:** làm đầu tiên sau duyệt. **Đầu ra:** một luồng ổn định có test regression và tài liệu đúng; chưa thêm hệ thống nghiệp vụ mới.

**Files chính:** `apps/web/app/_connected/{family-app,profile-panel,auth-screen,api,types}.tsx` hoặc `.ts` tương ứng; `packages/contracts/src/onboarding.ts`; `tests/e2e/connected-onboarding.spec.ts`; `scripts/verify-connected-onboarding.mjs`; `.github/workflows/ci.yml`; CURRENT_STATE và docs context/UX/privacy/decision log.

- [ ] A1. Tạo test tái hiện draft đang nhập → refresh trả network error → form phục hồi không mất draft; revoke/logout → không còn dữ liệu nhà; response cũ không ghi đè state sau logout.
- [ ] A2. Kiểm hồ sơ mở: contact đổi family→self; claim hết hạn, đổi version, thu hồi khi request đang chờ; UI không tiếp tục gửi xác nhận từ trạng thái đã vô hiệu.
- [ ] A3. Bổ sung request cancellation/giới hạn chờ và phân loại lỗi; tách trạng thái kết nối khỏi session. Revalidate dữ liệu đang mở khi focus, thay quyền và retry, không chỉ tải lại danh sách.
- [ ] A4. Kiểm lời mời hết hạn/đã dùng/thu hồi, xác minh mở tab khác, reset token thiếu/sai/đã dùng, validation field và conflict 409. Giữ cơ chế không tiết lộ email có tài khoản ở forgot-password.
- [ ] A5. Dùng shared DTO khi phù hợp, giữ riêng form state; thêm contract response onboarding và không thay lockfile ngoài nhu cầu đã xác minh.
- [ ] A6. Cho browser flow thật chạy trên CI với web/API khởi động và readiness check, DB riêng, tài khoản hư cấu, cleanup, log đã lọc. Xử lý race bằng chờ response/state cần thiết; không coi tăng timeout là giải pháp mặc định.
- [ ] A7. Đồng bộ Project Brain. Chuẩn bị ba nhóm diff: API/contract/tests; web/onboarding; preview/docs. Kiểm từng commit build được và không đưa .env/ảnh chứa token vào Git. Chỉ tạo/push commit khi chủ dự án giao.

**Nghiệm thu:** các ca regression trên đạt; npm run check, test:auth, test:e2e và browser thật đạt trên code cuối; CI trên đúng commit xanh sau push. Nếu chưa push, ghi rõ CI chưa xác minh.

## 5. Gói B — duyệt hệ thiết kế và luồng sử dụng

**Phụ thuộc:** A cho luồng ổn định; nghiên cứu bố cục có thể bắt đầu sớm. **Files:** `design/tokens.json`, `packages/ui/src`, `apps/web/app/_connected`, `apps/web/app/design-preview/tree`, `docs/05_UX_UI_GUIDELINES.md`, spec home/profile/tree.

- [ ] B1. Lập một bản thiết kế nhất quán gồm đăng nhập, Nhà mình, cây+hồ sơ, chỉnh hồ sơ và duyệt thành viên. Giữ ý tưởng sơ đồ A + hồ sơ B; mỗi màn phải có tác vụ chính rõ.
- [ ] B2. Chọn typography tiếng Việt, phân cấp tên người/nội dung/action, màu semantic và spacing qua tokens. Loại trang trí không giúp nhận diện hoặc thao tác. Dùng người/ảnh minh họa có nhãn, không điền số liệu giả vào app thật.
- [ ] B3. Chốt điều hướng theo giai đoạn: tab chỉ xuất hiện khi có tính năng; hồ sơ ở avatar, danh bạ là lối xem thay thế cây. Có URL/back/reload cho các khu vực chính; admin không làm rối trải nghiệm thành viên.
- [ ] B4. Hồ sơ có cách xem và cách sửa riêng; ngày sinh đầy đủ hoặc chỉ năm, người đã mất, thiếu ảnh; nút gọi/email/mở Facebook chỉ cho dữ liệu server cho phép và URL hợp lệ.
- [ ] B5. Review 320/390/768/1280 px, zoom chữ 200%, tên Việt dài/dấu, thiếu ảnh, bàn phím/focus, reduced motion, lỗi/rỗng/chờ. Bổ sung test có mục tiêu cho các lỗi phát hiện.
- [ ] B6. Trình một bản chạy được để chủ dự án duyệt trực quan. Chỉ nhân rộng UI sau khi được chấp nhận; screenshot và build không thay thế duyệt thẩm mỹ.

**Nghiệm thu:** hoàn thành 3 tác vụ không cần giải thích: vào nhà, tìm và liên hệ đúng người, nhận/sửa hồ sơ. Không có nút chết hoặc layout tràn; chủ dự án chấp nhận hướng thiết kế.

## 6. Gói C — dữ liệu gia phả thật và duyệt thay đổi

**Phụ thuộc:** A; UI theo B. **Files dự kiến:** migration kế tiếp sau 0009 (kiểm lại số trước tạo); `packages/contracts/src/relationships.ts`; module `apps/api/src/family/relationships.ts`, `change-requests.ts`; tests integration mới; spec family-tree/domain/schema/API.

- [ ] C1. Chốt schema Relationship và ChangeRequest từ spec: cha/mẹ-con biological/adoptive/unspecified; partnership có lịch sử; same-family FK; version và audit. Không thêm bảng Household/Branch đầy đủ nếu không cần cho cây pilot.
- [ ] C2. Chốt contract đọc graph giới hạn độ sâu/số node; node là summary không chứa private contact. API hồ sơ tiếp tục lọc quyền riêng.
- [ ] C3. Implement đề xuất tạo/sửa/loại bỏ quan hệ, duyệt/từ chối/hủy; apply+audit trong transaction. Admin có thể tự duyệt theo baseline, vẫn qua validation và audit.
- [ ] C4. Test TREE-01–06: chu trình kể cả concurrent approvals, tự nối, trùng đối xứng partnership, cross-family, tái hôn, cha mẹ nuôi, pending không xuất hiện ở graph chuẩn.
- [ ] C5. Seed 15 người hoàn toàn hư cấu vào DB thử riêng; nối graph và profile vào app. Hiển thị một người hoặc chưa có quan hệ vẫn dùng được; người không có account vẫn xuất hiện trong cây.

**Nghiệm thu:** thay đổi đã duyệt tồn tại sau reload, graph đọc từ DB; không còn dựa fixture cho cây trong app; không suy luận quan hệ từ vị trí node hoặc LLM.

## 7. Gói D — cây tương tác trên điện thoại

**Phụ thuộc:** contract C và thiết kế B. Chọn thư viện graph/layout sau một spike có tiêu chí mobile, accessibility, kích thước bundle, license và bảo trì; xác minh tài liệu chính thức lúc chọn, không chốt thư viện trong bản kế hoạch này.

- [ ] D1. Pan, pinch/wheel zoom, nút +/−, fit, Về tôi; mặc định quanh người xem 2–3 thế hệ, thu/mở nhánh.
- [ ] D2. Chạm node mở hồ sơ B; phân biệt click với drag; kéo node thay bố cục nhìn, tuyệt đối không thay quan hệ. Ban đầu reset được, không cần lưu bố cục chung cho cả nhà.
- [ ] D3. Từ node chọn Thêm cha/mẹ, con hoặc bạn đời → người có sẵn/người mới → xem lại đề xuất → gửi duyệt. Không kéo dây tự tạo quan hệ chuẩn.
- [ ] D4. Hiển thị quan hệ chưa rõ/nuôi/lịch sử chính xác; pending tách khỏi cạnh chuẩn. Tìm không dấu, danh bạ và bàn phím cung cấp lối tương đương.
- [ ] D5. Test drag không mở nhầm, pinch không gây tràn toàn trang, giữ selection sau refresh, reject không đổi cây, phê duyệt cập nhật graph. Thử 15 người và fixture lớn hơn để phát hiện layout kém, không cam kết quy mô vô hạn.

**Nghiệm thu:** người dùng tìm được mình, xem đúng hồ sơ, thêm một đề xuất và thấy cạnh sau duyệt trên điện thoại thật.

## 8. Gói E — lịch nhà và nhắc việc

- [ ] E1. Chốt quy tắc gia đình cho âm lịch, tháng nhuận, ngày không tồn tại và giờ nhắc; lưu ngày âm gốc, timezone và policy, không chỉ ngày dương quy đổi.
- [ ] E2. Chọn/kiểm calendar service với dataset ngày tham chiếu độc lập; sự kiện, lần diễn ra, RSVP, sửa/hủy có revision.
- [ ] E3. Worker outbox idempotent, nhắc baseline 7 ngày/1 ngày/trong ngày; sửa lịch vô hiệu job cũ, retry không nhắc trùng.
- [ ] E4. Lịch và inbox nhắc trong app trước; Web Push theo khả năng thiết bị, có tắt và fallback. Kiểm membership trước gửi, nội dung lockscreen chung.

**Nghiệm thu:** tháng nhuận/giao năm qua dataset, hủy/sửa không gửi nhắc cũ, revoke không nhận job mới; push thử app đóng trên thiết bị hỗ trợ.

## 9. Gói F — ảnh riêng tư, Khoảnh khắc và chat nhóm

**Thứ tự:** storage/media dùng chung → Khoảnh khắc → chat text realtime → ảnh trong chat.

- [ ] F1. Chọn private storage và giới hạn upload; kiểm MIME/chữ ký/kích thước, bỏ EXIF vị trí, thumbnail, quyền đọc và xóa theo parent. Chưa ready không công bố.
- [ ] F2. Một ảnh + caption tối đa 500 ký tự cho cả nhà, cảm xúc không xếp hạng; tích hợp vào Nhà mình, có progress/retry/xóa bài của mình.
- [ ] F3. Một phòng nhóm/nhà, text/reply, cursor history, idempotency key gửi, reconnect, thứ tự tin và trạng thái đang gửi/lỗi. Revoke ngắt quyền subscribe/fanout/fetch.
- [ ] F4. Thêm ảnh qua pipeline media; kiểm hai nhà, reconnect sau revoke, upload lỗi, gửi lại không nhân đôi.

**Nghiệm thu:** hai thiết bị trao đổi tin/ảnh; offline rồi reconnect không mất hoặc nhân đôi tin; dữ liệu không sang nhà khác. Chat riêng/circle/voice/video hoãn.

## 10. Gói G — vận hành và pilot

Thiết kế hosting/mail/backup sớm sau B, kiểm nghiệm release sau C–F theo MVP hiện hành. Có thể demo nhóm nhỏ dữ liệu giả sớm hơn, không gọi đó là pilot đầy đủ.

- [ ] G1. Xác nhận ngân sách tháng, thiết bị/email của 15 người và hai admin; chọn hosting/DB/mail/storage, tên miền và HTTPS. Không tự mua hoặc gửi lời mời thật.
- [ ] G2. Secrets, migration deploy, readiness, log lọc PII, rate limit phù hợp số instance, giám sát lỗi; backup có phục hồi thử và quy trình rollback.
- [ ] G3. PWA manifest/icons/install guidance; không cache riêng tư mặc định bằng service worker. Test logout/revoke/mở từ màn hình chính.
- [ ] G4. Thử một iPhone, một Android và một người lớn tuổi: nhận lời mời, xem cây, gọi người thân, xem ngày quan trọng, gửi ảnh. Ghi thời gian/lỗi, không bịa kết quả.
- [ ] G5. Sau khi được giao deploy/mời: nhóm nhỏ trước, rồi 15 người; theo dõi 4 tuần bằng phản hồi và số liệu tổng hợp tối thiểu. Có hướng dẫn hỗ trợ/xóa/export theo quyền.

**Gate:** không lỗi quyền nghiêm trọng; restore thành công; mail/nhắc thực hoạt động; chủ dự án quyết định mở pilot. Nếu muốn pilot chỉ gia phả trước, ghi thay đổi phạm vi MVP rõ ràng.

## 11. Gói H — AI có nguồn và quyền

- [ ] H1. Chọn một tập câu hỏi hữu ích trên dữ liệu đã có: tìm người, liên hệ được chia sẻ, ngày quan trọng, đường quan hệ đã duyệt.
- [ ] H2. Tools server với input validation và actor scope; không SQL tùy ý; kiểm quyền trước truy xuất, tổng hợp, citation và cache. Không đọc chat mặc định.
- [ ] H3. Chọn provider/budget/retention bằng decision riêng; có nguồn, không đủ dữ kiện thì nói rõ. Quan hệ và lịch do service xác định.
- [ ] H4. Mở rộng 24 seed cases thành bộ eval gồm trả lời đúng, thiếu dữ kiện, nhiều đường quan hệ, chéo nhà, private contact, revoke và prompt injection. Không coi số lượng 200–500 là gate trước khi có câu hỏi thực tế.
- [ ] H5. RAG chỉ thêm khi có tài liệu được phép và nhu cầu tìm nội dung; chưa fine-tune để nhớ PII.

**Nghiệm thu:** không rò dữ liệu trong bộ kiểm quyền; đạt tiêu chí chất lượng thống nhất trước phát hành và có giới hạn chi phí đo được.

## 12. Đợt đề nghị duyệt ngay

Chỉ phê duyệt **gói A và B** cho vòng kế tiếp: ổn định onboarding, khép khoảng trống kiểm thử, đồng bộ Brain, làm một bản thiết kế nhất quán để duyệt. Kết thúc bằng demo và báo bằng chứng; checkpoint Git khi được giao. C–H là lộ trình, mỗi gói có thiết kế chi tiết và review riêng trước khi triển khai.

Làm trực tiếp để tiết kiệm context. Chỉ cân nhắc một reviewer độc lập cho migration, quyền hoặc realtime; không tạo agent cho từng màn hình và không chạy lại toàn bộ suite nếu không có thay đổi/rủi ro mới. Không ước lượng ngày hoàn thành khi chưa chốt vòng sửa thiết kế và hạ tầng; dùng các gate kiểm chứng trên để quản lý tiến độ.
