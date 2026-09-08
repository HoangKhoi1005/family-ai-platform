# API contract dự kiến

Các routes nghiệp vụ dưới đây là thiết kế, chưa triển khai. Fastify hiện chỉ có `GET /health/live` với schema trong `packages/contracts`; trả status=ok cho process, không khẳng định database/provider sẵn sàng. Routes khác trả 404, không có dev-auth bypass. Thêm OpenAPI cho nghiệp vụ khi có routes thực để tránh tài liệu tuyên bố API chưa tồn tại.

## Quy ước

Prefix `/api/v1/families/{familyId}`. Xác thực session hoặc bearer do stack quyết định; cookie auth phải có CSRF protection phù hợp. Server lấy actor từ credential, không nhận actor/role tin cậy từ body. Resolve active membership trước tài nguyên.

ID production là UUID; ngày `YYYY-MM-DD`, timestamp ISO 8601 UTC; timezone IANA. List dùng cursor opaque và limit mặc định 20, tối đa 100; thứ tự ổn định có ID/sequence. Response chỉ có trường được phép, không serialize DB row trực tiếp.

Error: `{"error":{"code":"VALIDATION_ERROR","message":"Thông tin chưa hợp lệ","request_id":"…","fields":{}}}`. Mã: 400 validation, 401 unauthenticated, 403 hành động không được phép khi tài nguyên đã được phép biết, 404 tài nguyên không có/ngoài phạm vi, 409 conflict, 429 rate limit, 503 unavailable. Không trả stack trace/SQL.

## Routes

| Method / path sau prefix                  | Input chính                                                      | Output và quyền                                           |
| ----------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| GET /members                              | q, cursor, limit                                                 | Hồ sơ tóm tắt được phép; không search qua contact private |
| GET /members/{id}                         | —                                                                | Hồ sơ, contacts đã lọc, version                           |
| PATCH /members/{id}                       | display_name, contacts, version                                  | Owner được liên kết; admin chỉ sửa theo policy; 409 stale |
| GET /relationships                        | root_member_id, depth tối đa 4                                   | Cạnh đã duyệt và node được phép, không trả graph nhà khác |
| POST /change-requests                     | type, target_id?, base_version?, payload                         | 201 pending; payload theo schema type                     |
| POST /change-requests/{id}/decision       | decision approved/rejected, reason?, version                     | Admin; transaction validate + apply + audit; 409 đã xử lý |
| POST /invitations                         | expires_at, intended_member_id?                                  | Admin, token chỉ trả lúc tạo; single-use                  |
| POST /memberships/{id}/approve            | version                                                          | Admin; chỉ active membership, không tự liên kết hồ sơ     |
| POST /memberships/{id}/revoke             | reason?, version                                                 | Admin; chặn self-revoke admin cuối                        |
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

Routes global: `POST /api/v1/invitations/accept` nhận token và credential, tạo pending membership; không trả dữ liệu nhà trước duyệt. `POST/DELETE /api/v1/me/push-subscriptions` chỉ thiết bị của actor. Auth provider callback routes xác định khi chọn stack.

## Claim hồ sơ, thiết kế đợt onboarding

Các route sau prefix family dự kiến: `POST /member-claims` (admin, membership active và Member chưa liên kết), `GET /member-claims/{id}/preview` (chỉ candidate được chỉ định, claim còn hạn), `POST /member-claims/{id}/confirm` (candidate xác nhận version/visibility, atomic link+consume), `POST /member-claims/{id}/decline` (candidate) và `POST /member-claims/{id}/revoke` (admin). Claim preview là quyền hẹp theo [privacy](10_PRIVACY_SECURITY.md), không dùng endpoint hồ sơ thông thường để mở self contact trước link. Tất cả vẫn là thiết kế, chưa triển khai.

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
