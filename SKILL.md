---
name: edit-video-pro
description: Dựng tự động video talking-head theo phong cách có sẵn (s1, m1): cắt khoảng lặng và nói lặp, phụ đề, thẻ tiêu đề, cảnh giải thích, chèn footage, rồi mở editor để người dùng sửa và render mp4. Dùng khi người dùng đưa video gốc và muốn edit theo phong cách s1/m1.
---

# Edit Video Pro

Bạn là **đạo diễn**: bạn phân tích video, viết `plan.json`, chạy các script kiểm tra, rồi để người dùng xem lại trên editor. Cài đặt lần đầu: xem `README.md`.

**Chạy lệnh.** Thư mục skill là thư mục ghi ở dòng "Base directory for this skill" khi skill được nạp (nơi có `package.json`). Các lệnh trong tài liệu này viết dạng `npx tsx src/cli.ts <lệnh> ...` và chạy khi đang đứng trong thư mục skill. Từ bất kỳ thư mục nào khác, dùng `node "<thư mục skill>/scripts/ev.mjs" <lệnh> ...` thay cho `npx tsx src/cli.ts <lệnh> ...`: thư mục project (`projects/<tên>`) vẫn tính từ thư mục skill, còn file đầu vào bạn đưa (`--source`, file của `assets add`) tính từ thư mục bạn đang đứng.

**Lần đầu trên một máy:** chạy `node "<thư mục skill>/scripts/ev.mjs" doctor`. Lệnh kiểm tra Node, thư viện npm, ffmpeg, ffprobe, faster-whisper, chỗ trống ổ đĩa và rác còn sót trong thư mục tạm; thiếu gì nó nói cách sửa. Nếu `doctor` báo lỗi thì dừng và nói người dùng sửa trước. Để Claude Code tìm thấy skill ở mọi phiên: `node scripts/install-skill.mjs` (tạo liên kết `~/.claude/skills/edit-video-pro`; gỡ bằng `--remove`).

Đường dẫn project: `projects/<tên>/`. Tất cả thời gian trong `plan.json` tính bằng **giây theo `cleaned.mp4`**.

## Quy trình

Quy trình có **ba điểm dừng** để người dùng duyệt (điểm dừng 1, 2, 3 bên dưới): làm sai ở đó thì tốn công nhất. Người dùng có thể nói trước "bỏ điểm dừng X" thì làm theo; mặc định là dừng. Người dùng duyệt bằng lời: bạn **tóm tắt bằng tiếng thường**, không bắt họ đọc JSON.

1. **Nhận yêu cầu.** Hỏi một lượt (nếu chưa nói): đường dẫn video gốc; khung hình (`9:16`, `16:9`, `1:1`); phong cách (`s1` hoặc `m1`); **độ dài mong muốn** (giữ nguyên hay rút còn bao nhiêu); có footage để chèn không (quay màn hình, video dọc ngắn, ảnh chụp, logo); có tên kênh hoặc logo cần đặt không. Rồi chạy:
   `npx tsx src/cli.ts init projects/<tên> --source "<video>" --style <s1|m1> --aspect <9:16|16:9|1:1>`
   **Nguồn khác hình dạng khung** (ví dụ video ngang 16:9 cho khung dọc 9:16): `init` in một dòng nói rõ chuyện gì xảy ra. Mặc định là `cover`: hình được phóng cho tràn khung và cắt hai bên, lấy chính giữa. Chỉnh bằng `--focus x,y` (0 đến 1; `0.3,0.5` lấy lệch sang trái, `1,0.5` sát mép phải) khi người nói không ở giữa, hoặc `--fit contain` để giữ nguyên cả hình, chừa dải đen trên dưới. Giá trị này nằm trong `project.json` và được chép vào `meta.fit`, `meta.focus` của `plan.json` (sửa tay ở đó cũng được). Xem `preview` rồi mới chốt `focus`; phép đo độ sáng nền của phụ đề đã tính theo phần hình thật sự nằm trong khung. Chưa có chế độ làm mờ nền (`blur`).
   Lần đầu trên một máy chạy `doctor` (xem trên). Mỗi footage đăng ký một lần, kèm mô tả nội dung bằng lời của người dùng:
   `npx tsx src/cli.ts assets add projects/<tên> "<file>" --desc "<mô tả>"` (xem mục `assets.json` bên dưới). Không có footage thì dùng `logo-badge`, `prompt-box`, `stat-card`, `title-card`.
   Muốn nhìn hình thật của video trước khi quyết định (người nói đứng ở đâu, `focus`): sau `clean` chạy `npx tsx src/cli.ts frames projects/<tên> [--count N]` (mặc định 12 khung đều nhau của `cleaned.mp4` vào `frames/`, kèm `frames/sheet.png`).
