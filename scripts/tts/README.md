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

Sinh bộ bài và sổ khóa được bổ sung ở PR công cụ sản xuất tiếp theo; dữ liệu đi qua PR `hermes/`, không thay trạng thái phát hành.
