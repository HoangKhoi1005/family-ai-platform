# API contract và trạng thái triển khai

Đợt nối UI 2026-09-09: thêm `GET /api/v1/families/{familyId}/onboarding`, trả `{ member_id: string | null, claims: [{ id, version }] }` của chính actor active. Không trả contacts hoặc claim của người khác. Guest trả 401; pending/revoked/cross-family trả 404 theo quy tắc che tài nguyên. Xem [luồng đã nối](CONNECTED_ONBOARDING.md). Danh bạ/hồ sơ API đã có trong baseline merge `3e411b7`.

Đã triển khai health, auth Better Auth, `GET /api/v1/me`, invitation accept, các routes invitation/membership/claim và danh bạ/hồ sơ. Các routes lịch, quan hệ gia phả, chat, moments, media, notifications và AI vẫn là thiết kế. Hợp đồng máy đọc hiện có trong `packages/contracts/src/onboarding.ts`; không có dev-auth bypass. Health chỉ phản ánh process, không khẳng định database/provider sẵn sàng.

## Quy ước

Prefix `/api/v1/families/{familyId}`. Xác thực session hoặc bearer do stack quyết định; cookie auth phải có CSRF protection phù hợp. Server lấy actor từ credential, không nhận actor/role tin cậy từ body. Resolve active membership trước tài nguyên.

ID production là UUID; ngày `YYYY-MM-DD`, timestamp ISO 8601 UTC; timezone IANA. List dùng cursor opaque và limit mặc định 20, tối đa 100; thứ tự ổn định có ID/sequence. Response chỉ có trường được phép, không serialize DB row trực tiếp.

Error: `{"error":{"code":"VALIDATION_ERROR","message":"Thông tin chưa hợp lệ","request_id":"…","fields":{}}}`. Mã: 400 validation, 401 unauthenticated, 403 hành động không được phép khi tài nguyên đã được phép biết, 404 tài nguyên không có/ngoài phạm vi, 409 conflict, 429 rate limit, 503 unavailable. Không trả stack trace/SQL.

## Bản đồ routes (gồm cả thiết kế chưa triển khai)

| Method / path sau prefix                  | Input chính                                                      | Output và quyền                                           |
| ----------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| GET /members                              | q, cursor, limit                                                 | Hồ sơ tóm tắt được phép; không search qua contact private |
| GET /members/{id}                         | —                                                                | Hồ sơ, contacts đã lọc, version                           |
| PATCH /members/{id}                       | display_name, contacts, version                                  | Owner được liên kết; admin chỉ sửa theo policy; 409 stale |
| GET /relationships                        | root_member_id, depth tối đa 4                                   | Cạnh đã duyệt và node được phép, không trả graph nhà khác |
| POST /change-requests                     | type, target_id?, base_version?, payload                         | 201 pending; payload theo schema type                     |
| POST /change-requests/{id}/decision       | decision approved/rejected, version                              | Admin; transaction validate + apply + audit; 409 đã xử lý |
| POST /invitations                         | expires_at, intended_member_id?                                  | Admin, token chỉ trả lúc tạo; single-use                  |
| POST /memberships/{id}/approve            | version                                                          | Admin; chỉ active membership, không tự liên kết hồ sơ     |
| POST /memberships/{id}/revoke             | version                                                          | Admin; chặn self-revoke admin cuối                        |
| GET /events                               | from, to, cursor                                                 | Occurrence theo range có giới hạn tối đa 1 năm            |
| POST /events                              | title, calendar, recurrence, timezone, date_parts, lunar_policy? | Active member; validate lịch, không LLM                   |
| PATCH /events/{id}                        | changes, version                                                 | Creator/admin; tăng revision, tính lại jobs               |
| POST /events/{id}/cancel                  | version                                                          | Creator/admin; hủy occurrences/jobs tương lai             |
| PUT /occurrences/{id}/rsvp                | response yes/no/maybe                                            | Upsert của actor, không gửi membership_id giả             |
| GET /threads/{id}/messages                | before_seq?, limit                                               | Chỉ thread được phép, thứ tự server_seq                   |
| POST /threads/{id}/messages               | client_message_id, body?, media_id?, reply_to_id?                | Commit rồi realtime; retry cùng key trả cùng message      |
| DELETE /threads/{id}/messages/{messageId} | —                                                                | Author/admin; tombstone, audit moderation                 |
| GET /moments                              | cursor, limit                                                    | Feed audience=family, active membership                   |
| POST /moments                             | client_request_id, media_id, caption, audience=family            | Author; media ready và đúng owner/family                  |
| DELETE /moments/{id}                      | —                                                                | Author/admin; media cleanup, không còn trong feed         |
| PUT /moments/{id}/reaction                | reaction hoặc null                                               | Upsert/remove của actor                                   |
| POST /media/uploads                       | mime, bytes, purpose                                             | Kiểm quota, trả upload grant ngắn hạn và media_id         |
| POST /media/{id}/complete                 | —                                                                | Server xác minh object thực trước ready                   |
| GET /media/{id}/content                   | —                                                                | Quyền parent, gateway hoặc URL TTL giới hạn               |
| GET /notifications                        | cursor                                                           | Chỉ recipient hiện tại                                    |
| PATCH /notification-preferences           | offsets, quiet_hours, push_enabled                               | Actor, không sửa người khác                               |
| POST /ai/query                            | question, conversation_id?                                       | Giai đoạn 2; status, answer, sources, request_id          |