2. **Làm sạch.** `npx tsx src/cli.ts clean projects/<tên>` chép lời theo từng từ, cắt khoảng lặng và nói lặp, ghi `cleaned.mp4`, `transcript.json` (khớp thời gian với `cleaned.mp4`), `cuts.json`. Đọc `cuts.json` và `transcript.raw.json` (các file `clean` ghi: `cleaned.mp4`, `transcript.json`, `transcript.raw.json`, `cuts.json`, `repeats-suspect.json`; `fix-transcript` thêm `transcript.whisper.json`) để kiểm tra không cắt nhầm lời có nghĩa; nếu nghi ngờ thì báo người dùng. Lệnh chỉ tự cắt khoảng lặng và cụm ≥ 2 từ lặp lại; từ đơn lặp lại (ví dụ "từ từ", "dần dần" là từ láy tiếng Việt) **không** bị cắt và được liệt kê trong `repeats-suspect.json` để bạn xem là nói vấp thật hay từ láy. Nếu báo "Không tìm thấy lời nói trong video" thì dừng và nói rõ cho người dùng.
   **Sửa lỗi chép lời.** Whisper nghe sai nhiều từ tiếng Việt và caption in đúng từ trong `transcript.json`, nên sai là sai ngay trên màn hình. Đọc toàn bộ lời, ghi các từ sai chắc chắn vào `projects/<tên>/transcript-fixes.json` dạng `[{ "sai": "áp", "dung": "ác", "sau": "cái" }]` (`sau`: từ đứng **ngay trước** từ sai; `tiep`: từ đứng **ngay sau** nó; cả hai tùy chọn, dùng để chỉ sửa đúng chỗ và so với từ Whisper nghe, chưa sửa), rồi chạy `npx tsx src/cli.ts fix-transcript projects/<tên>`. Lệnh in ra những mục **không khớp chỗ nào** (gõ sai `sai`, hoặc `sau`/`tiep` không đúng): sửa rồi chạy lại. Bản Whisper gốc nằm ở `transcript.whisper.json`, lần nào cũng sửa từ bản đó nên chạy lại là an toàn; `condense` cũng tự áp lại `transcript-fixes.json` lên bản chép lời mới. Từ nào không chắc thì giữ nguyên và báo người dùng nghe lại (đừng bịa).
3. **Rút gọn nội dung (chỉ khi người dùng muốn ngắn hơn).** `clean` chỉ cắt lặng, không rút gọn nội dung. Đọc kỹ cả bản chép lời, tóm tắt câu chuyện (ý chính, ý phụ, câu hook, câu kết), rồi chọn các đoạn **trọn câu** giữ lại.
   - **Điểm dừng 1:** gửi người dùng danh sách đoạn giữ lại (mỗi đoạn một dòng: lời mở đầu, lời kết thúc, lý do giữ) và tổng thời lượng dự kiến; **chỉ cắt sau khi người dùng duyệt**.
   - `npx tsx src/cli.ts pauses projects/<tên>` liệt kê các khoảng ngừng thật kèm vài từ quanh nó: chỗ cắt không mất chữ. Người nói liền hơi thì ít chỗ ngừng; chọn đầu và cuối đoạn ở sát các khoảng ngừng đó khi có thể.
   - Ghi `projects/<tên>/condense-spec.json` dạng `{ "keep": [{ "from": "<vài từ đầu đoạn>", "to": "<vài từ cuối đoạn>" }, ...] }` (cụm tìm theo thứ tự trong lời, không phân biệt dấu và hoa thường), rồi chạy `npx tsx src/cli.ts condense projects/<tên>`. Lệnh đặt mỗi mốc cắt vào giữa khoảng ngừng nếu có, tránh cảnh cắt của chính video gốc, mờ tiếng 30 ms ở mỗi đầu đoạn, chép lời lại bản đã cắt và in ra từ thừa ở từng chỗ ghép (dòng `!!`, ví dụ "chính" của câu trước lọt vào đầu đoạn sau). Số dB trong báo cáo là độ ồn quanh mốc cắt so với mức nói bình thường (càng âm càng yên). "KHÔNG có chỗ ngừng" là bình thường với người nói liền hơi: lệnh vẫn cắt ở chỗ nhỏ tiếng nhất và mờ tiếng, **dòng `!!` mới là tín hiệu thật** của chữ thừa. Có dòng `!!` hoặc "KHÔNG có chỗ ngừng ... cắt giữa tiếng nói" kèm từ lạ thì đổi cụm đầu hoặc cuối của đoạn đó (thường nhích sang một khoảng ngừng) và chạy lại; lệnh luôn cắt lại từ `full.mp4` (bản gốc trước khi cắt).
   - Sau `condense`, `transcript.json` là bản chép lời mới: chạy lại `fix-transcript`. Kết quả `condense.json` có `joins` (thời điểm các chỗ ghép trên `cleaned.mp4`).
