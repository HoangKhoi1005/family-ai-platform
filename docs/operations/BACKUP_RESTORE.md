# Backup và restore drill

## Chuẩn bị age và R2

Tạo age identity trên máy offline do chủ dự án kiểm soát. Chỉ public recipient dạng `age1...` được đặt trong `BACKUP_AGE_RECIPIENT`; private identity không gửi qua chat và không lưu trong repo/VM thường trực. Khi restore, chép identity tạm vào đường dẫn ngoài repo, mode `0400`, khai báo đường dẫn tuyệt đối bằng `AGE_IDENTITY_PATH`, rồi xóa bản tạm sau drill.

Backup bucket dùng token riêng với quyền tối thiểu. Public access tắt; lifecycle xóa object dưới `postgres/` sau **30 ngày**. Media runtime credential không được đọc backup bucket.

## Tạo backup

Chạy từ checkout đúng release. Job dùng `PG*` env, tmpfs `/work`, mã hóa trước upload và chỉ in duration cùng checksum của ciphertext:

```sh
docker compose --env-file /opt/family-ai/secrets/staging.env -f deploy/compose.staging.yaml --profile backup run --rm backup
```

Xác nhận một object mới `postgres/*.dump.age` tồn tại trong private bucket và ghi object timestamp/checksum vào acceptance record. Không tải dump thuần ra disk và không chép object URL vào biên bản.

Nếu dùng systemd timer hằng ngày, unit chỉ gọi đúng command trên từ `/opt/family-ai/repo`, chạy dưới operator được cấp quyền Docker, và gửi exit status/event code tới cảnh báo. Không đưa secret vào unit file hoặc command line. Theo dõi bảy lần chạy liên tiếp trước pilot.

## Restore drill cô lập

Chọn object key cụ thể và target mới theo mẫu `family_stage_YYYYMMDD_restore_drill`. Sửa các biến này trong file secret tạm mode `0600`; không dùng tên database đang chạy. Mount age identity read-only rồi chạy:

```sh
docker compose --env-file /opt/family-ai/secrets/staging.env -f deploy/compose.staging.yaml --profile restore-drill run --rm restore-drill
```

Script từ chối môi trường khác staging, target không có hậu tố `_restore_drill`, target trùng `PGDATABASE`, target đã tồn tại, object key ngoài `postgres/*.dump.age`, hoặc identity không đọc được. Sau restore, script kiểm tra migration table, ba restricted roles và forced RLS trên các bảng tenant nền tảng. Output thành công chỉ gồm `RESTORE_DRILL_COMPLETED`, duration và encrypted checksum.

Sau đó dùng temporary tools container chạy các integration suite auth/tenant/calendar/notification/media với fixture hư cấu và URL trỏ rõ tới database restore. Không chạy application service với restore database. Ghi pass/fail metadata, không ghi row hoặc PII. Việc xóa database drill là maintenance action riêng sau khi chủ dự án duyệt evidence.

## RPO và thất bại

Với lịch backup hằng ngày, RPO mục tiêu là 24 giờ; acceptance record ghi RPO quan sát được từ timestamp object được restore. Backup thất bại không xóa object tốt gần nhất. Thực hiện theo [incident runbook](INCIDENTS.md), sửa nguyên nhân, chạy lại một job và làm restore drill nếu failure liên quan mã hóa, upload hoặc lifecycle.
