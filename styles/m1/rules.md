# Phong cách m1 — chữ lớn, nhịp nhanh (đen, vàng)

Đo từ `video demo m1.mp4` (49 s, 9:16): 5 lần cắt cứng (cảnh quay màn hình chen vào ở 2.1 s, 9.8 s, 30.8 s, 42.9 s); trong 20 s đầu có thành phần mới hoặc đổi chữ khoảng 1–2.5 s một lần.

## Tổng quan
- Người nói chiếm khung hình; **chữ là thứ dẫn dắt**. Các cảnh chèn ngắn (quay màn hình, icon) làm nhịp nhanh lên.
- Màu: nền đen `#0A0A0A`, vàng `#FFD93D` cho hộp từ khóa và nhãn, chữ trắng.
- Mở đầu bằng cụm biểu tượng thu hút (ví dụ hàng 5 sao hoặc logo ứng dụng) cùng câu chốt lớn trong 2 s đầu.

## Chọn thành phần
| Tình huống | Dùng | Ghi chú |
|---|---|---|
| Mỗi câu nói | `caption` (track `caption`) | ≤ 4 từ mỗi layer; từ khóa/cụm quan trọng `hl: true` (hộp vàng, chữ đen). Giữ nhịp ngắt theo hơi nói. |
| Liệt kê 2–4 khái niệm đồng cấp (ví dụ Typography, Graphic, Motion) | `chip-stack` (track `graphic`) | Mỗi chip một `icon` và `label`; chip hiện lần lượt, cả cụm giữ 3–5 s. |
| Nhắc tên công cụ/mốc quan trọng | `title-card` | `icon` + `title` ngắn, ≤ 2 s đến 3 s. |
| Minh họa bằng màn hình/footage | `footage` với `fit: contain`, 2–10 s | Luôn kèm `caption` ở trên hoặc dưới. Vào bằng `transition` kind `blur` (0.3 s). |
| Đổi ý lớn hoặc liệt kê quy trình | `explainer-scene` | Hiếm, ≤ 1–2 lần/video, 3–5 s, `avatar: false`. Dùng `mode: "overlay"` để thẻ nằm trên người nói đã tối và mờ (như cảnh chèn của bản gốc); `mode: "full"` cho cảnh nền đen. |
| Nhấn một từ hoặc ý quan trọng | `zoom-punch` (track `camera`) | Khoảng 6–10 s một lần, dài ≤ 1.5 s, đặt đúng lúc từ khóa được nói; `scale` mặc định 1.12. Có thể `shake` rất nhẹ ở khoảnh khắc mạnh nhất. |

## Chèn theo tình huống (đồ họa và footage)
Chèn dày: khoảng một cảnh chèn mỗi 5–8 s. Chọn kiểu theo lời đang nói, đọc `assets.json` để biết có footage nào:

| Lời đang nói | Chèn | Ghi chú |
|---|---|---|
| Tên công cụ, sản phẩm, mô hình ("Claude Opus 5.5") | `logo-badge` | `label` là tên, `icon` hoặc `src` là logo; 2–3 s; không làm tối người nói |
| Trích một câu prompt hoặc yêu cầu ("sửa giúp mình chữ này to hơn") | `prompt-box` | `text` là câu trích; `strike: true` khi nói đừng làm như vậy nữa; 2–4 s |
| Số liệu thời gian, chi phí ("mất hơn nửa tiếng") | `stat-card` | 1–3 hàng, giá trị ngắn; 3–5 s |
| Nói về giao diện hoặc thao tác trên màn hình | `footage` với `frame` là `window`, `motion` là `zoom-in` | Dùng clip `screen` trong `assets.json`; `title` là tên ứng dụng; 3–6 s; `from` để cắt đúng đoạn |
| Nói về một video ngắn hoặc nội dung dọc (TikTok) | `footage` với `frame` là `phone` | Dùng clip `phone`; 2–4 s; có thể `motion` là `pan-left` |
| Ảnh chụp hoặc minh họa | `footage` với `frame` là `window` hoặc `fit` là `contain` | Dùng ảnh `photo` |
| Không có footage nào khớp | `logo-badge`, `prompt-box`, `stat-card` hoặc `chip-stack` | Không tự bịa đường dẫn footage |

Footage trong `window` hoặc `phone` làm tối và mờ người nói; vẫn giữ caption (≤ 3 từ, `position` là `bottom`).

## Phụ đề
- Cỡ lớn (72), chữ trắng; từ khóa trên hộp vàng chữ đen (`emphasis` là `box`; các từ nhấn liền nhau gộp thành một hộp). Mỗi layer là một chunk, không chồng chunk.
- Chia các dòng theo nội dung (giống demo): khoảng 60% là `phrase` ở dưới (câu thường, nguyên cụm một lần); khoảng 20% là `label` (tên công cụ hoặc thuật ngữ: dòng nhỏ phía trên cộng dòng chính, ví dụ `label` "nó mở thêm" và dòng chính "tool Editor trực tiếp"); khoảng 10–15% là `big` (ý chính ≤ 3 từ ở giữa khung, tối đa một lần mỗi 8 s, có thể thêm `handles: true`); mỗi dòng một cụm nhấn.
- `position: "top"` chỉ dùng khi không có thẻ tiêu đề hoặc chip ở phía trên cùng lúc.
- Khi có `footage` hoặc thẻ chiếm màn hình, caption vẫn giữ nhưng ngắn hơn (≤ 3 từ).

## Nhịp và giới hạn
- Cảnh ngắn nhất 1.0 s (`minSceneSec`).
- Không để quá 3 s liên tục không có thay đổi thị giác (chữ mới, chip, footage hoặc chuyển cảnh).
- Chuyển cảnh `blur`/`zoom` mỗi lần vào hoặc ra khỏi cảnh chèn; không dùng `slide` hai lần liên tiếp.

## Chưa đo được
Kiểu easing chính xác của chip và hộp vàng, âm thanh/hiệu ứng tiếng.

## Số liệu cho đạo diễn
Các con số (khoảng cách tối đa giữa insert, loại insert được dùng, tỉ lệ caption `label`/`big`, nhịp zoom-punch) nằm trong khối `director` của `theme.json`; `analyze` và `validate` đọc chính khối này.

Cách xử lý từng tình huống nội dung (công cụ, con số, dấu mốc phần, kêu gọi hành động, danh sách) và độ đa dạng giữa các lần nằm trong `playbook.json` cùng thư mục; sửa ở đó để đổi gợi ý của `analyze`.
