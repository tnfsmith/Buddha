# Đường Xưa Mây Trắng — gói 33 bài chờ chọn phát hành

Đã đủ 33 bản chữ và tiếng: B có 10 bài (#76), C có 11 bài (#77), D có 12 bài (#78); tổng cộng 498 cue. Cả 33 bài đúng khuôn 10–16 ý, 450–750 tiếng, mỗi ý hiển thị không quá 260 ký tự, có nguồn/chương và thứ tự không trùng. ffprobe của 33/33 tệp đạt MP3, 24 kHz, mono, 96000 b/s; có ID3 ghi nguồn AI, chuẩn hóa −16 LUFS/−1,5 dBTP. Audit 132 object ở hai bucket khớp SHA, cue, giọng và hash. Giữ Sadaltager 0,85 cho cả loạt.

Đã rà lại 10 cờ lời/đuôi trên MP3 cuối bằng ASR độc lập và thử cách đọc rõ tên/câu. Bảy cue thuộc sáu bài được thay bằng lượt cải thiện, tái mã hóa từ WAV gốc; các cue còn lại giữ WAV đã dùng. Chỉ một câu diễn đạt ở Gốc cây hồng táo được viết rõ hơn; các thay đổi tên riêng dùng alias, chữ hiển thị/nguồn/chương giữ nguyên. Khóa mới ở cả hai bucket, khóa cũ giữ≥30 ngày. Không ghi đè hoặc xóa object.

## Sáu cờ cần nghe đối chiếu

Không sửa transcript hoặc đổi ngưỡng để làm đẹp điểm. Các cờ còn lại gồm tên riêng, chữ số 52 và hằng/hàng; chưa tự nhận đã được tai người duyệt. Link nghe có mốc giây trong PR #76/#33, hạn 7 ngày. Cờ tốc độ trong báo cáo gốc được giữ riêng; điểm ASR không thay cho nghiệm thu nghe.

| Đợt | Bài | Cue (đếm từ 0) | Giây | WER | Cờ |
|---|---|---:|---:|---:|---|
| D | bong-mat-ho-hang | 0 | 0.0 | 6.38% | chữ số 52 |
| D | bong-mat-ho-hang | 3 | 43.0 | 2.22% | hằng/hàng ở đuôi |
| B | dem-trang-ra-di | 5 | 66.1 | 2.50% | tên riêng |
| D | noi-dau-ba-visakha | 0 | 0.0 | 2.22% | tên riêng |
| D | tro-ve-hoi-tho | 0 | 0.0 | 2.38% | hằng/hàng ở đuôi |
| D | voi-say | 1 | 15.7 | 4.55% | tên riêng |

## Phát hành theo thứ tự

Issue #48 yêu cầu chủ dự án duyệt trong PR trước đổi `da_duyet`. Hiện cả 33 bài vẫn `cho_duyet`. Sau duyệt: cập nhật ngay PR đang có. Chủ dự án merge #76 → chờ staging/kiểm đúng head → #77 → kiểm → #78 → kiểm. Mỗi lần chuyển base PR kế về main và rebase/CI lại. API tương ứng 19/30/42 mục; sau cùng là 40 bài giảng và 2 nghi thức. Đường Xưa chia phần sách 10/13/10 (khác đợt sản xuất 10/11/12); Bóng mát của họ hàng, chương 52, ở Phần Hai.

Main `12747a4` đã merge #71/#69/#73/#82/#81, CI/staging đạt. Kiểm logic mới xác nhận phần chữ Namo trước âm thanh, ba lần lạy với máy quay toàn cảnh rồi Puck 1,00 phát đúng một lần. Kiểm live API/Range/cue của 9 mục đạt; ca phát thật vấp assertion nhãn AI cũ. Claude giữ Issue #83 và `tests/e2e/live-sermon.spec.js`; Codex không sửa tệp đó. Phải kiểm lại ca này sau bản vá. Chưa đủ điều kiện tag v0.16.0.
