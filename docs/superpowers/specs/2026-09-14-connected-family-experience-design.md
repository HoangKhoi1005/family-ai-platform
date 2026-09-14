# Connected Family Experience — Thiết kế

**Trạng thái:** Confirmed về hướng sản phẩm ngày 2026-09-14; chờ duyệt đặc tả triển khai.

**Phạm vi:** Đưa hệ thống A — Nhà đang sống và C — Quanh người thân từ design preview vào `/app` bằng dữ liệu thật; đồng thời xây nền dữ liệu, media và quyền truy cập cho Khoảnh khắc/Kỷ niệm B.

**Phụ thuộc:** Bắt đầu từ `feat/mobile-experience-redesign` tại `6770fac`. Không đưa fixture hoặc hình minh họa của preview vào bề mặt kết nối thật.

## 1. Kết quả cần đạt

Sau khi hoàn thành, một thành viên active có thể:

1. Mở `/app` và thấy màn Nhà dùng ngôn ngữ thị giác A, tên nhà, danh tính, người thân, ngày quan trọng và thông báo từ API thật.
2. Mở Gia phả, chọn một người, thấy 3–5 quan hệ trực tiếp đã duyệt trong “Quanh người thân”, rồi tiếp tục dùng canvas, hồ sơ và đề xuất quan hệ hiện có.
3. Chọn ảnh trên điện thoại, tải lên kho riêng, chờ kiểm tra, đăng Khoảnh khắc cho Cả nhà, xem feed và phản hồi một lần cho mỗi tài khoản.
4. Chuyển Khoảnh khắc của mình thành Kỷ niệm, bổ sung lời kể hoặc bản ghi âm, rồi đọc/nghe lại theo dòng thời gian.

Người pending, revoked hoặc thuộc nhà khác không được đọc metadata, nội dung media, signed URL, reaction hay Kỷ niệm của nhà mục tiêu.

## 2. Phân kỳ và ranh giới thay đổi

Thay đổi được triển khai theo bốn lát có thể kiểm thử độc lập:

1. **Connected A:** shell và Nhà thật, chỉ dùng endpoint đã có. Khi Moments chưa sẵn sàng, khu vực Khoảnh khắc hiển thị empty state trung thực.
2. **Connected C:** lớp định hướng quan hệ dùng `RelationshipGraphResponse`, giữ nguyên domain và workflow duyệt.
3. **B — domain/media/API:** migration, contracts, object storage, xử lý media, Moments, reactions và Memories.
4. **Connected B:** composer, feed và dòng Kỷ niệm mobile dùng API thật.

Mỗi lát phải giữ được onboarding, calendar, notifications, member profile và admin flows hiện hành. Không đổi năm đích chính: **Nhà · Khoảnh khắc · Gia phả · Trò chuyện · Tôi**. Kỷ niệm tiếp tục là một lối vào theo ngữ cảnh, không thành tab thứ sáu.

## 3. Connected shell và Nhà A

### 3.1 Thành phần

- `ConnectedAppShell` dùng token đã duyệt, app bar gọn, tab bar mobile có safe-area và rail desktop.
- `ConnectedHome` nhận một view model đã chuẩn hóa; component không tự gọi API và không biết fixture.
- `ConnectedHomePulse` hiển thị hồ sơ đang có thay đổi hữu ích khi backend cung cấp nguồn. Trong lát đầu, nó chỉ dùng danh sách Member thật và không bịa thời điểm cập nhật.
- `ConnectedHomeMoment` có hai trạng thái: Moment mới nhất từ API hoặc lời mời gửi ảnh đầu tiên.
- `ConnectedHomeEvent` lấy occurrence gần nhất từ calendar state hiện có.

### 3.2 Dữ liệu

`FamilyApp` tiếp tục là coordinator trong giai đoạn rollout đầu. Nó tạo `ConnectedHomeModel` từ:

- `GET /api/v1/me` cho danh tính và active membership.
- `GET /api/v1/families/{familyId}/onboarding` cho Member đang liên kết.
- `GET /api/v1/families/{familyId}/members?limit=100` cho danh bạ.
- `GET /api/v1/families/{familyId}/events` cho occurrence sắp tới.
- `GET /api/v1/families/{familyId}/notifications` cho unread count.
- `GET /api/v1/families/{familyId}/moments?limit=1` chỉ sau khi API Moments được đưa vào.

Tên nhà hiện chưa có endpoint family detail riêng. Trong lát A, shell dùng tên nhà đã có trong membership/session DTO; nếu DTO hiện tại không chứa tên, contract `/me` được mở rộng bằng `family_name` đã lọc phía server. Không lấy tên nhà từ client input hoặc hardcode family ID.

### 3.3 Trạng thái và lỗi

