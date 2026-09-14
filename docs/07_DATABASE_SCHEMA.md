# Schema tham chiếu và phần đã triển khai

Đã chọn PostgreSQL theo [ADR-001](decisions/ADR-001-monorepo.md). [Migration 0001](../packages/database/migrations/0001_identity.sql) tạo nền tảng users, family_spaces, family_memberships, members, member_account_links và member_contacts. Migrations 0002–0009 bổ sung auth, onboarding, audit và profile; 0010–0011 triển khai quan hệ cùng hàng duyệt; [0012](../packages/database/migrations/0012_calendar_core.sql) triển khai Event, Occurrence và RSVP; 0015–0024 triển khai notification delivery, Event-to-outbox và worker inbox; 0025–0032 trên nhánh feature triển khai media, Moments, Memories, lifecycle helper, guard tham chiếu và cleanup worker. Những bảng khác dưới đây vẫn là thiết kế. Runtime sử dụng RLS theo active membership; contact có quyền owner, quản trị hồ sơ chưa liên kết và claim preview được giới hạn theo ngữ cảnh server. Không dùng FAMILY_001 làm khóa hardcode. Thời điểm hệ thống lưu UTC; ngày lịch lưu kiểu date/field riêng. Bảng có nội dung chỉnh sửa dùng created_at, updated_at, version; audit lưu actor và thời điểm server.

| Bảng                     | Cột chính dự kiến                                                                                                                                           | Ràng buộc quan trọng                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| users                    | id, auth_subject                                                                                                                                            | auth_subject unique; không đưa contact gia phả vào đây                          |
| family_spaces            | id, name, timezone                                                                                                                                          | id là khóa phạm vi, default timezone Asia/Ho_Chi_Minh                           |
| family_memberships       | id, family_id, user_id, role, status                                                                                                                        | unique(family_id,user_id); role admin/member                                    |
| members                  | id, family_id, display_name, birth_date, birth_year, deceased, version                                                                                      | unique(family_id,id); ngày/năm nullable và nhất quán                            |
| member_account_links     | family_id, membership_id, member_id                                                                                                                         | unique theo membership và member; cả hai FK cùng nhà                            |
| member_contacts          | id, family_id, member_id, kind, value, visibility                                                                                                           | visibility chỉ family hoặc self; quyền quản lý hồ sơ chưa liên kết xem bên dưới |
| relationships            | id, family_id, from_member_id, to_member_id, type, subtype, start_date, end_date, removed_at, version                                                       | hai composite FK đến members; chuẩn hóa partnership; chống trùng cạnh           |
| kinship_overrides        | family_id, viewer_member_id, target_member_id, label                                                                                                        | unique cặp trong nhà                                                            |
| invitations              | id, family_id, token_hash, expires_at, used_at, revoked_at                                                                                                  | không lưu token thô; single-use baseline                                        |
| change_requests          | id, family_id, actor_membership_id, target_id, type, proposed_payload, base_version, status, reviewer_id, version                                           | payload kiểm schema; target cùng nhà; quyết định có audit                       |
| events                   | id, family_id, creator_membership_id, member_id, kind, title, calendar_type, recurrence, timezone, date_year/month/day, policies, revision, version, status | composite FK cùng nhà; constraint dương/âm, cả ngày/có giờ và policy            |
| event_occurrences        | id, family_id, event_id, local_date, starts_at, ends_at, event_revision, conversion_version, status                                                         | unique cả starts_at null; chỉ materialize revision hiện hành qua RLS            |
| event_rsvps              | family_id, occurrence_id, membership_id, response, updated_at                                                                                               | PK occurrence + membership; actor chỉ ghi/đọc RSVP của mình, admin đọc active   |
| chat_threads             | id, family_id, kind                                                                                                                                         | MVP một kind=family thread mỗi nhà                                              |
| messages                 | id, family_id, thread_id, sender_membership_id, client_message_id, body, media_id, reply_to_id, server_seq                                                  | unique(thread_id,server_seq), unique(sender_membership_id,client_message_id)    |
| moments                  | id, family_id, author_membership_id, media_id, caption, audience, deleted_at                                                                                | MVP audience=family; không nhận scope tùy biến                                  |
| moment_reactions         | family_id, moment_id, membership_id, reaction                                                                                                               | một reaction/người/moment                                                       |
| media_assets             | id, family_id, owner_membership_id, purpose, object_key, processed_object_key, mime_type, byte_size, status, version                                        | private object key; runtime không tự chuyển ready/rejected                      |
| memories                 | id, family_id, created_by_membership_id, source_moment_id, title, occurred_on, audience, version, deleted_at                                                | source Moment duy nhất trong nhà; audience=family                               |
| memory_items             | id, family_id, memory_id, position, kind, media_id, body, contributed_by_membership_id                                                                      | position 0–49 duy nhất/Memory; kind quyết định media/body                       |
| media_processing_jobs    | id, family_id, media_id, kind, status, attempts, available_at, lease_owner, lease_expires_at                                                                | process/delete/purge_source duy nhất/media; worker lease và retry giới hạn      |
| notification_preferences | family_id, membership_id, reminder_offsets, quiet_hours_start/end, timezone, push_enabled, version                                                          | PK cùng nhà/membership; actor chỉ đọc và sửa preference của mình                |
| push_subscriptions       | id, user_id, device_id, endpoint_secret, revoked_at                                                                                                         | global theo thiết bị; gửi vẫn phải kiểm membership và event access              |
| notifications            | id, family_id, recipient_membership_id, event_id, occurrence_id, event_revision, reminder_offset, kind, channel, read_at                                    | composite source cùng nhà; dedupe theo recipient/occurrence/revision/offset     |
| outbox_jobs              | id, family_id, recipient_membership_id, event/occurrence/revision, offset, channel, due/available/expires_at, attempts, lease, status                       | dedupe unique; runtime không đọc queue; payload chỉ giữ tham chiếu              |
| audit_entries            | id, family_id, actor_id, action, target_type, target_id, occurred_at, change_summary                                                                        | hạn chế đọc; không copy nguyên contact riêng vào audit                          |

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

