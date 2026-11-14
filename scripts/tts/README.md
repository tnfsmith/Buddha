# Giọng đọc sinh trước — #49

Google Chirp 3: HD, một giọng nam `vi-VN-Chirp3-HD-Sadaltager`, tốc độ 0,85 cho cả hai loạt. Chủ dự án chọn Google và cho phép Google STT đo lỗi; không gửi dữ liệu người dùng. Google không xác nhận vùng miền. Độ ấm cần người nghe đánh giá; bảng đo tự động không thay việc nghe.

Cần Node, FFmpeg (`FFMPEG_PATH` nếu chưa có trong PATH), cấu hình riêng ngoài Git: `GOOGLE_APPLICATION_CREDENTIALS` hoặc `GOOGLE_TTS_API_KEY`, `GOOGLE_CLOUD_PROJECT`, `CF_STAGING_API_TOKEN/ACCOUNT_ID`, `CF_PROD_API_TOKEN/ACCOUNT_ID`. ADC ưu tiên nếu có cả hai cách. Token Cloudflare sẵn có cần R2 Read/Write và khả năng ký S3; công cụ không tạo token mới.

Từ gốc repo, sau khi nạp cấu hình bằng `node --env-file=<tệp riêng>`:

```text
node scripts/tts/bench.mjs
node scripts/tts/select-voice.mjs --bench-dir <cache>
node scripts/tts/publish-bench.mjs --bench-dir <cache> --date 20261115 --upload
```

- `bench` giữ 288 kết quả gốc (sáu giọng, ba lượt, hai đoạn thử), không biến kết quả chưa đạt thành đạt.
- `select-voice` kiểm tên riêng ba lượt ở tốc độ chậm hơn; mỗi ý tối đa bốn lần, lưu mọi lần trước khi chọn vào `giong.json`.
- `publish-bench` mặc định chỉ kiểm; `--upload` tải 18 mẫu lên staging và lưu URL GET ký sẵn bảy ngày trong cache bị Git bỏ qua. `/media` chặn mẫu.
- `benchmark.json` là số đo thật của lần chọn hiện hành. ASR có thể nhận nhầm tên hiếm; giữ lỗi gốc để đối chiếu, không bỏ dấu thanh để làm đẹp điểm.
- R2 không ghi đè khóa đã có nội dung khác. Mỗi lần upload đều tải lại và so SHA-256. Không đưa âm thanh lớn, thông tin xác thực hay URL nghe tạm vào Git.

Sinh bộ bài (mặc định chỉ kiểm đầu vào; thêm `--upload` mới gọi dịch vụ):

```text
node scripts/tts/generate.mjs --series loi-phat-day --batch A --content-root <worktree-hermes>/content/bai-giang
node scripts/tts/generate.mjs --series loi-phat-day --batch A --content-root <worktree-hermes>/content/bai-giang --upload
```

Đường Xưa dùng `--series duong-xua --batch B` (rồi C, D), thêm `--allow-drafts` để tạo tệp nghe bản nháp. Không đổi trạng thái. Công cụ chỉ ghi `body_r2_key` và `_audio.lock.json` trong worktree nhánh `hermes/`, sau khi MP3+cues được kiểm trên **cả hai** bucket. Bản nháp chỉ nghe qua URL ký, không qua `/media`.

Mỗi ý TTS→STT tối đa bốn lần; chưa đạt giữ cờ trong sổ để người nghe kiểm. MP3 mono 24 kHz/**96 kbps**, loudnorm −16 LUFS/−1,5 dBTP; cues đo từ PCM thật, nghỉ 0,9 giây (1,5 trước ý cuối). Cache `.wrangler/tts-generated` giữ WAV/điểm/tệp cuối; cùng băm không gọi lại dịch vụ hoặc mã hóa lại. Mạng/upload lỗi thì chạy lại cùng lệnh; không ghi sổ nửa chừng cho bài chỉ có một bucket. Không xóa cache trước khi tải xong.

Quyết định 15/11: dùng LINEAR16/WAV Google gốc để mã hóa libmp3lame 96k, không nén lại MP3 cũ, không dùng đầu ra MP3 Google, không thêm `compression_level`. Nhãn băm có `96k` để giữ khóa mới riêng. Từng tệp phát hành phải được ffprobe xác nhận `mp3, 24000 Hz, mono, 96000 b/s`; đọc lại hai bucket đối chiếu SHA-256. `_audio.retired.json` ghi khóa cũ và thời điểm sớm nhất được dọn sau 30 ngày; chỉ dọn khi không còn tham chiếu D1. Mẫu thử giọng cũ không phải bằng chứng định dạng 96k của bài phát hành.

Nếu cả bốn lượt còn cờ, chọn lượt tốt nhất theo WER/tên/đuôi và sai lệch nhịp, vẫn giữ cờ; không mặc định lấy lượt cuối có thể kém hơn. Sổ mới ghi `selected_attempts` để truy lại WAV/điểm đã dùng. Muốn đổi tệp đã tải phải tăng version nội dung và ghi khóa mới, giữ khóa cũ; không bật ghi đè và không tăng số lần gọi để tìm màu xanh.

Đo LUFS/true peak **sau** mã hóa MP3 và lấy mẫu 24 kHz; nếu lệch thì chỉnh mức nội bộ rồi mã hóa lại từ PCM, tối đa bốn lượt. Chặn đầu ra lệch quá 0,5 LUFS hoặc đỉnh lớn hơn −1,5 dBTP; số đo cuối ghi trong sổ. Revision định dạng `verified-v2` đổi băm để không ghi đè bản thử trước đó.

`tts-lock.test.js` tự kiểm sổ hiện có trong repo khi chạy `npm test`: bài có khóa phải có dòng và băm khớp lời đọc, cùng giọng; sửa chữ phải sinh khóa mới. Cues được kiểm số ý/khoảng nghỉ/đuôi trước upload. CI không gọi dịch vụ thật. PR vẫn cần link nghe/cờ QA và kiểm staging sau merge.

`node scripts/tts/audit.mjs --content-root <worktree-hermes>/content/bai-giang --series loi-phat-day --batch A` tải lại MP3+cues của cả hai bucket, so SHA-256, Content-Type, voice/hash/số ý/thời gian với sổ. Chỉ đọc; kết quả và link nghe bảy ngày nằm trong `.wrangler/tts-audit/latest.json` (bị Git bỏ qua).
