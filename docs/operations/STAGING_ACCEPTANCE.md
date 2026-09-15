# Staging acceptance record

Sao chép mẫu này vào kho evidence riêng tư, không commit bản đã điền nếu metadata có thể nhận diện hạ tầng. Không ghi email, token, tên/contact thành viên, signed URL, object URL, ảnh, audio hoặc nội dung gia đình.

## Build và quota

- Ngày/giờ UTC: `REPLACE_WITH_UTC_TIMESTAMP`
- Commit SHA: `REPLACE_WITH_FULL_SHA`
- API image digest: `REPLACE_WITH_SHA256_DIGEST`
- Web image digest: `REPLACE_WITH_SHA256_DIGEST`
- Worker image digest: `REPLACE_WITH_SHA256_DIGEST`
- Backup image digest: `REPLACE_WITH_SHA256_DIGEST`
- OCI shape/quota xác nhận Always Free: `[ ]`
- Budget/usage alert thử: `[ ]`; ngày: `REPLACE_WITH_DATE`

## Database và quyền

- Migration count: `REPLACE_WITH_COUNT`
- Migration replay/checksum: `PASS | FAIL`
- Restricted role check: `PASS | FAIL`
- Tenant/forced-RLS smoke: `PASS | FAIL`
- Restore target có hậu tố `_restore_drill`: `PASS | FAIL`

## HTTPS và luồng sản phẩm hư cấu

- HTTPS hostname: `REPLACE_WITH_TS_NET_HOST` (không ghi auth key)
- Readiness qua web: `PASS | FAIL`
- Synthetic signup/email verification/login: `PASS | FAIL`
- Synthetic invitation/pending/approval/revoke: `PASS | FAIL`
- Synthetic calendar/inbox: `PASS | FAIL`
- Synthetic media upload/process/Moment/Memory: `PASS | FAIL`
- PostgreSQL/API/worker không có public port: `PASS | FAIL`

## Backup và thiết bị

- Backup encrypted checksum: `REPLACE_WITH_SHA256`
- Restore duration seconds: `REPLACE_WITH_INTEGER`
- RPO quan sát được (giờ): `REPLACE_WITH_NUMBER`
- Android PWA/camera/microphone/offline/revoke: `PASS | FAIL | NOT_RUN`
- iPhone PWA/camera/microphone/offline/revoke: `PASS | FAIL | NOT_RUN`
- Backup/availability/disk alert chạy đủ 7 ngày: `PASS | FAIL | IN_PROGRESS`

## Quyết định

- Staging technical gate: `PASS | FAIL`
- Cho phép nhập dữ liệu thật: `NO` cho đến quyết định pilot riêng
- Người duyệt: `REPLACE_WITH_PRIVATE_RECORD_REFERENCE`
- Ghi chú kỹ thuật không nhạy cảm: `REPLACE_WITH_EVENT_CODES_ONLY`
