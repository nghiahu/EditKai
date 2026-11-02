---
name: edit-video-pro
description: Dựng tự động video talking-head theo phong cách có sẵn (s1, m1): cắt khoảng lặng và nói lặp, phụ đề, thẻ tiêu đề, cảnh giải thích, chèn footage, rồi mở editor để người dùng sửa và render mp4. Dùng khi người dùng đưa video gốc và muốn edit theo phong cách s1/m1.
---

# Edit Video Pro

Bạn là **đạo diễn**: bạn phân tích video, viết `plan.json`, chạy các script kiểm tra, rồi để người dùng xem lại trên editor. Mọi lệnh chạy từ thư mục skill này (nơi có `package.json`). Cài đặt lần đầu: xem `README.md`.

Đường dẫn project: `projects/<tên>/`. Tất cả thời gian trong `plan.json` tính bằng **giây theo `cleaned.mp4`**.

## Quy trình

1. **Intake.** Hỏi người dùng (nếu chưa nói): đường dẫn video gốc, khung hình (`9:16`, `16:9`, `1:1`), phong cách (`s1` hoặc `m1`). Rồi chạy:
   `npx tsx src/cli.ts init projects/<tên> --source "<video>" --style <s1|m1> --aspect <9:16|16:9|1:1>`
2. **Làm sạch.** `npx tsx src/cli.ts clean projects/<tên>`. Lệnh chép lời theo từng từ, cắt khoảng lặng và nói lặp, ghi `cleaned.mp4`, `transcript.json` (đã khớp thời gian với `cleaned.mp4`), `cuts.json`. Đọc `cuts.json` và `transcript.raw.json` để kiểm tra không cắt nhầm lời có nghĩa; nếu nghi ngờ thì báo người dùng. Lệnh chỉ tự cắt khoảng lặng và cụm ≥ 2 từ lặp lại; từ đơn lặp lại (ví dụ "từ từ", "dần dần" là từ láy tiếng Việt) **không** bị cắt và được liệt kê trong `repeats-suspect.json` để bạn xem là nói vấp thật hay từ láy. Nếu báo "Không tìm thấy lời nói trong video" thì dừng và nói rõ cho người dùng.
3. **Phân tích.** Đọc `transcript.json`; chia thành các cảnh theo ý (`scenes`): `talking-head` (người nói), `explainer` (đoạn giải thích có đồ họa), `insert` (chèn footage). Cảnh không ngắn hơn `minSceneSec` của phong cách.
4. **Dựng.** Đọc `styles/<style>/rules.md` và `styles/<style>/theme.json`, rồi ghi `projects/<tên>/plan.json` (định dạng bên dưới). Footage người dùng đưa copy vào `projects/<tên>/assets/` và tham chiếu dạng `assets/<file>`.
5. **QA.** `npx tsx src/cli.ts validate projects/<tên>` in JSON `{round, maxRounds, stop?, issues[]}`. Sửa `plan.json` theo từng issue rồi chạy lại. Dừng khi `issues` rỗng hoặc có `"stop": true` (hết 3 vòng): khi đó liệt kê rõ các cảnh báo còn lại cho người dùng. Exit code 1 nghĩa là còn **lỗi** (chặn render).
6. **Review.** `npx tsx src/cli.ts editor projects/<tên>` mở editor ở `http://127.0.0.1:5187`. Người dùng sửa và bấm Lưu. Khi người dùng báo xong, đọc lại `plan.json`.
7. **Render.** `npx tsx src/cli.ts render projects/<tên>` ghi `out.mp4` (hoặc người dùng bấm Render trong editor).

Mỗi bước ghi kết quả ra file trong thư mục project, nên có thể chạy lại riêng từng bước. Nếu một lệnh lỗi, đọc thông báo của nó, báo người dùng bằng lời rõ ràng, không tự bỏ qua.

## Dựng lại sau khi người dùng đã sửa

Layer có `"locked": true` là layer người dùng đã sửa tay. **Không bao giờ ghi đè hoặc xóa chúng.** Khi dựng lại, ghi bản mới vào `projects/<tên>/plan.next.json` (không sửa thẳng `plan.json`) rồi chạy `npx tsx src/cli.ts merge projects/<tên>`: lệnh giữ mọi layer đã khóa, bỏ layer mới trùng id hoặc chồng thời gian lên layer đã khóa cùng track.

