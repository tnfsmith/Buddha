# Hợp đồng ReminderClock — nhắc nhở Web Push · #106 (với #105)

Hợp đồng ranh giới giữa API (Codex, #105) và Durable Object `ReminderClock` (Claude, #106), theo roadmap §9.2 và bảng `reminder`, `push_subscription` của migration 0010. Hai bên duyệt và merge hợp đồng này trước khi triển khai. Bản này chưa thêm DO, sender, route, binding hay migration.

## 1. Nguyên tắc

- **Mặc định tắt.** Người dùng tự bật từng nhắc. App chỉ gợi ý bật một nhắc giờ thiền.
- **Tối đa 2 nhắc đang bật mỗi người.** Mỗi nhắc báo tối đa một lần mỗi ngày, nên không quá 2 nhắc mỗi ngày.
- **Giờ yên lặng 21:30–05:00** theo múi giờ hồ sơ. API từ chối giờ nhắc rơi vào khoảng này.
- **Tịnh khẩu:** tạm dừng 1–30 ngày.
- **Lời nhắc không gây áy náy.** Câu chữ do app biên tập, không cần Hội đồng duyệt.
- **Đúng giờ ±1 phút** theo `profile.tz`. Nhắc trễ quá 30 phút (sự cố, alarm trễ) thì bỏ lượt, không gửi muộn.
- **Không gửi trùng** khi alarm chạy lại. Đăng ký nhận 404/410 thì xóa.
- **Không log** endpoint, khóa push hay nội dung riêng tư. Push chỉ mang `kind`; service worker hiện câu đã biên tập.
- **Chưa đủ điều kiện thì chưa bật push thật:** cần có VAPID, binding, quyền thông báo của người dùng và cờ `REMINDERS_ENABLED = "1"`. Thiếu một trong các điều kiện này thì lịch vẫn được lưu nhưng không gửi.

## 2. Luật dùng chung: `@vandao/shared/reminder.js`

API và DO import cùng một mô-đun thuần. Mô-đun không đọc giờ, mạng hay bộ nhớ; `now` luôn được truyền vào.

| Hàm | Việc |
|---|---|
| `checkReminders(list)` | Kiểm thân `PUT /reminders`: mỗi loại tối đa một nhắc, tối đa `MAX_ACTIVE` = 2 nhắc đang bật. Trả `{ ok, v }` hoặc mã `invalid_reminder`, `reminder_quiet_hours`, `reminder_limit` |
| `checkReminder(p)` | Một nhắc `{ kind, local_hm, days_mask?, active? }`; không nhận trường khác |
| `nextReminderAt(rem, { tz, now, uposatha })` | Lần nhắc kế tiếp (UTC ms, lớn hơn `now`, không trước `paused_until`) hoặc `null` |
| `pauseUntil(days, now)` | Tịnh khẩu 1–30 ngày → `paused_until`; `0` → bỏ tạm dừng |
| `shardOf(userId)` | Shard 0–15; tên DO là `rc-${shardOf(user_id)}` |
| `occKey(reminderId, localDate)` | Khóa của một lượt nhắc; giới hạn 2 lượt/ngày đếm theo khóa này |
| `sendKey(reminderId, localDate, subId)` | Khóa chống gửi trùng tới từng đăng ký |
| `occurrenceValid(rem, occ, { tz, uposatha, now })` | Lượt đang thử lại còn hiệu lực không (§4 bước 4), gồm giờ yên lặng theo giờ thực lúc gửi |
| `quietAt(now, tz)` | Giờ thực có rơi vào giờ yên lặng không; áp ở mọi lần gửi, kể cả alarm đến trễ |
| `canSend(status)`, `recoverStatus(status)`, `SEND_FINAL` | Chỉ gửi khi chưa có khóa hoặc khóa `retry`; `sending` còn lại từ lần trước → `unknown`, không gửi lại |
| `classifyPush(res)` | Kết quả gọi dịch vụ push → `ok` / `gone` / `retry` / `fail` / `unknown` theo bảng §4 bước 5 |
| `pushPayload(kind, at)` | `{"v":1,"kind":…,"at":…}` |
| `localParts`, `zonedToUtc`, `isTraiDate`, `inQuiet` | Hàm phụ trợ múi giờ, ngày trai, giờ yên lặng |

**Quy ước dữ liệu:**
- `kind` ở GĐ3 thuộc `thien | nhiem_vu | ghi_nhan | uposatha | tong_ket_tuan`. Schema có `nhom` nhưng loại này chờ GĐ5.
- `days_mask`: bit d ứng với `Date#getDay()` (Chủ nhật = bit 0 … Thứ bảy = bit 6).
  - `uposatha` luôn 127. Ngày nhắc lấy theo `practice_profile.uposatha` (2/4/6/10 ngày âm lịch, hoặc `khong`).
  - `tong_ket_tuan` đặt đúng một bit; mặc định là Chủ nhật.
- Múi giờ là `profile.tz` theo tên IANA.
  - Giờ không tồn tại khi nhảy giờ mùa hè: lấy thời điểm ngay sau khoảng nhảy.
  - Giờ lặp khi lùi giờ: lấy lần đầu.
- Ngày trai tính bằng `amlich.js` theo UTC+7, giống thẻ ngày trai ở Bia.
- Kênh: chỉ `push` do ReminderClock gửi.
  - `local` là thông báo cục bộ bản Android, do máy tự đặt.
  - `email` chờ hạ tầng; API từ chối kênh này ở GĐ3.

## 3. API → DO (Codex gọi, Claude hiện thực)

**Binding (Codex):**
- `durable_objects.bindings`: `{ name: "REMINDER_CLOCK", class_name: "ReminderClock" }`.
- `migrations`: `{ tag: "v-rc1", new_sqlite_classes: ["ReminderClock"] }`. Gói Free chỉ tạo được DO dùng SQLite.
- `workers/api/src/index.js` xuất lại lớp từ `workers/realtime/src/reminder-clock.js` (Claude).
- Biến và bí mật:
  - `REMINDERS_ENABLED` (mặc định `"0"`);
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`), đặt bằng `wrangler secret`, không commit.

**Gọi qua RPC:** `env.REMINDER_CLOCK.getByName('rc-' + shardOf(user_id))`.

| Phương thức | Đối số | Kết quả |
|---|---|---|
| `schedule(x)` | `{ user_id, reminder_id, next_at }`. `next_at` là UTC ms hoặc `null` | Ghi đè dòng chỉ mục (`null` → xóa), đặt lại alarm về mốc sớm nhất. Gọi lại với cùng dữ liệu không đổi gì. `{ ok: true }` |
| `cancel(x)` | `{ reminder_id }` | Xóa dòng chỉ mục. `{ ok: true }` |
| `cancelUser(x)` | `{ user_id }` | Xóa mọi dòng của người đó. Dùng khi xóa tài khoản hoặc dọn khách |
| `stats()` | — | `{ rows, due_1h, next_alarm }` cho vận hành, không có định danh |

**Thứ tự phía API:**
1. Kiểm bằng `checkReminders`.
2. Tính `next_at` bằng `nextReminderAt` với `profile.tz` và `practice_profile.uposatha`.
3. Ghi D1 trong một lô.
4. Gọi `schedule` cho mỗi nhắc kênh `push`. Nhắc tắt hoặc tạm dừng vẫn gọi, với `next_at` tương ứng hoặc `null`.

Gọi DO lỗi thì vẫn trả 200, vì D1 là nguồn chính và cron đối soát sẽ sửa (§5).

Các đổi khác cũng gọi lại `schedule` cho những nhắc bị ảnh hưởng: đổi `profile.tz`, đổi `practice_profile.uposatha`, Tịnh khẩu, bỏ đăng ký push cuối cùng.

## 4. Khi alarm chạy (Claude)

**Khái niệm «lượt nhắc».** Một lượt là một lần một nhắc tới hạn trong một ngày địa phương, khóa `occKey(reminder_id, local_date)`. Một lượt gửi tới mọi thiết bị đã đăng ký của người đó nhưng chỉ tính **một** lần vào giới hạn 2 lượt/ngày. Thử lại của cùng lượt không tính thêm.

Bảng SQLite riêng trong mỗi shard, dọn dòng cũ hơn 3 ngày:
- `idx(reminder_id PK, user_id, next_at)`: lịch sắp tới, mỗi nhắc một dòng.
- `occ(occ_key PK, reminder_id, user_id, local_date, due_at, kind, local_hm, attempt, retry_at, done)`: lượt đã mở. `due_at` là giờ gốc của lượt (UTC ms); khóa, payload và ngưỡng trễ của mọi lần thử đều theo giờ gốc này.
- `sent(key PK, occ_key, status, at)`: trạng thái từng đăng ký, khóa `sendKey(reminder_id, local_date, sub_id)`. Giữ khóa riêng từng đăng ký để không gửi lại cho thiết bị đã nhận.

Các bước:

0. **Phục hồi khóa gửi.** Alarm của một DO chạy tuần tự. Vì vậy mọi khóa `sending` còn lại lúc bắt đầu là của lần chạy trước bị dừng giữa chừng: dịch vụ push có thể đã nhận mà chưa kịp ghi kết quả. Chuyển chúng sang `unknown` (`recoverStatus`), coi như đã gửi và **không gửi lại**: ưu tiên không gửi trùng hơn chắc chắn tới. `unknown` không cộng `fail_count`. Lượt nào không còn đăng ký `retry` thì đặt `done = 1`.
1. **Lấy việc đến hạn**, tối đa 50 dòng mỗi lần:
   - lượt mới: dòng `idx` có `next_at ≤ now + 30 giây`;
   - lượt đang thử lại: dòng `occ` có `done = 0` và `retry_at ≤ now + 30 giây`.
2. **Đọc cấu hình mới nhất từ D1** trong một truy vấn: `reminder` (`active`, `kind`, `local_hm`, `days_mask`, `channel`, `paused_until`, `next_at`), `profile.tz`, `practice_profile.uposatha` và `push_subscription` của người đó.
3. **Lượt mới (từ `idx`).**
   - Không còn dòng, đã tắt hoặc khác kênh `push` → xóa dòng `idx`. Lượt đang thử lại của nhắc này tự hủy ở bước 4.
   - `next_at` trong D1 khác `idx` (API vừa đổi) → chỉ cập nhật `idx`, không gửi.
   - Tính lượt: `due_at = next_at`, `local_date` và `local_hm` theo `profile.tz`.
   - **Bỏ lượt, không tạo dòng `occ`, không tính vào giới hạn**, rồi sang bước 6, khi rơi vào một trong các trường hợp:
     - cờ tắt hoặc thiếu VAPID;
     - đang Tịnh khẩu;
     - **giờ thực lúc gửi** rơi vào giờ yên lặng (`quietAt(now, tz)`), kể cả khi alarm đến trễ;
     - trễ quá 30 phút (`LATE_MS`);
     - người dùng đã có 2 dòng `occ` trong `local_date` đó.
   - Còn lại: `INSERT OR IGNORE` dòng `occ` (alarm chạy lại thì dùng dòng đã có), rồi gửi theo bước 5. Xong thì sang bước 6.
4. **Lượt đang thử lại (từ `occ`).**
   - Kiểm lượt còn hiệu lực bằng `occurrenceValid(rem, occ, { tz, uposatha, now })`. Hợp lệ nghĩa là đủ các điều kiện:
     - nhắc còn, đang bật, kênh `push`;
     - `kind` và `local_hm` như lúc mở lượt;
     - không Tịnh khẩu tại `due_at`;
     - ngày vẫn hợp `days_mask` hoặc vẫn là ngày trai;
     - `zonedToUtc(local_date, local_hm, tz) === due_at`, tức không đổi múi giờ;
     - `now ≤ due_at + LATE_MS`;
     - giờ thực `now` không rơi vào giờ yên lặng. Ví dụ: nhắc 21:28 thử lại lúc 21:33 thì hủy, không dời sang sáng.
   - Không hợp lệ (người dùng đã tắt, đổi giờ, đổi múi giờ, Tịnh khẩu, hoặc quá hạn) → `done = 1`, các đăng ký còn chờ ghi `cancel`, không gửi.
   - Hợp lệ → gửi theo bước 5, chỉ cho các đăng ký có trạng thái `retry`. Bước này không đụng `idx` hay `next_at`.
5. **Gửi một lượt.**
   - Chỉ gửi cho đăng ký mà `canSend(status)` đúng: chưa có khóa, hoặc khóa `retry`. Các trạng thái `ok`, `gone`, `fail`, `cancel`, `unknown` và `sending` đều bỏ qua. Ghi khóa `sending` trước khi gửi, rồi ghi kết quả ngay sau khi có phản hồi.
   - Gửi tối đa 6 yêu cầu cùng lúc (giới hạn kết nối của Workers). Dữ liệu là `pushPayload(kind, due_at)`; `TTL` 3600; `Urgency: normal`; `Topic` bằng `kind`.
   - Mã hóa aes128gcm bằng thư viện chỉ dùng Web Crypto. Thư viện `web-push` gốc không chạy trên Workers.

   | Phản hồi của dịch vụ push | Việc làm |
   |---|---|
   | 2xx | `ok`; D1 đặt `fail_count = 0`, `last_ok_at = now` |
   | 404 / 410 | `gone`; xóa dòng `push_subscription` đó khỏi D1 |
   | 400 / 401 / 403 / 413 và 4xx khác | `fail`; `fail_count + 1`; không thử lại |
   | 429 / 503 (dịch vụ xác nhận từ chối tạm thời) | `retry` |
   | Không có phản hồi (lỗi mạng, hết giờ, bị hủy) hoặc 5xx khác (500, 502, 504…) | `unknown`: không rõ dịch vụ đã nhận hay chưa → coi như đã gửi, **không gửi lại**, không cộng `fail_count` |

   - Phân loại bằng `classifyPush`. Chỉ thử lại khi dịch vụ xác nhận đã từ chối. Kết quả không xác định áp cùng nguyên tắc với bước 0: ưu tiên không gửi trùng hơn chắc chắn tới.

   - Còn đăng ký `retry`, `attempt < 3` và `now + 5 phút ≤ due_at + LATE_MS` → `attempt + 1`, `retry_at = now + 5 phút`.
   - Hết lượt thử → các đăng ký `retry` chuyển `fail` (`fail_count + 1`); `done = 1`, `retry_at = NULL`.
   - Không còn đăng ký `retry` → `done = 1`.
   - `fail_count ≥ 5` thì xóa đăng ký.
   - Alarm ném lỗi giữa chừng thì Cloudflare tự chạy lại. Khóa `sent` bảo đảm không gửi trùng: đăng ký đã `ok` được bỏ qua, và đăng ký còn `sending` được chuyển `unknown` ở bước 0. Dòng `occ` bảo đảm lượt chỉ tính một lần.
6. **Hẹn lần sau**, chỉ cho lượt mới ở bước 3, kể cả khi đã bỏ lượt:
   - `next = nextReminderAt(row, { tz, now: max(now, due_at), uposatha })`.
   - Ghi D1: `UPDATE reminder SET next_at = ? WHERE id = ? AND active = 1 AND next_at IS ?` (giá trị cũ). Không đổi dòng nào nghĩa là API vừa sửa; giữ bản của API.
   - Cập nhật `idx`.
   - Lượt đang thử lại giữ nguyên giờ gốc, độc lập với `next_at` mới.

   **Ví dụ:** nhắc 06:00 gặp 429. Lúc 06:00 lượt mở với `due_at = 06:00`, `retry_at = 06:05`, `next_at` chuyển sang 06:00 ngày mai. Alarm 06:05 thử lại với khóa và payload của 06:00 hôm nay. Nếu trước 06:05 người dùng tắt nhắc hoặc đổi sang 07:00 thì lượt bị hủy ở bước 4.
7. **Đặt lại alarm** về `min(idx.next_at, occ.retry_at với done = 0)` của shard; không còn gì thì xóa alarm.
8. **`cancel` / `cancelUser`** xóa dòng `idx` và đặt `done = 1` cho các lượt `occ` chưa xong của nhắc hoặc người dùng đó. `schedule` không xóa lượt đang thử lại; bước 4 kiểm hiệu lực lúc chạy.
9. **Log:** chỉ ghi số đếm theo trạng thái (`ok`, `gone`, `fail`, `retry`, `unknown`, `cancel`, `skip_*`), không ghi `user_id`, endpoint hay khóa.

## 5. Đối soát (Codex)

Cron hằng đêm sẵn có (`17 19 * * *`) thêm một bước:
- chọn `reminder` có `active = 1`, kênh `push` và `next_at` trong 26 giờ tới;
- gọi `schedule` cho từng dòng, gom theo shard.

Bước này sửa các lần gọi DO bị lỡ. Gọi trùng không sao vì `schedule` ghi đè.

## 6. Service worker (Claude)

- Sự kiện `push`: đọc `kind` rồi hiện câu đã biên tập, tiêu đề «Vân Đạo», `tag` bằng `kind` (nhắc mới thay nhắc cũ cùng loại), `renotify: false`. Câu mẫu:
  - `thien`: «Đến giờ ngồi thiền đã hẹn. Mời bạn về Đài Thiền.»
  - `nhiem_vu`: «Việc nhỏ của hôm nay đã sẵn ở Bia Tích Lũy.»
  - `ghi_nhan`: «Cuối ngày rồi. Mời bạn ghi nhận ba trục.»
  - `uposatha`: «Hôm nay là ngày trai. Bạn có thể tự nguyện thọ trì.»
  - `tong_ket_tuan`: «Mời bạn phản tỉnh tuần qua.»
- Sự kiện `notificationclick`:
  - `uposatha`, `nhiem_vu`, `ghi_nhan`, `tong_ket_tuan` → `/#view=board`;
  - `thien` → `/#zone=pad`.
  Ưu tiên tập trung vào tab đang mở.
- Không có chữ riêng tư trong push. Đổi câu chữ là đổi app, không đổi máy chủ.

## 7. Nghiệm thu

**Luật dùng chung** (`packages/shared/test/reminder.test.js`, đã có trong PR này):
- giờ yên lặng;
- tối đa 2 nhắc đang bật, mỗi loại một nhắc;
- dữ liệu sai không ném lỗi;
- Tịnh khẩu;
- múi giờ Việt Nam và một múi giờ có đổi giờ;
- `days_mask`;
- ngày trai khớp âm lịch;
- tổng kết tuần;
- shard ổn định.

**DO** (Claude, trong pool Workers của API sau khi có binding):
- `schedule` hai lần cùng dữ liệu → một dòng, alarm không đổi;
- alarm chạy lại sau lỗi giữa chừng → không gửi trùng cho đăng ký đã `ok`;
- **giới hạn theo lượt:**
  - một nhắc gửi tới hai thiết bị chỉ tạo một dòng `occ`;
  - nhắc thứ hai trong ngày vẫn gửi;
  - lượt thứ ba khác nhau trong cùng ngày địa phương (ví dụ người dùng tắt một nhắc rồi bật nhắc khác) bị bỏ;
  - thử lại của lượt đã tính không bị chặn;
- **thử lại giữ giờ gốc:**
  - nhắc 06:00 gặp 429: `next_at` sang 06:00 ngày mai, lượt thử lúc 06:05 dùng khóa và payload của 06:00 hôm nay, không gửi lại cho thiết bị đã `ok`;
  - tắt nhắc, đổi giờ, đổi múi giờ hoặc bật Tịnh khẩu trước 06:05 → lượt bị hủy, không gửi;
  - `cancel` hủy lượt đang thử lại;
  - dừng sau 3 lần thử hoặc khi quá `due_at + 30 phút`;
- **giờ yên lặng theo giờ thực:** nhắc 21:28 gặp 429 → lượt thử lúc 21:33 bị hủy; alarm của nhắc 21:20 đến trễ lúc 21:35 → bỏ lượt, vẫn hẹn lần sau;
- **lỗi mạng không rõ kết quả:** giả lập dịch vụ push nhận yêu cầu rồi cắt kết nối trước khi trả phản hồi (hoặc trả 502/504). Khóa thành `unknown`, không có lần thử lại nào cho đăng ký đó, `fail_count` không đổi. Trả 429/503 thì thử lại sau 5 phút;
- **phục hồi `sending`:** giả lập alarm dừng sau khi dịch vụ push đã trả 2xx nhưng trước khi ghi `ok`. Lần alarm sau chuyển khóa sang `unknown`, không gọi dịch vụ push lần nữa cho đăng ký đó, và không cộng `fail_count`;
- 404/410 → dòng `push_subscription` bị xóa; 429/503 → thử lại sau 5 phút, tối đa 3 lần; mất phản hồi hoặc 5xx khác → `unknown`, không thử lại (§4 bước 5);
- API sửa giờ trước khi alarm chạy → không gửi theo giờ cũ;
- Tịnh khẩu, giờ yên lặng, đã đủ 2 nhắc trong ngày, trễ quá 30 phút → không gửi, vẫn hẹn lần sau;
- cờ tắt hoặc thiếu VAPID → không gọi dịch vụ push;
- log không chứa `user_id`, endpoint hay khóa.

Máy chủ push giả do test tạo, không gọi dịch vụ thật.

**API** (Codex): `PUT /reminders` dùng `checkReminders`/`nextReminderAt`; các mã lỗi trên; gọi `schedule`/`cancel`/`cancelUser` đúng lúc; cron đối soát; xóa tài khoản và dọn khách xóa sạch.

**Thiết bị thật** (chủ dự án):
- Android Chrome và PWA iOS 16.4 trở lên đã «Thêm vào Màn hình chính» nhận một nhắc thiền, sai lệch không quá 1 phút;
- Tịnh khẩu chặn được nhắc;
- gỡ quyền thông báo thì đăng ký bị xóa sau lần gửi kế tiếp.

## 8. Phân công sau khi hợp đồng merge

| Phần | Người làm | Tệp |
|---|---|---|
| Binding, migration tag DO, biến và bí mật, xuất lớp, route `PUT/GET /reminders` và `POST/DELETE /push/subscription`, cron đối soát, export/xóa | Codex | `workers/api/**`, `apps/web/src/net/**` (đăng ký push và gọi API) |
| Lớp `ReminderClock`, gửi push, ca kiểm DO | Claude | `workers/realtime/src/reminder-clock.js`, `workers/realtime/test/**` (chạy trong pool của API) |
| Service worker `push`/`notificationclick`; màn cài đặt nhắc (bật/tắt, giờ, Tịnh khẩu, xin quyền) | Claude | `apps/web/build.mjs` (sw), `apps/web/src/ui/**`, cần claim vùng dùng chung |