4. **Phân tích.** `npx tsx src/cli.ts analyze projects/<tên>` đọc `transcript.json`, `assets.json`, `glossary.json` và ghi `storyboard.json`: từng nhịp lời nói kèm các gợi ý (tên công cụ, con số, câu lệnh, danh sách, nhấn mạnh, giao diện, video ngắn, dấu mốc phần, kêu gọi hành động) và một `treatment` đề xuất theo khối `director` của `theme.json`. Lệnh từ chối ghi đè khi đã có nhịp `reviewed: true` trừ khi thêm `--force`. Gợi ý của mã chỉ dựa vào từ khóa nên **mỏng**: phần hiểu nội dung là của bạn (câu nào là điểm nhấn, ý nào cần đồ họa), xem bước 5.
   - Những insert có `"maybe": true` trong `storyboard.json` là **gợi ý lấp khoảng trống** (lệnh in "chưa chắc"): một khoảng dài hơn `insertGapMaxSec` mà không tín hiệu nào cho insert, nên mã đặt một thẻ ở giữa với vài từ của nhịp đó. Chữ ấy chỉ là đoán: đọc lại và đổi thành ý chính của đoạn, hoặc xóa insert nếu chỗ đó không cần; khi bạn giữ thì bỏ dòng `maybe`.
   - **Đọc hiểu trước khi sửa storyboard:** đọc cả bản chép lời rồi ghi `projects/<tên>/outline.md`: mỗi đoạn một dòng gồm khoảng thời gian, ý của đoạn trong một câu, và đồ họa bạn định dùng (thẻ gì, chữ gì, vì sao); đánh dấu đoạn nào là hook, ý chính, ví dụ, lời kêu gọi. Đoạn nào thưa đồ họa quá `insertGapMaxSec` thì phải có dòng đề xuất. `outline.md` là nền để bạn sửa storyboard ở bước 5 và để tóm tắt kế hoạch cho người dùng duyệt ở điểm dừng 2.
5. **Kế hoạch đạo diễn.** Đọc `styles/<style>/rules.md` và `styles/<style>/theme.json`. Xem vài ảnh khung của `cleaned.mp4` (ffmpeg) để biết video gốc **đã có sẵn** bảng, chữ, cảnh phụ nào: đừng chèn trùng. **Sửa `storyboard.json`** (xem mục `storyboard.json` bên dưới): đổi, thêm, xóa insert, đổi kiểu caption; đặt đồ họa **theo câu**: bắt đầu ở từ được nhắc và hết trước khi câu kết thúc, không chạy ngang qua chỗ ghép (ở chỗ ghép đã có chuyển cảnh). Mỗi chỗ ghép trong `condense.json` đã có sẵn một `transition` do `analyze` đặt (0.4 s, cân tâm ở điểm cắt, kiểu xoay vòng theo danh sách `transitions` của `playbook.json`, hai chỗ ghép liền nhau không cùng kiểu), và các insert khác tự tránh xa chỗ ghép 0.3 s (cắt ngắn trước chỗ ghép nếu còn ít nhất 1.2 s, không thì bắt đầu sau chỗ ghép); chỉ đổi kiểu hoặc xóa nếu thấy chưa hợp. Chạy lại `condense` thì phải chạy lại `analyze` (kèm `--force` nếu đã duyệt nhịp). Không đặt `logo-badge` ở giữa khung nếu che mặt người nói.
   - **Điểm dừng 2:** tóm tắt kế hoạch bằng lời cho người dùng: các insert nào, chữ gì, ở đâu (theo thời điểm hoặc câu), chỗ nào trùng đồ họa có sẵn của video gốc và bạn xử lý ra sao. Chờ duyệt; rồi đặt `reviewed: true` cho từng nhịp.
