# Edit Video Pro (hướng dẫn cho Codex)

Dự án này là một skill dựng video talking-head tự động. **Quy trình, định dạng `plan.json` và quy tắc cứng nằm trong `SKILL.md`** — đọc toàn bộ file đó trước (bỏ qua phần frontmatter ở đầu file) và làm đúng như vậy; `AGENTS.md` này chỉ tóm tắt để không lệch hai bản.

Quy tắc ngắn:
- Vai trò của bạn là đạo diễn: viết `projects/<tên>/plan.json`, không tự sửa mã nguồn để vượt qua validator.
- Lệnh (chạy từ thư mục này): `npx tsx src/cli.ts <init|clean|analyze|compose|validate|merge|editor|render> projects/<tên> [--source <video>] [--style s1|m1] [--aspect 9:16|16:9|1:1]`.
- Đọc `styles/<style>/rules.md` và `theme.json` trước khi dựng. Có thêm track `camera` (`zoom-punch`, `shake`), `explainer-scene.mode` (`full`/`overlay`) và nhiều `body.kind`: bảng đầy đủ nằm trong `SKILL.md`. Caption mặc định là `phrase` (nguyên cụm); các kiểu `big`, `label`, `word` và `position`, `emphasis` cũng ở đó.
- Footage của người dùng: `npx tsx src/cli.ts assets add projects/<tên> "<file>" --desc "<mô tả>"` (và `assets list`); đọc `assets.json` để ghép footage với lời nói. Footage có `frame`, `motion`, `from` và mặc định tắt tiếng; thêm các layer `logo-badge`, `prompt-box`, `stat-card`: bảng đầy đủ ở `SKILL.md`.
- Quy trình đạo diễn: `analyze` ghi `storyboard.json` (đề xuất theo từng nhịp), bạn sửa nó rồi đặt `reviewed: true`, `compose` dựng `plan.json` (hoặc `plan.next.json` khi đã có) và `compose-report.json`; chi tiết ở `SKILL.md`. Tự viết `plan.json` vẫn được.
- Layer có `"locked": true` là của người dùng: không ghi đè, không xóa. Dựng lại thì ghi `plan.next.json` rồi chạy `merge`.
- Tối đa 3 vòng `validate`; hết vòng còn cảnh báo thì liệt kê cho người dùng.
- Lệnh lỗi thì báo thông báo của nó bằng lời rõ ràng, không bỏ qua.
