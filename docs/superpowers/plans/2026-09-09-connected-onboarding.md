# Connected onboarding implementation plan

Goal: luồng thật đăng ký → xác minh → nhận lời mời → duyệt → nhận hồ sơ → cập nhật → Nhà mình.
Architecture: web gọi API cùng origin, server và RLS quyết định quyền. Cây minh họa riêng, không giả dữ liệu quan hệ thật.
Stack: Next.js, Better Auth, Fastify, PostgreSQL hiện có. Không dependency mới.
Spec: [onboarding](../specs/2026-09-08-onboarding.md). Chủ dự án đã giao triển khai toàn luồng trong phiên này, chưa nghiệm thu thẩm mỹ. Thực hiện trực tiếp theo lựa chọn tiết kiệm context; không commit/push.

- [x] API: GET families/:familyId/onboarding chỉ trả link/claim của actor active, không contacts. Test guest/pending/cross-family và actor khác.
- [x] Web auth: /login, /register, /verify-email, /forgot-password, /reset-password. Better Auth endpoints, thông báo tiếng Việt, không lưu mật khẩu. Invite token giữ sessionStorage riêng cho tab, xóa URL sau nhập, xóa khi consume/logout.
- [x] Web /app: kiểm /me, trạng thái pending/revoked/no-family, refresh định kỳ và khi focus. Active xem Nhà mình, danh bạ/API, hồ sơ và claim. Refresh/403 xóa dữ liệu cũ; không cache PII trong storage.
- [x] Admin: tạo lời mời copy thủ công, approve/revoke, tạo Member, chỉ định claim tới active membership. Không gửi email người thật.
- [x] Verification: lint/typecheck/build, integration thật, browser auth/membership flow qua API thật nếu local services có sẵn; review mobile/desktop. Ghi rõ giới hạn.

Claim giữ semantics đang triển khai: admin chỉ định, người nhận xác nhận ownership và visibility. Chưa có self-service request backend; UI giải thích quản trị viên cần chỉ định hồ sơ.
