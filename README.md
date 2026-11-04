# Edit Video Pro

Skill dựng video talking-head tự động (phong cách `s1`, `m1`) kèm editor local để xem lại và sửa trước khi render. Thiết kế: `../../Tài liệu/2026-11-02-edit-video-pro-design.md`.

## Cài đặt (một lần)

Cần Node 22+, ffmpeg/ffprobe trong PATH, Python 3.11.

```bash
npm install
python -m venv .venv
.venv/Scripts/python -m pip install faster-whisper
```

Kiểm tra máy đã đủ chưa: `npx tsx src/cli.ts doctor` (báo thiếu gì và cách sửa). Đăng ký skill cho Claude Code: `node scripts/install-skill.mjs` (liên kết `~/.claude/skills/edit-video-pro` tới thư mục này; `--dry-run` để xem trước, `--remove` để gỡ). Chạy CLI từ thư mục khác: `node <thư mục skill>/scripts/ev.mjs <lệnh> ...`.

Remotion tải trình duyệt headless ở lần render đầu tiên. Model chép lời mặc định là `small` (đặt `EDITKAI_WHISPER_MODEL=base` để chạy nhanh hơn, kém chính xác hơn).

## Dùng

Nhờ Claude Code (skill `edit-video-pro`, xem `SKILL.md`) hoặc Codex (xem `AGENTS.md`) chạy quy trình, hoặc tự chạy từng bước:

```bash
npx tsx src/cli.ts init projects/demo --source "video.mp4" --style m1 --aspect 9:16
npx tsx src/cli.ts assets add projects/demo "man-hinh.mp4" --desc "quay man hinh editor"   # footage de chen (tuy chon)
npx tsx src/cli.ts clean projects/demo
npx tsx src/cli.ts analyze projects/demo   # ghi storyboard.json (đề xuất theo từng nhịp)
# AI sửa projects/demo/storyboard.json rồi đặt reviewed: true
npx tsx src/cli.ts compose projects/demo   # dựng plan.json + compose-report.json
npx tsx src/cli.ts validate projects/demo
npx tsx src/cli.ts merge projects/demo      # sau khi dựng lại: gộp plan.next.json, giữ layer đã khóa
npx tsx src/cli.ts editor projects/demo     # http://127.0.0.1:5187
npx tsx src/cli.ts render projects/demo
```

## Phát triển

- `npm test` chạy toàn bộ test (các file test chạy lần lượt vì Remotion dùng chung cache webpack; toàn bộ mất khoảng 1 phút).
- Thêm phong cách: tạo `styles/<tên>/theme.json` và `styles/<tên>/rules.md`; thêm component vào `remotion/components/` và đăng ký trong `remotion/registry.ts` nếu cần.
- `scripts/analyze-demo.ts <video> <outDir>` lấy mốc cắt và khung hình dày từ một video demo để viết `rules.md`.
- Chuyển động: các hàm nảy/hiện/thoát nằm trong `remotion/motion/`, thông số theo phong cách trong khối `motion` của `theme.json`. `tests/remotion/helper.ts` có `filmstrip(plan, frames, out)` để ghép dãy khung hình thành một ảnh và xem chuyển động bằng mắt.
- Caption có bốn kiểu (`phrase` mặc định, `word`, `big`, `label`); `remotion/components/caption/` chứa từng renderer và `src/plan/captionProps.ts` đọc `props` với giá trị mặc định an toàn.
- Chưa có: nhiều lớp video chồng nhau, chỉnh sóng âm/màu, sửa bằng ô chat, chỉnh vị trí chữ bằng kéo thả, âm thanh hiệu ứng, cảnh mở/kết, icon 3D.
