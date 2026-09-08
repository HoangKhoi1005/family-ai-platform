# Schema tham chiếu và phần đã triển khai

Đã chọn PostgreSQL theo [ADR-001](decisions/ADR-001-monorepo.md). [Migration 0001](../packages/database/migrations/0001_identity.sql) tạo nền tảng users, family_spaces, family_memberships, members, member_account_links và member_contacts. Migrations 0002–0005 bổ sung auth; 0006–0008 bổ sung invitations, member_claims, audit_entries, runtime policies theo actor/membership và helper metadata claim. Các bảng tính năng khác dưới đây vẫn là thiết kế. Runtime sử dụng RLS theo active membership; contact có quyền owner, quản trị hồ sơ chưa liên kết và claim preview được giới hạn theo ngữ cảnh server. Không dùng FAMILY_001 làm khóa hardcode. Thời điểm hệ thống lưu UTC; ngày lịch lưu kiểu date/field riêng. Bảng có nội dung chỉnh sửa dùng created_at, updated_at, version; audit lưu actor và thời điểm server.

| Bảng                     | Cột chính dự kiến                                                                                                   | Ràng buộc quan trọng                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| users                    | id, auth_subject                                                                                                    | auth_subject unique; không đưa contact gia phả vào đây                          |
| family_spaces            | id, name, timezone                                                                                                  | id là khóa phạm vi, default timezone Asia/Ho_Chi_Minh                           |
| family_memberships       | id, family_id, user_id, role, status                                                                                | unique(family_id,user_id); role admin/member                                    |
| members                  | id, family_id, display_name, birth_date, birth_year, deceased, version                                              | unique(family_id,id); ngày/năm nullable và nhất quán                            |
| member_account_links     | family_id, membership_id, member_id                                                                                 | unique theo membership và member; cả hai FK cùng nhà                            |
| member_contacts          | id, family_id, member_id, kind, value, visibility                                                                   | visibility chỉ family hoặc self; quyền quản lý hồ sơ chưa liên kết xem bên dưới |
| relationships            | id, family_id, from_member_id, to_member_id, type, subtype, start_date, end_date                                    | hai composite FK đến members; check khác nhau; chống trùng cạnh                 |
| kinship_overrides        | family_id, viewer_member_id, target_member_id, label                                                                | unique cặp trong nhà                                                            |
| invitations              | id, family_id, token_hash, expires_at, used_at, revoked_at                                                          | không lưu token thô; single-use baseline                                        |
| change_requests          | id, family_id, actor_membership_id, target_id, type, proposed_payload, base_version, status, reviewer_id            | payload kiểm schema; target luôn resolve trong family                           |
| events                   | id, family_id, title, member_id, calendar_type, date_parts, recurrence, timezone, lunar_policy, version, creator_id | date_parts có schema theo loại; không JSON tùy ý không kiểm tra                 |
| event_occurrences        | id, family_id, event_id, local_date, starts_at, event_revision, status                                              | unique(event_id,local_date,event_revision); FK cùng nhà                         |
| event_rsvps              | family_id, occurrence_id, membership_id, response                                                                   | unique occurrence + người, response yes/no/maybe                                |
| chat_threads             | id, family_id, kind                                                                                                 | MVP một kind=family thread mỗi nhà                                              |
| messages                 | id, family_id, thread_id, sender_membership_id, client_message_id, body, media_id, reply_to_id, server_seq          | unique(thread_id,server_seq), unique(sender_membership_id,client_message_id)    |
| moments                  | id, family_id, author_membership_id, media_id, caption, audience, deleted_at                                        | MVP audience=family; không nhận scope tùy biến                                  |
| moment_reactions         | family_id, moment_id, membership_id, reaction                                                                       | một reaction/người/moment                                                       |
| media_assets             | id, family_id, uploader_membership_id, object_key, mime, bytes, status                                              | private object key, kiểm owner/scope của nội dung liên kết                      |
| notification_preferences | family_id, membership_id, enabled_offsets, quiet_hours, push_enabled                                                | unique membership; schema kiểm giờ                                              |
| push_subscriptions       | id, user_id, device_id, endpoint_secret, revoked_at                                                                 | global theo thiết bị; gửi vẫn phải kiểm membership và event access              |
| notifications            | id, family_id, recipient_membership_id, source_id, kind, dedupe_key, status, read_at                                | dedupe_key unique; source resolve cùng nhà                                      |
| outbox_jobs              | id, family_id, kind, payload_ref, dedupe_key, due_at, attempts, status                                              | dedupe_key unique, không nhét contact/chat thô vào payload                      |
| audit_entries            | id, family_id, actor_id, action, target_type, target_id, occurred_at, change_summary                                | hạn chế đọc; không copy nguyên contact riêng vào audit                          |

`member_contacts.visibility`: **family** = mọi active member trong nhà; **self** = chỉ account liên kết hồ sơ. Người quản trị hồ sơ chưa có account có quyền quản lý contact của hồ sơ đó, nhưng trước khi liên kết phải giải quyết quyền sở hữu; sau liên kết admin không được đọc self contact qua quyền admin đơn thuần.

## Isolation phải có bằng chứng

- Bảng thuộc nhà có `family_id NOT NULL`; FamilySpace tự là gốc. Users và push subscriptions là global có kiểm owner riêng.
- Parent có unique(family_id,id); child FK(family_id,parent_id) tham chiếu cặp đó. `reply_to_id` còn phải thuộc **cùng thread**, không chỉ cùng nhà.
- Nếu chọn PostgreSQL, bật RLS cho bảng tenant, chính sách lấy User đã xác thực và active membership. RLS không tự thay quyền cấp trường: contact riêng cần bảng/policy riêng hoặc query DTO được lọc.
- Service/worker có credential đặc quyền phải vẫn dùng scope và explicit authorization; không giả định RLS bảo vệ connection bypass.
- Chống chu trình parent-child trong transaction với khóa đủ để hai ghi đồng thời không tạo chu trình. Chỉ check ở UI là không đủ.
- Index theo access pattern: (family_id,updated_at,id), message(thread_id,server_seq), occurrence(family_id,local_date), jobs(status,due_at).

## Vòng đời và thay đổi

Thiết kế soft delete chỉ khi cần khôi phục/audit, không dùng làm lý do giữ PII vô thời hạn. Xóa nội dung kéo theo media, job, index/cache tương ứng theo [privacy](10_PRIVACY_SECURITY.md). Không cascade xóa toàn cây chỉ vì User bị xóa. Migration có checksum và transaction; không sửa migration đã áp dụng, tạo migration mới. Xem CURRENT_STATE về kết quả chạy local, không đồng nghĩa đã triển khai production.

Household, Branch, Memory, Document và embedding được hoãn; chỉ tạo bảng khi feature được đưa vào phạm vi.