- Lần tải đầu giữ skeleton có kích thước ổn định và navigation không nhảy.
- Lỗi calendar, notifications hoặc Moments chỉ làm vùng tương ứng hiện nút “Thử lại”.
- Network error giữ dữ liệu đã tải và hiển thị trạng thái mất kết nối.
- `401` xóa session state và chuyển đến `/login` theo flow hiện có.
- `403/404` từ family resource tăng sequence, hủy response cũ, xóa toàn bộ family state và trở lại trạng thái không có nhà.
- Nhà không có Member liên kết vẫn dùng luồng claim hiện có; không gọi relationship graph.
- Nhà chưa có nội dung chỉ hiển thị các hành động thật: mời người thân, thêm ngày quan trọng, gửi Khoảnh khắc đầu tiên.

## 4. Connected Gia phả C

### 4.1 Component và dữ liệu

Tạo `ConnectedRelationshipOrbit` nhận:

```ts
interface ConnectedRelationshipOrbitProps {
  selected: RelationshipGraphNodeDto;
  connections: TreeConnection[];
  membersById: ReadonlyMap<string, RelationshipGraphNodeDto>;
  onSelectMember: (memberId: string) => void;
}
```

`connectionsFor(graph, selectedId)` tiếp tục là nguồn nhãn quan hệ. Orbit chỉ nhận các edge nằm trong `RelationshipGraphResponse` đã được server lọc. Không suy luận quan hệ mở rộng, vai vế hoặc giới tính.

Chạm một người trong orbit sẽ:

1. Chọn node cùng ID trong tree state.
2. Đưa React Flow đến node bằng hành vi focus hiện có.
3. Mở member sheet từ endpoint hồ sơ đã lọc quyền.

Canvas, directory, zoom, pan, fit view, “Về tôi”, thu/mở nhánh và proposal wizard giữ contract hiện có. Pending proposal không xuất hiện trong orbit hoặc graph chính thức.

### 4.2 Trường hợp quan hệ

- Quan hệ `parent_child/adoptive` hiển thị “Cha / mẹ nuôi” hoặc “Con nuôi”.
- Quan hệ `parent_child/unspecified` ghi rõ “chưa rõ loại quan hệ”.
- Partnership có `end_date` hiển thị “Bạn đời trước đây”.
- Nhiều partnership được hiển thị thành các mục riêng, không tự chọn một người là hiện tại nếu dữ liệu không chứng minh.
- Người thiếu ảnh dùng monogram từ tên đã lọc.
- Tên dài xuống dòng tối đa có chủ ý và vẫn giữ target chạm 44 px.

## 5. Domain Khoảnh khắc, Kỷ niệm và media

### 5.1 Phạm vi audience của pilot

MVP chỉ chấp nhận `audience = "family"`. Client gửi `selected_people`, `branch`, `household` hoặc giá trị không biết nhận `400 VALIDATION_ERROR`. Việc chuyển Moment thành Memory giữ nguyên family scope và không mở rộng audience.

### 5.2 Lược đồ PostgreSQL

Migration mới tạo các bảng sau. Mọi bảng dữ liệu gia đình có `family_id`, UUID, timestamp UTC và constraint cùng nhà.

**`media_assets`**

- `id`, `family_id`, `owner_membership_id`
- `purpose`: `moment_image | memory_image | memory_audio`
- `status`: `pending | processing | ready | rejected | deleted`
- `object_key`, `processed_object_key`, `mime_type`, `byte_size`, `sha256`
- `width`, `height`, `duration_ms` nullable
- `rejection_code` nullable, `version`, `created_at`, `updated_at`, `deleted_at`

`object_key` do server sinh từ family/media UUID; client không chọn bucket path. Metadata không lưu EXIF vị trí.

**`moments`**

- `id`, `family_id`, `author_membership_id`, `media_id`
- `caption` tối đa 500 ký tự
- `audience` với constraint chỉ nhận `family`
- `client_request_id`, `version`, `created_at`, `deleted_at`
- unique `(family_id, author_membership_id, client_request_id)`

**`moment_reactions`**

- `family_id`, `moment_id`, `membership_id`, `reaction`, `created_at`, `updated_at`
- primary key `(moment_id, membership_id)`
- reaction pilot chỉ nhận `thuong`; PUT cùng giá trị là idempotent, `null` xóa reaction.

**`memories`**

- `id`, `family_id`, `created_by_membership_id`
- `source_moment_id` nullable, unique khi khác null
- `title`, `occurred_on`, `audience = family`
- `version`, `created_at`, `updated_at`, `deleted_at`

**`memory_items`**

- `id`, `family_id`, `memory_id`, `position`
- `kind`: `image | text | audio`
- `media_id` nullable, `body` nullable
- `contributed_by_membership_id`, `created_at`, `deleted_at`
- unique `(memory_id, position)`
- CHECK constraint yêu cầu `body` cho text và `media_id` cho image/audio. Trạng thái `ready`, purpose phù hợp và cùng nhà của media được kiểm lại trong transaction trước khi ghi item; không thể biểu diễn các điều kiện liên bảng này bằng CHECK constraint PostgreSQL.

