# Thiết kế backend quan hệ gia đình

**Ngày:** 2026-09-10  
**Phạm vi:** Gói C1–C4 trong roadmap  
**Nguồn yêu cầu:** `specs/family-tree/README.md`, `docs/06_DOMAIN_MODEL.md`, `docs/10_PRIVACY_SECURITY.md`, `docs/11_API_CONTRACTS.md`

## Mục tiêu

Tạo nguồn dữ liệu chuẩn cho quan hệ gia đình đã được duyệt. Thành viên đang hoạt động có thể đọc một phần graph quanh một hồ sơ; thành viên có thể gửi đề xuất; quản trị viên có thể duyệt hoặc từ chối; người gửi có thể hủy đề xuất đang chờ. Mọi quyết định được kiểm tra lại trong transaction và ghi audit.

Gói này chưa chọn thư viện graph, chưa triển khai pan/pinch/drag và chưa suy ra cách xưng hô. UI cây thật sẽ dùng contract của gói này trong lát cắt kế tiếp.

## Mô hình dữ liệu

### `relationships`

- `id`, `family_id`, `from_member_id`, `to_member_id`, `type`, `subtype`
- `start_date`, `end_date` chỉ dùng cho partnership
- `removed_at`, `version`, `created_at`, `updated_at`
- Hai composite foreign key buộc hai đầu mối quan hệ thuộc cùng `family_id`.
- Không cho phép tự nối.
- Với `parent_child`, `from_member_id` luôn là cha/mẹ và `to_member_id` luôn là con. `subtype` là `biological`, `adoptive` hoặc `unspecified`.
- Với `partnership`, hai ID được chuẩn hóa theo thứ tự UUID trước khi lưu. `subtype` là `married` hoặc `partner`.
- Chỉ có một parent-child chưa bị loại bỏ cho cùng cặp có hướng và một partnership đang hiệu lực cho cùng cặp không hướng. Các giai đoạn partnership đã kết thúc vẫn được giữ để thể hiện lịch sử và tái hôn.
- `removed_at` biểu thị bản ghi sai đã bị loại bỏ khỏi graph chuẩn; nó khác `end_date`, vốn là lịch sử partnership hợp lệ.

### `change_requests`

- `id`, `family_id`, `actor_membership_id`, `type`, `target_id`, `base_version`
- `proposed_payload` là JSON object đã được server chuẩn hóa
- `status`: `pending`, `approved`, `rejected`, `cancelled`
- `reviewer_id`, `decision_note`, `decided_at`, `version`, timestamps
- `relationship_create` không có target/base version.
- `relationship_update` và `relationship_remove` phải có target/base version cùng nhà.
- Update chỉ đổi `subtype`, `start_date`, `end_date`. Muốn đổi hai đầu hoặc đổi loại quan hệ phải loại bỏ rồi đề xuất mới; quy tắc này giữ audit rõ ràng.

## Quyền và transaction

- Active member được đọc `relationships` chưa bị loại bỏ trong nhà mình, tạo đề xuất với chính membership của mình, đọc đề xuất của mình và hủy đề xuất của mình khi còn pending.
- Active admin đọc toàn bộ đề xuất trong nhà và ra quyết định. Quyền admin không mở contact riêng tư.
- Pending, revoked và cross-family nhận 404 theo baseline che tài nguyên.
- Runtime role không được sửa trực tiếp quan hệ từ endpoint hồ sơ. Mọi thay đổi đi qua change request.
- Khi duyệt, transaction khóa advisory theo `family_id`, khóa request và target, kiểm lại actor, version, status, member endpoints, duplicate và chu trình rồi mới apply và ghi audit.
- Kiểm chu trình duyệt theo các cạnh parent-child chưa bị loại bỏ, cộng cạnh được đề xuất. Khóa theo nhà làm hai lần duyệt đồng thời được tuần tự hóa.
- Audit chỉ ghi ID, loại thay đổi, subtype và version; không sao chép hồ sơ hoặc contact vào `change_summary`.

## API

### Đọc graph

`GET /api/v1/families/{familyId}/relationships?root_member_id={uuid}&depth={1..4}`

- `depth` mặc định 2, tối đa 4.
- Root phải thuộc nhà hiện tại.
- Trả tối đa 100 node; nếu vượt, trả 400 để client yêu cầu depth nhỏ hơn thay vì cắt graph âm thầm.
- Node chỉ có member summary; không có biography hoặc contact.
- Edge gồm ID, hai đầu, type/subtype, ngày partnership, version.
- Kết quả có thứ tự ổn định theo khoảng cách, tên hiển thị, ID; edge theo type và ID.

### Đề xuất và quyết định

- `POST /api/v1/families/{familyId}/change-requests`
- `GET /api/v1/families/{familyId}/change-requests?status=pending`
- `POST /api/v1/families/{familyId}/change-requests/{requestId}/decision`
- `POST /api/v1/families/{familyId}/change-requests/{requestId}/cancel`

Create trả 201 với request đã chuẩn hóa. List chỉ dành cho admin trong gói này; người gửi nhận request vừa tạo từ response và không cần inbox riêng. Decision nhận `decision`, `version`, `note?`; reject không thay graph. Cancel nhận `version`. Mọi mutation yêu cầu same-origin JSON, rate limit theo actor và optimistic version; trạng thái cũ trả 409.

## Validation

- UUID hợp lệ, hai member khác nhau và cùng nhà.
- Ngày dùng `YYYY-MM-DD`; `end_date` không trước `start_date`.
- Parent-child không nhận ngày; partnership bắt buộc subtype phù hợp.
- Create được kiểm duplicate và cycle lúc gửi để phản hồi sớm, rồi kiểm lại khi duyệt.
- Pending request không bao giờ xuất hiện trong graph chuẩn.
- Update/remove target đã bị loại bỏ hoặc version đã đổi trả 409.

## Kiểm thử

- Contract: schema từ chối unknown keys, subtype sai, ngày sai và payload không khớp type.
- Database: RLS cho active/pending/revoked/cross-family; composite FK; self-edge; duplicate; partnership lịch sử.
- API: graph depth, node cap, không có contact, root ngoài nhà; member create/cancel; admin approve/reject; stale versions; audit.
- Business rules TREE-01–06, gồm cha mẹ nuôi, tái hôn và hai approval đồng thời có thể tạo chu trình.

## Tiêu chí hoàn thành

Graph đã duyệt đọc từ PostgreSQL, không chứa pending hoặc dữ liệu nhà khác. Một đề xuất chỉ có thể được áp dụng một lần, tồn tại sau reload và tạo audit. Không có đường ghi quan hệ qua profile API hoặc từ vị trí node/LLM.
