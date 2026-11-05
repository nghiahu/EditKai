# Edit Video Pro (hướng dẫn cho Codex)

Dự án này là một skill dựng video talking-head tự động. **Quy trình, định dạng `plan.json` và quy tắc cứng nằm trong `SKILL.md`** — đọc toàn bộ file đó trước (bỏ qua phần frontmatter ở đầu file) và làm đúng như vậy; `AGENTS.md` này chỉ tóm tắt để không lệch hai bản.

Quy tắc ngắn:
- Vai trò của bạn là đạo diễn: viết `projects/<tên>/plan.json`, không tự sửa mã nguồn để vượt qua validator.
- Lệnh (chạy từ thư mục này): `npx tsx src/cli.ts <doctor|init|clean|frames|faces|analyze|compose|validate|merge|editor|preview|render> projects/<tên> [--source <video>] [--style s1|m1] [--aspect 9:16|16:9|1:1]`.
- Đọc `styles/<style>/rules.md` và `theme.json` trước khi dựng. Có thêm track `camera` (`zoom-punch`, `shake`), `explainer-scene.mode` (`full`/`overlay`) và nhiều `body.kind`: bảng đầy đủ nằm trong `SKILL.md`. Caption mặc định là `phrase` (nguyên cụm); các kiểu `big`, `label`, `word` và `position`, `emphasis` cũng ở đó.
- Footage của người dùng: `npx tsx src/cli.ts assets add projects/<tên> "<file>" --desc "<mô tả>"` (và `assets list`); đọc `assets.json` để ghép footage với lời nói. Footage có `frame`, `motion`, `from` và mặc định tắt tiếng; thêm các layer `logo-badge`, `prompt-box`, `stat-card`: bảng đầy đủ ở `SKILL.md`.
- Quy trình đạo diễn: `analyze` ghi `storyboard.json` (đề xuất theo từng nhịp), bạn sửa nó rồi đặt `reviewed: true`, `compose` dựng `plan.json` (hoặc `plan.next.json` khi đã có) và `compose-report.json`; chi tiết ở `SKILL.md`. Tự viết `plan.json` vẫn được.
- Flow có ba điểm dừng để người dùng duyệt bằng lời (danh sách đoạn giữ lại trước khi cắt, kế hoạch đạo diễn tóm tắt, xem trước); chi tiết ở `SKILL.md`. Rút gọn nội dung: `pauses` (chỗ ngừng thật), `condense` (đọc `condense-spec.json`, cắt trọn câu, kiểm tra chỗ ghép); sửa lỗi chép lời: `fix-transcript` (đọc `transcript-fixes.json`).
- Layer có `"locked": true` là của người dùng: không ghi đè, không xóa. Dựng lại thì ghi `plan.next.json` rồi chạy `merge`.
- Tối đa 3 vòng `validate`; hết vòng còn cảnh báo thì liệt kê cho người dùng.
- Lệnh lỗi thì báo thông báo của nó bằng lời rõ ràng, không bỏ qua.
- Tiếng hiệu ứng tự có khi dựng (`whoosh`, `pop`, `tick`, `thud`); chỉnh bằng `meta.sfx` (`enabled`, `volume`) hoặc `props.sound: false` trên layer; chi tiết ở `SKILL.md`.
- Đồ họa không che mặt người nói: chạy `faces` sau `clean`/`condense` (ghi `faces.json`, đo cục bộ); `compose` đặt lại thẻ, `validate` cảnh báo `insert-on-face`/`caption-on-face`; `preview` ghi thêm `preview/report.md`; chi tiết ở `SKILL.md`.
- Thêm layer `callout` (vòng khoanh, mũi tên chỉ chỗ, tự đặt `x`, `y`) và `step-number` (số bước nghiêng khổng lồ; `analyze` đề xuất khi lời nói có "thứ hai", "bước 3", "mẹo số 3"); chi tiết ở `SKILL.md`.
- Thêm layer `chart` (cột hoặc đường vẽ dần cho 2–6 số thật, nên có `source`) và tiếng hiệu ứng bám theo giọng nói (`meta.sfx.density`); chi tiết ở `SKILL.md`.
