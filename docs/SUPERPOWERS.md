## Quy trình hiện hành — 2026-09-09

Theo phê duyệt mới: làm trực tiếp mặc định để giảm chi phí context. Chỉ dùng subagent khi công việc độc lập đủ lớn hoặc cần review bảo mật/migration; không tạo vòng review agent cho mọi task. Khi cần subagent vẫn dùng Luna xhigh. Quy tắc này thay thế mặc định SDD cho mọi feature nhiều bước ở phần lịch sử bên dưới.

# Superpowers và cách làm việc bằng subagents

## Trạng thái cài đặt

Đã cài 14 skills vào thư mục skills cá nhân của Codex trên máy hiện tại, từ `obra/superpowers` commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`. Nguồn và danh sách ở [superpowers.lock.json](superpowers.lock.json). Đây là cài **skills**, không phải cài plugin marketplace hoặc session hooks. Skills có thể được nhận diện từ lượt mới; nếu chưa xuất hiện, mở phiên mới.

Các tệp skills cá nhân không nằm trong Git của Family AI. Người clone repo trên máy khác chạy [script cài đặt](../scripts/setup-superpowers.ps1) bằng PowerShell; script clone đúng commit và chỉ thêm thư mục chưa có. Nếu đã có skill cùng tên, script dừng trước khi copy để tránh ghi đè tùy biến. Thư mục tải tạm được giữ và in đường dẫn cho người dùng kiểm tra; không tự xóa dữ liệu.

```powershell
powershell -NoProfile -File scripts/setup-superpowers.ps1
```

Không cần cài npm dependency cho Superpowers. Scripts hỗ trợ của upstream có thể cần Bash/Python; trên Windows kiểm tra yêu cầu của skill trước khi chạy, dùng Git Bash khi script yêu cầu Bash. Việc cài skills thành công không có nghĩa mọi helper upstream đã được kiểm thử trên máy này.

## Nguồn chuẩn và mức tự động

AGENTS.md và Project Brain giữ domain, quyền riêng tư, scope và tiến độ. Superpowers giúp lập kế hoạch, debug và review. Trước khi áp dụng skill, đọc SKILL.md đầy đủ và những tham chiếu bắt buộc. Khi spec đã đủ, dùng nó làm đầu vào; không lặp lại discovery chỉ vì task mới. Chỉ brainstorm phần yêu cầu còn thiếu.

Mặc định task nhỏ làm trực tiếp; feature nhiều bước dùng writing-plans rồi subagent-driven-development. Skill SDD phiên bản đã ghim yêu cầu **một implementer tại một thời điểm**, sau đó review; không gọi nhiều implementer đồng thời và tuyên bố đang theo nguyên bản SDD. dispatching-parallel-agents dùng riêng cho điều tra/review độc lập, không sửa chung file.

Giới hạn đề xuất: một coordinator + tối đa ba subagents đang hoạt động. Giới hạn thực tế theo công cụ; không bảo đảm có đủ slot hoặc một model cụ thể. Worker không tự tạo agent con. Không tự tăng model/chi phí ngoài quyền được cấp bởi phiên và công cụ.

## Phân công cho tính năng tiếp theo

Chủ dự án đã chọn supervisor Astra ở mức nhẹ nhàng và subagents **GPT-5.6 Luna xhigh** cho triển khai/review chuyên sâu. Supervisor không tự thay mức reasoning của phiên chính trong UI. Khi dispatch, truyền model và reasoning rõ ràng; không tự nâng model ngoài lựa chọn này.

Đợt hiện tại theo [scope onboarding](superpowers/specs/2026-09-08-onboarding.md). [Plan bản mẫu](superpowers/plans/2026-09-08-design-preview.md) có gate duyệt trực quan của chủ dự án trước khi làm hàng loạt màn hình; backend độc lập tiếp tục trong phạm vi đã duyệt. Ledger riêng từng plan tại `.superpowers/sdd/` để phục hồi tiến độ sau đổi context.

1. Coordinator đọc spec admin/member-profile, chốt lựa chọn auth còn thiếu và contracts, lập plan có thứ tự phụ thuộc.
2. Backend implementer làm auth/membership/runtime RLS trong phạm vi được giao; báo test và những gì chưa kiểm được.
3. Reviewer kiểm spec và quyền: hai nhà, revoked/pending, admin không vượt contact self. Coordinator xử lý findings trước khi chuyển task.
4. Frontend implementer dùng contract đã chốt để làm login/chờ duyệt/hồ sơ; reviewer kiểm luồng, trạng thái lỗi và accessibility.
5. Coordinator tích hợp, chạy gate phù hợp và cập nhật CURRENT_STATE. Commit/push theo phạm vi người dùng giao cho phiên đó.

Root package.json/lockfile, migrations, contracts và decision log có một người chịu trách nhiệm tại mỗi thời điểm. Khi các agent dùng chung working tree, mọi thay đổi hiện ngay cho nhau; không coi từng agent tự có checkout riêng. Chỉ tạo worktree từ baseline đã commit; không bỏ quên file untracked. Worktree tách biệt có dependencies, env và port riêng khi cần chạy app.

## Giao việc mẫu

```text
Đọc AGENTS.md, CURRENT_STATE.md và docs/SUPERPOWERS.md.
Thực hiện feature hồ sơ theo specs/member-profile/README.md.
Dùng Superpowers writing-plans và subagent-driven-development khi khả dụng.
Lập plan từ spec hiện có; chỉ hỏi điểm còn thiếu ảnh hưởng hành vi/quyền.
Một implementer tại một thời điểm, review sau mỗi task.
Kiểm thử quyền bằng hai gia đình giả. Không đưa dữ liệu thật vào Git.
Cập nhật CURRENT_STATE và báo bằng chứng kiểm thử.
Chưa commit/push nếu tôi chưa giao trong phiên này.
```

Với bug: “Dùng systematic-debugging, lấy log gốc và kiểm giả thuyết trước khi sửa; dùng reviewer nếu thay đổi ảnh hưởng nhiều module.” Với task nhỏ: “Sửa trong phạm vi này và chạy kiểm tra liên quan, không cần subagents.”

## Cập nhật và gỡ

Không tự cập nhật main mỗi phiên. Khi muốn nâng version: review upstream diff, chọn commit mới, cập nhật lock và cài vào thư mục thử khác bằng `-Destination`; kiểm trước khi thay bản đang dùng. Có thể gỡ bằng cách loại bỏ đúng những thư mục skills đã cài khỏi thư mục cá nhân sau khi kiểm đường dẫn; không xóa toàn bộ thư mục skills. Xóa liên kết hướng dẫn trong repo không gỡ bản cài cá nhân.

Superpowers không sửa lỗi sandbox, refresh token hoặc cổng bận. `spawn EPERM` trong terminal của agent chưa đủ chứng minh lỗi terminal người dùng cùng nguyên nhân; cần log trước dòng tổng kết Turbo.