6. **Dựng và kiểm tra.** `npx tsx src/cli.ts compose projects/<tên>` ghi `plan.json` (hoặc `plan.next.json` khi `plan.json` đã có: chạy `merge`) và `compose-report.json`. Vẫn có thể tự viết `plan.json` bằng tay (định dạng bên dưới). Footage người dùng đưa copy vào `projects/<tên>/assets/` và tham chiếu dạng `assets/<file>`. Sau đó `npx tsx src/cli.ts validate projects/<tên>` in JSON `{round, maxRounds, stop?, issues[]}`. Sửa theo từng issue rồi chạy lại. Dừng khi `issues` rỗng hoặc có `"stop": true` (hết 3 vòng): khi đó liệt kê rõ các cảnh báo còn lại cho người dùng. Exit code 1 nghĩa là còn **lỗi** (chặn render).
7. **Xem trước.** **Điểm dừng 3.** Chạy `npx tsx src/cli.ts preview projects/<tên>` thay cho render đầy đủ (khoảng 1 phút so với 3 phút trên video 78 giây): lệnh chụp mỗi khoảnh khắc đáng xem (giữa mỗi chuyển cảnh, mỗi insert khi đã vào hẳn, các caption có nền mờ, vài caption khác, đầu và cuối video; tối đa 24, thêm `--frames <N>` để đổi) vào `projects/<tên>/preview/f01.png`… và ghép tất cả thành `preview/sheet.png` theo thời gian. **Mở `sheet.png` và xem bằng mắt** (đọc ảnh), rồi mở từng khung nếu cần xem kỹ; lệnh in ra thời điểm và nhãn của từng khung. Cùng kiểm tra như render: plan có lỗi thì bị từ chối. Muốn xem chuyển động: `preview projects/<tên> --video` dựng `preview.mp4` nhỏ và chất lượng thấp, nhưng chỉ nhanh hơn render đầy đủ khoảng một phần tư (video 78 giây mất khoảng 2 phút), nên chỉ dùng khi thật cần. Báo người dùng chỗ bạn thấy còn yếu, hoặc mở editor ở bước 8. Âm thanh bạn không nghe được: nhờ người dùng nghe các chỗ ghép.
8. **Chỉnh tay.** `npx tsx src/cli.ts editor projects/<tên>` mở editor ở `http://127.0.0.1:5187`. Người dùng sửa và bấm Lưu. Khi người dùng báo xong, đọc lại `plan.json`.
9. **Render.** `npx tsx src/cli.ts render projects/<tên>` ghi `out.mp4` (hoặc người dùng bấm Render trong editor).
10. **Vòng sửa.** Người dùng góp ý kiểu "thẻ này đổi chữ", "chỗ ghép này bị cụt": sửa `storyboard.json` (hoặc chọn lại đoạn ở bước 3), dựng lại bằng `compose` rồi `merge` (xem mục dưới); layer người dùng đã khóa không bị ghi đè.

Mỗi bước ghi kết quả ra file trong thư mục project, nên có thể chạy lại riêng từng bước. Nếu một lệnh lỗi, đọc thông báo của nó, báo người dùng bằng lời rõ ràng, không tự bỏ qua.