RLS và application queries đều yêu cầu active membership. Composite foreign key ngăn liên kết Moment/Memory/media khác nhà. Xóa logic đánh dấu parent trước; object cleanup chạy qua outbox/job và kiểm tra lại quyền/trạng thái trước khi xóa vật lý.

### 5.3 Object storage

API phụ thuộc interface:

```ts
interface MediaStorage {
  createUploadGrant(input: UploadGrantInput): Promise<UploadGrant>;
  headObject(objectKey: string): Promise<StoredObjectMetadata | null>;
  getObject(objectKey: string): Promise<NodeJS.ReadableStream>;
  putProcessedObject(input: ProcessedObjectInput): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
  createReadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
}
```

Local development chạy MinIO bằng `compose.yaml`. Adapter dùng giao thức S3-compatible; production có thể cấu hình R2, S3 hoặc provider tương thích mà không đổi contracts/domain. Credential chỉ tồn tại ở API/worker.

Upload grant tồn tại tối đa 10 phút và trỏ vào object quarantine. `POST /media/{id}/complete` chỉ chuyển asset sang `processing` sau khi `headObject` khớp giới hạn dung lượng. Worker đọc object, xác minh magic bytes thay vì tin MIME client, kiểm pixel/duration và:

- Ảnh: chấp nhận JPEG/PNG/WebP tối đa 10 MB, giới hạn pixel cấu hình, decode rồi encode lại để loại EXIF/GPS; HEIC bị từ chối bằng mã lỗi rõ cho đến khi pipeline có test tương thích.
- Audio: chấp nhận các định dạng được pipeline xác minh, giới hạn 25 MB và 10 phút; không tự phát trong UI.

Chỉ object đã xử lý có status `ready` mới được gắn vào Moment/Memory. URL đọc có TTL tối đa 60 giây và chỉ được cấp sau khi kiểm tra quyền parent tại thời điểm request. Tài liệu sản phẩm ghi rõ URL còn hạn hoặc bản đã tải xuống không thể bị thu hồi từ thiết bị người nhận.

## 6. API contracts

Tất cả route đặt dưới `/api/v1/families/{familyId}` và resolve actor từ session.

### 6.1 Media

- `POST /media/uploads`: `{ mime_type, byte_size, purpose }` → `{ media, upload: { url, method, headers, expires_at } }`.
- `POST /media/{mediaId}/complete`: body rỗng → asset `processing`; retry không tạo job thứ hai.
- `GET /media/{mediaId}`: metadata được phép, không trả object key.
- `GET /media/{mediaId}/content`: owner được xem draft của chính mình; người khác chỉ được xem media `ready` đang được một Moment/Memory chưa xóa mà họ có quyền đọc tham chiếu. Sau đó API trả `302` đến URL TTL ≤ 60 giây hoặc stream qua gateway.

Rate limit upload theo actor và family; quota pilot cấu hình phía server. Unknown body keys bị từ chối.

### 6.2 Moments

- `GET /moments?cursor&limit`: feed mới nhất trước, stable cursor `(created_at,id)`, tối đa 100.
- `POST /moments`: `Idempotency-Key` và `{ client_request_id, media_id, caption, audience: "family" }`.
- `DELETE /moments/{momentId}`: tác giả hoặc admin; idempotent với bản đã xóa.
- `PUT /moments/{momentId}/reaction`: `{ reaction: "thuong" | null }`.

Moment DTO chỉ trả media descriptor hoặc content endpoint, tác giả dạng Member summary được phép, `my_reaction` và danh sách reaction summary không có số đếm công khai.

### 6.3 Memories

- `GET /memories?cursor&limit`: timeline theo `occurred_on DESC, id DESC`.
- `POST /memories`: tạo Kỷ niệm thủ công với title, occurred_on và danh sách item hợp lệ.
- `POST /moments/{momentId}/memory`: tác giả Moment hoặc admin tạo một Memory nguồn; retry trả bản hiện có.
- `POST /memories/{memoryId}/items`: thêm text hoặc media ready, dùng optimistic `version`.
- `DELETE /memories/{memoryId}`: người tạo hoặc admin, soft delete và enqueue cleanup nếu không còn parent tham chiếu media.

Memory DTO trả item theo `position`, nguồn đóng góp và content endpoint đã kiểm quyền. Memory đã xóa hoặc mất quyền không để lại placeholder có thể suy ra nội dung.

## 7. UI kết nối B

### 7.1 Composer Khoảnh khắc

Composer là bottom sheet mobile:

