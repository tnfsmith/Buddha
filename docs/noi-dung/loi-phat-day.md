# Loạt bài giảng «Lời Phật dạy»

- **Ngày:** 14/11/2026 · **Mã loạt:** `loi-phat-day` · **Menu riêng** trong tab Thuyết giảng, tách khỏi «Đường Xưa Mây Trắng»
- **Quyết định của chủ dự án (14/11/2026):** giữ bảy bài của v0.14.0, viết dài hơn, ý rõ hơn, dễ hiểu hơn; đặt thành menu riêng để sau này thêm nhiều bài theo cách này, song song với loạt Đường Xưa.
- **Hợp đồng kỹ thuật:** [ADR 0002](../adr/0002-bai-giang-giong-doc-r2.md) · **Issue:** #53 · **Nội dung:** `content/bai-giang/<id>.md` ([PR #54](https://github.com/tnfsmith/Buddha/pull/54))

## 1. Khác gì loạt Đường Xưa

| | Lời Phật dạy | Đường Xưa Mây Trắng |
|---|---|---|
| Trọng tâm | **Một bài kinh**: Đức Phật dạy gì, giảng từng điểm | **Một câu chuyện** trong đời Đức Phật, theo trình tự sách |
| Thứ tự | Theo `thu_tu` do chủ dự án định (bước 10) | Theo chương sách |
| Nguồn | Kinh tạng Pāli (Nikāya), ghi số kinh | "Phỏng theo Đường Xưa Mây Trắng, chương N" + kinh gốc |

## 2. Cách giảng một bài (bốn nhịp)

| Nhịp | Số ý | Viết gì |
|---|---|---|
| 1. Bối cảnh | 1–2 | Ngài dạy ở đâu, cho ai, vì sao, nói ngắn. |
| 2. Lời dạy | 6–10 | Từng điểm của bài kinh, đúng ý kinh gốc, giảng bằng lời đời thường. Thuật ngữ giải nghĩa ngay; khi cần thì thêm một ví dụ trong đời sống hôm nay. |
| 3. Việc làm hôm nay | 1–2 | Một việc nhỏ, cụ thể, ai cũng làm được. |
| 4. Lắng | 1 | Một hình ảnh để người nghe mang theo. |

Khuôn khổ và điều cấm giống loạt Đường Xưa ([`duong-xua-may-trang.md`](duong-xua-may-trang.md) mục 2):

- 10–16 ý, mỗi ý ≤ 260 ký tự, một câu Pāli;
- lời mới, không chép bản dịch;
- không hứa chứng đắc, không gắn với tiền.

## 3. Danh sách

| thu_tu | id | Tên | Nguồn | Trạng thái |
|---|---|---|---|---|
| 10 | `chuyen-phap-luan` | Chuyển Pháp Luân | SN 56.11 | v2 chờ duyệt (PR #54) |
| 20 | `vo-nga-tuong` | Vô Ngã Tướng | SN 22.59 | v2 chờ duyệt |
| 30 | `tu-bi` | Tâm Từ | Sn 1.8 | v2 chờ duyệt |
| 40 | `diem-lanh` | Điềm Lành | Sn 2.4 | v2 chờ duyệt |
| 50 | `kalama` | Kālāma | AN 3.65 | v2 chờ duyệt |
| 60 | `niem-xu` | Niệm Xứ | MN 10 | v2 chờ duyệt |
| 70 | `phap-cu` | Pháp Cú · Song Yếu | Dhp 1–6 | v2 chờ duyệt |

**Bài có thể thêm sau** (chủ dự án chọn): Lễ sáu phương (DN 31, đã có nháp), Kinh Hạnh phúc của người tại gia (AN 4.62), Ba điều ai cũng làm được (Dhp 183), Tấm gương (MN 61), Hơi thở (MN 118).

## 4. Giọng đọc và R2

- **Một giọng duy nhất cho mọi loạt.** Giọng chọn ở #49 dùng chung cho Lời Phật dạy và Đường Xưa.
- **Thư mục R2 tách theo loạt:**
  - `bai-giang/loi-phat-day/<id>/v<version>-<hash8>/vi-<voice>.mp3` (+ `.cues.json`);
  - `bai-giang/duong-xua/…` cho loạt kia.
- Bảy bài lên v0.15.0 bằng chữ. Có tiếng khi giọng đã chọn, `/media` (#50) và client (#51) đã merge.