**Rẽ nhánh và lỗi.**
- Không cần rút ngắn: bỏ bước 3.
- Video không có lời nói: dừng ở bước 2 và nói rõ cho người dùng; không tự dựng.
- Chép lời quá tệ (nhiều từ lạ, nhiều đoạn không có nghĩa): đưa người dùng xem vài câu mẫu và hỏi có tự sửa tay hay dùng bản khác; đừng sửa những từ bạn không chắc.
- Người dùng đưa footage giữa chừng: `assets add` kèm mô tả, quay lại bước 5.
- Video gốc đã có đồ họa hoặc chữ dựng sẵn: báo người dùng, tránh chèn trùng; caption nằm trên nền gần trắng sẽ có nền mờ (`backdrop: "plate"`, tự thêm khi `compose`).
- Còn cảnh báo sau 3 vòng `validate`: liệt kê cho người dùng, không tự bỏ qua.

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
| `caption` | (không có) | dùng `words`: `{t, s, e, hl}` lấy từ `transcript.json`; `start` = `s` của từ đầu trừ 0.05 s (cụm `phrase` hiện ngay ở đầu layer), `end` = `e` của từ cuối cộng 0.4 s hoặc sát đầu caption kế tiếp (hiệu ứng thoát chạy sau lời nói, không đè lên từ cuối). Số từ ≤ `limits.maxCaptionWords`. |
| `title` | `title-card` | `{ icon, title, sub? }` |
| `graphic` | `chip-stack` | `{ chips: [{ icon, label, sub? }] }` |
| `graphic` | `explainer-scene` | `{ label?, title, mode?: "full"\|"overlay", body?: { kind, items }, avatar?: boolean }`. `mode` `full` (mặc định) là nền kín; `overlay` là thẻ nằm trên người nói đã tối và mờ. `body.kind`: `list` và `card` (`items`: chuỗi), `waveform` (`items`: nhãn tùy chọn), `progress` (`items`: `{ label, value 0–100 }`), `phone` (`items`: các dòng tin nhắn) |
| `graphic` | `logo-badge` | `{ icon?: tên icon (mặc định "sparkles"), src?: ảnh logo trong assets (thắng icon), label?, sub?, position?: "top"\|"center"\|"bottom" (mặc định center), dim? }`. Huy hiệu bo góc có tia sáng, nhãn trong viên thuốc phía trên, `sub` phía dưới; dùng khi nhắc tên công cụ hoặc sản phẩm. Mặc định không làm tối người nói |
| `graphic` | `prompt-box` | `{ text (bắt buộc, không rỗng), placeholder?, strike?: boolean, position? (mặc định top), dim? }`. Ô nhập kiểu chat: chữ được gõ ra 28 ký tự mỗi giây kèm con trỏ nhấp nháy; `strike: true` thì sau khi gõ xong một đường gạch ngang vẽ qua chữ (như câu prompt bị hủy). Dùng khi lời nói trích một câu prompt. Mặc định không làm tối người nói |
| `graphic` | `stat-card` | `{ title?, rows: [{ icon?, value, caption? }] (1–4 hàng, `value` không rỗng), position? (mặc định center), dim? }`. Thẻ nền đen, mỗi hàng icon trái, giá trị lớn và chú thích nhỏ, các hàng vào lần lượt; giá trị dài hơn 12 ký tự tự co chữ. Dùng cho số liệu thời gian hoặc chi phí. Mặc định làm tối và mờ người nói |
| `graphic` | `quote-card` | `{ quote, author?, position? (mặc định center), dim? }`. Câu nói trong thẻ nền đen có dấu ngoặc kép lớn, các từ hiện lần lượt, rồi tên tác giả; `quote` không rỗng, tối đa 240 ký tự, chữ tự co theo độ dài. Dùng cho một câu trích hoặc câu chốt. Mặc định làm tối và mờ người nói |
| `graphic` | `counter` | `{ to, from? (mặc định 0), decimals? (0–3, mặc định 0), prefix?, suffix?, label?, position? (mặc định center), dim? }`. Số lớn đếm từ `from` lên `to` (với khoảng như "300 mấy, 400" thì lấy `to` là số bạn muốn người xem đọc, ví dụ 400, chứ không nhập khoảng) (một lần rồi đứng yên; định dạng tiếng Việt: dấu chấm giữa hàng nghìn, dấu phẩy thập phân), kèm tiền tố, hậu tố (`%`, ` triệu`) và nhãn nhỏ phía dưới; không có thẻ nền. Dùng cho con số cần gây ấn tượng. Mặc định làm tối và mờ người nói |
| `graphic` | `transition` | `{ kind: "zoom"\|"blur"\|"slide"\|"push"\|"flash"\|"whip"\|"dip" }`, dài ≤ 0.6 s; hiệu ứng áp lên video nền (`flash` là nháy sáng, `whip` hất ngang và nhòe như lia máy nhanh, `dip` tối dần gần đen rồi sáng lại), đặt ngay trước cảnh hoặc cân tâm ở chỗ ghép, không chồng layer `graphic` khác |
| `camera` | `zoom-punch` | `{ scale?: số trong (1, 1.5], focus?: { x, y } trong 0–1 }`, 0.8–1.5 s; đẩy camera vào ở từ nhấn mạnh rồi trả lại (mặc định theo phong cách: s1 1.06, m1 1.12) |
| `camera` | `shake` | `{ intensity?: 1–3 }`, rung nhẹ cho khoảnh khắc mạnh |
| `footage` | `footage` | `{ src: "assets/<file>", fit?, frame?, motion?, focus?, from?, title?, sound?, dim? }` (bảng props bên dưới) |