Routes global: `POST /api/v1/invitations/accept` nhận token và credential, tạo pending membership; không trả dữ liệu nhà trước duyệt. `POST/DELETE /api/v1/me/push-subscriptions` chỉ thiết bị của actor. Auth routes dùng Better Auth theo ADR-002; push-subscriptions chưa triển khai.

## Claim hồ sơ, đã triển khai backend

Các route sau prefix family đã triển khai: `POST /member-claims` (admin, membership active và Member chưa liên kết), `GET /member-claims/{id}/preview` (chỉ candidate được chỉ định, claim còn hạn), `POST /member-claims/{id}/confirm` (candidate xác nhận version/visibility, atomic link+consume), `POST /member-claims/{id}/decline` (candidate) và `POST /member-claims/{id}/revoke` (admin). Claim preview là quyền hẹp theo [privacy](10_PRIVACY_SECURITY.md), không dùng endpoint hồ sơ thông thường để mở self contact trước link. Mutation dùng session đã xác minh, Origin cùng web và JSON; preview/revoke cùng các thao tác claim khác có rate limit theo actor.

## Payload sự kiện ngày giỗ

```json
{
  "title": "Ngày giỗ ông",
  "calendar": "lunar_vietnamese",
  "date_parts": { "day": 12, "month": 8, "year": null },
  "recurrence": "yearly",
  "timezone": "Asia/Ho_Chi_Minh",
  "lunar_policy": { "month_mode": "regular", "missing_day": "last_day" }
}
```

Quy tắc month_mode ở [notifications](12_NOTIFICATION_RULES.md). Trường title không dùng làm khóa sự kiện.

## Đồng thời và realtime

Mutation tạo nội dung hỗ trợ idempotency; cùng key/body trả kết quả cũ, cùng key/body khác trả 409. Giữ bản ghi dedupe ít nhất 7 ngày cho client retry. Approval và edit có optimistic version, validation trong transaction.

Envelope realtime: `event_id`, `family_id`, `type`, `entity_id`, `server_seq?`, `revision`, `occurred_at`; chỉ tới người được phép, không broadcast contact private. Loại ban đầu: message.created/deleted, moment.created/deleted, event.updated, membership.revoked. Client dedupe event_id, reconnect lấy lịch sử sau cursor, không giả định event tới đúng thứ tự. HTTP persistence là nguồn chuẩn.

## Danh bạ/hồ sơ — bản triển khai đang review

Task 3 bổ sung GET /members, GET /members/{id}, GET /members/{id}/management, POST /members và PATCH /members/{id} sau prefix family. DTO/JSON Schema nằm tại packages/contracts/src/profile.ts; chưa nghiệm thu bản này.

- Danh sách trả members và next_cursor; q chỉ tìm display_name/familiar_name, limit mặc định 20 và tối đa 100. Liên hệ không có trong kết quả tìm kiếm.
- Profile trả biography và contacts đã lọc quyền. Management dành cho admin active quản lý hồ sơ chưa liên kết; không mở quyền xem self contact của người đã liên kết.
- Tạo hồ sơ yêu cầu display_name; sửa yêu cầu version. Các trường cho phép: display_name, familiar_name, hometown, biography, birth_date, birth_year, deceased, contacts. Quan hệ và account link không được sửa qua endpoint này.
- contacts nếu có là thay thế toàn bộ danh sách, tối đa 10, gồm kind/value/visibility; visibility mặc định self. Bỏ contacts khỏi PATCH giữ nguyên danh sách; contacts rỗng xóa các liên hệ trong phạm vi hồ sơ được quyền sửa.
- Thay đổi hồ sơ hoặc liên hệ tăng version và ghi audit cùng transaction. Version cũ trả 409. Ngày sinh giữ dạng YYYY-MM-DD; chỉ biết năm không sinh thêm ngày giả.
