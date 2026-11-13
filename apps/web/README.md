# Vân Đạo — bản dựng thử chạy trên trình duyệt

`van-dao.html` là một tệp duy nhất: mở bằng Chrome, Edge hoặc Safari là chạy, không cần máy chủ hay mạng.
Thư mục này là mã nguồn để dựng lại tệp đó.

## Dựng lại

Chạy ở thư mục gốc repo (npm workspaces, Node.js 26):

```
npm ci
npm run build         # tạo apps/web/dist/van-dao.html và apps/web/public/index.html
```

Luật dùng chung (Kusala, Tịnh danh, lịch thời thiền, âm lịch) nằm ở `packages/shared`; trạng thái trên máy ở `src/state.js`.

## Cấu trúc

| Tệp | Nội dung |
| --- | --- |
| `src/data.js` | Kịch bản 15 phút (7 mốc), chuông, đường bao hơi thở, Giai đoạn 0 + 4 tầng, 6 phân khu, 49 ngày, công thức Kusala |
| `src/audio.js` | Web Audio: dao động chạy liên tục, chuông có đường bao về đúng 0, HRTF, 3 chế độ sinh học, trình phát và phép đo ngoại tuyến |
| `src/music.js` | Vân Nhạc: 7 khúc nhạc nền sinh trực tiếp (đàn, sáo, chuông bát, chuông gió, nền hòa âm, vang), đổi khúc hòa tan, phát liên tục / lần lượt / ngẫu nhiên, chọn theo buổi – lịch tu – tâm trạng, nhường thời thiền, phép đo ngoại tuyến |
| `src/realm.js` | Cõi mở rộng: khoảng 300 đảo xa và 15 bảo tháp dựng theo lô, 4 đàn hạc |
| `src/sermon.js` | Thuyết giảng: 7 bài tóm lược ý kinh (viết lời mới, kèm nguồn Nikāya và câu Pāli), trình tự đảnh lễ – giảng – Sādhu – hồi hướng, đọc thành tiếng bằng giọng máy của thiết bị nếu có |
| `src/birds.js` | Chim nhỏ bay tới đậu cạnh nhân vật, trên cây, nóc Tịnh Thất, Bia, Cổng, bậc thềm; hót rồi bay đi |
| `src/gfx.js` | Nhiễu và họa tiết vẽ bằng mã: mây, lá cây, cỏ, ngói, bia, gương mặt, hình Tôn tượng |
| `src/people.js` | Nhân vật hình người (3 tư thế), tùy biến diện mạo và y phục, đám đông dựng theo lô, quy tắc và gợi ý Tịnh danh |
| `src/island.js` | Địa hình đảo, Tịnh Thất mái cong, cây lá thật, hồ sen, thác, đảo láng giềng theo từng tầng |
| `src/world.js` | Cảnh tổng: trời, biển mây, Tôn tượng, 40 đảo trên 4 tầng, Vân Tọa Tầng 4, Đại Thiền Đường, di chuyển, du vân thăm bạn, máy quay |
| `src/main.js` | Giao diện, trang tạo nhân vật, bảng 49 ngày, lưu trạng thái (localStorage), radar, dao động ký, vòng lặp |
| `shot.mjs` | Kiểm thử bằng Chrome không giao diện: chụp cảnh, đo âm thanh, thử phát/tua/dừng |

## Kiểm thử

```
node shot.mjs "island|sim=20|6000" "hall|mode=hall&t=700|6000"   # ảnh trong dist/
node shot.mjs "probe|[[0,90],[650,80]]"                          # đỉnh, RMS, số gián đoạn
node shot.mjs "live"                                             # phát, tua, can thiệp sinh học, dừng
node shot.mjs "eval|q=0|(async()=>{const A=window.__app,o=[];for(const s of A.SONGS)o.push(await A.probeSong(s.id,90));return o})()"   # đo 7 khúc nhạc nền
```

Tham số sau dấu `#` của địa chỉ: `mode=hall|journey`, `t=<giây>`, `sim=<ngày 1–49>`, `tier=<0–4>`, `view=board|creator`, `realm=1` (toàn cõi), `music=1` (mở bảng nhạc), `q=<0|1|2>` (khóa mức đồ họa), `snap=1` (bỏ chuyển cảnh).

Tải cảnh đo ở bản này: khoảng 1,3 triệu tam giác và 490 lần vẽ mỗi khung hình.

Phông chữ Be Vietnam Pro và Noto Serif (giấy phép SIL OFL) được nhúng sẵn trong tệp; khi dựng, toàn bộ văn bản được chuẩn hóa NFC để không rời dấu. Tham số thử thêm: `sermon=<id bài>&sk=<giây bỏ qua>`, `at=<nút>` (đặt nhân vật tại một khu). Ứng dụng tự hạ mức đồ họa khi máy chậm.

## Giới hạn của bản này

- Chạy một người. Người ngồi trong Đại Thiền Đường, trên các đảo và ba bạn đồng tu là mô phỏng.
- Cảnh và nhân vật dựng hoàn toàn bằng mã, chưa dùng mô hình 3D hay ảnh chụp; muốn chân thật hơn nữa cần mô hình GLB, chất liệu và HDRI do họa sĩ làm.
- Kinh Đài AI chưa nối máy chủ GraphRAG.
- Chế độ sinh học chọn bằng tay; chưa đọc cảm biến nhịp thở hay nhịp tim.
- Tiến trình lưu trong trình duyệt của máy đang dùng, chưa đồng bộ giữa các thiết bị.
- Dùng WebGL (WebGLRenderer) cho chắc chắn; chưa chuyển sang WebGPU.
