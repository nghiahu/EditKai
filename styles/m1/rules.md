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
| Đổi ý lớn hoặc liệt kê quy trình | `explainer-scene` | Hiếm, ≤ 1–2 lần/video, 3–5 s, `avatar: false`. |

## Phụ đề
- Cỡ lớn (72), nằm giữa phần dưới, chữ trắng; từ khóa trên hộp vàng. Mỗi layer là một chunk, không chồng chunk.
- Khi có `footage` hoặc thẻ chiếm màn hình, caption vẫn giữ nhưng ngắn hơn (≤ 3 từ).

## Nhịp và giới hạn
- Cảnh ngắn nhất 1.0 s (`minSceneSec`).
- Không để quá 3 s liên tục không có thay đổi thị giác (chữ mới, chip, footage hoặc chuyển cảnh).
- Chuyển cảnh `blur`/`zoom` mỗi lần vào hoặc ra khỏi cảnh chèn; không dùng `slide` hai lần liên tiếp.

## Chưa đo được
Kiểu easing chính xác của chip và hộp vàng, âm thanh/hiệu ứng tiếng.
