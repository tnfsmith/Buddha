# Hợp đồng thời gian thực — vé, phòng, codec 16 byte · GĐ4 (#108)

Hợp đồng ranh giới giữa API (Codex: `/rt/ticket`, binding, chặn/báo cáo, T4.3) và các Durable Object `Lobby`, `HallRoom`, `IslandRoom` (Claude: T4.1, client T4.2). Căn cứ roadmap §7.1–§7.7. Hai bên duyệt và merge hợp đồng này trước khi triển khai. Bản này chưa có DO, route `/ws` hay binding.

## 1. Nguyên tắc

- **Thời thiền không bao giờ dừng vì mạng.** Mất kết nối, vượt hạn mức hay phòng đầy thì client chuyển sang đám đông mô phỏng, ghi «đang đông, hiển thị mô phỏng».
- **Không có chat chữ tự do ở GĐ4.** Chỉ có vị trí, tư thế và cử chỉ: chắp tay, đảnh lễ, tùy hỷ.
- **DO không đọc D1 khi có người vào phòng.** Vé mang đủ dữ liệu: người, phòng, Tịnh danh, diện mạo và danh sách chặn.
- **Hai người đã chặn nhau không thấy nhau** trong cùng phòng.
- **Ngủ đông:** dùng `ctx.acceptWebSocket()`, metadata lưu bằng `serializeAttachment()`, ping/pong bằng auto-response. Không thay đổi thì không phát, nên khi mọi người ngồi yên đối tượng được ngủ.
- **Không log** `user_id`, vé hay địa chỉ IP. Chỉ đếm số kết nối, số khung và lỗi theo mã.

## 2. Luật dùng chung: `@vandao/shared/rt.js`

| Hàm | Việc |
|---|---|
| `parseRoom(name)`, `hallShard(t, s)` | `hall:t{0–4}` (phòng gốc client xin), `hall:t{0–4}:s{1–99}` (shard Lobby cấp), `island:{user_id}` |
| `encodeState`, `decodeState`, `validRec(r, kind)` | Bản ghi 16 byte client → máy chủ và kiểm giới hạn |
| `encodeBatch`, `decodeBatch` | Khung gộp máy chủ → client |
| `signTicket(secret, p)`, `verifyTicket(secret, t, { now, room })`, `checkTicketPayload`, `nonce` | Vé HMAC v1 |
| `bloomMake(uids)`, `bloomHas(f, uid)`, `hiddenPair(a, b)` | Bộ lọc chặn trong vé, không âm tính giả |
| `checkRoomReport(p)` | Thân báo cáo trong phòng `{ context: 'room', room, slot, sid, reason? }` |
| Hằng số | `HALL_CAP` 200, `ISLAND_CAP` 12, `FREE_HALL_SHARDS` 3, `SEND_HZ` 5, `BATCH_HZ` 4 (Free: 2), `TICKET_TTL_MS` 60 000, `BLF_MAX_N` 800, `PERMS`, `CLOSE`, `BOUNDS`, `STATES` |

**Bản ghi 16 byte (little-endian, §7.3):**

| Byte | Kiểu | Trường |
|---|---|---|
| 0–1 | Uint16 | `slot` do DO cấp, duy nhất trong phòng |
| 2–5, 6–9, 10–13 | Float32 × 3 | X, Y, Z |
| 14 | Uint8 | Trạng thái: 0 đứng · 1 tọa thiền · 2 chắp tay · 3 đảnh lễ · 4 kinh hành · 5 tùy hỷ |
| 15 | Uint8 | Hướng quay `yaw × 256 / 2π` |

**Khung gộp:** `[type u8 = 1][count u16][rsv u8 = 0] + count × 16 byte`. 200 người là 3.204 byte.

## 3. Vé (API — Codex)

`POST /api/v1/rt/ticket { room }`, với `room` là `hall:t{n}` hoặc `island:{host_id}`. Cần phiên, kể cả phiên khách.