1. Chọn camera hoặc thư viện qua file input `accept` đúng định dạng.
2. Xem trước cục bộ và thấy nhãn “Cả nhà”.
3. Xin upload grant, tải object với tiến trình, gọi complete rồi poll trạng thái giới hạn thời gian.
4. Khi media ready, tạo Moment với idempotency key ổn định trong vòng retry của tab.
5. Thành công mới xóa preview cục bộ và đưa Moment vào feed.

Mất mạng giữ file và caption trong memory của tab, cho phép thử lại; không lưu ảnh/âm thanh vào localStorage hoặc service-worker cache. Đóng tab có thể mất draft và UI phải nói rõ.

### 7.2 Feed và reaction

Feed mobile dùng một nội dung chính theo thứ tự thời gian. Ảnh tải qua media content endpoint. Nút “Thương” cập nhật lạc quan nhưng rollback khi server từ chối. Không có public count, followers hoặc infinite autoplay.

### 7.3 Dòng Kỷ niệm

Kỷ niệm mở từ Nhà, hồ sơ hoặc Moment. Timeline giữ mốc ngày, người đóng góp và nguồn. Audio chỉ phát sau thao tác trực tiếp, có play/pause, thời lượng và fallback tải lỗi. UI không tuyên bố đã phát nếu file chưa ready hoặc trình duyệt từ chối.

## 8. Authorization và an toàn

- `family_id` lấy từ route nhưng chỉ được dùng sau `requireFamily` xác minh active membership.
- Mọi ID con resolve đồng thời với family scope; cross-family trả 404.
- Pending/revoked không được upload, publish, react, convert, list hoặc nhận signed URL.
- Worker dùng role riêng, xử lý theo row đã claim và kiểm status; không có quyền duyệt nội dung gia đình tùy ý.
- Filename gốc không đi vào object key hoặc log. Log chỉ có request ID, media ID, trạng thái và mã lỗi không chứa nội dung.
- Caption/story được giới hạn độ dài và render như text, không dùng HTML tùy ý.
- Service worker tiếp tục không cache API response hoặc media riêng tư.
- Xóa membership không xóa Member khỏi gia phả; quyền đọc media dừng ở request tiếp theo.

## 9. Kiểm thử và nghiệm thu

### 9.1 Connected A/C

- Unit test cho `ConnectedHomeModel` và `connectionsFor` với dữ liệu một người, adoptive, unspecified, remarriage, partnership đã kết thúc, tên dài và thiếu ảnh.
- Browser test ở 320, 390, 768 và 1280 px; chữ 200%, keyboard/focus, reduced motion và safe-area.
- Browser flow thật chứng minh `/app` không import fixture preview, xử lý network error, lỗi vùng, membership revoke và stale response.

### 9.2 Database/API/media

- Migration test cho RLS, composite foreign key, unique idempotency, reaction upsert và source Moment duy nhất.
- Integration test với hai nhà A/B, active/pending/revoked, ID đoán được, signed URL và media parent đã xóa.
- Test file giả MIME, quá 10 MB, vượt pixel, EXIF GPS, object không tồn tại và complete retry.
- Test publish chỉ nhận media ready cùng owner/family; retry không tạo Moment thứ hai.
- Test chuyển Moment thành Memory không tạo duplicate và không mở rộng audience.
- Test cleanup không xóa media còn được Memory khác tham chiếu.

### 9.3 Quality gate

Mỗi lát chạy test hẹp ở chu kỳ RED/GREEN rồi chạy typecheck và suite liên quan. Trước khi push/PR chạy `npm run check`, database integration scripts, Playwright desktop/mobile và `python scripts/validate_brain.py`. Build/test đạt không thay thế visual review trên điện thoại.

## 10. Ngoài phạm vi

- Audience theo household, branch, circle hoặc selected people.
- Video, live photo, HEIC conversion và chỉnh sửa ảnh.
- Public reaction count, follower, streak hoặc recommendation feed.
- Native widget và background upload khi PWA bị đóng.
- AI tự động tóm tắt, phân loại hoặc viết Kỷ niệm.
- Chat media và dùng private chat làm nguồn Memory.
- Chọn production hosting/storage provider; gói này chỉ khóa contract S3-compatible và adapter đã kiểm thử.

## 11. Thứ tự tích hợp Git

1. PR thiết kế A+B+C hiện tại được merge trước hoặc các PR sau dùng stacked-base rõ ràng.
2. PR Connected A+C không chứa migration media.
3. PR B domain/media/API có migration và security tests, chưa bật UI cho người dùng nếu processing pipeline chưa đạt.
4. PR Connected B chỉ merge khi endpoint, object storage và cleanup job đã được kiểm chứng.

Không bật feature bằng dữ liệu thật chỉ vì UI preview đạt. Mỗi bề mặt được phát hành khi contract, quyền truy cập, lỗi mạng, browser test và visual review đều có bằng chứng.
