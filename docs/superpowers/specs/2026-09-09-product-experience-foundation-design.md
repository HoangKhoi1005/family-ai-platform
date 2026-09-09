# Nền trải nghiệm sản phẩm — Thiết kế gói B

**Trạng thái:** Chờ chủ dự án duyệt văn bản trước khi lập implementation plan

**Ngày:** 2026-09-09

**Phạm vi:** Hệ thiết kế và luồng Nhà mình · Gia phả · Hồ sơ · Quản trị trên web/PWA

**Không thuộc phạm vi:** schema quan hệ thật, graph API, pan/zoom nâng cao, lịch, moments, chat, AI và deploy

## 1. Mục tiêu

Gói B tạo một hướng trải nghiệm đủ rõ để chủ dự án có thể duyệt bằng mắt và thử bằng tay trước khi mở rộng nghiệp vụ. Sản phẩm phải có cảm giác như một không gian gia đình Việt đương đại: ấm, riêng tư, dễ nhận ra người thân và không giống dashboard SaaS hoặc giao diện AI sinh tự động.

Ba việc phải thực hiện được mà không cần hướng dẫn:

1. Vào Nhà mình và hiểu trạng thái hiện tại của gia đình.
2. Tìm đúng người, mở hồ sơ và dùng thông tin liên hệ được phép.
3. Mở hồ sơ của mình, chỉnh thông tin và hiểu kết quả lưu/lỗi.

Gia phả trong gói B dùng dữ liệu hư cấu có nhãn tại khu vực preview để duyệt bố cục kết hợp **sơ đồ A + hồ sơ B**. Dữ liệu quan hệ thật và quy trình duyệt quan hệ thuộc gói C; pan/zoom và thao tác graph đầy đủ thuộc gói D.

## 2. Nguyên tắc thiết kế

### 2.1 Cá tính

Hướng chủ đạo là **Album gia đình Việt đương đại**:

- Nền sáng ấm, chữ màu mực, xanh lá trầm làm màu nhận diện và cam đất dùng cho điểm nhấn có chủ đích.
- Tên người, ảnh và nội dung gia đình quyết định bố cục; không biến mọi section thành card bo góc giống nhau.
- Typography có tương phản giữa tên/ngữ cảnh và nội dung thao tác, nhưng phải đọc tốt với đầy đủ dấu tiếng Việt.
- Đường nối, nhãn thế hệ và trạng thái dùng nét rõ, không dùng glow, glassmorphism hoặc gradient tím xanh.
- Chuyển động giải thích thay đổi vị trí hoặc trạng thái; tôn trọng `prefers-reduced-motion`.

Không dùng emoji trang trí, số liệu giả, feed gây nghiện, follower/like count, nút AI nổi hoặc copy quảng cáo chung chung.

### 2.2 Hình ảnh và dữ liệu

- Preview chỉ dùng người và nội dung hư cấu, có nhãn “Dữ liệu minh họa”.
- `/app` không tự điền sự kiện, ảnh, vai vế hoặc số liên hệ để làm giao diện đầy hơn.
- Thiếu ảnh dùng monogram từ tên hiển thị và màu nền ổn định theo Member ID; không dùng avatar người thật ngẫu nhiên.
- Không suy đoán “Bác Hai”, “Dì Năm”, nội/ngoại hoặc giới tính từ tên.

### 2.3 Khả năng sử dụng

- Action chính có vùng bấm tối thiểu 44×44 CSS px.
- Body text mặc định tối thiểu 16 px; giao diện vẫn dùng được ở browser text zoom 200%.
- Focus nhìn thấy rõ; mọi thao tác chính dùng được bằng bàn phím.
- Trạng thái không chỉ phân biệt bằng màu.
- Danh bạ luôn là lối thay thế cho người không dùng được sơ đồ.

## 3. Kiến trúc trải nghiệm

### 3.1 Hai bề mặt trong gói B

1. **Design preview:** cập nhật các route dưới `/design-preview` để thử hệ thiết kế bằng fixture hư cấu. Đây là nơi chủ dự án duyệt thẩm mỹ và hành vi responsive.
2. **Ứng dụng kết nối:** giữ hành vi `/app` hiện tại trong lúc duyệt. Sau khi preview được chấp nhận, implementation plan mới chuyển shell, profile và directory đã duyệt sang dữ liệu API thật.

Cách tách này cho phép thay đổi thiết kế mạnh mà không làm hỏng onboarding đã ổn định. Preview không gọi API, không dùng session thật và không trở thành đường dẫn sản phẩm.

### 3.2 Route mục tiêu sau khi được duyệt

