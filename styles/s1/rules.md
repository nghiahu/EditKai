# Phong cách s1 — giải thích công nghệ (navy, teal, cam)

Đo từ `video demo s1.mp4` (76 s, 9:16): 3 lần cắt cứng, cách nhau 3.9–9.5 s (trung bình 6.7 s); phần còn lại là người nói liên tục với lớp phủ.

## Tổng quan
- Người nói chiếm khung hình phần lớn thời gian. Thông tin thêm hiện ở **thẻ tiêu đề phía trên đầu** và vài **cảnh giải thích toàn màn hình**.
- Màu: navy `#0B1530` làm nền, teal `#2DE2D0` cho từ khóa và đường gạch, cam `#FF9A3C` cho thẻ nhấn mạnh (chi phí, cảnh báo).
- Nhịp: một ý mới thì một thẻ tiêu đề mới, mỗi thẻ giữ 3–7 s, thẻ sau thay thẻ trước (không chồng).

## Chọn thành phần
| Tình huống | Dùng | Ghi chú |
|---|---|---|
| Nói một ý/khái niệm mới | `title-card` (track `title`) | `icon` + `title` ngắn (≤ 4 từ, viết hoa nếu là tên), `sub` là một dòng giải thích nhỏ. Hiện 3–7 s. |
| Điểm nhấn con số, chi phí, cảnh báo | `title-card` với `override.colors.teal` = cam | Dùng tiết kiệm, tối đa 1 lần mỗi 20 s. |
| Giải thích quy trình/các bước (≥ 2 ý đi cùng nhau) | `explainer-scene` (track `graphic`) | Khoảng mỗi 25–30 s xen một cảnh, dài 6–10 s. `label` viết hoa nhỏ (ví dụ `TỪ FOOTAGE GỐC`), `title` viết hoa, `body.kind` = `list` cho các bước. `avatar: true` để giữ người nói ở góc. |
| Ảnh chụp giao diện/sản phẩm | `footage` với `fit: contain` | Đặt trong `explainer-scene` hoặc sau chuyển cảnh `blur`. |
| Chuyển vào/ra cảnh giải thích | `transition` kind `blur` hoặc `zoom`, 0.3–0.5 s | Đặt ngay trước khi cảnh bắt đầu. |

Không dùng `chip-stack` ở s1.

**Camera (track `camera`):** dùng ít, tối đa một `zoom-punch` mỗi 20 s (scale mặc định 1.06), không dùng `shake`. Cảnh giải thích mặc định là `full`; với các bước/quy trình ưu tiên `body.kind` `progress` (thanh tiến độ cho con số như quota) hoặc `waveform` (khi nói về giọng/lời nói) thay vì chỉ `list`.

## Phụ đề
- Một dòng nhỏ ở dưới (theme đã đặt cỡ 40 và vị trí), ≤ 8 từ mỗi layer `caption`, ngắt ở chỗ nghỉ tự nhiên của câu.
- Mỗi layer tô `hl: true` cho 1–2 từ khóa (danh từ chính, con số). Không tô cả câu.
- Phụ đề vẫn hiện trong lúc có thẻ tiêu đề; trong `explainer-scene` vẫn giữ phụ đề.

## Nhịp và giới hạn
- Cảnh ngắn nhất 1.5 s (`minSceneSec`).
- Hai thẻ tiêu đề không cách nhau dưới 0.3 s; không để quá 12 s liên tục chỉ có người nói trơn.
- Mở đầu: thẻ tiêu đề đầu tiên xuất hiện trong 1 s đầu. Kết: một câu kêu gọi kèm `title-card` ở 5 s cuối.

## Chưa đo được
Easing chính xác của icon/chữ, âm thanh và hiệu ứng tiếng — cần mắt người xem lại bản dựng.
