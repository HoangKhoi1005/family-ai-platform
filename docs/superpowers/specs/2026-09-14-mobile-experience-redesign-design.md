# Mobile Experience Redesign — Thiết kế

**Trạng thái:** Confirmed ngày 2026-09-14

**Phạm vi:** Nâng cấp hệ thống trải nghiệm mobile và design preview trước khi áp dụng vào `/app` có dữ liệu thật.

## Quyết định đã duyệt

Trải nghiệm dùng ba mô hình bổ trợ nhau:

1. **A — Nhà đang sống** là nền tảng của Nhà và Khoảnh khắc. Màn mở đầu cho biết ai vừa xuất hiện, chuyện gì đang xảy ra và người dùng có thể gửi gì cho gia đình ngay lúc đó.
2. **B — Dòng ký ức** dành cho Kỷ niệm. Kỷ niệm được kể theo thời gian bằng ảnh, lời kể, giọng nói và sự kiện liên quan; không biến thành một album ảnh chung chung.
3. **C — Quanh người thân** dành cho Gia phả. Người dùng bắt đầu từ một người, thấy những quan hệ gần và việc liên quan, rồi mới mở rộng vào canvas chính xác.

Năm đích điều hướng chính vẫn là **Nhà · Khoảnh khắc · Gia phả · Trò chuyện · Tôi**. Kỷ niệm là một lớp nội dung có lối vào từ Nhà, hồ sơ và Khoảnh khắc; không thêm tab thứ sáu trong pilot.

## Mục tiêu trải nghiệm

Trong 20 giây đầu, người dùng phải trả lời được ba câu:

- Hôm nay trong nhà có ai hoặc chuyện gì mới?
- Có ngày nào cần mình nhớ hoặc phản hồi?
- Mình có thể làm một việc thân mật nào ngay bây giờ?

Vòng lặp giữ chân chính là **thấy một khoảnh khắc → phản hồi ngắn → gửi lại một khoảnh khắc**. Lịch tạo sự chờ đợi, Kỷ niệm tạo chiều sâu, Gia phả giúp hiểu người thân. Không dùng streak, điểm thưởng, đếm lượt thích công khai hoặc thông báo gây áp lực.

## Hệ thống thị giác

- Dùng sans-serif có glyph tiếng Việt ổn định cho toàn bộ UI. Chữ hiển thị dựa vào cỡ, trọng lượng và khoảng trắng; không dùng serif lớn như dấu hiệu nhận diện mặc định.
- Nền sáng trung tính, xanh lá trầm cho hành động và trạng thái gia đình, đỏ sơn mài dùng có tiết chế cho hành động chia sẻ hoặc điểm cần chú ý.
- Ảnh hoặc nội dung của người thân được phép phá lưới và giữ diện tích lớn. Các thông tin phụ dùng surface nhỏ, nhưng không đặt mọi nội dung trong card bo tròn giống nhau.
- Nhãn chữ hoa có tracking chỉ dùng cho thông tin hệ thống rất ngắn; câu chữ sản phẩm dùng kiểu viết tự nhiên.
- Chuyển động 160–220 ms cho phản hồi trực tiếp; không tự chạy carousel, tự phát âm thanh hoặc làm mất vị trí cuộn.

## A — Nhà đang sống

### Cấu trúc mobile

1. App bar gọn: tên nhà, thông báo và avatar. Không lặp lại nhận diện nhà trong phần nội dung.
2. Lời chào ngắn và hàng người vừa có cập nhật. Nút đầu hàng mở composer Khoảnh khắc.
3. Một Khoảnh khắc chính chiếm ưu tiên, có người gửi, thời điểm, phạm vi và lời nhắn. Phản hồi không hiển thị số đếm công khai.
4. Ngày quan trọng gần nhất nằm ngay sau Khoảnh khắc, có ngày và thời gian còn lại.
5. Lối vào Kỷ niệm và Gia phả xuất hiện theo ngữ cảnh ở phần tiếp theo.

### Trạng thái rỗng