## Định dạng `plan.json`

```json
{
  "version": 1,
  "meta": { "source": "cleaned.mp4", "fps": 30, "width": 1080, "height": 1920, "style": "s1" },
  "scenes": [{ "id": "sc1", "start": 0, "end": 6, "role": "talking-head" }],
  "layers": [
    { "id": "c1", "track": "caption", "start": 0.2, "end": 2.0,
      "words": [{ "t": "Quá", "s": 0.2, "e": 0.5, "hl": false }, { "t": "đẳng", "s": 0.5, "e": 0.8, "hl": true }] },
    { "id": "t1", "track": "title", "type": "title-card", "start": 0.5, "end": 3.5,
      "props": { "icon": "video", "title": "EDIT VIDEO", "sub": "Quy trình có sẵn" } }
  ]
}
```

`meta.width/height/fps` lấy từ `projects/<tên>/project.json`. Không ghi màu hay font vào plan (nằm trong `theme.json`); chỉ `override` khi người dùng yêu cầu riêng.

| Track | `type` | `props` |
|---|---|---|
| `caption` | (không có) | dùng `words`: `{t, s, e, hl}` lấy từ `transcript.json`; `start` = `s` của từ đầu, `end` = `e` của từ cuối. Số từ ≤ `limits.maxCaptionWords`. |
| `title` | `title-card` | `{ icon, title, sub? }` |
| `graphic` | `chip-stack` | `{ chips: [{ icon, label, sub? }] }` |
| `graphic` | `explainer-scene` | `{ label?, title, mode?: "full"\|"overlay", body?: { kind, items }, avatar?: boolean }`. `mode` `full` (mặc định) là nền kín; `overlay` là thẻ nằm trên người nói đã tối và mờ. `body.kind`: `list` và `card` (`items`: chuỗi), `waveform` (`items`: nhãn tùy chọn), `progress` (`items`: `{ label, value 0–100 }`), `phone` (`items`: các dòng tin nhắn) |
| `graphic` | `transition` | `{ kind: "zoom"\|"blur"\|"slide"\|"push"\|"flash" }`, dài ≤ 0.6 s; hiệu ứng áp lên video nền (`flash` là nháy sáng), đặt ngay trước cảnh, không chồng layer `graphic` khác |
| `camera` | `zoom-punch` | `{ scale?: số trong (1, 1.5], focus?: { x, y } trong 0–1 }`, 0.8–1.5 s; đẩy camera vào ở từ nhấn mạnh rồi trả lại (mặc định theo phong cách: s1 1.06, m1 1.12) |
| `camera` | `shake` | `{ intensity?: 1–3 }`, rung nhẹ cho khoảnh khắc mạnh |
| `footage` | `footage` | `{ src: "assets/<file>", fit?: "cover"\|"contain" }` |

Icon có sẵn (vẽ dần và nảy khi hiện): `video`, `skill`, `chat`, `clock`, `check`, `typography`, `graphic`, `motion`, `audio`, `sparkles`, `zap`, `scissors`, `wand`, `layers`, `play`, `mic`, `subtitles`, `image`, `bot`, `gauge`, `lightbulb`, `rocket`, `star` (tên lạ, kể cả `lottie:...`, sẽ rơi về `check`).

Camera là một track riêng (`camera`): hai layer cùng track không chồng nhau. Video người nói tự tối và mờ khi có cảnh giải thích `overlay` hoặc footage `fit: "contain"`; không cần khai báo.

Quy tắc cứng (validator kiểm tra): schema đúng; id layer không trùng; `type` đúng bảng trên và đúng track, `props` có các trường bắt buộc (title-card/explainer-scene cần `title`, chip-stack cần `chips[].label`, transition cần `kind`); hai layer **cùng track không chồng thời gian**; footage tồn tại; không layer nào vượt độ dài video. Cảnh báo (không chặn): chữ tràn vùng an toàn, caption quá nhiều từ, cảnh quá ngắn, phụ đề lệch lời đã chép (phụ đề phải khớp từ trong `transcript.json` trong vòng 0.3 s).

## Khi nào dừng và hỏi người dùng

Thiếu video/khung hình/phong cách; video không có lời nói; một lệnh lỗi mà thông báo không đủ để tự sửa; trước khi xóa project hay ghi đè `out.mp4` đã có.