**Kiểm trước khi cấp:**
1. Tầng: `hall:t0` mở cho mọi phiên; `t1`–`t4` theo `tier_progress` (T3.4/#107), chưa có thì `403 room_forbidden`.
2. Đảo:
   - Chủ đảo luôn vào được đảo mình.
   - Khách vào khi chủ có mặt và đang Nghênh khách (`island_json.open`), hoặc khi `canVisitAway` (hợp đồng Bạn đồng tu) cho phép.
   - Chủ đã chặn khách hoặc khách đã chặn chủ → `403 room_forbidden`, cùng mã với «cổng đóng» để không lộ việc chặn.
3. Hỏi Lobby (RPC `assign`, §4) để lấy shard cho phòng `hall`. Lobby trả lỗi `full` hoặc `busy` thì API trả `503 rt_full` / `503 rt_busy`; client chuyển sang mô phỏng.

**Thân vé v1** (`checkTicketPayload`):
```
{ v: 1, uid, room: "hall:t0:s2" | "island:{host}", tinh_danh, tag, look, blf: { m, b }, exp, n }
  + chỉ với đảo: { perm: "host" | "open" | "away", open: bool }
```
- `look` là diện mạo đã kiểm ở `/profile`, hoặc `null`.
- `blf` là bộ lọc Bloom (`bloomMake`) của **toàn bộ** danh sách chặn hai chiều: người mình chặn và người chặn mình.
  - Bộ lọc không có âm tính giả. DO ẩn một cặp khi bộ lọc của một trong hai người chứa người kia (`hiddenPair`), nên mọi cặp đã chặn đều bị lọc, bất kể ai vào trước.
  - Dương tính giả dưới 1 % chỉ làm hai người không chặn nhau cũng không thấy nhau, vô hại.
  - Danh sách vượt `BLF_MAX_N` (800) thì API không cấp vé và trả `503 rt_unavailable`; client dùng đám đông mô phỏng. Không bao giờ cấp vé với danh sách chặn thiếu.
- `perm` và `open` chỉ có ở vé đảo, do API xác thực lúc cấp:
  - `host`: chủ đảo, bất kể cổng mở hay đóng;
  - `open`: chủ đang Nghênh khách;
  - `away`: ghé khi vắng, theo `canVisitAway`.
  - `open` là cổng đảo lúc cấp vé. Độc cư thì chỉ chủ có vé.
- `exp` = `now + 60 giây`.
- `n` là nonce ngẫu nhiên 16 byte.

**Dạng vé:** `v1.<payload base64url>.<HMAC-SHA256 base64url>`, ký bằng `RT_SECRET`. Thiếu khóa thì `503 rt_unavailable`. Thay dạng `{p, s}` hiện có trong `routes/rt.js`, vì chưa client nào dùng dạng cũ.

**Phản hồi:** `{ ticket, room, ws_url: "/ws/{room}?t={ticket}&v=1", expires_at, batch_hz }`.

## 4. Durable Object (Claude) và binding (Codex)

**Binding** trong Worker duy nhất (ADR 0001), cùng mô hình với ReminderClock (#130):
- `durable_objects.bindings`: `LOBBY` → `Lobby`, `HALL_ROOM` → `HallRoom`, `ISLAND_ROOM` → `IslandRoom`.
- `migrations`: `{ tag: "v-rt1", new_sqlite_classes: ["Lobby", "HallRoom", "IslandRoom"] }`.
- `workers/api/src/index.js` xuất lại các lớp từ `workers/realtime/src/*.js`.
- Biến:
  - `RT_SECRET` (secret);
  - `RT_FREE` (`"1"` mặc định khi còn gói Free);
  - `RT_DAILY_IN` (mặc định 1.600.000 tin đến/ngày, khoảng 80 % hạn mức Free).
- Route `GET /ws/:room` (Codex):
  - kiểm `Upgrade: websocket` và `parseRoom`;
  - chuyển nguyên yêu cầu tới `env.HALL_ROOM.getByName(room)` hoặc `env.ISLAND_ROOM.getByName(room)`;
  - không kiểm vé ở Worker, DO tự kiểm.

**Lobby** (`getByName('lobby')`), qua RPC:

| Phương thức | Đối số → kết quả |
|---|---|
| `assign({ tier, uid, friends })` | `friends` là tối đa 50 user_id bạn đồng tu, do API lấy từ D1. Ưu tiên shard có bạn và còn chỗ, rồi shard số nhỏ nhất còn chỗ, rồi mở shard mới. Gói Free tối đa 3 shard. Trả `{ shard }`, `{ error: 'full' }` hoặc `{ error: 'busy' }` (vượt `RT_DAILY_IN`) |
| `report({ room, count, uids, inbound })` | HallRoom và IslandRoom báo khi có người vào/ra và mỗi 30 giây khi có thay đổi. `uids` dùng cho ưu tiên bạn và `hideNow`; chỉ giữ trong bộ nhớ SQLite của Lobby, không ghi D1 |
| `total({ tier })` | Tổng người đang ngồi cả tầng, cho dòng «đang có N người cùng ngồi» |
| `hideNow({ a, b })` | API gọi khi có người chặn: chuyển tới mọi phòng (Đại Thiền Đường và đảo) đang có một trong hai người |

**HallRoom / IslandRoom:**
- **Khi nâng cấp WebSocket:**
  - `verifyTicket(RT_SECRET, t, { now, room: tên DO })`;
  - nonce đã thấy trong 120 giây (bảng SQLite `seen`) → `4401`;
  - `?v` khác 1 → `4400`;
  - phòng đầy → `4503`.
- **Mỗi người một kết nối.** Cùng `uid` vào lại thì kết nối cũ bị đóng `4409`.
- **Cấp `slot` và `sid`.** `slot` là số nhỏ nhất còn trống. `sid` là dấu phiên kết nối ngẫu nhiên (`nonce()`): mỗi lần vào một `sid` mới, nên slot dùng lại cho người khác vẫn phân biệt được. Attachment giữ `uid`, `sid`, `tinh_danh`, `tag`, `look`, `blf` và với đảo thêm `perm`.
- **Gửi JSON `welcome`:** `{ type: 'welcome', v: 1, slot, sid, room, server_now, batch_hz, peers: [{ slot, sid, tinh_danh, tag, look }], total }`. Danh sách `peers` không có cặp `hiddenPair`.
- **Tin JSON hiếm:**
  - `{ type: 'join', slot, sid, tinh_danh, tag, look }` và `{ type: 'leave', slot, sid }`;
  - `{ type: 'count', total }` mỗi 30 giây khi tổng đổi;
  - `{ type: 'hide', slot }` khi `hideNow`.

  Join/leave của cặp `hiddenPair` không gửi cho nhau.
- **Tin client → DO:**
  - chỉ nhận khung nhị phân đúng 16 byte;
  - `slot` trong khung bị ghi đè bằng slot của kết nối;
  - bản ghi không `validRec` thì bỏ;
  - quá 5 tin/giây thì bỏ tin dư; quá 20 tin/giây liên tục 3 giây thì đóng `4429`;
  - tin chữ thì bỏ, trừ `{ type: 'ping' }` do auto-response trả.
- **Phát khung gộp:**
  - Có thay đổi thì đặt alarm `1000 / batch_hz` ms; mỗi lần phát chỉ gửi bản ghi đã đổi kể từ lần trước.
  - Mỗi người nhận một khung đã lọc người hai bên chặn nhau.
  - Không thay đổi thì không đặt alarm, để DO ngủ.
  - `batch_hz` = 2 khi `RT_FREE = "1"`, còn lại 4.
- **Đếm tin đến:** mỗi phòng cộng số tin trong ngày UTC và báo Lobby. Lobby dùng tổng này cho `busy`.
- **IslandRoom — quyền ở lại do máy chủ xác thực:**
  - 12 chỗ, không qua Lobby. Trạng thái cổng `open` của DO lấy theo vé hoặc RPC mới nhất (so theo thời điểm cấp).
  - **Vào phòng:**
    - vé `host` luôn vào được;
    - vé `open` cần cổng đang mở và chủ đang có mặt (hoặc trong 60 giây chờ chủ nối lại);
    - vé `away` cần cổng đang mở.
    - Không đủ điều kiện → `4403`.
  - **Chủ chuyển Độc cư.** API gọi `setOpen({ open: false, at })` trên `island:{chủ}` ngay khi ghi `island_json.open = false`. DO gửi `{ type: 'closed' }` rồi đóng mọi kết nối không phải chủ bằng `4410`, kể cả khách `away`, vì Độc cư luôn thắng. Mở lại cổng thì gọi `setOpen({ open: true, at })`.
  - **Chủ rời đảo.** Chờ 60 giây cho chủ nối lại. Hết thời gian thì khách `open` nhận `{ type: 'closed' }` và đóng `4410`; khách `away` được ở lại vì đó là quyền ghé khi vắng.
  - **Thu quyền.** Khi chủ tắt «ghé khi vắng», hủy kết nối hay chặn một người, API gọi `revoke({ guest })` trên `island:{chủ}`; DO đóng đúng khách đó bằng `4403`. Khi chặn, API cũng gọi `Lobby.hideNow` (§6).
  - **Báo thành viên cho Lobby.** IslandRoom báo Lobby khi có người vào/ra (`report` với `room = island:{chủ}`), để `hideNow` tới được cả phòng đảo.
  - **Client:** nhận `closed` thì đưa người dùng về đảo mình, báo «Chủ đảo đã khép cổng» hoặc «Chủ đảo đã rời đi».

**RPC phục vụ báo cáo (T4.3, Codex gọi):** `whois({ reporter, slot, sid })` trên đúng phòng → `{ uid }` hoặc `null`.
- DO trả `uid` chỉ khi đủ cả bốn điều kiện:
  1. người báo (`reporter`) đang ở trong phòng, hoặc rời chưa quá 10 phút;
  2. cặp `slot` + `sid` đúng là một phiên kết nối đang có, hoặc đã kết thúc chưa quá 10 phút;
  3. hai người không phải cặp `hiddenPair`, tức người báo đã thấy được đối tượng;
  4. người báo khác đối tượng.
- DO giữ bảng SQLite `recent(sid PK, uid, slot, left_at)` cho các phiên đã rời trong 10 phút để tra cứu, rồi dọn. Không ghi D1.
- Client báo cáo bằng REST `POST /api/v1/reports` với thân `checkRoomReport`: `{ context: 'room', room, slot, sid, reason? }`.
  - API hỏi `whois`. Kết quả `null` thì trả `404 not_found`; có `uid` thì ghi bảng `report` với `context = 'room'`.
  - Cùng route này vẫn nhận thân báo cáo đảo của #122: `{ context: 'island', target, reason? }`.
- Client không bao giờ thấy `user_id` của người khác.

## 5. Client (Claude, T4.2)

- **Vào phòng:**
  - Lấy vé ngay trước khi mở WebSocket; vé sống 60 giây, không lưu.
  - Nhận `welcome` rồi gắn người thật vào pool `InstancedMesh` của `people.js`.
  - Nội suy 150 ms. Trên điện thoại tối đa 150 hình người thật, phần còn lại hiện hình đơn giản.
- **Gửi:** khi đang đi tối đa 5 bản ghi/giây và chỉ khi đổi; khi ngồi thiền không gửi gì.
- **Mất kết nối:** nối lại sau 1, 2, 4, 8, 16, 30 giây (±20 % ngẫu nhiên). Sau 3 lần lỗi liên tiếp, hoặc khi nhận `4503`, `4504`, `rt_full`, `rt_busy`, thì chuyển sang đám đông mô phỏng và thử lại sau 5 phút.
- **Mã đóng:**
  - `4401`: lấy vé mới một lần.
  - `4400`: tải lại app.
  - `4403`: báo «cổng đã đóng» (đảo).
  - `4409`: báo «đang mở ở thiết bị khác».

## 6. Chặn và báo cáo (Codex, T4.3)

- **Chặn có hiệu lực:**
  - **khi vào phòng**, qua bộ lọc `blf` của toàn bộ danh sách chặn trong vé;
  - **ngay khi chặn**, qua `Lobby.hideNow`. Lobby biết thành viên của cả phòng Đại Thiền Đường lẫn phòng đảo. Cả hai bên nhận `hide` cho slot người kia, và khung gộp sau đó lọc hai người.
  - Nếu hai người cùng ở một đảo, API gọi thêm `revoke` trên đảo đó cho người không phải chủ (§4).
- **Báo cáo:** REST, không qua WebSocket; ghi D1 theo bảng `report` hiện có.
- **Số liệu shard cho vận hành:** `Lobby.total` và `stats()` gồm số phòng, số người, tin đến trong ngày. Không có định danh.

## 7. Nghiệm thu

**Dùng chung** (`packages/shared/test/rt.test.js`, đã có trong PR này):
- vị trí byte little-endian, `yaw`, khung gộp, 200 người = 3.204 byte;
- sai độ dài hay sai kiểu → `null`;
- tên phòng;
- vé: ký/kiểm, hết hạn, sai phòng, sai khóa, sửa thân vé, thân vé sai hợp đồng.

**DO** (Claude, trong pool Workers sau khi có binding):
- vào bằng vé hợp lệ thì nhận `welcome`; vé dùng lại trong 120 giây → `4401`;
- cùng `uid` vào lần hai → kết nối cũ `4409`;
- người đi 5 bản ghi/giây, người khác nhận khung gộp ≤ `batch_hz`;
- mọi người ngồi yên → không còn alarm, DO được ngủ;
- quá tốc → `4429`;
- hai người chặn nhau không nhận `join` hay bản ghi của nhau dù ai vào trước, kể cả khi danh sách chặn có 800 người; `hideNow` ẩn ngay ở cả Đại Thiền Đường lẫn đảo;
- **đảo:**
  - khách `open` không vào được khi chủ vắng quá 60 giây;
  - `setOpen(false)` đóng mọi khách `4410`, kể cả `away`;
  - chủ rời đi thì khách `open` bị đóng, khách `away` ở lại;
  - `revoke` đóng đúng một khách;
- **`whois`:**
  - trả `null` khi người báo chưa từng ở phòng, khi `sid` không khớp slot (slot đã cấp lại cho người khác), khi hai người là cặp ẩn, hoặc khi đã quá 10 phút;
  - trả đúng `uid` cho phiên vừa rời dưới 10 phút;
- Lobby ưu tiên shard có bạn; đầy → `full`; vượt `RT_DAILY_IN` → `busy`;
- log không có `uid`, vé hay IP.

**API** (Codex):
- mỗi mã lỗi ở §3; vé đúng dạng v1;
- `blf` chứa đủ danh sách chặn hai chiều; vượt 800 → `rt_unavailable`;
- đảo đóng hay bị chặn dùng cùng mã;
- `perm` đúng theo Nghênh khách và `canVisitAway`;
- gọi `setOpen` và `revoke` đúng lúc;
- báo cáo `room` qua `whois` và báo cáo `island` của #122 trên cùng route.

**Tải** (Hermes, T4.4, chỉ staging, sau khi có worker): 200 kết nối/shard ổn định 30 phút; p95 < 250 ms; không mất khung; DO ngủ khi mọi người ngồi yên.

## 8. Phân công sau khi merge

| Phần | Người làm | Tệp |
|---|---|---|
| `/rt/ticket` vé v1 (gồm `blf`, `perm`, `open`), kiểm tầng/đảo/chặn, `GET /ws/:room`, binding/migration tag, biến, `reports` qua `whois`, gọi `hideNow`/`setOpen`/`revoke` | Codex (T4.3) | `workers/api/**` |
| `Lobby`, `HallRoom`, `IslandRoom`, ca kiểm DO | Claude (T4.1) | `workers/realtime/src/**`, `workers/realtime/test/**` (chạy trong pool của API) |
| Client: kết nối, nội suy, pool người thật, nối lại, mô phỏng khi lỗi | Claude (T4.2) | `apps/web/src/rt/**`, `people.js`, `world.js` |
| k6 staging | Hermes (T4.4) | `ops/**`, `docs/reports/**` |
