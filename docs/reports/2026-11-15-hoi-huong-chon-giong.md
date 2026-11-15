> Chủ dự án đã từ chối ba mẫu 0,85. Xem [Puck nhanh gọn](2026-11-15-hoi-huong-puck.md) cho lựa chọn hiện hành.

# Hồi hướng ngắn — ba giọng chờ chủ dự án chọn

Quyết định mới 15/11 thay bản kết 50–60 giây: chỉ đọc nguyên câu DEDICATE ở tag v0.14.0, không lời cảm ơn/tiễn. Không TTS Pāli.

> Nguyện công đức nghe Pháp này lan đến mọi loài: cho ai khổ được hết khổ, ai sợ được hết sợ, ai sầu được hết sầu.

| Mẫu | Giọng | Giây | WER | LUFS | dBTP |
|---|---|---:|---:|---:|---:|
| A | vi-VN-Chirp3-HD-Orus | 10.44 | 0% | -16.2 | -2.14 |
| B | vi-VN-Chirp3-HD-Fenrir | 8.16 | 0% | -16.08 | -2.13 |
| C | vi-VN-Chirp3-HD-Alnilam | 8.16 | 0% | -16.16 | -2.02 |

Cùng 0,85, cùng lời/nhịp/âm lượng. Ba waveform PCM khác nhau. Google trả đúng giọng nam vi-VN; LINEAR16 → libmp3lame 96k, mono 24k, ID3 AI. Tải/đọc lại MP3+cues cả hai bucket (12 object); SHA/Content-Type/ID3/cues khớp. Orus lượt 1 ASR nhận Nguyện thành Nguyễn; giữ lỗi, chọn lượt 2 WER0%, không sửa transcript.

Độ dứt khoát/truyền cảm cần chủ dự án nghe; chưa chọn giọng, không đưa ba mẫu `_mau-giong` vào D1 hoặc `_audio.lock`. Tạm bỏ khóa bản kết cũ khỏi nguồn đang chờ duyệt. Không đổi cấu hình giọng chung. Sau chọn, dùng chính bytes đã nghe cho khóa nghi thức chính thức và khai báo meta.audio.voice riêng; không sinh lại.

Mở đầu chỉ còn bốn cue lời Việt, bỏ ba cue Namo/Pāli; giữ nguyên WAV Việt đã nghe. 0,85 = 22,95s, 0,80 = 24,29s; cả hai bucket khớp, giữ 0,85 đã chọn. Client Claude #79/#82 hiển thị Pāli, quay về chúng sanh đảnh lễ ba lần rồi mới phát hồi hướng một cue; không phụ thuộc Sādhu trong audio. Codex không sửa apps/web/ADR.

Giữ mọi khóa nghi thức cũ ít nhất 30 ngày trong `_audio.retired.json`, không DELETE. Link ký 7 ngày ở PR81/#33, không commit URL. PR81 Draft; chưa final verdict, chưa đủ tag v0.16.0.