| Route                         | Vai trò                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `/app`                        | Nhà mình                                                  |
| `/app/tree`                   | Gia phả và danh bạ thay thế                               |
| `/app/tree?person={memberId}` | Gia phả với hồ sơ người được chọn                         |
| `/app/profile`                | Xem/chỉnh hồ sơ của chính mình                            |
| `/app/admin`                  | Quản trị membership, lời mời và hồ sơ; chỉ hiện với admin |

`Lịch nhà` và `Trò chuyện` chỉ xuất hiện trong navigation khi có màn hình hoạt động. Profile mở từ avatar. Back, reload và deep link phải giữ đúng khu vực/người được chọn; không tiếp tục dùng một `useState` duy nhất làm nguồn điều hướng.

### 3.3 Ranh giới component mục tiêu

- `AppShell`: khung, navigation, account menu và vùng thông báo toàn cục.
- `FamilySessionProvider`: session, active family, refresh/revoke và trạng thái kết nối.
- `HomeView`: nội dung Nhà mình; mỗi section lỗi độc lập.
- `FamilyDirectory`: tìm kiếm không dấu và lối truy cập không cần graph.
- `FamilyTreePreview`: chỉ trình bày cây fixture trong gói B.
- `MemberProfileView`: đọc hồ sơ và contact theo payload server đã lọc.
- `SelfProfileEditor`: form bản nháp, version conflict và save state.
- `AdminWorkspace`: tác vụ quản trị tách khỏi trải nghiệm thành viên.

Tách theo trách nhiệm khi chuyển thiết kế vào app; không thực hiện một đợt refactor riêng không có giá trị người dùng. `family-app.tsx` hiện tại tiếp tục làm adapter trong quá trình chuyển đổi rồi mới thu nhỏ.

## 4. Thiết kế từng màn hình

### 4.1 Nhà mình

Thứ tự thị giác:

1. Nhận diện nhà và lời chào ngắn theo tên đã cấu hình.
2. Một dải “Điều nhà mình cần nhớ” chỉ hiện khi có dữ liệu thật.
3. Nội dung gần đây hoặc empty state có ý nghĩa.
4. Một hành động chính phù hợp với tính năng đã triển khai.
5. Một dải người thân gần đây/danh bạ, không trình bày như bảng thống kê.

Trong gói B chưa có event/moment API, preview được phép minh họa chúng bằng fixture có nhãn. Khi chuyển vào `/app`, section chưa có backend phải dùng empty state hoặc chưa xuất hiện; không tạo nút chết.

### 4.2 Gia phả kết hợp hồ sơ

Desktop dùng bố cục hai vùng: cây là không gian chính, hồ sơ người được chọn nằm cạnh phải. Mobile dùng cây toàn chiều ngang và hồ sơ dạng bottom sheet hoặc màn hình phủ có thể đóng; URL vẫn giữ `person`.

Node ưu tiên ảnh/monogram, tên thường gọi và một dòng ngữ cảnh quan hệ đã được dữ liệu cung cấp. Chạm node chọn người; gói B chưa triển khai kéo node. Các action “Thêm cha/mẹ”, “Thêm con”, “Thêm bạn đời” chỉ xuất hiện trong preview nếu chúng mở được một luồng review fixture hoàn chỉnh; nếu chưa có luồng thì trình bày bằng chú thích, không tạo nút chết. Chúng không xuất hiện trong `/app` trước gói C.

Preview phải thể hiện được:

- Một người không có ảnh.
- Tên tiếng Việt dài.
- Một người đã mất với biểu hiện trang trọng, không làm mờ như disabled.
- Quan hệ cha/mẹ nuôi hoặc chưa rõ bằng nhãn, không chỉ bằng kiểu đường.
- Trạng thái một người chưa có quan hệ mà không làm vỡ layout.

### 4.3 Hồ sơ người thân

Chế độ xem và chỉnh sửa là hai trạng thái riêng. Chế độ xem ưu tiên nhận diện người, giới thiệu ngắn và contact được phép. Nút gọi, email và Facebook chỉ render khi payload có value hợp lệ; nút có tên truy cập rõ.

Chế độ sửa giữ bản nháp khi lỗi mạng, hiển thị “Đang lưu” khi request chưa hoàn tất, chỉ báo thành công sau phản hồi server. Conflict 409 không ghi đè; người dùng được chọn tải dữ liệu mới hoặc giữ bản nháp để sao chép thủ công.

Ngày sinh hỗ trợ ngày đầy đủ hoặc chỉ năm. Người đã mất vẫn có hồ sơ đầy đủ nhưng không có ngôn ngữ trạng thái tài khoản. Contact `self` chỉ hiện cho chủ hồ sơ; admin không tự vượt quyền.

