# ADR-002 — Xác thực email/mật khẩu và biên quyền

Ngày: 2026-09-08. Trạng thái: Baseline được supervisor lựa chọn trong phạm vi triển khai đã duyệt; chưa triển khai.

## Quyết định

Dùng Better Auth 1.7.3 trong Fastify để quản lý danh tính, mật khẩu, xác minh email và session. Ghim phiên bản dependency; PostgreSQL là store. Không dùng plugin Organization/Admin để thay vai trò theo nhà. Membership, invitation, approval, account link và quyền contact thuộc domain của dự án.

Một public origin cho web và `/api/*` qua proxy server; local cũng dùng proxy để tránh cookie khác origin. Fastify chuyển đầy đủ headers và nhiều Set-Cookie qua adapter; không tin Host/X-Forwarded-Host hoặc header định danh do client cung cấp. [Hướng dẫn Fastify](https://better-auth.com/docs/integrations/fastify).

Cookie session HttpOnly, SameSite phù hợp, Secure khi HTTPS; không localStorage session, không cookie cache. API kiểm membership từ database mỗi request thay vì nhét role/family vào session. Thu hồi một nhà không hủy quyền ở nhà khác. [Session](https://better-auth.com/docs/concepts/session-management).

## Database và migration

Giữ UUID users.id. Thêm trường auth cần thiết bằng migration mới; giữ auth_subject cũ nullable/deprecated để không mất danh tính baseline. New users được Better Auth ghi đủ trường; không tạo email giả để backfill bản ghi cũ. Account/session/verification/rate-limit có bảng riêng. Kiểm schema với phiên bản đã ghim, không tự migrate lúc app khởi động. [Schema](https://better-auth.com/docs/concepts/database).

Tách credentials family_auth và family_runtime, đều NOSUPERUSER NOBYPASSRLS, không DDL/owner. Auth chỉ được core auth/global users, không bảng tenant. Runtime không đọc password/session token. Runtime set actor đã xác minh trong transaction-local context; RLS derive membership thật. CLI migration/bootstrap dùng owner chỉ trong thao tác quản trị local được giao, không trong HTTP server.

## Email và bảo vệ endpoint

Nodemailer 10.0.1 đưa email vào Mailpit local; không provider production hoặc email thật. Theo API thư viện, sendOnSignUp/sendOnSignIn thuộc emailVerification, requireEmailVerification thuộc emailAndPassword. Password reset thu hồi sessions. Không log URL/token/email/nội dung SMTP; lỗi delivery chỉ log mã chung và có cách resend. [Email](https://better-auth.com/docs/concepts/email), [SMTP](https://nodemailer.com/smtp), [Mailpit](https://mailpit.axllent.org/docs/install/docker/).

Giữ origin/CSRF checks của Better Auth; endpoint nghiệp vụ có kiểm Origin riêng cho mutation cookie-auth. Không coi CORS là CSRF. Bật rate limits cả môi trường local có kiểm thử; không tin forwarded IP khi chưa có proxy được cấu hình. [Rate limits](https://better-auth.com/docs/concepts/rate-limit).

## Hệ quả và giới hạn

Thêm thư viện có lifecycle/schema cần theo dõi khi nâng phiên bản. Email/mật khẩu chưa được kiểm chứng với 15 người dùng thật. Hộp thư local chỉ phục vụ phát triển, không phải delivery service. Reset phải có test replay/expiry; xác minh email phải kiểm hành vi thực tế của phiên bản đã ghim, không tự tuyên bố mọi token thư viện là one-time hay hashed nếu chưa kiểm chứng.
