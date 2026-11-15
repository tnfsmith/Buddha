# Puck — hồi hướng nhanh gọn, chủ dự án đã duyệt P1

Ba giọng 0,85 trước đã bị chủ dự án từ chối vì chậm/thiếu năng lượng. Theo yêu cầu mới: Puck, nhịp nhanh hơn, bỏ pause dài; giữ nguyên câu hồi hướng tag v0.14.0, không Pāli hoặc lời cảm ơn.

> Nguyện công đức nghe Pháp này lan đến mọi loài: cho ai khổ được hết khổ, ai sợ được hết sợ, ai sầu được hết sầu.

| Mẫu | Tốc độ | Giây | WER | LUFS | dBTP |
|---|---:|---:|---:|---:|---:|
| P1 | 1.00 | 7.01 | 0% | -16.17 | -2.14 |
| P2 | 1.10 | 6.34 | 0% | -16.19 | -2.15 |

Hai mẫu đều đủ lời/đúng đuôi, MP3 96k mono24k/ID3, cả hai bucket đọc lại khớp SHA/cues/Content-Type. Dùng nhịp câu ngắn và dấu kết câu mạnh, không tăng âm lượng để giả cảm giác truyền cảm. Điểm pace thô còn cờ theo ngưỡng chậm cũ, giữ nguyên vì chủ dự án yêu cầu nhanh.

Đã thử 1,20 nhưng còn cờ thiếu từ/đuôi; thử nhấn chữ và SSML được Google chấp nhận nhưng còn sai/thừa lời, nên loại khỏi lựa chọn đọc đủ câu. Giữ toàn bộ transcript/lượt thử trong JSON, không sửa điểm.

Chủ dự án đã nghe duyệt P1/Puck1,00 ngày 15/11. Đã gắn khóa phát hành và chuyển bản kết da_duyet. Main lock ràng buộc đúng voice Puck/rate1,00 riêng cho nghi thức; giữ nguyên giọng/khóa thư viện. Nguồn Việt chỉ một cue, Pāli > chỉ hiển thị. Claude #82 giữ máy quay hướng chúng sanh đảnh lễ ba lần rồi mới phát hồi hướng. Codex không sửa apps/web, không đổi 7 bài/33 Đường Xưa. Link nghe ký 7 ngày ở PR81/#33; không merge/tag.

Tệp phát hành giữ nguyên SHA-256 của đúng mẫu P1 đã nghe, không gọi TTS hay mã hóa lại. Hai bucket đối chiếu giống mẫu; cờ pace theo ngưỡng chậm cũ vẫn giữ cùng phê duyệt nghe. Chưa merge/deploy; cần client #82 hoàn tất máy quay/đảnh lễ.