### 4.4 Quản trị

Quản trị là workspace riêng tại `/app/admin`, không chen action duyệt vào Home của thành viên thường. Mỗi nhóm gồm lời mời, membership chờ duyệt và claim hồ sơ; số lượng chỉ lấy từ dữ liệu thật.

Mỗi quyết định có tên người, loại thay đổi, thời điểm và action rõ. Trạng thái đã xử lý hoặc conflict phải đóng action cũ và cho tải lại. Gói B chỉ thiết kế lại hành vi quản trị hiện có; duyệt quan hệ thuộc gói C.

### 4.5 Đăng nhập và onboarding

Không viết lại logic auth đã ổn định. Gói B đồng bộ typography, khoảng cách, logo chữ và trạng thái lỗi với AppShell. Form giữ một cột, action chính rõ và không thêm tranh minh họa chung chung. Invitation, pending, claim hết hạn và offline giữ nguyên contract đã kiểm chứng.

## 5. Trạng thái và dữ liệu

Mọi màn hình cần có trạng thái loading, empty, retryable error, offline và revoked phù hợp phạm vi. Quy tắc:

- Lỗi một section của Home không chặn section khác.
- Lỗi mạng không tự xóa session hoặc bản nháp.
- 401 kết thúc session; 403/404 tài nguyên gia đình xóa scope tương ứng theo contract hiện tại.
- Đổi tài khoản/nhà không được chớp dữ liệu cache cũ.
- Profile/contact luôn dùng dữ liệu server đã lọc; client không nhận toàn bộ rồi tự ẩn.
- Preview fixture nằm trong module riêng và không được import vào route `/app`.

## 6. Design tokens

Mở rộng `design/tokens.json` thay vì hardcode giá trị lặp lại trong CSS:

- Color roles: canvas, paper, ink, muted ink, family green, terracotta accent, border, success, warning, danger và focus.
- Typography roles: display, person name, section title, body, metadata và action.
- Spacing/radius/elevation chỉ thêm khi ít nhất hai component dùng chung.
- Motion roles: quick feedback và spatial transition; reduced motion về gần 0.

Token phải được sinh qua pipeline hiện tại và qua `tokens:check`. Không thêm theme engine hoặc dark mode trong gói B.

## 7. Kiểm thử và duyệt

### 7.1 Automated checks

- Giữ toàn bộ onboarding E2E hiện có xanh.
- Thêm E2E cho URL/back/reload, tìm không dấu, mở/đóng hồ sơ từ cây và lối danh bạ.
- Kiểm 320, 390, 768 và 1280 px; không tràn ngang.
- Kiểm browser text zoom 200%, keyboard focus và reduced motion.
- Test fixture không thực hiện network request và không thể đi vào connected app state.
- Test `/app` không render action hoặc dữ liệu giả của tính năng chưa triển khai.

### 7.2 Visual review bắt buộc

Chụp và kiểm tra trực tiếp ít nhất:

- Nhà mình desktop/mobile: có nội dung và empty state.
- Cây + hồ sơ desktop/mobile: tên dài, thiếu ảnh, người đã mất.
- Hồ sơ xem/sửa: normal, saving, error và conflict.
- Admin: có hàng chờ duyệt và empty state.
- Auth/pending: desktop/mobile.

Build, screenshot và test không thay thế quyết định thẩm mỹ của chủ dự án. Chỉ chuyển thiết kế vào `/app` sau khi chủ dự án duyệt bản chạy được.

## 8. Tiêu chí nghiệm thu gói B

1. Chủ dự án xác nhận giao diện không còn cảm giác AI slop/generic dashboard.
2. Nhà mình, hồ sơ và gia phả có phân cấp riêng, không dùng cùng một card grid.
3. Ba tác vụ mục tiêu hoàn thành được trên desktop và mobile mà không cần giải thích.
4. URL/back/reload giữ đúng màn hình và người được chọn sau khi thiết kế được chuyển vào app.
5. Không có dữ liệu hoặc nút giả trong `/app`; preview được phân tách và gắn nhãn.
6. Tên dài, thiếu ảnh, chữ 200%, keyboard và reduced motion đều dùng được.
7. Onboarding, privacy và revoke behavior hiện tại không bị suy giảm.

## 9. Sau gói B

Gói C triển khai `Relationship`, `ChangeRequest`, graph API và audit bằng migration mới sau `0009`. Gói D chọn thư viện graph qua spike rồi thêm pan, pinch/wheel zoom, fit, “Về tôi”, thu/mở nhánh và tạo đề xuất từ node. Hai gói này dùng hệ thiết kế và route contract đã được duyệt trong gói B.