**Footage (`props` của layer `footage`; chỉ `src` là bắt buộc).** Nội dung `assets/<file>` do `assets add` đưa vào. Footage mặc định **tắt tiếng** (tiếng của nó sẽ chồng lên giọng người nói); chỉ bật khi `sound` là `true`.

| Trường | Giá trị | Mặc định | Ý nghĩa |
|---|---|---|---|
| `fit` | `cover`, `contain` | `cover` | `cover` phủ toàn khung; `contain` thành thẻ nổi bo góc |
| `frame` | `none`, `window`, `phone` | `none` | `window`: thẻ cửa sổ ứng dụng nằm ngang có thanh tiêu đề (cho quay màn hình, ảnh chụp giao diện); `phone`: khung điện thoại (cho video dọc ngắn). Hai khung đều là thẻ nổi |
| `motion` | `none`, `zoom-in`, `zoom-out`, `pan-left`, `pan-right` | `none` | Trôi chậm suốt layer (Ken Burns), áp lên nội dung chứ không lên khung |
| `focus` | `{ x, y }` trong 0–1 | `{ x: 0.5, y: 0.5 }` | Điểm gốc của zoom |
| `from` | số giây ≥ 0 | 0 | Bắt đầu phát clip từ giây thứ mấy (chỉ video) |
| `title` | chuỗi | không | Chữ trên thanh cửa sổ; chỉ dùng với `frame` là `window` |
| `sound` | `true`, `false` | `false` | `true` mới bật tiếng của footage |
| `dim` | `true`, `false` | theo bảng dưới | Ghi đè việc làm tối và mờ người nói |

**Làm tối nền người nói (`dim`).** Mặc định có làm tối và mờ (độ sáng 0.55, mờ 6 px) với: footage có `frame` là `window` hoặc `phone` hoặc `fit` là `contain`, `stat-card`, `explainer-scene` chế độ `overlay`. Mặc định **không** làm tối: footage `cover` toàn khung, `logo-badge`, `prompt-box`. Prop `dim` boolean trên layer thắng mặc định.

**`assets.json` và lệnh `assets`.** Mỗi project có thư mục `assets/` và file `assets.json`: `{ "assets": [ { "file": "assets/editor.mp4", "description": "...", "kind": "screen|phone|photo|logo|other", "durationSec", "width", "height" } ] }`. `kind` là một trong `screen`, `phone`, `photo`, `logo`, `other` và tự suy ra: video ngang là `screen`, video dọc là `phone`, ảnh là `photo` (đổi bằng `--kind`, ví dụ `logo` cho logo hoặc `other` cho loại khác). Lệnh:
- `npx tsx src/cli.ts assets add projects/<tên> "<file>" --desc "<mô tả>" [--kind screen|phone|photo|logo|other]`: sao chép vào `assets/`, đo kích thước và thời lượng, ghi `assets.json`. Cùng tên file nhưng khác nội dung thì báo lỗi, không ghi đè.
- `npx tsx src/cli.ts assets list projects/<tên>`: in `assets.json`.

Khi dựng, đọc `assets.json` và ghép **mô tả** với lời đang nói (ví dụ mô tả "quay màn hình editor" ghép với đoạn nói về giao diện editor); dùng `from` để cắt đúng đoạn cần trong clip dài. `validate` cảnh báo `asset-missing` khi một mục trong `assets.json` trỏ tới file không tồn tại.

**Caption (`props` của layer `caption`, đều tùy chọn).** Mặc định là `phrase`: cả cụm hiện cùng lúc từ đầu layer (mờ rõ dần và nảy nhẹ), các từ `hl: true` đứng liền nhau gộp thành một cụm nhấn, cả cụm mờ ra ở cuối layer. Thời điểm hiện do `start`/`end` của layer quyết định, nên `start` đặt ngay trước từ đầu tiên.

