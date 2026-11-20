# Bạn đồng tu — thiết kế trải nghiệm và phân công (#121)

> Phần mở rộng v2 (#151): Đài Đồng Tu ở Đại Thiền Đường, mời nhóm, hẹn giờ, chia sẻ, tiến trình bạn — xem `dong-tu-dai-thien-duong.md`.

Chủ dự án giao ngày 18/11/2026. Claude thiết kế trải nghiệm, giao diện, 3D và luật dùng chung. Codex viết máy chủ, D1 và mô-đun mạng theo [hợp đồng](../contracts/ban-dong-tu.md). Luật dùng chung: `packages/shared/src/dong-tu.js`. Lộ trình: `PROJECT_ROADMAP.md` §10.4 và GĐ5 (T5.4–T5.8).

## 1. Yêu cầu của chủ dự án

1. Tìm **bạn đồng tu là người quen biết ngoài đời** cùng tham gia Vân Đạo.
2. **Mời bạn ghé thăm / Ghé thăm bạn.**
3. **Mời cùng Ngồi thiền / Trà Đạo / Tham quan** Vân Đảo của mình hoặc của bạn.
4. **Danh sách Bạn đồng tu**, trạng thái online/offline.
5. **Thấy bạn đồng tu ở gần mình** khi đã quen biết, thân thiết qua lời mời tham gia hệ thống.
6. Codex viết mã theo thiết kế của Claude. Hai bên không quá tải, không xung đột tệp.

## 2. Nguyên tắc

- **Chỉ người đã biết nhau.** Kết nối bằng liên kết/mã mời/QR trao tận tay, hoặc gõ đúng «Tịnh danh · mã» rồi bên kia đồng ý. Không có danh bạ công khai, không gợi ý người lạ, không tìm gần đúng, không đọc danh bạ điện thoại.
- **«Ở gần» là gần trong Vân Đạo, không phải vị trí địa lý.** Vân Đảo của bạn đồng tu được dựng cạnh Vân Đảo của mình: thân thiết ở vòng gần nhất, quen biết ở vòng kế. Không thu GPS hay vị trí thiết bị (Luật BVDLCN 91/2025, §15 roadmap). Nếu sau này cần «bạn ở cùng tỉnh», làm việc đó thành lựa chọn riêng, tự khai, mặc định tắt, và phải có quyết định mới.
- **Không làm gián đoạn thời thiền.** Lời mời tới lúc đang thiền thì chờ đến khi xuất thiền, không chuông, không bật lên màn hình.
- **Không chữ tự do.** Chỉ có lời mẫu (`LINES`) và cử chỉ (chắp tay, tùy hỷ) cho tới khi GĐ5 có kiểm duyệt (T5.1).
- **Không điểm, không xếp hạng, không huy hiệu** (AGENTS.md mục 1).
  - «Thân thiết» do hai người cùng chọn, không tự lên theo số lần gặp.
  - Số bạn không hiện thành thành tích.
  - Kết nối bạn đồng tu không cộng Kusala.
  - Lời mời người mới chỉ ghi lại **ai giới thiệu ai** (bảng `guidance` có sẵn). Có dùng bản ghi này cho tiêu chí mở tầng hay không là quyết định riêng ở §8.6/§16 và #107; Bạn đồng tu không mở tầng.
- **Hai chiều đồng ý, rút lại lúc nào cũng được.** Có hủy kết nối, chặn, ẩn trạng thái và chế độ Độc cư (khép Cổng Vân Môn).

## 3. Giai đoạn phù hợp

**GĐ5 — xã hội tu tập**, chia hai đợt:

| Đợt | Nội dung | Phụ thuộc | Khi nào |
|---|---|---|---|
| **5A — Bạn đồng tu (T5.4–T5.8)** | Kết nối, danh sách, hiện diện, lời mời gặp, ghé thăm, cùng thiền/trà/tham quan theo giờ chung, đảo bạn gần đảo mình | Chỉ cần tài khoản/đồng bộ (GĐ2, đã có). Không cần thời gian thực (dùng nhịp hiện diện + hỏi định kỳ 30 giây đã có từ #96). Không cần kiểm duyệt vì không chữ tự do, không người lạ | **Bắt đầu ngay sau khi Claude xong #104 và Codex xong #105**, chạy song song GĐ4 |
| **5B — Cùng đi lại thời gian thực** | Thấy bạn đi lại, kinh hành, chắp tay ngay trên đảo (`IslandRoom`) | GĐ4 T4.1 (`workers/realtime`) | Thuộc T5.2 hiện có |

Lý do không đặt vào GĐ4: GĐ4 là Đại Thiền Đường nhiều người. Bạn đồng tu là quan hệ xã hội, đúng nhóm GĐ5 (bảng `companion`, `invite`, `guidance`, `user_block` đã có từ 0004). Kéo đợt 5A lên sớm vì nó không phụ thuộc thời gian thực hay kiểm duyệt.

Đợt 5A ghi lại dữ kiện «đã thăm đảo bạn» và «ai giới thiệu ai». Các tiêu chí mở tầng ở §1.2/§16 có dùng chúng hay không, và với điều kiện gì, do #107 quyết định.

## 4. Khái niệm

| Khái niệm | Định nghĩa | Mã |
|---|---|---|
| Bạn đồng tu | Hai tài khoản đã đồng ý kết nối | `companion.status = 'dong_y'` |
| Quen biết | Mặc định khi kết nối | `closenessOf` → `'quen'` |
| Thân thiết | Cả hai cùng chọn «Thân thiết» | `closenessOf(true, true)` → `'than'` |
| Lời mời kết bạn | Liên kết `…/#ban=MÃ`, QR, mã 8 ký tự (7 ngày, 5 lượt); hoặc lời kết nối theo «Tịnh danh · mã» (chờ 14 ngày) | `invite`, `companion_request` |
| Lời mời gặp | 5 kiểu: `tham`, `xin_tham`, `thien`, `tra`, `tham_quan` | `MEET_KINDS` |
| Hiện diện | `online` · `thien` · `tham` · `tra` · `vang` (quá 3 phút không có nhịp) | `presenceOf` |
| Ghé khi vắng | Chỉ bạn thân thiết, bạn đã bật cho phép, và chủ đảo đang Nghênh khách lúc ghé | `canVisitAway(me, host, rel)` |

**Điều kiện theo phân khu (dùng lại luật có sẵn, không thêm ngày mới):**
- Đi thăm cần **Cổng Vân Môn của người đi đã nửa mở (ngày 29)** hoặc đã hoàn thành chương trình.
- Chủ đảo phải đang **Nghênh khách**.
- Trà Đạo cần **Trà Đạo Tỉnh Thức của chủ đảo đã mở (ngày 15)**.
- Cùng ngồi thiền dùng được **từ ngày 1**: người chưa đi được thì hai bạn ngồi cạnh nhau ở Đại Thiền Đường.

Tất cả nằm trong `canMeet`; máy chủ và máy khách cùng chạy.

## 5. Luồng người dùng

### 5.1 Mời người quen tham gia Vân Đạo (người mới)
1. Bia hoặc màn Bạn đồng tu → **«Mời bạn tu cùng»** → liên kết + QR + mã `K7M2-QX9A`, nút Chia sẻ (Web Share) và Sao chép.
2. Người nhận mở liên kết. Người mới đi luồng tạo nhân vật như thường, thấy dòng «*Tuệ Thái · 5696* mời bạn cùng tu».
3. Người mới bấm «Giữ hành trình» (phiên khách hiện có). Máy khách gửi mã, hai người thành **bạn đồng tu** ngay, vì người tạo liên kết đã đồng ý từ trước.
   - Bảng `guidance` ghi người giới thiệu, chỉ là dữ kiện.
   - Khách được nhắc lưu mã khôi phục để không mất bạn đồng tu khi tài khoản khách bị dọn.
4. Người mời nhận thông báo trong app: «*Minh An · 2210* đã nhận lời mời và trở thành bạn đồng tu».

### 5.2 Kết nối người đã dùng Vân Đạo
- **Cách 1, mã/QR:** như trên. Người đã có tài khoản mở liên kết thì thấy thẻ xác nhận «Kết nối với *Tuệ Thái · 5696*?».
- **Cách 2, Tịnh danh · mã:** gõ đúng «Tuệ Thái · 5696» → «Gửi lời kết nối».
  - Người gửi luôn thấy «Đã gửi lời kết nối tới Tuệ Thái · 5696», cả lúc gửi lẫn trong mục Đang chờ, dù người ấy có thật hay không, có nhận lời kết nối hay không, đã chặn hay đã từ chối.
  - Bên kia (nếu có thật và nhận lời kết nối) chọn Đồng ý / Từ chối. Từ chối thì người gửi không được báo; lời kết nối tự hết hạn sau 14 ngày.
  - Chỉ khi đồng ý, người ấy mới hiện trong danh sách bạn.
  - Tối đa 5 lời kết nối/ngày.

### 5.3 Danh sách và trạng thái
- Nhóm: **Thân thiết** → **Quen biết** → **Đang chờ** (gửi đi / gửi đến).
- Mỗi dòng: chấm trạng thái, Tịnh danh · mã, dòng phụ («Đang tọa thiền», «Vắng mặt · hôm nay»), ngày hành trình nếu bạn đó cho hiện. Nút chính đổi theo `canMeet`.
- Trạng thái chỉ hiện với bạn đồng tu. Người tắt «Hiện trạng thái» luôn hiện là «Vắng mặt», không có giờ.

### 5.4 Mời gặp và trả lời
1. Chọn bạn → **Mời ▾**: Ghé thăm đảo mình · Cùng ngồi thiền · Trà Đạo · Tham quan đảo mình; hoặc **Xin ghé thăm** đảo bạn. Nút không dùng được thì mờ, kèm câu trong `REASON_TEXT`.
2. Bên nhận thấy thẻ ở góc màn hình: lời mẫu, Đồng ý / Để lúc khác, đếm ngược 10 phút. Đang thiền thì thẻ chờ tới lúc xuất thiền. Đang trong một cuộc gặp khác thì máy khách tự trả «Để lúc khác».
3. Đồng ý với hoạt động cùng giờ (thiền, trà): máy chủ đặt `start_at = lúc nhận + 60 giây`. Hai máy cùng đếm ngược theo giờ máy chủ (`server_now`) rồi bắt đầu, lệch dưới 1 giây.

### 5.5 Ghé thăm / Tham quan
Dùng chuyến du vân qua Vân Môn có sẵn (#116): đi ra Cổng Vân Môn → mây hạ xuống → bay theo vân lộ → hạ xuống trước Vân Môn đảo bạn → đi vào.
- **Có chủ nhà:** bạn đứng đón và chào. Ở đợt 5A, nhân vật của chủ đứng ở vị trí hiện diện gần nhất, không đi theo. Tham quan dùng bảng phân khu của đảo bạn, đánh dấu chỗ chủ giới thiệu. Đợt 5B mới có đi cùng thời gian thực.
- **Ghé khi vắng:** đảo vẫn đẹp như chủ đã chăm, Vân Tọa trống, đèn mây tắt. Khách chắp tay, tùy hỷ rồi về. Chủ thấy «*Minh An* đã ghé thăm hôm nay».

### 5.6 Cùng ngồi thiền
- **Nơi ngồi:** Đài Thiền của chủ đảo; người chưa đi được thì cùng ngồi ở Đại Thiền Đường. Hai Vân Tọa cạnh nhau, cùng hướng Tôn tượng.
- **Âm thanh:** mỗi máy tự phát thời thiền 15 phút của mình, bắt đầu cùng `start_at`. Âm thanh vẫn là Web Audio trên từng máy, không truyền âm qua mạng. Mất mạng thì vẫn ngồi đủ.
- **Sau khi xong:** hai bên được tự ghi nhận `thoi_thien` như thường. Lời gợi ý chứng thực tuần (§9.4) có thể nhắc đến bạn đồng tu, nhưng không tự cộng gì.

### 5.7 Cùng Trà Đạo
Bàn trà ở Trà Đạo Tỉnh Thức của chủ đảo, 10 phút theo giờ chung. Tiến trình: pha trà → rót hai chén → ngắm mây → lời hồi hướng ngắn. Âm thanh trà dùng `sfxVoice`/Web Audio. Hai nhân vật ngồi đối diện.

### 5.8 Thân thiết, ghé khi vắng, hủy, chặn
Trong thẻ bạn:
- «Đánh dấu thân thiết»: bên kia thấy gợi ý «*Tuệ Thái* muốn là bạn thân thiết».
- «Cho bạn ghé khi tôi vắng»: chỉ khi đã thân thiết, mặc định tắt. Chế độ Độc cư luôn thắng: đang khép cổng thì không ai ghé được, kể cả bạn đã được cho phép.
- «Hủy kết nối».
- «Chặn» (cùng `user_block`): xóa kết nối, ẩn trạng thái, từ chối mọi lời mời. Lời kết nối đang chờ giữa hai người chỉ bị vô hiệu phía nhận: người chặn không còn thấy, người bị chặn vẫn thấy «Đã gửi» như cũ và chỉ thấy như kết nối đã bị hủy (hợp đồng §3.4).
- «Báo cáo» (`report.context = 'island'`).

## 6. Giao diện (Claude thiết kế và dựng)

### 6.1 Điểm vào
- **Nút «Bạn đồng tu»** trên thanh chính, cạnh Bia: có chấm số khi có yêu cầu hoặc lời mời đang chờ; không hiện số bạn.
- **Cổng Vân Môn**: panel hiện có thêm «Bạn đồng tu (n đang ở Vân Đạo)» và nút chế độ Độc cư / Nghênh khách. Chế độ này đồng bộ lên hồ sơ để máy chủ kiểm quyền ghé thăm.
- **Trong cảnh:** bấm vào Vân Đảo của bạn để mở thẻ bạn. Màn `friend` hiện có giữ nguyên nút Chắp tay chào, Tùy hỷ, Du vân sang thăm, Mời cùng tọa thiền, nay nối với bạn thật.

### 6.2 Màn Bạn đồng tu (điện thoại trước)
```
┌──────────────────────────────┐
│ Bạn đồng tu            [ × ] │
│ [ Mời bạn tu cùng ]  [Tìm ▸] │
│ ─ Lời mời đang chờ (1) ───── │
│ ◐ Minh An · 2210  mời cùng   │
│   ngồi thiền · còn 8 phút    │
│   [Đồng ý] [Để lúc khác]     │
│ ─ Thân thiết ─────────────── │
│ ● Tuệ Thái · 5696            │
│   Đang ở Vân Đạo · ngày 31   │
│   [Mời ▾]  [Ghé thăm]        │
│ ─ Quen biết ──────────────── │
│ ◑ Thiện Tâm · 7781           │
│   Đang tọa thiền             │
│   [Mời ▾] (chờ sau thời thiền)│
│ ○ An Hòa · 3304              │
│   Vắng mặt · trong tuần      │
└──────────────────────────────┘
```
- **Chấm trạng thái:** ● xanh dịu = online; ◑ vàng = đang thiền/trà; ◐ = đang thăm đảo; ○ xám = vắng. Luôn có chữ đi kèm, không chỉ dựa vào màu.
- **Bố cục:** giao diện trong suốt như các panel hiện có; panel cao tối đa 44vh trên điện thoại để không che Tôn tượng.
- **Dòng bạn:** tối đa 2 dòng chữ; nút ≥ 44 px.
- **«Tìm ▸»** mở ô «Tịnh danh · mã» kèm một câu: «Chỉ tìm đúng tên và mã người ấy đưa cho bạn».

### 6.3 Mời bạn tu cùng
Một thẻ gồm:
- QR (dựng bằng canvas, không thư viện ngoài);
- mã `K7M2-QX9A` cỡ chữ lớn;
- nút **Chia sẻ** (Web Share API, không có thì Sao chép) và **Tạo mã mới**;
- dòng «Còn 5 lượt · hết hạn sau 7 ngày».

Lời đi kèm khi chia sẻ: «Mời bạn cùng tu tập với mình trên Vân Đạo: …/#ban=K7M2QX9A». Không có ảnh, không có ngày hành trình.

### 6.4 Thẻ lời mời đến
- **Vị trí:** góc dưới phải (máy tính) hoặc trên thanh điều khiển (điện thoại).
- **Nội dung:** lời mẫu, Tịnh danh, đếm ngược, hai nút.
- **Âm báo:** một tiếng ngân `gift`, nhỏ. Đang thiền thì không có âm và không hiện; sau khi xuất thiền mới hiện, kèm dòng «trong lúc bạn thiền».

### 6.5 Trong cảnh 3D (Claude, `world.js`/`island.js`)
- **Vị trí đảo:** đảo bạn thật thay dần 3 đảo bạn mô phỏng (`FRIEND_DAY`). Thân thiết ở vòng 0, sát mép Vân Đảo; quen biết ở vòng 1. Tối đa `NEAR_ISLES` (4 + 4). Bạn khác chỉ có trong danh sách.
- **Hình dáng:** đảo bạn dựng bằng `buildNeighbor` theo ngày hành trình bạn cho hiện, như #116 đã làm cho bạn mô phỏng. Không đọc dữ liệu riêng tư nào khác.
- **Hiện diện trên đảo:**
  - online: đèn mây ở Vân Môn đảo bạn sáng dịu;
  - đang thiền: vầng sáng quanh Vân Tọa;
  - vắng: đèn tắt, Vân Tọa trống;
  - nhãn Tịnh danh hiện khi đến gần.
- **Hiệu năng:** mỗi đảo bạn ≤ 4 lệnh vẽ sau gộp hình. Toàn cảnh điện thoại vẫn ≤ 120 lệnh vẽ / 400.000 tam giác (§12.2; hiện 70 / 345.000). Đo bằng `perf.spec.js` trước khi mở PR.

### 6.6 Cài đặt riêng tư (trang Tài khoản)
- **Hiện trạng thái với bạn đồng tu:** bật mặc định; tắt thì luôn «Vắng mặt».
- **Cho người khác gửi lời kết nối bằng Tịnh danh · mã:** bật mặc định; quyền hiển thị «Ẩn» thì tắt.
- **Hiện ngày hành trình với bạn đồng tu:** bật mặc định.
- **Danh sách đã chặn:** có nút bỏ chặn.

## 7. Dữ liệu và quyền riêng tư

| Dữ liệu | Ai thấy | Giữ bao lâu |
|---|---|---|
| Kết nối (cặp tài khoản, thân thiết, cho ghé khi vắng) | Hai người trong cặp | Tới khi hủy hoặc xóa tài khoản |
| Hiện diện (trạng thái + giờ cuối) | Bạn đồng tu, nếu bật «Hiện trạng thái» | Chỉ một dòng/người, ghi đè |
| Lời mời gặp | Hai người trong cặp | Xóa sau 7 ngày |
| Mã mời | Người tạo | Hết hạn 7 ngày; xóa sau 30 ngày |
| Ghé thăm khi vắng | Chủ đảo («đã ghé hôm nay») | 30 ngày |

- **Xuất và xóa:** xuất dữ liệu (`/export`) có đủ các mục trên. Xóa tài khoản xóa theo `ON DELETE CASCADE`.
- **Không thu thập:** GPS/vị trí, danh bạ, nội dung trò chuyện, số lần gặp hiện ra ngoài.

## 8. Phân công và thứ tự

| ID | Việc | Ai | Tệp | Phụ thuộc | Nghiệm thu |
|---|---|---|---|---|---|
| **T5.4** | Thiết kế, hợp đồng, luật dùng chung | **Claude** | `docs/thiet-ke/ban-dong-tu.md`, `docs/contracts/ban-dong-tu.md`, `packages/shared/src/dong-tu.js` + test, roadmap §10.4/GĐ5 | — | Codex duyệt; chủ dự án gộp |
| **T5.5** | D1 0011 + API kết nối/mời/hiện diện/gặp, chặn, xuất/xóa, kiểm thử Worker | **Codex (AG)** | `db/migrations/0011_*.sql`, `workers/api/src/routes/companions.js`, `index.js`, `export.js`, test | T5.4 gộp | Mọi ca ở hợp đồng §6 xanh trên D1 cục bộ |
| **T5.6** | Mô-đun mạng: gọi API, nhịp hiện diện, hỏi định kỳ, đọc `#ban=`, đẩy chế độ Nghênh khách lên hồ sơ | **Codex (AG)** | `apps/web/src/net/dong-tu.js` (mới), một móc trong `net/account.js` | T5.4 gộp | Kiểm thử đơn vị với máy chủ giả; không gửi khi chưa có phiên |
| **T5.7** | Giao diện: nút, màn danh sách, mời bạn tu cùng (QR), thẻ lời mời, thẻ bạn, cài đặt riêng tư | **Claude** | `apps/web/src/ui/dong-tu.js` (mới), `main.js` (móc), `index.template.html` (CSS) | T5.4; làm song song T5.5/T5.6 với máy chủ giả | `tests/e2e/ban-dong-tu.spec.js` hai thiết bị: kết bạn bằng liên kết, mời thiền, cùng đếm ngược |
| **T5.8** | 3D: đảo bạn thật gần đảo mình, đèn hiện diện, ghé thăm/ghé khi vắng, cùng ngồi (Đài Thiền/Đại Thiền Đường), Trà Đạo hai người | **Claude** | `world.js`, `island.js`, `people.js`, `music.js` | T5.7 | `perf.spec.js` trong ngân sách; e2e ghé thăm, cùng ngồi |
| T5.9 | Nghiệm thu với bạn thật; xác nhận điều kiện mặc định ở §9 | **Chủ dự án** | — | T5.5–T5.8 | Hai người thật kết bạn, cùng ngồi một thời thiền |

**Thứ tự và tránh xung đột:**
1. T5.4 (PR này) gộp trước.
2. Codex làm T5.5 → T5.6. Claude làm T5.7 → T5.8 song song, dùng máy chủ giả đúng hợp đồng như `tests/e2e/dong-bo.spec.js`.
3. Hai bên không sửa chung tệp:
   - Codex giữ `net/dong-tu.js` và `workers/`.
   - Claude giữ `ui/dong-tu.js`, 3D, `tests/e2e`.
   - Chỗ duy nhất hai bên cùng chạm là một dòng gọi trong `net/account.js` (Codex) và `main.js` (Claude), mỗi người tệp của mình.
4. Muốn đổi hợp đồng thì mở PR riêng cho `docs/contracts/ban-dong-tu.md` + `dong-tu.js` trước, không sửa ngầm trong PR triển khai.

**Khối lượng ước tính:**
- **Codex:** T5.5 khoảng 2–3 ngày, T5.6 khoảng 1 ngày, làm sau #105.
- **Claude:** T5.7 khoảng 2 ngày, T5.8 khoảng 2–3 ngày, làm sau #104.

Không bên nào phải dừng việc GĐ3 đang dở.

## 9. Mặc định cần chủ dự án xác nhận (đã đặt trong `dong-tu.js`, đổi một chỗ)

1. **Ghé thăm cần Cổng Vân Môn nửa mở (ngày 29).** Theo luật phân khu hiện có. Cùng ngồi thiền dùng được từ ngày 1 qua Đại Thiền Đường.
2. **«Ở gần» là đảo gần trong Vân Đạo**, không dùng vị trí địa lý.
3. **Thân thiết do hai người cùng chọn**, không tự lên theo số lần gặp.
4. **Không chữ tự do** ở đợt 5A, chỉ lời mẫu.
5. **Giới hạn:** tối đa 50 bạn đồng tu; 5 lời kết nối/ngày, mỗi lời chờ 14 ngày, không báo khi bị từ chối; mã mời 7 ngày/5 lượt; dựng tối đa 8 đảo bạn gần.
6. **Nhịp hiện diện 2 phút**, vắng sau 3 phút. Trên gói Free: khoảng 30 lượt ghi D1/giờ cho mỗi người đang mở app. Đủ cho vài trăm người dùng cùng lúc trước khi cần GĐ4/Paid.
7. **Phiên khách** (tài khoản ẩn danh) dùng được Bạn đồng tu. Mất tài khoản khách thì mất các kết nối, và giao diện nhắc lưu mã khôi phục.
