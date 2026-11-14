# ADR 0002 — Bài giảng có giọng đọc: định dạng nội dung, R2, `/media`, phát ở client

- **Ngày:** 14/11/2026
- **Trạng thái:** đề xuất, chờ chủ dự án merge. Thiết kế: Claude. Triển khai: Codex (nội dung, giọng đọc, máy chủ) và Claude (client).
- **Issue:** #47 (thiết kế), #48 (nội dung), #49 (giọng đọc), #50 (máy chủ), #51 (client); liên quan #46 (nạp D1), #35 (migration), #55 (Hội đồng không bắt buộc)
- **Dàn bài loạt:** [`duong-xua-may-trang.md`](../noi-dung/duong-xua-may-trang.md) (Đường Xưa Mây Trắng) · [`loi-phat-day.md`](../noi-dung/loi-phat-day.md) (Lời Phật dạy, #53)

## Bối cảnh

Ngày 14/11/2026 chủ dự án yêu cầu:

- dựng loạt bài giảng theo đúng trình tự tác phẩm *Đường Xưa Mây Trắng*, mỗi bài là một câu chuyện cùng lời Đức Phật dạy trong chuyện đó;
- nội dung cô đọng, gợi hình, để người nghe thấy tấm lòng bao dung, bác ái của Ngài với mọi loài;
- giữ bảy bài của v0.14.0, viết chi tiết hơn;
- **(chỉnh cùng ngày)** bảy bài ấy thành loạt riêng «Lời Phật dạy» có **menu riêng**, để sau này thêm nhiều bài theo cách này song song với loạt Đường Xưa; **một giọng đọc duy nhất** cho mọi loạt; thư mục R2 tách theo loạt;
- Codex viết nội dung, chọn giọng OpenAI trầm ấm, sinh giọng đọc từng bài và đưa lên R2 `vandao-media` theo thư mục dễ quản lý khi số bài tăng.

Hiện trạng sau #39 / PR #45: client chỉ phát bài `da_duyet` lấy từ `GET /api/v1/content?kind=bai_giang`. Hợp đồng `body_inline` là mỗi dòng một ý, dòng `>` là câu Pāli. Chưa có `content/`, công cụ nạp, đường `/media`, và API chưa trả `body_r2_key`.

Ràng buộc:

- **Bản HTML đơn không chứa âm thanh.** Lộ trình §2 điều 5: "bản ghi tham khảo (nếu có) để trên R2, tải theo yêu cầu".
- **Thời thiền giữ nguyên.** Âm thanh thời thiền vẫn sinh bằng Web Audio (`AGENTS.md` 1.3). Giọng đọc chỉ phát ở tab Thuyết giảng; không thay chuông, không thay nhạc thiền.
- **OpenAI ngừng mọi mô hình của `/v1/audio/speech` ngày 06/01/2027** (`tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`), thay bằng `gpt-realtime-2.1-mini` qua Realtime API ([trang ngừng mô hình của OpenAI](https://developers.openai.com/docs/deprecations)). Các mô hình chuyển giọng nói thành chữ dùng để kiểm lỗi (`gpt-4o-transcribe`, `gpt-4o-mini-transcribe`) ngừng ngày 26/02/2027.
- **Theo chính sách sử dụng của OpenAI**, phải báo rõ cho người nghe rằng giọng đọc do AI tạo.
- Chỉ phát bài chủ dự án đã chọn phát hành (`status = 'da_duyet'`); không bao giờ nói người dùng đã chứng đắc. Theo #55 (14/11/2026), Hội đồng cố vấn là tư vấn tùy chọn, không phải điều kiện hiển thị.
- `AGENTS.md` 1.1: không gắn bài giảng với tiền, Gieo Duyên hay Đại Công Đức.

## Quyết định

### 1. Nội dung: `content/bai-giang/<id>.md` (định dạng v2)

Mỗi bài là một tệp Markdown có front-matter. Thân bài giữ hợp đồng client hiện có (#46), bổ sung vài quy ước cho giọng đọc.

```markdown
---
id: con-thien-nga               # ổn định, không đổi khi sửa bài
version: 1                      # tăng khi chủ dự án duyệt lại bản sửa
kind: bai_giang
tier: 0
lang: vi
title: Con thiên nga bị thương
source_ref: "Phỏng theo Đường Xưa Mây Trắng (Thích Nhất Hạnh), chương 4 · Phật truyện (Lalitavistara) · Pháp Cú 129–130"
status: cho_duyet               # nhap | cho_duyet | da_duyet | ngung
reviewed_by:                    # tùy chọn: người chọn phát hành
reviewed_at:                    # tùy chọn: epoch giây
meta:
  loat: duong-xua               # loạt
  phan: 1                       # phần của loạt (1–3)
  thu_tu: 20                    # thứ tự trong loạt, bước 10 để chèn bài sau này
  chuong: [4]                   # chương trong sách
  dot: B                        # đợt sản xuất (A–D)
---
Buổi sáng mùa xuân ở thành Ca Tỳ La Vệ…
Bỗng có tiếng dây cung bật lên…
> Sabbe tasanti daṇḍassa, sabbe bhāyanti maccuno; attānaṃ upamaṃ katvā, na haneyya na ghātaye.
…
```

- **Mỗi dòng không trống là một ý:** 1–3 câu, tối đa 260 ký tự, 10–16 ý mỗi bài (450–750 tiếng, đọc chậm khoảng 4–6 phút).
- **Pāli:** dòng bắt đầu bằng `>` là câu Pāli gốc, tối đa một câu mỗi bài, khớp từng chữ với SuttaCentral. Chỉ hiện chữ, giọng AI không đọc.
- **Cách đọc khác cách viết:**
  - Dùng `[[chữ hiển thị|cách đọc]]` trong dòng, ví dụ `[[Pháp Cú 129|Pháp Cú một trăm hai mươi chín]]`.
  - Công cụ nạp bỏ cú pháp này khi ghi `body_inline` (chỉ giữ chữ hiển thị); công cụ giọng đọc chỉ dùng cách đọc.
  - Từ lặp lại nhiều bài (tên riêng, Hán Việt khó) đặt trong `content/tu-dien-doc.yml`, áp cho mọi bài.
- **Không** có văn bản "kịch bản đọc" riêng, để chữ trên màn hình và lời đọc không lệch nhau.
- Chỉ bài `status: da_duyet` vào D1. Bài thiếu `source_ref` hoặc không có ý nào thì không vào. `reviewed_at` không bắt buộc (#55).
- Văn phong và dàn bài theo [`docs/noi-dung/duong-xua-may-trang.md`](../noi-dung/duong-xua-may-trang.md).

### 2. Danh mục và thứ tự: cột `content_item.meta`

- Migration kế tiếp `0008_content_meta.sql` thêm `meta TEXT` (JSON, có thể rỗng) vào `content_item`. Codex tạo sau khi #35 tuần tự hóa migration.
- Nội dung `meta` là khối front-matter ở mục 1, thêm `audio` (mục 3).
- Trong khi chờ 0008, client vẫn chạy: thiếu `meta` thì hiện theo thứ tự API trả về.
- **Loạt hiện có:** `loi-phat-day` (Lời Phật dạy: bảy bài v0.14.0 giữ `id`, `version: 2`) và `duong-xua` (Đường Xưa Mây Trắng). Mỗi loạt là một menu riêng trong app, xếp theo `thu_tu`.
- Bài thiếu `meta.loat` (kể cả khi API chưa trả `meta`) vào loạt mặc định `loi-phat-day`.
- Thêm loạt mới chỉ cần giá trị `meta.loat` mới (chữ thường, gạch nối) và một dòng tên loạt trong client.

### 3. Âm thanh trên R2

**Cây thư mục** (cả `vandao-media-staging` và `vandao-media`):

```
bai-giang/
  <loat>/<id>/v<version>-<hash8>/<lang>-<voice>.mp3          # giọng đọc
  <loat>/<id>/v<version>-<hash8>/<lang>-<voice>.cues.json    # mốc thời gian từng ý
  _mau-giong/<yyyymmdd>/<voice>.mp3                          # mẫu thử giọng; không phục vụ qua /media
  _khung/                                                    # để dành: đảnh lễ, hồi hướng có tiếng (giai đoạn sau)
```

Ví dụ, mỗi loạt một thư mục:

- `bai-giang/loi-phat-day/chuyen-phap-luan/v2-8c01d2aa/vi-cedar.mp3`
- `bai-giang/duong-xua/con-thien-nga/v1-3fa94c1d/vi-cedar.mp3`

- **`<hash8>`** là 8 ký tự đầu của SHA-256, băm trên: lời đọc sau từ điển, giọng, mô hình, câu chỉ dẫn, tốc độ.
  - Khóa vì thế không bao giờ bị ghi đè, nên cache được vĩnh viễn.
  - Đổi một chữ thì sinh khóa mới.
  - Khóa cũ giữ 30 ngày rồi mới xóa.
- Không dùng `thu_tu` trong đường dẫn: đổi thứ tự không phải chuyển tệp.
- Loại nội dung khác dùng cùng mẫu dưới tiền tố riêng (`bai-thien/`, `kinh-van/`… trùng giá trị `kind`).
- **`content_item.body_r2_key`** = khóa tệp `.mp3`. Tệp `.cues.json` cùng tên, đổi đuôi.
- **Định dạng:**
  - MP3 CBR 64 kbps, mono, 24 kHz (giữ tần số mẫu gốc của OpenAI);
  - chuẩn hóa −16 LUFS, đỉnh −1,5 dBTP;
  - lặng 0,9 giây giữa hai ý và 1,5 giây trước ý cuối.
  - Một bài 5 phút khoảng 2,4 MB. Cả loạt 36 bài dưới 100 MB, trong hạn mức Free của R2.
- **`cues.json`:**

```json
{ "v": 1, "id": "con-thien-nga", "version": 1, "lang": "vi",
  "voice": "cedar", "model": "gpt-4o-mini-tts", "hash": "3fa94c1d", "dur": 287.4,
  "cues": [ { "i": 0, "t": 0.0, "e": 14.2 }, { "i": 1, "t": 15.1, "e": 24.8 } ] }
```

  - `i` là chỉ số ý: các dòng không phải Pāli, theo thứ tự.
  - `t`, `e` là giây bắt đầu và kết thúc.
  - Số `cues` phải bằng số ý; sai thì client bỏ âm thanh, chỉ hiện chữ.
- **Sổ âm thanh `content/bai-giang/_audio.lock.json`** (Codex commit): mỗi bài một dòng gồm `id, version, key, hash, dur, voice, model, generated_at, wer`.
  - Đây là nguồn sự thật về những gì đang có trên R2.
  - CI kiểm: mỗi bài `da_duyet` có `body_r2_key` đều có dòng tương ứng.

### 4. Phục vụ: `GET /media/<khóa>` trong `workers/api`

- **Chỉ phục vụ khóa của bài đã duyệt:** khóa `.mp3` (hoặc `.cues.json` đổi về `.mp3`) phải bằng `body_r2_key` của một dòng `status = 'da_duyet'`. Ngoài ra trả 404, gồm cả `_mau-giong/` và bài chưa duyệt.
- Hỗ trợ `HEAD`, `Range` (206 với `Content-Range`, `Accept-Ranges: bytes`; Safari iOS bắt buộc) và `If-None-Match` (ETag của R2).
- Header:
  - `Cache-Control: public, max-age=31536000, immutable`;
  - `Content-Type: audio/mpeg` hoặc `application/json`;
  - `X-Content-Type-Options: nosniff`.
- Không liệt kê thư mục; không ghi nhận danh tính người nghe vào log.
- **Nghe để duyệt:** Codex gửi đường dẫn ký sẵn của R2, hạn 7 ngày, trong PR nội dung. Không mở bài chưa duyệt qua `/media`.

### 5. API: `GET /api/v1/content`

- Thêm `body_r2_key` vào `SELECT` (cột đã có từ 0005, không cần migration).
- Sau khi có 0008, thêm `meta`.
- Giữ `WHERE status = 'da_duyet'`; giữ nguyên thứ tự hiện có. Client tự xếp theo `meta.thu_tu`.

### 6. Client (Claude)

- **`toSermon`** đọc thêm `body_r2_key` và `meta` (chuỗi JSON hoặc đối tượng):
  - `audio = { src: '/media/' + key, cues: '/media/' + key.replace(/\.mp3$/, '.cues.json') }`;
  - `loat`, `phan`, `order`.
- **Tab Thuyết giảng:**
  - menu riêng cho từng loạt (thẻ «Lời Phật dạy», «Đường Xưa Mây Trắng»); trong loạt chia theo phần nếu có, xếp theo `thu_tu`;
  - bài không có `thu_tu` xếp sau cùng; loạt chưa có bài báo "đang được soạn và duyệt".
- **Khi phát:**
  - `HTMLAudioElement` phát trực tiếp, không đi qua Web Audio, để tránh im tiếng khi `AudioContext` bị treo trên iOS;
  - mở khóa phát ngay trong cú chạm "Thỉnh giảng" (Safari iOS chặn phát sau đó nếu không có cú chạm);
  - hạ Vân Nhạc như hiện nay khi giảng;
  - Tôn tượng "nói" trong khoảng `t`–`e` của từng ý;
  - chữ từng ý hiện theo `cues`;
  - nút tạm dừng / tiếp, ý trước / ý sau.
- **Nhãn cố định khi có tiếng:** "Giọng đọc do AI tạo (OpenAI)".
- **Dự phòng:** không có `body_r2_key`, chạy `file://`, lỗi mạng, hoặc `cues` lệch số ý → phát như hiện nay (chữ theo nhịp, không tiếng).
- **Service worker** (`build.mjs` sinh `sw.js`) bỏ qua `/media/`. Hiện SW gọi `cache.put` với mọi phản hồi `ok`, mà phản hồi 206 không lưu cache được.
- Kiểm khói Playwright giả lập `/media` và API. Không gọi OpenAI hay R2 thật.

### 7. Giọng đọc OpenAI (Codex)

- **Không phụ thuộc lúc chạy.** Worker và client không gọi OpenAI. Âm thanh sinh trước bằng công cụ trong `scripts/tts/`, lưu trên R2. Khi OpenAI ngừng mô hình, các bài đã sinh vẫn phát bình thường.
- **Mô hình:** `gpt-4o-mini-tts` (dùng tên gọi chung; có báo cáo tên kèm ngày bị từ chối 400). Tốc độ khoảng 0,9.
  - Câu chỉ dẫn tiếng Việt cố định, ghi trong `scripts/tts/giong.json` và tính vào băm.
  - Ví dụ: *"Giọng trầm ấm, chậm rãi, nhẹ nhàng như người kể chuyện bên ngọn đèn. Phát âm tiếng Việt chuẩn, đúng dấu thanh. Ngắt nghỉ ở dấu phẩy, dấu chấm. Không đọc như quảng cáo."*
- **Một giọng duy nhất cho mọi loạt** (Lời Phật dạy, Đường Xưa và các loạt sau), để người nghe nhận ra cùng một người giảng. Đổi giọng là quyết định của chủ dự án và phải sinh lại cả kho.
- **Giọng ứng viên:** `cedar`, `marin`, `ash`, `ballad`, `sage`, `verse`.
  - Chỉ chọn giọng có cả ở Speech API lẫn Realtime API, để sau 06/01/2027 các bài mới vẫn cùng một giọng.
  - Loại `onyx`, `fable`, `nova` vì không có trong Realtime. Codex xác nhận lại danh sách với tài liệu OpenAI khi làm.
- **Chọn giọng:**
  1. Sinh đoạn mẫu bằng bài `con-thien-nga` (có tên riêng, Hán Việt, số) cho mỗi ứng viên, mỗi giọng 3 lần.
  2. Chấm theo: đúng dấu thanh (tỉ lệ lỗi chữ khi chuyển ngược thành văn bản), độ ấm và chậm, đọc đúng tên riêng, ổn định giữa 3 lần, có trên Realtime.
  3. Codex **tự chọn một giọng chính, một dự phòng** theo bảng điểm và sinh ngay, không chờ (chủ dự án chỉnh 14/11/2026 để kịp v0.15.0). Mẫu tải lên `_mau-giong/`, gửi đường dẫn ký sẵn.
  4. Chủ dự án nghe sau; muốn đổi giọng thì sinh lại cả kho (chi phí nhỏ). Giọng vẫn phải thống nhất một cho mọi loạt.
- **Cách sinh:**
  - Mỗi ý một lần gọi, cùng giọng, cùng câu chỉ dẫn; ghép bằng `ffmpeg` với khoảng lặng ở mục 3.
  - Mốc `cues` lấy từ độ dài từng đoạn.
  - Sinh từng ý giúp có mốc chính xác và chỉ phải sinh lại đúng ý lỗi.
- **Kiểm lỗi tự động** (mỗi ý):
  - chuyển ngược thành văn bản và so với lời đọc;
  - tỉ lệ lỗi theo tiếng ≤ 5 % sau khi bỏ dấu câu và hoa thường;
  - không mất câu cuối (lỗi cắt đuôi đã được báo với bản 2025-12-15);
  - độ dài 0,3–0,75 giây mỗi tiếng.
  - Lỗi thì sinh lại tối đa 3 lần, vẫn lỗi thì đánh dấu để người nghe.
  - Trước 26/02/2027 dùng `gpt-4o-transcribe`, sau đó đổi sang mô hình thay thế.
- **Hạn chót:**
  - Sinh xong giọng đọc mọi bài đã có văn bản **trước 05/01/2027**, kể cả bài còn `cho_duyet`. Sửa chữ sau đó thì sinh lại ý bị sửa.
  - Công cụ có lớp tiếp hợp `speech | realtime`. Sau 06/01/2027 chuyển sang `gpt-realtime-2.1-mini` cùng giọng, chạy lại bộ kiểm lỗi, cho chủ dự án nghe so sánh trước khi dùng.
- **Khóa bí mật:**
  - `OPENAI_API_KEY` chỉ ở máy Codex hoặc secret của một workflow chạy tay (`workflow_dispatch`).
  - Không bao giờ ở Worker, client hay repo.
  - Tải lên R2 bằng token Cloudflare sẵn có: staging khi merge `main`, production khi gắn tag.

### 8. Quy trình duyệt

1. Codex mở PR nội dung (`hermes/…`): các tệp `content/bai-giang/*.md` ở `cho_duyet`, kèm đường dẫn nghe ký sẵn cho từng bài.
2. Chủ dự án đọc trên GitHub và nghe từng bài. Ghi "Duyệt: id…" hoặc góp ý sửa trong PR.
3. Codex chuyển bài chủ dự án đã chọn sang `da_duyet` (có thể ghi `reviewed_by`, `reviewed_at`, không bắt buộc theo #55); sinh lại giọng nếu chữ đổi. Chủ dự án merge.
4. Merge `main` → công cụ nạp (#46) đưa vào D1 staging và tải âm thanh lên `vandao-media-staging`. Gắn tag → production.
5. Rút một bài: phiên bản mới `status: ngung`; API thôi trả bài, `/media` thôi phục vụ.

## Hệ quả

- Bảy bài «Lời Phật dạy» trở lại app **có giọng đọc** ở v0.15.0. Chủ dự án duyệt ngày 14/11; v0.15.0 chờ công cụ nạp D1 (#46), `/media` (#50) và TTS (#49). Không cần đợi loạt Đường Xưa.
- Migration 0008 (`meta`) phải có trước bài Đường Xưa đầu tiên. Thiếu `meta`, client xếp bài vào loạt mặc định «Lời Phật dạy».
- `AGENTS.md` §6 ("mọi âm thanh sinh bằng `audio.js`, `music.js`") cần thêm ngoại lệ: giọng đọc bài giảng đã duyệt, lưu trên R2, tải theo yêu cầu. Codex giữ `AGENTS.md` nên Codex sửa (#33). Mục 1.3 về thời thiền không đổi.
- Rủi ro và cách giảm:
  - Giọng AI tối ưu cho tiếng Anh, có thể sai dấu thanh tiếng Việt → bộ kiểm lỗi, từ điển cách đọc, chủ dự án nghe duyệt.
  - Hạn 06/01/2027 → ưu tiên sinh sớm; có lớp tiếp hợp Realtime.
  - Bản quyền sách → kể lại bằng lời mới, không chép câu văn; ghi "phỏng theo … chương …" trong `source_ref`.
- Chi phí OpenAI cho cả loạt (36 bài × khoảng 5 phút, tính cả sinh lại) dưới 10 USD theo giá hiện hành.