Nhà mới không để lại một màn hình trống. Màn hình giải thích hai việc đầu tiên: mời người thân và gửi Khoảnh khắc đầu tiên. Không bịa nội dung gia đình để lấp chỗ trống.

## B — Dòng ký ức

- Mỗi mục có mốc thời gian, người đóng góp, nguồn và quyền xem.
- Ảnh, văn bản và giọng kể có thể cùng nằm trong một mục.
- Sự kiện lịch hoặc người trong gia phả có thể liên kết đến Kỷ niệm; liên kết không làm thay đổi dữ liệu nguồn.
- Màn hình ưu tiên đọc/nghe theo trình tự; hành động thêm Kỷ niệm luôn có nhãn rõ và nằm trong vùng chạm một tay.
- Nội dung đã mất quyền xem hoặc bị xóa có trạng thái rõ, không để khoảng trắng khó hiểu.

## C — Quanh người thân

- Phần mở đầu của Gia phả hiển thị người đang chọn ở trung tâm cùng 3–5 quan hệ gần nhất và cập nhật liên quan.
- Đây là lớp định hướng; canvas `@xyflow/react` và danh bạ vẫn là nguồn thao tác đầy đủ.
- Mọi nhãn quan hệ đến từ dữ liệu đã duyệt. Quan hệ chưa xác định được ghi rõ và không nối như sự thật.
- Trên mobile, chạm người mở hồ sơ dạng sheet; thao tác thêm người thân đi qua luồng đề xuất và duyệt hiện có.
- Zoom, pan, thu nhánh và “Về tôi” được giữ lại, nhưng toolbar ưu tiên tìm người và định hướng trước các nút kỹ thuật.

## Responsive và khả năng tiếp cận

- Thiết kế gốc tại 390×844; kiểm tra thêm 320, 768 và 1280 px.
- Tab bar cố định có safe-area; nội dung không bị che. Desktop dùng rail và tăng khoảng thở, không kéo rộng card mobile vô hạn.
- Target tối thiểu 44×44 px. Focus nhìn thấy rõ; icon-only control phải có accessible name.
- Tên tiếng Việt dài được xuống dòng có chủ ý. Chữ 200% vẫn không tràn ngang và hành động chính còn dùng được.
- Giữ vị trí cuộn khi đóng sheet; tôn trọng `prefers-reduced-motion`.

## Dữ liệu và tính trung thực

- `/design-preview` chỉ dùng fixture hư cấu và luôn có nhãn “Dữ liệu minh họa”. Không gọi API.
- Hình minh họa trong preview phải được đánh dấu rõ; sản phẩm thật chỉ hiển thị media người dùng có quyền xem.
- `/app` chỉ nhận hệ thống mới sau khi từng surface đạt browser test, visual review và không làm yếu quyền truy cập hiện có.

## Phân kỳ

1. **Foundation:** tokens, shell và Nhà theo hướng A.
2. **Retention:** Khoảnh khắc theo A và Kỷ niệm theo B.
3. **Identity:** Gia phả theo C, giữ canvas và workflow duyệt.
4. **Completion:** Trò chuyện, Tôi, onboarding và admin dùng cùng hệ thống nhưng giữ bố cục riêng theo nhiệm vụ.
5. **Connected rollout:** áp dụng vào `/app` theo dữ liệu/API thật, không mang fixture sang.

## Tiêu chí nghiệm thu lát cắt đầu tiên

- `/design-preview` có app bar gọn, lời chào, hàng cập nhật, một Khoảnh khắc chính, một ngày quan trọng và lối vào Kỷ niệm/Gia phả.
- “Gửi Khoảnh khắc” mở đúng composer preview hiện có; không có nút chết.
- Không còn tiêu đề serif khổ lớn, chuỗi nhãn chữ hoa và đường kẻ trang trí làm công thức chính trên Nhà.
- Navigation vẫn hoạt động, còn nhìn thấy sau khi cuộn và đánh dấu đúng route.
- Không gọi `/api/*`; không tràn ngang ở viewport đã nêu; chữ 200% và reduced motion vẫn dùng được.
