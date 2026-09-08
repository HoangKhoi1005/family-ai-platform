# Hướng dẫn cho coding agent

## Đọc trước khi làm

1. [CURRENT_STATE.md](CURRENT_STATE.md): tiến độ thực tế, việc tiếp theo, giới hạn kiểm chứng.
2. [docs/00_PROJECT_CONTEXT.md](docs/00_PROJECT_CONTEXT.md): mục tiêu và phạm vi.
3. [docs/14_DECISION_LOG.md](docs/14_DECISION_LOG.md): quyết định hiện hành và trạng thái.
4. [docs/06_DOMAIN_MODEL.md](docs/06_DOMAIN_MODEL.md) và [docs/10_PRIVACY_SECURITY.md](docs/10_PRIVACY_SECURITY.md) khi làm dữ liệu, API, AI hoặc phân quyền.
5. Spec tính năng liên quan trong [specs](specs/README.md); đọc UX và tokens khi làm giao diện.

Không nạp toàn bộ tài liệu vào mọi task. Dùng [mục lục](docs/INDEX.md) để chọn nguồn đúng. Repo là bộ nhớ có phiên bản; lịch sử chat chỉ là đầu vào cần đối chiếu. Chỉ tuyên bố đã đọc những file thực sự đã đọc.

## Trước khi code

- Kiểm tra hướng dẫn cục bộ, working tree và implementation hiện có; bảo toàn thay đổi của người dùng.
- Tóm tắt ngắn phạm vi tác động, phụ thuộc và cách kiểm chứng, rồi tiếp tục thực hiện trong phạm vi đã được giao. Không biến bước này thành cửa xin phép cho mọi sửa đổi.
- Nếu tài liệu và code mâu thuẫn, ghi nhận: code chứng minh hành vi hiện tại, spec quy định hành vi mong muốn. Không tự tuyên bố một trong hai đã đúng.
- Với xung đột về mục tiêu, riêng tư hoặc thay đổi lớn chưa có căn cứ, hỏi người dùng đúng điểm còn thiếu; vẫn làm phần độc lập.

## Bất biến

- Pilot **15 người**; User khác Member; dữ liệu gia đình phải được phân vùng và kiểm quyền phía máy chủ.
- Không hardcode một family ID làm cơ chế bảo mật. `family_id` do server xác thực, không tin giá trị client.
- Quan hệ thuộc Member; không tạo `users.father_id`. Không suy luận quan hệ hoặc lịch âm bằng LLM.
- AI không có SQL tùy ý hay quyền đọc chat mặc định. Bộ lọc quyền áp dụng trước truy xuất, tổng hợp, tạo trích dẫn và cache.
- Không lưu dữ liệu thật/secret trong repo, log hoặc fixture. Xem [NEVER_DO.md](NEVER_DO.md).
- Navigation, domain và baseline bảo mật có thể thay đổi qua quyết định có ghi lý do; không tự đổi để làm một task dễ hơn.

## Quy ước triển khai

- Stack monorepo: npm workspaces + Turborepo, TypeScript, Next.js, Fastify, PostgreSQL; xem [ADR-001](docs/decisions/ADR-001-monorepo.md). Auth chọn Better Auth theo [ADR-002](docs/decisions/ADR-002-authentication.md); trạng thái triển khai tra CURRENT_STATE. Hosting, storage và LLM chưa chọn. Không tự thêm Flutter/Supabase như đã có quyết định.
- Dùng định danh tiếng Anh nhất quán với glossary; UI tiếng Việt UTF-8. Dùng design tokens cho giá trị thiết kế dùng lại.
- Khi chọn stack, bổ sung lệnh build/lint/test thực sự vào README; không bịa lệnh hoặc kết quả.
- Migration có phiên bản; server validation, authorization và constraints đi cùng tính năng dữ liệu.
- Test dựa trên rủi ro và business rules, đặc biệt truy cập chéo nhà, thu hồi quyền, lịch âm, cây quan hệ và retry realtime. Không thêm test chỉ để lặp lại code.
- Đã được chủ dự án cho phép dùng subagents cho feature nhiều bước theo [quy trình Superpowers](docs/SUPERPOWERS.md). Task nhỏ làm trực tiếp. Với SDD: một implementer tại một thời điểm rồi reviewer; chỉ chạy song song điều tra/review độc lập. Coordinator giữ contracts/migrations/lockfile và tích hợp. Worker không tự tạo agent con. Mọi agent đọc cùng baseline và phạm vi file được giao.

## Chất lượng UX/UI bắt buộc

- Chủ dự án yêu cầu tránh giao diện AI slop/generic AI app. Đây là tiêu chí nghiệm thu, không chỉ là sở thích màu sắc. Đọc [UX/UI](docs/05_UX_UI_GUIDELINES.md) trước mọi task giao diện.
- Hướng đang thử: Album gia đình Việt đương đại. Con người, ảnh và nội dung quyết định bố cục; không dùng một mẫu dashboard/card grid cho mọi màn hình.
- Không tự thêm gradient tím xanh, glassmorphism, emoji trang trí, số liệu giả, nút AI nổi hoặc hiệu ứng không phục vụ thao tác.
- Bản mẫu Nhà mình và hồ sơ phải được chủ dự án duyệt trực quan trước khi triển khai hàng loạt màn hình nghiệp vụ. Phần backend độc lập tiếp tục trong phạm vi đã duyệt.
- Review giao diện chạy thực tế ở desktop/mobile, tên tiếng Việt dài, thiếu ảnh, trạng thái lỗi/rỗng, chữ lớn và bàn phím. Build/test đạt không thay thế visual review.
- Điều phối theo lựa chọn của chủ dự án: supervisor Astra, subagents GPT-5.6 Luna với reasoning xhigh; không tự đổi model để tăng chi phí. Một implementer tại một thời điểm, reviewer độc lập.

## Bàn giao task

- Chạy kiểm tra phù hợp; ghi rõ đã chạy, chưa chạy, lỗi và giới hạn. Tài liệu: `python scripts/validate_brain.py`.
- Cập nhật CURRENT_STATE với kết quả có bằng chứng và bước tiếp theo. Cập nhật spec/contract nếu hành vi đổi.
- Chỉ thêm decision khi có quyết định; thay đổi lớn tăng context version theo [quy tắc](docs/INDEX.md).
- Báo ngắn thay đổi, kiểm chứng, rủi ro còn lại. Không commit, push, deploy hoặc gửi tin ra ngoài nếu nhiệm vụ chưa giao việc đó.

<!-- CODEGRAPH_START -->

## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