| Trường | Giá trị | Mặc định | Ý nghĩa |
|---|---|---|---|
| `variant` | `phrase`, `word`, `big`, `label` | `phrase` | `phrase`: nguyên cụm một lần. `word`: từng từ nảy theo lúc nói. `big`: một từ hoặc cụm ≤ 3 từ cỡ lớn. `label`: dòng nhỏ phía trên cộng dòng chính |
| `position` | `top`, `center`, `bottom` | `center` cho `big`, còn lại `bottom` | Vị trí dọc. `top` trùng thẻ tiêu đề hoặc chip sẽ bị cảnh báo `caption-overlaps-card` |
| `emphasis` | `box`, `ink`, `underline` | theo phong cách (m1 `box`, s1 `underline`) | `box`: hộp vàng chữ đen quét qua cả cụm nhấn. `ink`: chữ màu nhấn. `underline`: màu nhấn và gạch chân |
| `label` | chuỗi | không | Dòng nhỏ phía trên; **bắt buộc** (không rỗng) khi `variant` là `label` |
| `handles` | `true`, `false` | `false` | Chỉ với `big`: bốn ô vuông ở góc khung chữ |
| `backdrop` | `none`, `plate` | `none` | `plate`: nền tối mờ phía sau cả cụm chữ. Chữ luôn có viền đen; dùng `plate` khi nền phía sau gần trắng (bảng trắng, cảnh sáng của video gốc). `compose` tự thêm `plate` cho caption có hơn 15% bề ngang chữ nằm trên nền gần trắng; validator cảnh báo `caption-low-contrast` ở plan viết tay chưa có `plate` |

Giá trị lạ làm validator báo `invalid-props`; số từ quá giới hạn (`big` ≤ 3, kiểu khác ≤ `limits.maxCaptionWords`) báo `caption-too-long`.

Icon có sẵn (vẽ dần và nảy khi hiện): `video`, `skill`, `chat`, `clock`, `check`, `typography`, `graphic`, `motion`, `audio`, `sparkles`, `zap`, `scissors`, `wand`, `layers`, `play`, `mic`, `subtitles`, `image`, `bot`, `gauge`, `lightbulb`, `rocket`, `star`, `languages`, `flag`, `heart`, `thumbs-up`, `share`, `users`, `trophy`, `camera`, `smartphone`, `eye`, `target`, `book-open`, `globe` (tên lạ, kể cả `lottie:...`, sẽ rơi về `check`).

Camera là một track riêng (`camera`): hai layer cùng track không chồng nhau. Video người nói tự tối và mờ khi có cảnh giải thích `overlay` hoặc footage `fit: "contain"`; không cần khai báo.

Quy tắc cứng (validator kiểm tra): schema đúng; id layer không trùng; `type` đúng bảng trên và đúng track, `props` có các trường bắt buộc (title-card/explainer-scene cần `title`, chip-stack cần `chips[].label`, transition cần `kind`); hai layer **cùng track không chồng thời gian**; footage tồn tại; không layer nào vượt độ dài video. Cảnh báo (không chặn): `footage-overrun` (`from` cộng độ dài layer vượt thời lượng clip trong `assets.json`, hình sẽ đứng ở khung cuối), `prompt-too-long` (`prompt-box` không đủ thời gian để gõ hết chữ và vẽ gạch), chữ tràn vùng an toàn, caption quá nhiều từ, cảnh quá ngắn, phụ đề lệch lời đã chép (phụ đề phải khớp từ trong `transcript.json` trong vòng 0.3 s).

## `storyboard.json`, `glossary.json` và `compose-report.json`

`storyboard.json` = `{ version: 1, style, beats[] }`. Mỗi nhịp: `id`, `start`, `end`, `firstWord`, `lastWord` (chỉ số từ trong `transcript.words`, gồm cả hai đầu), `text`, `cues[]` (`kind`: `tool`, `number`, `prompt`, `list`, `emphasis`, `ui`, `shortvideo`, `question`), `reviewed` và `treatment`:
- `caption`: `{ variant: "phrase" | "label" | "big", label?, hl: number[], bigRange: [từ đầu, từ cuối] | null }`. `hl` là chỉ số từ được tô nhấn; `bigRange` tối đa 3 từ và nằm trong nhịp, thành một caption `big` riêng.
- `inserts[]`: `{ type, props, at, duration }` với `type` là một layer type có track `title`, `graphic` hoặc `footage` (props như trong bảng layer); `at` tính bằng giây theo `cleaned.mp4`.
- `camera[]`: `{ type: "zoom-punch" | "shake", at, duration, props? }`.
- `note`: ghi chú tự do của đạo diễn.