## Calendar Core

Migration `0012_calendar_core.sql` lưu các phần ngày trong cột có kiểu thay vì JSON tự do. Event dương lịch kiểm ngày tháng và policy 29/2; Event âm lịch bắt buộc month mode/missing-day policy và được service xác minh bằng converter trước khi ghi. Pilot khóa timezone `Asia/Ho_Chi_Minh`. `event_occurrences` giữ revision và version converter; bản ghi cũ được chuyển trạng thái thay vì xóa lịch sử. Unique key dùng `NULLS NOT DISTINCT` để all-day occurrence không bị nhân đôi khi retry.

RLS cho active member đọc Event/Occurrence cùng nhà. Insert Event phải dùng membership của chính actor trong context `calendar_write`; chỉ creator còn active hoặc admin active được sửa/hủy. Occurrence chỉ được ghi cho revision Event hiện hành; admin vẫn có thể xử lý Event do creator đã bị thu hồi. RSVP dùng membership của chính actor, chỉ cho occurrence active và upsert trên primary key. Người dùng thường chỉ đọc RSVP của mình; admin chỉ đọc RSVP của membership còn active.

Migration `0013_calendar_idempotency.sql` lưu khóa retry của thao tác tạo Event theo `(family_id, actor_membership_id, idempotency_key)`, kèm SHA-256 của body và composite FK tới Event cùng nhà. Cùng khóa/cùng body trả Event đã tạo; cùng khóa/body khác trả conflict. Runtime chỉ đọc/ghi khóa của chính active membership trong context `calendar_write`.

Migration `0014_calendar_rsvp_policy.sql` yêu cầu context `calendar_write` cho RSVP và kiểm lại occurrence active thuộc revision hiện hành của Event active ngay trong RLS. HTTP precheck không thay thế hàng rào này.

## Notification delivery foundation

Migrations `0015_notification_delivery.sql`–`0024_notification_worker_role_guard.sql` tạo preference riêng theo membership, inbox source và outbox chỉ giữ tham chiếu Event/Occurrence. Composite foreign key khóa recipient và nguồn vào cùng `family_id`; unique key chống nhân bản theo recipient, occurrence, revision, offset, kind và channel. Queue có due/available/expires, attempts và lease metadata để hai worker dùng `FOR UPDATE SKIP LOCKED` mà không cùng claim một job.

Runtime chỉ đọc và cập nhật preference/inbox của chính active membership, không có quyền đọc hoặc cập nhật trực tiếp outbox. Enqueue dùng context `calendar_write` và helper bảo mật có tham số hẹp để tự lấy active recipients, kiểm Event/Occurrence hiện hành, creator/admin cùng nhà và giao của offset Event với preference từng người. Helper hiện chỉ tạo kênh `in_app`, đặt due theo 09:00 giờ Việt Nam, lùi cùng ngày về 07:00 khi Event bắt đầu sớm và bỏ backlog đã quá hạn. Event create/update/cancel gọi enqueue/cancel trong cùng transaction; revision cũ được giữ nhưng job pending/leased chuyển cancelled.

Login `family_worker` không có table privilege và chỉ execute các hàm claim/deliver/fail. Helper `NOLOGIN` recheck membership, Event/Occurrence revision, preference, due/expiry và quiet hours trước khi upsert inbox. Quiet hours dời job mà không tăng attempt; revoke hoặc revision cũ hủy ngay. Lỗi tạm thời backoff tối đa năm attempt; notification unique key bảo đảm retry không nhân inbox. Admin không được đọc inbox của thành viên khác chỉ vì có vai trò admin; owner connection không dùng trong process worker.

## Quan hệ và đề xuất thay đổi

Migration `0010_relationships.sql` đã triển khai `relationships` và `change_requests` trong nhánh `feat/family-relationships`. Parent-child có hướng từ cha/mẹ đến con và subtype biological/adoptive/unspecified. Partnership chuẩn hóa hai UUID, có subtype married/partner, giữ các giai đoạn đã kết thúc và chỉ cho một giai đoạn đang hiệu lực của cùng cặp.

RLS cho active member đọc quan hệ cùng nhà. Ghi quan hệ chỉ mở trong route context `relationship_decision` cho admin; thành viên không thể đi vòng qua endpoint hồ sơ. Change request lưu pending riêng, người gửi chỉ đọc/hủy đề xuất của mình, admin đọc và quyết định. Approval dùng family advisory lock trước khi kiểm chu trình và apply.

## Tìm kiếm tên trong đợt danh bạ/hồ sơ

Migration 0009_member_profile_unaccent.sql đã bổ sung extension unaccent trong schema public và quyền gọi hàm cho family_runtime. Chỉ dùng để đối chiếu tên khi tìm kiếm; không thay tên lưu trong members. Index members_family_name hiện có giữ thứ tự phân trang theo family_id, display_name, id. API danh bạ vẫn đang triển khai và chờ kiểm chứng.

Tham chiếu: [PostgreSQL 17 unaccent](https://www.postgresql.org/docs/17/unaccent.html).
