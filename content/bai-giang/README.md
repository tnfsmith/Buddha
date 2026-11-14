# Bài giảng (`content/bai-giang/`)

Mỗi tệp là một bài giảng: front-matter + mỗi dòng một ý, dòng `>` là câu Pāli gốc. Định dạng và quy trình duyệt theo [ADR 0002](../../docs/adr/0002-bai-giang-giong-doc-r2.md).

- Bài chỉ vào D1 khi `status: da_duyet` và có `reviewed_at` (#46).
- `meta.loat` chia menu trong app:
  - `loi-phat-day`: Lời Phật dạy, mỗi bài một bài kinh;
  - `duong-xua`: Đường Xưa Mây Trắng, theo trình tự sách.
- Giọng đọc trên R2: `bai-giang/<loat>/<id>/v<version>-<hash8>/vi-<voice>.mp3`. Một giọng cho mọi loạt.