Phần đề xuất chỉ là điểm xuất phát: xem từng nhịp, hợp lý thì giữ, không thì sửa. `compose` bỏ qua và ghi vào `compose-report.json` (`issues`, `inserts.dropped`, `inserts.moved`, `camera.dropped`) mọi mục không hợp lệ (type lạ, `at` ngoài video, `duration` ≤ 0, `hl`/`bigRange` ngoài nhịp); đọc báo cáo rồi sửa storyboard. Báo cáo còn có số caption theo kiểu, `unreviewedBeats` và `unusedAssets`.

`glossary.json` (tùy chọn, trong thư mục project) thêm thuật ngữ riêng cho phần phát hiện công cụ: `{ "terms": [{ "term": "Zorblax", "label": "phần mềm" }] }`; thuật ngữ của project thắng thuật ngữ mặc định cùng tên (`styles/glossary.json`). Cùng kiểu `{ term, label }` có hai danh sách nữa: `section` (dấu mốc phần của bài nói: "mở bài", "đầu tiên", "cuối cùng"; nhãn là chữ trên thẻ) và `cta` (kêu gọi hành động: "đăng ký", "bình luận"); "bước <số>" luôn là `section`. `notTools` là danh sách từ tiếng Việt viết không dấu hay bị nhận nhầm là tên công cụ khi viết hoa đầu câu ("Trong", "Cho"); thêm từ của bạn vào đó nếu `analyze` gợi ý nhầm một logo cho một từ thường.

**Cẩm nang `playbook.json`** (`styles/<style>/playbook.json`, đổi cách `analyze` đề xuất insert). Mỗi tình huống (`tool`, `number`, `section`, `cta`, `list`) có nhiều công thức (recipe: `id`, `type`, `duration`, `props` mẫu dùng `{text}`, `{TEXT}`, `{label}`, `{icon}`); công thức đầu tiên là cách mặc định. Phần `variety` giữ cho video không đơn điệu: `rotate` (cùng tình huống thì lần sau dùng công thức dùng lâu nhất chưa dùng lại), `maxShare` (tỉ lệ tối đa của một kiểu insert trong cả video, tính khi đã có ít nhất 4 insert) và `sameTypeGapSec` (hai insert cùng kiểu cách nhau tối thiểu bấy nhiêu giây). Danh sách `transitions` (mặc định `zoom`, `whip`, `blur`, `dip`, `push`, `slide`; không có `flash` vì khung trắng hoàn toàn quá gắt để lặp lại; đặt `[]` để tắt) quyết định kiểu chuyển cảnh ở các chỗ ghép. Kiểu insert phong cách không cho phép (`allowedInserts`) thì không bao giờ được chọn. Tình huống `number` có thêm công thức `counter` (số đếm lên) khi cue là một số rõ ràng như "30 phút" hoặc "50%"; `quote-card` chưa có tình huống tự gợi ý, bạn đặt tay ở bước đạo diễn khi người nói trích một câu. Muốn thêm một cách xử lý mới cho một tình huống chỉ cần thêm một công thức vào file; thiếu file thì dùng cẩm nang mặc định. Gợi ý vẫn chỉ là điểm xuất phát: bạn sửa `storyboard.json` như thường.

Hai cảnh báo mới của `validate`: `insert-gap` (một khoảng dài hơn `director.insertGapMaxSec` không có insert nào; tối đa 5 dòng rồi một dòng tóm tắt) và `asset-unused` (file trong `assets.json` mà không layer `footage` hay `logo-badge` nào dùng làm `src`). Cả hai chỉ là cảnh báo: thêm insert phù hợp hoặc bỏ asset.

## Khi nào dừng và hỏi người dùng

Thiếu video/khung hình/phong cách; video không có lời nói; một lệnh lỗi mà thông báo không đủ để tự sửa; trước khi xóa project hay ghi đè `out.mp4` đã có.
