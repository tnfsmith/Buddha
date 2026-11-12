# VÂN ĐẠO — LỘ TRÌNH KỸ THUẬT & THIẾT KẾ PRODUCTION (bản 2)

> **Ngày lập:** 12/11/2026 · **Thay thế:** bản 1 (3 bước: CI/CD → Auth & D1 → Multiplayer).
> **Phạm vi:** kiểm định hiện trạng, kiến trúc đích trên hệ sinh thái Cloudflare, lược đồ dữ liệu đầy đủ, đăng nhập đơn giản, đồng bộ offline-first, thời gian thực nhiều người, ứng dụng Android (APK/AAB), quy trình để Claude và Antigravity làm song song không xung đột, và kế hoạch theo giai đoạn.
> **Thứ tự ưu tiên khi mâu thuẫn:** Các nguyên tắc bất di bất dịch trong `CLAUDE.md` (mục 1) > tài liệu này > `van-dao-tom-tat-thiet-ke.md`. Riêng lộ trình, lược đồ DB và quy trình làm việc thì tài liệu này thay thế mục 4 của `CLAUDE.md`.
> **Ký hiệu:** `[n]` là nguồn ở Phụ lục F. Các con số chi phí/năng lực là **ước lượng** cần đo lại bằng tải thật.

---

## 0. TÓM TẮT ĐIỀU HÀNH

**Kết luận kiểm định:** Vân Đạo **chưa đạt mức production** cho một ứng dụng tu tập nhiều người. Hiện tại là một **bản trải nghiệm một người dùng chất lượng cao**, trong đó **Giai đoạn 0 (Sơ nhập Tịnh Cảnh, 49 ngày)** đã hoàn chỉnh ở phía trình duyệt; **Tầng 1–4 mới có không gian 3D và văn mô tả**, chưa có chương trình tu học, điều kiện mở tầng hay các cơ chế cộng đồng mà chính `data.js` mô tả (dẫn dắt người sơ nhập, nhóm đồng tu, điều phối…).

**Năm việc chặn production (theo thứ tự rủi ro):**
1. Toàn bộ hành trình chỉ nằm trong `localStorage` của một trình duyệt: xóa dữ liệu trình duyệt hay đổi máy là mất 49 ngày tu tập.
2. Khóa "1 nấc mỗi ngày" dựa vào đồng hồ máy người dùng; chỉnh giờ máy là nhảy ngày.
3. Không có tài khoản, máy chủ, sao lưu, giám sát, kiểm thử tự động hay chính sách dữ liệu cá nhân.
4. CI đẩy thẳng mọi commit trên `main` lên production; repo commit cả file build ~1 MB (`van-dao.html`) và bỏ qua `package-lock.json` → xung đột merge và bản build không tái lập được khi hai agent cùng làm.
5. Công cụ đã lỗi thời: `wrangler ^3.114` (v3 hết hỗ trợ sửa lỗi từ Q1/2026, chỉ còn vá bảo mật nghiêm trọng đến Q1/2027 [14]); workflow chạy Node 20 (hết hạn 30/4/2026 [16]) và `actions/*@v4` (GitHub đã gỡ Node 20 khỏi runner từ 23/9/2026 [17]).

**Hướng đi:** giữ nguyên lõi client nhẹ (Three.js + Web Audio, không framework nặng), thêm một Worker API (Hono + Better Auth + D1), một Worker thời gian thực (Durable Objects + WebSocket Hibernation), PWA offline-first, rồi đóng gói Android bằng Capacitor. Toàn bộ chạy trên Cloudflare (gói Workers Paid).

---

## 1. KIỂM ĐỊNH HIỆN TRẠNG (12/11/2026)

### 1.1 Những gì đã đạt

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Chuỗi 49 ngày × 3 trục Đức–Thiện–Tuệ, nhiệm vụ theo 7 tuần | Đạt (client) | `data.js: WEEKS`, xác nhận từng trục mỗi ngày |
| Công thức Kusala `E = 10 × (trước+trong+sau)/3 × 1,5 × 1,25` | Đạt (client) | `kusala()`; thanh trượt 0,5–1,2; E mỗi trục trong khoảng 5–22,5 |
| Khóa 1 nấc mỗi ngày | Một phần | Chỉ so `lastDate < today()` theo giờ máy, không có xác thực |
| Thời thiền 15 phút, 7 mốc, âm thanh sinh liên tục | Đạt | `audio.js` dùng AudioParam, không tạch |
| Tịnh danh 4 quy tắc | Đạt (client) | `people.js: checkName`; chưa kiểm ở máy chủ, chưa chống trùng |
| 6 phân khu Vân Đảo mở theo ngày (Trà Đạo ngày 15, Cổng Vân Môn 29/43) | Đạt | Suy ra từ `S.day`, không cần lưu riêng |
| Đại Thiền Đường, Tôn tượng 1,5×, 4 tầng + Vân Tọa | Đạt (hình ảnh) | Người ngồi quanh là mô phỏng |
| Vân Nhạc, thuyết giảng 7 bài, chim cảnh, diện mạo nhân vật | Đạt | Nội dung thuyết giảng chưa qua duyệt chuyên môn |
| Triển khai Cloudflare Workers Static Assets + tên miền riêng | Đạt | CI GitHub Actions → `vandao.ainextbrain.com` |

### 1.2 Khoảng trống để thành "ứng dụng tu tập thật sự theo 4 tầng"

Bốn tầng mang tên biểu trưng của bốn quả Thánh (Nhập Lưu, Nhất Lai, Bất Lai, Vô Học). Một ứng dụng **không thể và không được xác nhận quả chứng**; `data.js` đã ghi đúng là "biểu trưng". Vì vậy mỗi tầng phải được thiết kế như **một cõi tu học**: có chương trình, có điều kiện quan sát được (số ngày giữ giới, số thời thiền, bài tự vấn, việc phụng sự), có thể có người hướng dẫn xác nhận việc **hoàn thành chương trình**, và tuyệt đối không hiển thị câu kiểu "bạn đã đắc…".

| Tầng | Yêu cầu đã viết trong `data.js` | Hiện trạng | Cần xây |
|---|---|---|---|
| 0 · Sơ nhập | 49 ngày; niệm hơi thở; ngũ giới; nhật ký | Có đủ (client) | Đưa lên máy chủ, chống nhảy ngày, sao lưu |
| 1 · Nhập Lưu | 49 ngày liên tục lần hai; **dẫn dắt ≥ 3 người sơ nhập**; thăm đảo bạn, pháp đàm | Chỉ có cảnh và văn mô tả; bạn đồng tu là nhân vật mô phỏng | Chương trình tầng 1; mã mời & quan hệ dẫn dắt; thăm đảo thật (IslandRoom) |
| 2 · Nhất Lai | Nhật ký "8 ngọn gió"; **lập nhóm đồng tu, mục tiêu chung** | Chưa có | Nhóm đồng tu, mục tiêu nhóm, phòng nhóm |
| 3 · Bất Lai | Thiền từ & thiền quán mỗi ngày; **điều phối, giải đáp, sách tấn nhóm sơ nhập** | Chưa có | Vai trò điều phối, hỏi–đáp có kiểm duyệt |
| 4 · Vô Học | Chánh niệm mọi oai nghi; **hộ pháp ẩn danh** | Chưa có | Chế độ phụng sự ẩn danh (giúp người khác mà không hiện tên) |

**Thiếu lớn nhất là nội dung**, không phải mã: chương trình tu học của Tầng 1–4 chưa tồn tại (chỉ Giai đoạn 0 có 7 tuần nhiệm vụ). Cần một người hướng dẫn chuyên môn duyệt (xem §11).

**Nguyên tắc đạo đức sản phẩm bổ sung:**
- Không bảng xếp hạng Kusala, không so sánh điểm giữa người với người; điểm là để tự soi, chỉ chủ nhân thấy. Cộng đồng chỉ thấy số liệu tổng hợp ẩn danh ("hôm nay có N thời thiền được hồi hướng").
- Không thông báo thúc ép kiểu mạng xã hội; nhắc nhở mặc định tắt, người dùng tự bật và chọn giờ.
- Nhật ký quán chiếu (`note`) mặc định **chỉ lưu trên máy**; đồng bộ lên máy chủ phải là lựa chọn chủ động (xem §10).

### 1.3 Khoảng trống kỹ thuật

| Nhóm | Vấn đề | Mức | Xử lý ở |
|---|---|---|---|
| Dữ liệu | `localStorage` duy nhất (khóa `vandao.v1`), không sao lưu | Chặn | GĐ1–GĐ2 |
| Toàn vẹn | Ngày tu tập theo giờ máy; Kusala tính ở client | Chặn | GĐ2 (máy chủ tính lại) |
| Tài khoản | Không có; đổi máy phải tạo lại nhân vật | Chặn | GĐ2 |
| Nhiều người | Đám đông là mô phỏng | Chặn (với mục tiêu nhiều người) | GĐ4 |
| CI/CD | Mọi push lên `main` → production; không preview, không kiểm thử chặn | Cao | GĐ0 |
| Repo | Commit file build `van-dao.html` (~0,96 MB), bỏ qua lockfile; người dùng đẩy từ Windows (rủi ro CRLF) | Cao | GĐ0 |
| Phiên bản | wrangler 3, Node 20, `actions/*@v4` | Cao | GĐ0 |
| Hiệu năng di động | Cảnh nhiều tam giác và lệnh vẽ; chưa đo FPS trên máy thật | Trung bình | GĐ1, GĐ7 |
| Kiểm thử | Chỉ có `shot.mjs` (Chrome headless) | Cao | GĐ0 |
| Quan sát | Không log, không số liệu, không cảnh báo | Cao | GĐ2, GĐ7 |
| Pháp lý | Chưa có điều khoản, đồng ý, xuất/xóa dữ liệu theo Luật BVDLCN 2025 | Chặn trước khi mở đăng ký | GĐ2, GĐ7 |
| Khả năng tiếp cận | Có đọc giọng nói; thiếu giảm chuyển động, kiểm tra tương phản | Trung bình | GĐ7 |

### 1.4 Hiệu chỉnh các điểm chưa chính xác của bản 1

| Bản 1 | Vấn đề | Bản 2 |
|---|---|---|
| Lưu `unlocked_zones` trong `journey_progress` | Dữ liệu suy ra được từ ngày → dễ lệch | Không lưu; tính từ `day` và `ZONES[].unlock` |
| `practice_logs(duc_score, thien_score, tue_score, e_total)` mỗi ngày | Không khớp mã: mỗi **trục** được xác nhận riêng, có `pre/during/post/wise/self/note` | Bảng `kusala_entry` một dòng / (ngày, trục) |
| `hall_seats(seat_index PRIMARY KEY)` toàn cục | Ghế là trạng thái phiên, thay đổi từng giây → ghi D1 liên tục, khóa nóng | Ghế cấp phát trong Durable Object; D1 chỉ lưu "ghế ưa thích" |
| So `last_completed_date` để chống nhảy ngày | Vẫn tin ngày client gửi | Máy chủ tính ngày địa phương theo giờ máy chủ + múi giờ đã đăng ký; bất biến `day ≤ số ngày lịch đã trôi qua + 1` |
| PartyKit hoặc Durable Objects | Hai lựa chọn song song làm phân tán công sức | Dùng thẳng Durable Objects + WebSocket Hibernation API |
| Khung 16 byte mỗi người | Đúng hướng nhưng thiếu khung gộp, endian, nhịp gửi | Đặc tả đầy đủ ở §7.3 |
| Deploy mỗi lần push `main` | Không có cổng kiểm soát | Preview mỗi PR → staging khi merge → production khi gắn tag |

---

## 2. NGUYÊN TẮC THIẾT KẾ (giữ nguyên CLAUDE.md, bổ sung cho production)

1. **Offline-first:** thiền, xác nhận nhiệm vụ, nghe nhạc, thuyết giảng chạy được không cần mạng; có mạng thì tự đồng bộ.
2. **Máy chủ là trọng tài cho tiến trình:** client hiển thị ngay, máy chủ tính lại Kusala và quyết định ngày. Hai bên dùng **chung một mã** (`packages/shared`).
3. **Riêng tư mặc định:** thu thập tối thiểu; email là tùy chọn (chỉ khi muốn giữ hành trình); nhật ký chỉ lưu trên máy nếu không bật đồng bộ.
4. **Client không framework nặng:** giữ Three.js + JS module; máy chủ tách thư mục, không trộn logic máy chủ vào vòng lặp render.
5. **Không có file âm thanh lớn trong mã nguồn:** âm thanh sinh bằng thuật toán; bản ghi tham khảo (nếu có) để trên R2, tải theo yêu cầu.
6. **Một nguồn sự thật cho luật tu tập:** công thức Kusala, luật Tịnh danh, lịch 49 ngày, điều kiện mở tầng nằm trong `packages/shared` và dữ liệu nội dung, không viết lặp ở nhiều nơi.

---

## 3. KIẾN TRÚC ĐÍCH TRÊN CLOUDFLARE

```
                 ┌──────────────────────── vandao.ainextbrain.com ────────────────────────┐
 Trình duyệt/PWA │  Worker "vandao" (web + api)                                           │
 Android (Cap.)  │   ├─ Static Assets: index.html, js/fonts băm tên, sw.js, manifest      │
   ── HTTPS ───▶ │   ├─ /api/auth/*   Better Auth (khách ẩn danh, Email OTP, passkey)      │
   ── WSS ─────▶ │   ├─ /api/v1/*     Hono: sync, profile, journey, social, content       │
                 │   ├─ /ws/*         nâng cấp WebSocket → chuyển tới Durable Object       │
                 │   └─ /.well-known/assetlinks.json (Android App Links)                  │
                 └───┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────┘
                     │D1        │KV        │R2        │Queues    │Email     │DO (script khác)
                     ▼          ▼          ▼          ▼          ▼          ▼
               vandao-core   CONFIG    vandao-media  vd-jobs   send_email  Worker "vandao-realtime"
               (+ bản đọc    (cờ tính  (âm thanh,    (gửi mail, (OTP)       ├─ Lobby (chia shard)
               vùng xa)      năng, cache xuất dữ liệu,tổng hợp,             ├─ HallRoom  hall:t{tầng}:s{n}
                             nội dung) lưu trữ cũ)   xóa TK)                ├─ IslandRoom island:{chủ đảo}
                                                                            └─ GroupRoom group:{id} (GĐ5)
 Cron (Worker vandao): tổng hợp số liệu cộng đồng mỗi ngày · dọn khách ẩn danh · thực thi xóa tài khoản
 Bảo vệ: Turnstile (gửi OTP) · ratelimits binding · Analytics Engine (số liệu) · Workers Observability (log)
```

### 3.1 Danh mục dịch vụ

| Dịch vụ | Dùng cho | Giới hạn/điểm cần biết |
|---|---|---|
| Workers + Static Assets | Web, API | Tệp tĩnh tối đa 25 MiB/tệp; 100.000 tệp/phiên bản ở gói Paid [8] |
| D1 | Tài khoản, hồ sơ, hành trình, Kusala, quan hệ, nội dung | 10 GB/CSDL (không nâng được), 1.000 truy vấn/lần gọi Worker (Paid), 100 tham số/truy vấn, dòng tối đa 2 MB [1]; mỗi CSDL xử lý **tuần tự**, truy vấn 1 ms ≈ 1.000 truy vấn/giây [1] |
| D1 read replication | Đọc gần người dùng | Chỉ có tác dụng khi dùng **Sessions API**; bookmark giữ nhất quán tuần tự trong một phiên [2] |
| Durable Objects (SQLite) | Phòng thời gian thực, chia shard | Lớp mới nên dùng SQLite; 10 GB/đối tượng; CPU mặc định 30 s/lần gọi, nâng được đến 5 phút [4]; giới hạn mềm ~1.000 yêu cầu/giây/đối tượng [4] |
| WebSocket Hibernation | Giữ kết nối khi phòng im lặng | Đối tượng ngủ khi rảnh, kết nối vẫn mở [5]; tối đa 32.768 kết nối/đối tượng nhưng CPU/bộ nhớ giới hạn thực tế thấp hơn [5b] |
| KV | Cờ tính năng, cache nội dung đã duyệt | Đọc nhiều, ghi ít |
| R2 | Âm thanh tham khảo, gói xuất dữ liệu, lưu trữ nhật ký cũ | Không phí egress |
| Queues | Gửi mail, tổng hợp, xóa tài khoản theo hẹn | Tách việc chậm khỏi request |
| Cron Triggers | Tổng hợp hằng ngày, dọn dẹp | Chạy trên Worker `vandao` |
| Email Service (`send_email`) | Gửi mã OTP | Public beta từ 16/4/2026, cần gói Workers Paid [12] |
| Turnstile | Chống bot ở bước gửi OTP | Bắt buộc kiểm token ở máy chủ qua Siteverify [13] |
| Rate Limiting binding | Giới hạn OTP, sync, mời | Đã GA cho production; khai báo `ratelimits` cần Wrangler ≥ 4.36 [11] |
| Analytics Engine | Số liệu kỹ thuật ẩn danh (FPS, lỗi sync, thời thiền hoàn tất) | Không chứa dữ liệu định danh |
| Workers Builds / Previews | Preview mỗi PR | Mỗi PR có URL preview cố định theo nhánh [9] |

**Gói cần dùng:** Workers Paid (5 USD/tháng tối thiểu) — vì Email Sending chỉ có ở gói Paid [12] và để có D1 10 GB, Time Travel 30 ngày [1].

### 3.2 Vì sao tách hai Worker
- Worker `vandao-realtime` có vòng đời triển khai riêng (thay đổi lớp DO cần `migrations` có thẻ), không làm chậm việc phát hành web/API.
- Tài liệu Workers Builds từng ghi Preview URL không được tạo cho Worker **hiện thực** Durable Object [10b]; để Worker web/API luôn có preview cho mỗi PR, các lớp DO đặt ở Worker riêng và được gọi qua binding liên script (`script_name`). Cần kiểm lại hành vi này với Worker Previews mới khi làm GĐ0.
- Client chỉ thấy **một nguồn gốc** (`vandao.ainextbrain.com`) → cookie phiên dùng chung, không cần CORS cho web.

---

## 4. LƯỢC ĐỒ DỮ LIỆU (D1 `vandao-core`)

### 4.1 Quy ước
- Thời điểm: `INTEGER` mili-giây Unix (UTC). Ngày tu tập: `TEXT 'YYYY-MM-DD'` theo **múi giờ của người dùng** (`profile.tz`).
- Khóa chính tự sinh: ULID (sắp xếp theo thời gian, client sinh được khi offline → dùng làm khóa chống trùng).
- Migration **chỉ tiến**, đánh số `NNNN_ten.sql` trong `db/migrations/`; `wrangler d1 migrations apply` chạy theo thứ tự và ghi lịch sử vào bảng `d1_migrations` [3]. Không bao giờ sửa migration đã merge; không đặt script lùi trong thư mục này.
- Chỉ **lane Dữ liệu** (xem §9) được tạo migration mới.

### 4.2 Bảng của Better Auth (sinh bằng CLI, không viết tay)
`0001_auth.sql` sinh từ cấu hình Better Auth (`npx @better-auth/cli generate` với Drizzle, dialect SQLite): `user` (thêm cột `isAnonymous` của plugin anonymous [15]), `session`, `account`, `verification`, `passkey` (khi bật). Ứng dụng chỉ tham chiếu `user.id`. Email của khách ẩn danh là địa chỉ giả do plugin sinh, không phải email thật.

### 4.3 Bảng ứng dụng

```sql
-- 0002_profile_journey.sql
CREATE TABLE profile (
  user_id         TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  tinh_danh       TEXT NOT NULL CHECK (length(tinh_danh) BETWEEN 2 AND 16),  -- NFC, đã qua checkName() ở máy chủ
  tinh_danh_key   TEXT NOT NULL,          -- chữ thường NFC, phục vụ tìm kiếm/chặn tên phản cảm
  tag             TEXT NOT NULL,          -- 4 chữ số phân biệt người trùng tên: "An Tịnh · 0427"
  look_json       TEXT NOT NULL,          -- {"v":1,...} diện mạo, ≤ 4 KB
  settings_json   TEXT NOT NULL DEFAULT '{}',  -- nhạc, chim cảnh, giọng đọc, radar... (không nhạy cảm)
  island_json     TEXT NOT NULL DEFAULT '{}',  -- vị trí cuối {x,z,rot,sit}, chế độ cổng mây {open}
  tz              TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  tz_changed_at   INTEGER,                -- đổi múi giờ tối đa 1 lần/7 ngày (chống nhảy ngày)
  name_changed_at INTEGER,                -- đổi Tịnh danh tối đa 1 lần/30 ngày
  visibility      TEXT NOT NULL DEFAULT 'dong_tu' CHECK (visibility IN ('an','dong_tu','cong_khai')),
  pref_seat       INTEGER,                -- ghế ưa thích trong Đại Thiền Đường (gợi ý, không giữ chỗ)
  rev             INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE (tinh_danh_key, tag)
);

CREATE TABLE journey (
  user_id        TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  program        TEXT NOT NULL DEFAULT 'so-nhap-49',   -- sau này: 'tang-1', 'tang-2'...
  cycle          INTEGER NOT NULL DEFAULT 1,           -- "Trở về ngày 1" = chu kỳ mới, giữ lịch sử
  day            INTEGER NOT NULL DEFAULT 1 CHECK (day >= 1),
  started_on     TEXT NOT NULL,                        -- ngày địa phương, do MÁY CHỦ đặt
  last_done_on   TEXT,                                 -- ngày địa phương gần nhất có xác nhận
  completed_at   INTEGER,
  sacca_count    INTEGER NOT NULL DEFAULT 0,           -- số lần "thành thật nhận lỗi"
  sessions_done  INTEGER NOT NULL DEFAULT 0,
  sermons_done   INTEGER NOT NULL DEFAULT 0,
  is_current     INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
  rev            INTEGER NOT NULL DEFAULT 1,
  updated_at     INTEGER NOT NULL,
  PRIMARY KEY (user_id, program, cycle)
);
CREATE UNIQUE INDEX journey_current ON journey(user_id) WHERE is_current = 1;

-- 0003_practice.sql
CREATE TABLE kusala_entry (
  id          TEXT PRIMARY KEY,                -- ULID do client sinh (khóa chống trùng)
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  program     TEXT NOT NULL,
  cycle       INTEGER NOT NULL,
  day         INTEGER NOT NULL,
  pillar      TEXT NOT NULL CHECK (pillar IN ('duc','thien','tue')),
  local_date  TEXT NOT NULL,                   -- máy chủ tính từ at + tz
  base        REAL NOT NULL DEFAULT 10,
  pre         REAL NOT NULL CHECK (pre    BETWEEN 0.5 AND 1.2),
  during      REAL NOT NULL CHECK (during BETWEEN 0.5 AND 1.2),
  post        REAL NOT NULL CHECK (post   BETWEEN 0.5 AND 1.2),
  wise        INTEGER NOT NULL CHECK (wise IN (0,1)),   -- như lý tác ý ×1,5
  self        INTEGER NOT NULL CHECK (self IN (0,1)),   -- tự giác ×1,25
  e_score     REAL NOT NULL,                   -- MÁY CHỦ tính lại bằng packages/shared/kusala.js
  note        TEXT CHECK (note IS NULL OR length(note) <= 1000),  -- chỉ có khi bật đồng bộ nhật ký
  at          INTEGER NOT NULL,                -- thời điểm xác nhận (client), đã kẹp theo giờ máy chủ
  server_at   INTEGER NOT NULL,
  UNIQUE (user_id, program, cycle, day, pillar)
);
CREATE INDEX kusala_user_date ON kusala_entry(user_id, local_date);

CREATE TABLE practice_session (
  id          TEXT PRIMARY KEY,                -- ULID client
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('thien15','thien_tu_do','nghe_giang','kinh_hanh','tra_dao','thien_duong')),
  ref         TEXT,                            -- mã bài giảng/bài thiền
  place       TEXT,                            -- 'pad','kuti','hall','tea'...
  started_at  INTEGER NOT NULL,
  duration_s  INTEGER NOT NULL CHECK (duration_s BETWEEN 0 AND 14400),
  completed   INTEGER NOT NULL CHECK (completed IN (0,1)),
  server_at   INTEGER NOT NULL
);
CREATE INDEX session_user_time ON practice_session(user_id, started_at);

CREATE TABLE tier_progress (
  user_id       TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  tier          INTEGER NOT NULL CHECK (tier BETWEEN 0 AND 4),
  status        TEXT NOT NULL CHECK (status IN ('dang_tu','du_dieu_kien','da_mo')),
  criteria_json TEXT NOT NULL DEFAULT '{}',    -- ảnh chụp điều kiện đã đạt (để giải thích, kiểm toán)
  opened_at     INTEGER,
  confirmed_by  TEXT REFERENCES user(id) ON DELETE SET NULL,  -- người hướng dẫn xác nhận hoàn thành CHƯƠNG TRÌNH (tùy chọn)
  PRIMARY KEY (user_id, tier)
);

-- 0004_social.sql
CREATE TABLE companion (                        -- đồng tu, một dòng cho mỗi cặp (a < b)
  a            TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  b            TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('cho','dong_y')),
  requested_by TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (a, b),
  CHECK (a < b)
);
CREATE INDEX companion_b ON companion(b);

CREATE TABLE invite (                           -- mã mời sơ nhập (Tầng 1: dẫn dắt ≥ 3 người)
  code        TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  uses_left   INTEGER NOT NULL DEFAULT 5,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE TABLE guidance (
  newcomer_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  guide_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  invite_code TEXT,
  accepted_at INTEGER NOT NULL
);
CREATE INDEX guidance_guide ON guidance(guide_id);

CREATE TABLE sangha_group (                     -- nhóm đồng tu (Tầng 2)
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 40),
  founder_id  TEXT REFERENCES user(id) ON DELETE SET NULL,
  goal        TEXT CHECK (goal IS NULL OR length(goal) <= 300),
  min_tier    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE TABLE group_member (
  group_id   TEXT NOT NULL REFERENCES sangha_group(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'thanh_vien' CHECK (role IN ('thanh_vien','dieu_phoi')),
  joined_at  INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_member_user ON group_member(user_id);

CREATE TABLE user_block (
  blocker_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE TABLE report (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  target_id   TEXT REFERENCES user(id) ON DELETE SET NULL,
  context     TEXT NOT NULL CHECK (context IN ('hall','island','group','name')),
  reason      TEXT CHECK (reason IS NULL OR length(reason) <= 500),
  status      TEXT NOT NULL DEFAULT 'mo' CHECK (status IN ('mo','da_xu_ly','bo_qua')),
  created_at  INTEGER NOT NULL
);

-- 0005_content_ops.sql
CREATE TABLE content_item (                     -- bài giảng, bài thiền, nhiệm vụ: có phiên bản và duyệt
  id          TEXT NOT NULL,
  version     INTEGER NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('bai_giang','bai_thien','nhiem_vu','kinh_van','chuong_trinh')),
  tier        INTEGER NOT NULL DEFAULT 0,
  lang        TEXT NOT NULL DEFAULT 'vi',
  title       TEXT NOT NULL,
  body_inline TEXT,                               -- nội dung ngắn
  body_r2_key TEXT,                               -- nội dung dài/âm thanh trên R2
  source_ref  TEXT NOT NULL,                      -- trích dẫn kinh điển (VD: 'MN 10', 'SN 56.11')
  status      TEXT NOT NULL CHECK (status IN ('nhap','cho_duyet','da_duyet','ngung')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  PRIMARY KEY (id, version)
);
CREATE TABLE community_day (                    -- tổng hợp ẩn danh, ghi bởi cron (không ghi theo từng request)
  local_date    TEXT PRIMARY KEY,
  sessions      INTEGER NOT NULL DEFAULT 0,
  dedications   INTEGER NOT NULL DEFAULT 0,
  practitioners INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE device (
  id           TEXT PRIMARY KEY,                  -- ULID sinh trên máy, lưu trong IndexedDB
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL CHECK (platform IN ('web','pwa','android')),
  app_version  TEXT,
  last_sync_at INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE TABLE sync_op (                          -- chống áp dụng trùng thao tác offline; cron xóa sau 30 ngày
  user_id    TEXT NOT NULL,
  op_id      TEXT NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, op_id)
);
CREATE TABLE consent (                          -- bằng chứng đồng ý theo phiên bản văn bản
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind    TEXT NOT NULL CHECK (kind IN ('dieu_khoan','dong_bo_nhat_ky','thu_dien_tu')),
  version TEXT NOT NULL,
  granted INTEGER NOT NULL CHECK (granted IN (0,1)),
  at      INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, version)
);
CREATE TABLE deletion_request (
  user_id       TEXT PRIMARY KEY,
  requested_at  INTEGER NOT NULL,
  execute_after INTEGER NOT NULL                  -- cho phép hủy trong 7 ngày, sau đó xóa cứng
);
```

Ghi chú: tổng Kusala từng trục **không lưu**, tính bằng `SUM(e_score)` theo `(user_id, program, cycle)` (tối đa 147 dòng/chu kỳ). Phân khu mở và tầng hiển thị cũng suy ra.

### 4.4 Ngân sách dung lượng D1 (ước lượng)
- `kusala_entry` ≈ 250 B/dòng gồm chỉ mục; 3 dòng/ngày/người hoạt động. 10.000 người hoạt động mỗi ngày → ~11 triệu dòng/năm ≈ 2,7 GB/năm. `practice_session` ≈ 0,5 GB/năm ở cùng quy mô.
- Với trần 10 GB/CSDL không nâng được [1]: đặt cảnh báo ở 6 GB; khi chu kỳ đã hoàn tất quá 12 tháng thì chuyển chi tiết sang R2 (JSON theo người dùng) và chỉ giữ tổng hợp. Nếu vượt 50.000 người hoạt động/ngày, tách `kusala_entry`/`practice_session` sang CSDL theo năm hoặc theo băm `user_id` (D1 được thiết kế để mở rộng ngang bằng nhiều CSDL nhỏ [1]).

### 4.5 Lưu trữ phía client (IndexedDB `vandao`, thay `localStorage`)
| Store | Nội dung |
|---|---|
| `state` | Bản sao hồ sơ, hành trình hiện tại, cài đặt, `rev` máy chủ, bookmark D1 |
| `outbox` | Thao tác chưa gửi `{id(ULID), type, at, payload}` |
| `kusala` | Bản ghi theo (chu kỳ, ngày, trục), gồm `note` (nhật ký chỉ ở máy nếu chưa bật đồng bộ) |
| `sessions` | Thời thiền đã ngồi |
| `meta` | `device_id`, phiên bản lược đồ client |

Lần đầu chạy bản mới: đọc `localStorage['vandao.v1']`, chuyển sang IndexedDB theo bảng ánh xạ ở Phụ lục A, giữ khóa cũ thêm 30 ngày rồi mới xóa.

---

## 5. HỢP ĐỒNG API (REST `/api/v1`, JSON, khóa `snake_case`)

| Phương thức & đường dẫn | Xác thực | Mục đích | Giới hạn |
|---|---|---|---|
| `POST /api/auth/sign-in/anonymous` | — | Tạo phiên khách (Better Auth) | 5/phút/IP |
| `POST /api/auth/email-otp/send-verification-otp` | Turnstile | Gửi mã 6 số | 3/10 phút/email, 10/giờ/IP |
| `POST /api/auth/sign-in/email-otp` | — | Đăng nhập/gắn email vào khách | 5 lần sai → khóa mã |
| `GET /api/v1/me` | phiên | Hồ sơ + hành trình hiện tại + tổng Kusala + phân khu mở | 60/phút |
| `POST /api/v1/sync` | phiên | Đồng bộ hai chiều (§5.1) | 30/phút |
| `PATCH /api/v1/profile` | phiên | Đổi Tịnh danh (kiểm 4 quy tắc), diện mạo, cài đặt, quyền riêng tư | Tên: 1/30 ngày |
| `GET /api/v1/export` | phiên | Xuất toàn bộ dữ liệu (JSON) | 2/ngày |
| `POST /api/v1/account/delete` · `DELETE …/delete` | phiên + OTP | Yêu cầu/hủy yêu cầu xóa tài khoản | — |
| `POST /api/v1/rt/ticket` | phiên | Vé vào phòng thời gian thực (§7.2) | 20/phút |
| `GET/POST /api/v1/companions`, `/invites`, `/groups`, `/blocks`, `/reports` | phiên | Xã hội tu tập (GĐ5) | theo loại |
| `GET /api/v1/content?tier=&kind=` | công khai | Nội dung **đã duyệt** (cache KV) | cache 1 giờ |

Lỗi trả về dạng `{"error":{"code":"day_locked","message":"…"}}`. Mọi phản hồi có `x-d1-bookmark`; client gửi lại ở request sau để đọc nhất quán qua bản sao [2]. Kiểm tra đầu vào bằng thư viện schema nhẹ (Valibot) dùng chung ở `packages/shared`.

### 5.1 Giao thức đồng bộ offline-first
Yêu cầu:
```json
{ "device_id": "01J…", "client_now": 1763000000000, "tz": "Asia/Ho_Chi_Minh",
  "known": { "profile_rev": 7, "journey_rev": 31 },
  "ops": [
    { "id": "01J…A", "type": "kusala.confirm", "at": 1762990000000,
      "payload": { "program": "so-nhap-49", "cycle": 1, "day": 12, "pillar": "tue",
                   "pre": 1, "during": 1.1, "post": 0.9, "wise": true, "self": true, "note": null } },
    { "id": "01J…B", "type": "session.done", "at": 1762990900000,
      "payload": { "kind": "thien15", "duration_s": 900, "completed": true, "place": "pad" } },
    { "id": "01J…C", "type": "profile.patch", "at": 1762991000000,
      "payload": { "settings": { "birds": { "n": 6, "freq": 1, "vol": 0.6 } } } }
  ] }
```
Phản hồi: `{ "applied": [...], "rejected": [{ "id": "…", "code": "exists|day_locked|stale_cycle|invalid" }], "state": { profile, journey, totals, zones, server_now } }`.

Quy tắc máy chủ (trong một lô D1 `batch()` để nguyên tử):
1. **Chống trùng:** bỏ qua `op.id` đã có trong `sync_op`.
2. **Kẹp thời gian:** `at` hợp lệ trong `[server_now − 7 ngày, server_now + 2 phút]`; ngoài khoảng → `invalid`. `local_date` tính từ `at` theo `profile.tz`.
3. **Kusala:** máy chủ tính lại `e_score` bằng `kusala()` chung; mỗi (chu kỳ, ngày, trục) chỉ ghi lần đầu (`UNIQUE`) → lần sau trả `exists` kèm bản đã lưu.
4. **Khóa ngày (bất biến cứng):** `day ≤ (ngày địa phương hôm nay theo giờ máy chủ − started_on) + 1`; tiến ngày theo đúng luật client hiện tại: chỉ khi `last_done_on < hôm nay` và đủ 3 trục của ngày hiện tại. Phát lại thao tác theo thứ tự `at` để người dùng offline nhiều ngày vẫn tiến đúng.
5. **Hồ sơ/cài đặt:** ghi đè theo nhóm trường, thao tác có `at` mới hơn thắng (LWW), tăng `rev`. Vị trí trên đảo chỉ gửi khi rời trang hoặc tối đa 1 lần/phút.
6. **"Trở về ngày 1":** tạo chu kỳ mới (`cycle+1`), chu kỳ cũ giữ lịch sử. Thiết bị còn ở chu kỳ cũ nhận `stale_cycle` và nhận trạng thái mới.
7. Client luôn **nhận `state` của máy chủ làm chuẩn** sau mỗi lần sync, rồi phát lại các thao tác còn trong `outbox`.

---

## 6. TÀI KHOẢN & ĐĂNG NHẬP — ĐƠN GIẢN CHO NGƯỜI DÙNG CUỐI

### 6.1 Luồng trải nghiệm
1. **Lần đầu mở app:** không có màn hình đăng nhập. Người dùng tạo nhân vật như hiện nay (Tịnh danh + diện mạo) và bắt đầu tu tập ngay; dữ liệu lưu trên máy.
2. **Ngầm tạo phiên khách:** khi có mạng, app gọi đăng nhập ẩn danh (plugin `anonymous` của Better Auth cho phép trải nghiệm có xác thực mà không cần email, mật khẩu hay thông tin định danh [15]) và đồng bộ hồ sơ + hành trình.
3. **"Giữ hành trình của tôi"** (gợi ý nhẹ ở Bia Tích Lũy sau ngày 1, không chặn): nhập email → nhận mã 6 số → xong. Better Auth gọi `onLinkAccount` để chuyển dữ liệu từ tài khoản khách sang tài khoản mới [15]; Email OTP dùng plugin `emailOTP` [15b], thư gửi bằng binding `send_email` [12]. Không có mật khẩu.
4. **Đổi máy/điện thoại mới:** màn hình chào có nút "Tôi đã có hành trình" → email → mã → tải về Tịnh danh, diện mạo, ngày, Kusala, vị trí cuối. **Không phải tạo lại nhân vật.**
5. **Xung đột khi đăng nhập trên máy đã có hành trình khách:** hỏi một câu "Giữ hành trình đã lưu (ngày 12)" hay "Dùng hành trình trên máy này (ngày 2)"; mặc định giữ bản đã lưu, bản kia lưu thành chu kỳ cũ — không mất dữ liệu.
6. **Tùy chọn sau:** passkey ("đăng nhập bằng vân tay/Face ID") cho web; Google cho ai muốn. Không bắt buộc.

### 6.2 Trang "Tài khoản" (trong menu Nhân vật)
Đổi Tịnh danh (kiểm 4 quy tắc tại máy chủ, 1 lần/30 ngày) · đổi diện mạo · chế độ hiển thị (Ẩn / Đồng tu / Công khai) · bật/tắt đồng bộ nhật ký quán chiếu · danh sách thiết bị và "đăng xuất mọi nơi" · xuất dữ liệu · xóa tài khoản (hủy được trong 7 ngày) · chặn/báo cáo.

### 6.3 Bảo mật xác thực
- Cookie phiên `HttpOnly; Secure; SameSite=Lax` trên web; ứng dụng Android dùng **bearer token** (plugin `bearer` của Better Auth) lưu trong bộ nhớ an toàn, vì WebView chạy ở nguồn gốc khác.
- Better Auth khởi tạo **theo từng request** vì binding D1 chỉ có trong `fetch()` [15c]; bật cờ `nodejs_compat`.
- OTP hết hạn 10 phút, tối đa 5 lần nhập sai; Turnstile ở bước gửi mã, luôn kiểm token ở máy chủ [13]; `ratelimits` theo IP và theo email [11].
- Endpoint gửi mail chỉ gửi tới email của chính người đang xác thực (không thành relay thư rác).
- Cron xóa tài khoản khách không gắn email và không hoạt động sau 90 ngày (báo trước trong app).

---

## 7. THỜI GIAN THỰC NHIỀU NGƯỜI (Durable Objects)

### 7.1 Cấu trúc phòng
| Phòng | Khóa đối tượng | Ai vào | Sức chứa thiết kế |
|---|---|---|---|
| `Lobby` | `lobby` | API gọi để chọn shard | 1 đối tượng (chỉ xử lý lúc vào phòng) |
| `HallRoom` | `hall:t{tầng}:s{n}` | Đại Thiền Đường theo tầng | 200 người/shard (cấu hình được) |
| `IslandRoom` | `island:{user_id chủ đảo}` | Chủ đảo + khách khi cổng mây mở | 12 người |
| `GroupRoom` | `group:{group_id}` | Thành viên nhóm (GĐ5) | 100 người |

Khi một shard đầy, Lobby mở shard mới; ưu tiên xếp người vào shard có đồng tu của họ. Phía client hiển thị tối đa 200 người thật, phần còn lại là chỉ số "đang có N người cùng ngồi" (Lobby tổng hợp mỗi 30 giây).

### 7.2 Vào phòng
1. Client gọi `POST /api/v1/rt/ticket {room}` → API kiểm phiên, quyền (bị chặn, cổng đảo đóng…), hỏi Lobby lấy shard, trả **vé ký HMAC** sống 60 giây `{uid, slot_hint, room, tinh_danh, look_hash, exp}`.
2. Client mở `wss://vandao.ainextbrain.com/ws/{room}?t={vé}`; Worker web chuyển tới DO. DO kiểm chữ ký bằng secret dùng chung, **không truy vấn D1** khi có người vào.
3. DO dùng `ctx.acceptWebSocket()` (Hibernation API), lưu metadata mỗi kết nối bằng `serializeAttachment()` vì bộ nhớ bị xóa khi đối tượng ngủ [5]. Ping/pong trả bằng auto-response để nhịp giữ kết nối không đánh thức đối tượng.

### 7.3 Đặc tả khung nhị phân (little-endian)
Bản ghi trạng thái **16 byte** (giữ tương thích bản 1):

| Byte | Kiểu | Trường |
|---|---|---|
| 0–1 | Uint16 | `slot` (DO cấp, duy nhất trong phòng) |
| 2–5, 6–9, 10–13 | Float32 ×3 | X, Y, Z |
| 14 | Uint8 | Trạng thái: 0 đứng · 1 tọa thiền · 2 chắp tay · 3 đảnh lễ · 4 kinh hành · 5 tùy hỷ |
| 15 | Uint8 | Hướng quay `yaw × 256 / 2π` |

- **Client → máy chủ:** 1 bản ghi 16 byte, **chỉ gửi khi thay đổi**; đang đi tối đa 5 lần/giây; đang ngồi thiền không gửi gì.
- **Máy chủ → client:** khung gộp `[type:u8=1][count:u16][rsv:u8] + count × 16 byte`, phát tối đa 4 lần/giây và **chỉ khi có thay đổi**. Sự kiện hiếm (vào/rời phòng kèm Tịnh danh, diện mạo) gửi dạng JSON text `type: "join" | "leave"`.
- Không có chat chữ tự do ở GĐ4; chỉ cử chỉ (chắp tay, đảnh lễ, tùy hỷ). Pháp đàm bằng chữ chỉ mở ở GĐ5 trong phòng nhóm, có chặn/báo cáo.

### 7.4 Phía client
- Pool `InstancedMesh` sẵn có trong `people.js` (tỉ lệ `sc`, động tác chắp tay/đảnh lễ bằng shader) nhận dữ liệu thật thay cho mô phỏng; nội suy 150 ms để chuyển động mượt.
- Mức chi tiết theo khoảng cách; trên điện thoại giới hạn 150 hình người thật, còn lại dùng hình đơn giản.
- Mất kết nối → tự nối lại với lùi thời gian tăng dần; thời thiền **không bao giờ dừng** vì lỗi mạng.

### 7.5 Ước lượng chi phí và năng lực (cần đo lại)
Giá Durable Objects gói Paid: 0,15 USD/triệu yêu cầu, 12,50 USD/triệu GB-giây, đã gồm 1 triệu yêu cầu và 400.000 GB-giây mỗi tháng [6]. Tin nhắn WebSocket **gửi đến** đối tượng tính theo tỉ lệ 20:1 [7]; đối tượng rảnh đủ điều kiện ngủ đông thì không tính thời lượng [6].

Kịch bản giờ cao điểm: 2.000 người cùng lúc, 10 shard hoạt động 3 giờ/ngày, trung bình 1 tin/giây/người (đa số đang ngồi nên gần 0, người đang đi 5 tin/giây):
- Tin đến: 2.000 × 1 × 10.800 × 30 ≈ 648 triệu → /20 ≈ 32,4 triệu yêu cầu tính phí → ≈ 4,7 USD.
- Thời lượng: 10 × 10.800 × 30 × 0,128 GB ≈ 415.000 GB-giây → vượt nhẹ phần đã gồm → ≈ 12,5 USD (làm tròn theo khối triệu GB-giây [6]).
- **Tổng phần thời gian thực ≈ 20–25 USD/tháng** + 5 USD nền. D1, KV, Email ở quy mô này nằm chủ yếu trong hạn mức gói Paid (cần xác nhận bằng số liệu thật).

Điểm nghẽn cần theo dõi: CPU của một shard khi phát khung gộp (giới hạn mềm ~1.000 yêu cầu/giây/đối tượng [4]); Lobby chỉ xử lý lúc vào phòng nên chịu được hàng trăm lượt vào/giây.

### 7.6 Kiểm thử tải
- Công cụ: k6 (WebSocket) hoặc script Node `ws` chạy từ GitHub Actions/máy riêng, mô phỏng bot gửi đúng khung 16 byte.
- Mục tiêu nghiệm thu GĐ4: 200 kết nối/shard ổn định 30 phút; độ trễ p95 < 250 ms trong khu vực; không mất khung; đối tượng ngủ đông khi mọi người ngồi yên (kiểm chỉ số thời lượng); điện thoại tầm trung giữ ≥ 30 FPS với 150 hình người.
- Mục tiêu GĐ7: 2.000 kết nối đồng thời trên 10 shard; sync 50 yêu cầu/giây trong 10 phút với lỗi < 0,1 %.

---

## 8. ỨNG DỤNG ANDROID (APK để thử, AAB để lên Google Play)

### 8.1 Chọn công nghệ
| Tiêu chí | Capacitor 8 (đề xuất) | TWA + Bubblewrap (phương án nhẹ) |
|---|---|---|
| Cách chạy | WebView hệ thống, **đóng gói sẵn tài nguyên trong app** | Mở PWA trong Chrome toàn màn hình [20] |
| Offline lần đầu | Có ngay (tài nguyên nằm trong APK) | Phụ thuộc service worker |
| Plugin gốc | Giữ màn hình sáng khi thiền, thông báo nhắc giờ, chia sẻ, rung nhẹ | Hạn chế |
| Cập nhật | Phát hành bản mới (hoặc tải tài nguyên web mới khi mở app) | Cập nhật web là xong |
| Kích thước | Lớn hơn | Rất nhỏ |

Đề xuất **Capacitor 8** vì thời thiền cần chạy chắc chắn offline và giữ màn hình sáng; TWA giữ làm phương án dự phòng (cần PWA đạt chuẩn từ GĐ1).

### 8.2 Yêu cầu công cụ (11/2026)
- Google Play: **ứng dụng mới và bản cập nhật phải nhắm Android 16 (API 36) từ 31/8/2026** [18].
- Capacitor 8 cần Android Studio Otter 2025.2.1 trở lên [19]; Node 22+, JDK 21, `compileSdk/targetSdk 36`, `minSdk 24`, AGP 8.13, Gradle 8.14.3 [19b].
- Hỗ trợ trang bộ nhớ 16 KB cho thư viện native (Play Console sẽ cảnh báo nếu thiếu) [19b].

### 8.3 Cấu trúc & build
```
apps/android/
├── capacitor.config.ts   # appId: com.ainextbrain.vandao (chốt trước khi lên Play, không đổi được)
├── package.json          # @capacitor/core, cli, android ^8; @capacitor/local-notifications; keep-awake
└── android/              # dự án Gradle do `npx cap add android` sinh, có commit
```
- Build web đích `android` (tài nguyên tách tệp, không cần service worker) → `npx cap sync android` → `./gradlew assembleRelease` (APK cài thử) và `bundleRelease` (AAB cho Play).
- API gọi tuyệt đối `https://vandao.ainextbrain.com/api`; xác thực bằng bearer token (§6.3).
- Worker phục vụ `/.well-known/assetlinks.json` (App Links, và passkey trong app ở giai đoạn sau).
- Âm thanh: WebView có thể bị tạm dừng khi tắt màn hình → thời thiền giữ màn hình sáng (plugin keep-awake), giảm độ sáng; không hứa phát nền khi khóa máy.
- Ký: Play App Signing; **upload key** lưu trong GitHub Secrets (`ANDROID_KEYSTORE_B64`, mật khẩu…); `versionCode` = số lần chạy CI, `versionName` = tag.
- Workflow `android.yml` (Phụ lục D): chạy khi gắn tag `android-v*`, xuất APK + AAB thành artifact/GitHub Release; giai đoạn đầu tải AAB lên Play Console (kênh Internal testing) thủ công.

---

## 9. QUY TRÌNH CỘNG TÁC SONG SONG CLAUDE ↔ ANTIGRAVITY

### 9.1 Luật dùng chung cho mọi agent
- Tạo **`AGENTS.md`** ở gốc repo làm luật chung; Antigravity đọc `AGENTS.md` và `GEMINI.md`, cùng thư mục `.agents/rules/` [21]. `CLAUDE.md` giữ ngắn: nhập `@AGENTS.md` + phần riêng cho Claude. Antigravity giới hạn 12.000 ký tự mỗi tệp luật [21b] → luật ngắn gọn, chi tiết để trong `docs/`.
- Mỗi việc = **một GitHub Issue** có: phạm vi thư mục được sửa, tiêu chí nghiệm thu, phụ thuộc. Nhận việc bằng nhãn `lane:claude` / `lane:antigravity` + `status:claimed`. Không dùng tệp "bảng việc" trong repo (chính nó sẽ xung đột).
- Nhánh ngắn: `claude/<số-issue>-<mô-tả>` hoặc `ag/<số-issue>-<mô-tả>`; rebase lên `main` trước khi mở PR; PR < ~400 dòng thay đổi (không tính tệp sinh); **squash merge**.
- **Không ai đẩy thẳng lên `main`, kể cả từ máy cá nhân.** Lưu ý: repo private trên GitHub Free **không có** branch protection; tính năng này cần GitHub Pro/Team [22]. Hai lựa chọn: (a) nâng GitHub Pro để bật "require PR + required checks"; (b) giữ Free nhưng production chỉ triển khai từ **tag** đã qua CI (§9.4), nên một lần đẩy nhầm cũng không lên production.

### 9.2 Phân lane theo thư mục (sở hữu chính)
| Lane | Agent chính | Thư mục sở hữu |
|---|---|---|
| **3D & trải nghiệm** | Claude | `apps/web/src/world.js, island.js, people.js, realm.js, birds.js, gfx.js, audio.js, music.js, sermon.js`, `apps/web/src/rt/` (client thời gian thực) |
| **Thời gian thực máy chủ** | Claude | `workers/realtime/` |
| **API, Auth, Dữ liệu** | Antigravity | `workers/api/`, `db/migrations/` (**độc quyền tạo migration**), `apps/web/src/net/` (client sync) |
| **Hạ tầng & CI** | Antigravity | `.github/workflows/`, `wrangler.jsonc` các Worker, `apps/android/` |
| **Dùng chung (tuần tự)** | Người tạo Issue chỉ định 1 agent | `packages/shared/` (Kusala, Tịnh danh, giao thức, schema), `apps/web/src/ui/`, `data.js`, `package.json` gốc |
| **Nội dung** | Người dùng + người duyệt | `content/` (bài giảng, chương trình các tầng) |

Thay đổi chạm lane khác → mở Issue cho lane đó hoặc ghi rõ trong PR và chờ lane đó xác nhận.

### 9.3 Điểm nóng xung đột và cách khóa
1. **File build trong repo:** ngừng commit `van-dao.html`, `dist/`, `public/`; bản HTML đơn để tải offline lấy từ GitHub Release do CI đính kèm.
2. **Lockfile:** commit `package-lock.json`, CI dùng `npm ci`. Xung đột lockfile → không sửa tay, chạy lại `npm install` sau khi rebase.
3. **`main.js` (465 dòng, ai cũng sửa):** tách ở GĐ0 thành `state.js`, `ui/panel.js`, `ui/creator.js`, `ui/journey.js`, `ui/account.js`, `boot.js`.
4. **Đánh số migration:** chỉ lane Dữ liệu tạo; CI kiểm số thứ tự liên tục, không trùng, không sửa tệp đã merge.
5. **Lớp Durable Object:** chỉ lane Thời gian thực sửa `migrations` trong `workers/realtime/wrangler.jsonc`.
6. **Xuống dòng:** thêm `.gitattributes` (`* text=auto eol=lf`) và `.editorconfig` — người dùng đẩy từ Windows.
7. **Hợp đồng trước, cài đặt sau:** schema API (`packages/shared/api.ts`) và codec giao thức (`packages/shared/rt-codec.js`) được merge **trước**; sau đó hai lane làm song song với dữ liệu giả (mock) theo cùng hợp đồng.

### 9.4 Dòng chảy từ nhánh đến production
```
nhánh claude/* hoặc ag/*
   └─ PR ──▶ ci.yml: lint · unit (Vitest) · test Worker (vitest-pool-workers) · build + ngân sách kích thước
            · e2e khói (Playwright, WebGL headless) · kiểm migration
         └─ preview.yml: `wrangler preview --name pr-N` → URL preview bình luận vào PR [9b]
              (D1/KV riêng cho preview qua khối `previews` trong cấu hình [9])
   └─ squash merge vào main ──▶ deploy.yml: áp migration lên D1 staging → deploy `vandao-staging`
                                (staging.vandao.ainextbrain.com) → kiểm khói tự động
   └─ gắn tag vX.Y.Z ──▶ deploy.yml (production):
          1) áp migration production (chỉ kiểu "mở rộng": thêm bảng/cột, không xóa)
          2) deploy realtime (nếu đổi) → deploy web/api
          3) kiểm khói; lỗi → `wrangler rollback`; dữ liệu → D1 Time Travel (30 ngày ở gói Paid [1])
```
- Thay đổi phá vỡ lược đồ làm theo **mở rộng → chuyển → thu hẹp** qua 2 bản phát hành.
- Secret trong repo GitHub chỉ dùng cho nhánh/tag của repo này; workflow preview kiểm `head.repo == repository` trước khi dùng secret [9b].

### 9.5 Định nghĩa "Xong" (DoD) cho mọi PR
Build xanh · kiểm thử mới cho logic mới · không tăng kích thước HTML đơn quá 3 % nếu không giải thích · không phá invariants trong `CLAUDE.md` · preview đã được mở thử trên điện thoại · cập nhật tài liệu liên quan · commit có dòng ghi công của agent.

---

## 10. BẢO MẬT, QUYỀN RIÊNG TƯ, TUÂN THỦ

- **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 có hiệu lực từ 1/1/2026** [23], cùng Nghị định 356/2025/NĐ-CP (thay Nghị định 13) [23b]. Người dùng có quyền được biết, đồng ý, truy cập, chỉnh sửa và yêu cầu xóa dữ liệu [23c]. Đáp ứng bằng: điều khoản + đồng ý có phiên bản (`consent`), xuất dữ liệu, xóa tài khoản, nhật ký mặc định không lên máy chủ.
- Dữ liệu thực hành tu tập có thể bị xem là thể hiện **niềm tin tôn giáo** (thuộc nhóm nhạy cảm theo quy định trước đây) → cần luật sư xác nhận theo danh mục mới của Nghị định 356 trước khi mở đăng ký rộng; trong lúc chờ, áp dụng mức bảo vệ của dữ liệu nhạy cảm.
- Máy chủ: secret qua `wrangler secret`; truy vấn tham số hóa; kiểm đầu vào ở biên; tiêu đề CSP, HSTS, `Permissions-Policy`; không ghi email/nhật ký vào log; Analytics Engine chỉ nhận số liệu ẩn danh.
- Thời gian thực: vé HMAC 60 giây; chặn người bị chặn ngay trong DO; giới hạn tốc độ khung; báo cáo vi phạm có hàng chờ xử lý.
- Đánh giá theo OWASP ASVS mức 1 trước khi mở công khai (GĐ7).

---

## 11. QUẢN TRỊ NỘI DUNG TU HỌC

- Mọi bài giảng, bài thiền, chương trình tầng nằm trong `content/` (Markdown + front-matter: `id, version, tier, source_ref, status`) → CI nạp vào `content_item`/KV. Chỉ nội dung `da_duyet` được hiển thị.
- Bảy bài thuyết giảng tóm lược Nikāya hiện có chuyển sang trạng thái `cho_duyet` cho đến khi người hướng dẫn chuyên môn đọc lại.
- **Khung điều kiện mở tầng (đề xuất, chờ người hướng dẫn quyết):**
  - 0 → 1: hoàn tất 49 ngày (đã có) + ≥ 30 thời thiền trọn + bài tự vấn cuối chương trình.
  - 1 → 2: hoàn tất chương trình Tầng 1 + đã dẫn dắt ≥ 3 người sơ nhập hoàn thành ít nhất tuần đầu.
  - 2 → 3: tham gia hoặc khởi xướng một nhóm đồng tu và hoàn thành mục tiêu chung.
  - 3 → 4: giữ vai trò điều phối nhóm sơ nhập trong một chu kỳ.
  - Điều kiện lưu ở dữ liệu nội dung (không viết cứng trong mã); giao diện chỉ nói "đã hoàn thành chương trình Tầng N", **không nói đã chứng đắc**.
- Không dùng AI sinh nội dung giáo lý hiển thị trực tiếp cho người dùng nếu chưa qua duyệt; nếu sau này có tra cứu kinh bằng AI thì chỉ trả lời kèm trích dẫn nguồn kinh và có nhãn rõ ràng.

---

## 12. CÔNG NGHỆ & PHIÊN BẢN CHUẨN (mốc 11/2026)

| Thành phần | Phiên bản đề xuất | Lý do / ghi chú |
|---|---|---|
| Node.js (CI, công cụ) | **24 LTS** | Hỗ trợ đến 30/4/2028; Node 20 đã hết hạn 30/4/2026 [16]. Có thể lên 26 khi đã vào Active LTS |
| Wrangler | **^4 (bản mới nhất)** | v3 chỉ còn vá bảo mật nghiêm trọng đến Q1/2027 [14]; cần ≥ 4.36 cho `ratelimits` [11] |
| GitHub Actions | `actions/checkout@v5+`, `actions/setup-node@v5+`, `cloudflare/wrangler-action@v3` | Runner đã bỏ Node 20 từ 23/9/2026 [17] |
| `compatibility_date` | Cập nhật mỗi quý (hiện `2026-10-01`), cờ `nodejs_compat` cho Better Auth | |
| three.js | r187 (đang dùng), nâng có kiểm soát | Nhịp phát hành ~8–11 tuần/bản trong 2026, r186 đã gỡ một số định dạng build cũ [24] → nâng bản phải chạy e2e hình ảnh |
| esbuild | 0.28.x (đang dùng) | Giữ đóng gói nhanh, không thêm bundler nặng |
| Web Audio, WebGL2 | Giữ | WebGPU để sau, khi cần |
| Hono | 4.x | Router nhẹ cho Workers |
| Better Auth | Bản **stable** mới nhất (v1.6 đã không còn là stable; v1.8 đang beta) [15] | Plugin `anonymous`, `emailOTP`, `bearer`, `passkey` |
| Drizzle ORM + drizzle-kit | Bản mới nhất | Better Auth trên D1 cần Drizzle hoặc Kysely, không có adapter D1 riêng [15c] |
| Valibot | Bản mới nhất | Kiểm schema nhẹ dùng chung client/máy chủ |
| Vitest + `@cloudflare/vitest-pool-workers` | Bản mới nhất | Kiểm thử chạy trong runtime Workers |
| Playwright | Bản mới nhất | e2e khói + ảnh chụp WebGL |
| Capacitor | **8.x**, `targetSdk 36` | Đáp ứng yêu cầu API 36 của Play [18][19] |
| Bubblewrap (dự phòng TWA) | 1.27+ | Bản 10/2026 nhắm Android 16 [20b] |

Quy tắc cập nhật: Dependabot/Renovate mở PR hằng tuần cho bản vá, hằng tháng cho bản nhỏ; bản lớn cần Issue riêng.

---

## 13. CẤU TRÚC REPO ĐÍCH (npm workspaces)

```
Buddha/
├── AGENTS.md                  # luật chung mọi agent (≤ 12.000 ký tự)
├── CLAUDE.md                  # @AGENTS.md + phần riêng Claude
├── PROJECT_ROADMAP.md         # tài liệu này
├── docs/                      # thiết kế, ADR (quyết định kiến trúc), runbook
├── content/                   # nội dung tu học có duyệt
├── apps/
│   ├── web/                   # (dời từ van-dao-src/) src/, build.mjs (đích: single | web | android), tests/
│   └── android/               # Capacitor 8
├── workers/
│   ├── api/                   # Worker "vandao": static assets + Hono + Better Auth + cron + queue consumer
│   └── realtime/              # Worker "vandao-realtime": Lobby, HallRoom, IslandRoom, GroupRoom
├── packages/shared/           # kusala.js, tinh-danh.js, schedule.js, api.ts, rt-codec.js, schemas
├── db/migrations/             # D1, chỉ tiến
├── tests/e2e/ · tests/load/
├── .github/workflows/         # ci.yml · preview.yml · deploy.yml · android.yml
├── .gitattributes · .editorconfig · package.json · package-lock.json
```
Việc dời `van-dao-src/` → `apps/web/` làm bằng **một PR duy nhất** (`git mv`, không đổi nội dung) trong lúc không có nhánh nào đang mở.

---

## 14. KẾ HOẠCH THEO GIAI ĐOẠN

Thời lượng là ước lượng cho một người điều phối + hai agent; mỗi giai đoạn kết thúc bằng một tag phát hành.

### GĐ0 — Nền móng repo & CI (≈ 1 tuần)
| Việc | Lane | Nghiệm thu |
|---|---|---|
| Dời sang monorepo, `.gitattributes`, commit lockfile, ngừng commit build | Antigravity (PR đóng băng) | `npm ci && npm run build` sạch trên Linux và Windows |
| Nâng Node 24, Wrangler 4, actions v5+, tách ci/preview/deploy, staging + deploy theo tag | Antigravity | PR có URL preview; merge lên staging; tag lên production |
| Tách `main.js`; tạo `packages/shared` (Kusala, Tịnh danh, lịch 49 ngày) + Vitest | Claude | Kiểm thử công thức và 4 quy tắc tên xanh; giao diện không đổi (so ảnh `shot.mjs`) |
| Viết `AGENTS.md`, rút gọn `CLAUDE.md`, nhãn Issue, mẫu PR | Claude | Cả hai agent đọc cùng một bộ luật |

### GĐ1 — PWA & offline-first (≈ 1 tuần) · Claude
Manifest + service worker (cache tệp băm tên), build đích `web` tách font/three/app, IndexedDB + `outbox`, chuyển `vandao.v1` → IndexedDB, chế độ chất lượng thấp cho máy yếu. **Nghiệm thu:** tắt mạng vẫn mở app và ngồi thiền đủ 15 phút; Lighthouse PWA đạt; dữ liệu cũ chuyển đủ.

### GĐ2 — API, D1, tài khoản (≈ 2 tuần) · song song
- Antigravity: `workers/api` (Hono, Better Auth khách + Email OTP, Drizzle), migration 0001–0005, `/me`, `/sync`, `/profile`, `/export`, xóa tài khoản, Turnstile, rate limit, cron dọn dẹp, Analytics Engine.
- Claude: client sync theo hợp đồng (mock trước), màn "Giữ hành trình" / "Tôi đã có hành trình", trang Tài khoản, xử lý xung đột chu kỳ.
- **Nghiệm thu:** tạo nhân vật trên điện thoại → gắn email → mở laptop → nhập mã → nhân vật, ngày, Kusala, vị trí khôi phục < 10 giây; xác nhận offline 3 ngày rồi online → tiến đúng 3 ngày; đổi giờ máy không nhảy ngày; E máy chủ = E client.

### GĐ3 — Nội dung & cơ chế 4 tầng (≈ 2 tuần, song song GĐ2)
`content/` + quy trình duyệt; bảng `tier_progress`; cấu hình điều kiện mở tầng; giao diện "đủ điều kiện → mở Tầng 1" và biến đổi không gian; chương trình Tầng 1 (khung, chờ nội dung). **Nghiệm thu:** người hoàn tất 49 ngày thấy lộ trình Tầng 1 với nội dung đã duyệt; không có câu chữ khẳng định chứng đắc.

### GĐ4 — Đại Thiền Đường thời gian thực (≈ 2–3 tuần)
- Claude: `workers/realtime` (Lobby, HallRoom), codec 16 byte, đám đông thật bằng `InstancedMesh`, nội suy, nối lại.
- Antigravity: `/rt/ticket`, chặn/báo cáo, số liệu shard, kịch bản k6.
- **Nghiệm thu:** như §7.6 (200/shard, p95 < 250 ms, ngủ đông khi im lặng, ≥ 30 FPS trên máy tầm trung).

### GĐ5 — Xã hội tu tập cho Tầng 1–3 (≈ 3 tuần)
Đồng tu, mã mời & dẫn dắt sơ nhập, thăm đảo thật (IslandRoom, cổng mây Độc cư/Nghênh khách), nhóm đồng tu + phòng nhóm, vai trò điều phối, pháp đàm chữ có kiểm duyệt. **Nghiệm thu:** hai người thật thăm đảo nhau, cùng an tọa; nhóm 10 người đặt mục tiêu chung; chặn có hiệu lực tức thì.

### GĐ6 — Android (≈ 1–2 tuần, có thể bắt đầu sau GĐ2) · Antigravity
Capacitor 8, build đích `android`, bearer auth, giữ màn hình sáng, nhắc giờ thiền tại máy, `android.yml` ký APK/AAB, kênh Internal testing. **Nghiệm thu:** cài APK trên Android 10–16 thật; thiền offline; đăng nhập bằng email lấy lại hành trình từ web; AAB được Play Console chấp nhận (API 36).

### GĐ7 — Gia cố & ra mắt (≈ 2 tuần)
Tải 2.000 kết nối, đánh giá ASVS L1, điều khoản + chính sách dữ liệu (rà pháp lý), bảng theo dõi & cảnh báo, sao lưu xuất D1 hằng tuần sang R2 (ngoài Time Travel), runbook sự cố, khả năng tiếp cận (giảm chuyển động, tương phản, nhãn đọc màn hình), ngân sách hiệu năng. **Ra mắt beta kín → công khai.**

### GĐ8 — Sau ra mắt
iOS (Capacitor), sự kiện hồi hướng chung theo ngày rằm, âm thanh tham khảo trên R2, tra cứu kinh có trích dẫn, phân vùng dữ liệu khi vượt ngưỡng §4.4.

**Song song hóa tóm tắt:** GĐ0 tuần tự → (GĐ1 ∥ chuẩn bị GĐ2) → (GĐ2 ∥ GĐ3) → (GĐ4 ∥ GĐ6) → GĐ5 → GĐ7.

---

## 15. VẬN HÀNH & QUAN SÁT

| Chỉ số (SLO) | Mục tiêu |
|---|---|
| API sẵn sàng | ≥ 99,9 %/tháng |
| Đồng bộ thành công | ≥ 99,5 % lượt sync |
| Vào phòng thời gian thực | ≥ 99 % trong < 2 giây |
| Lỗi JS phía client | < 0,5 % phiên |

- Bật `observability` cho cả hai Worker; Analytics Engine ghi: thời thiền hoàn tất, lỗi sync theo mã, FPS theo nhóm máy, số người mỗi shard.
- Cảnh báo: tỉ lệ lỗi 5xx, D1 > 6 GB, chi phí DO tăng bất thường, OTP gửi tăng đột biến (dấu hiệu lạm dụng).
- Runbook: rollback Worker, khôi phục D1 bằng Time Travel, tắt tính năng bằng cờ KV, khóa đăng ký khi bị spam.

---

## 16. RỦI RO & QUYẾT ĐỊNH CẦN ANH CHỐT

| # | Quyết định | Đề xuất |
|---|---|---|
| 1 | Nâng GitHub Pro để có branch protection cho repo private? | Nên nâng; nếu không, chỉ deploy production theo tag |
| 2 | Người hướng dẫn chuyên môn duyệt nội dung và điều kiện mở tầng | Cần có trước GĐ3 |
| 3 | Đăng nhập Google ngoài Email OTP? | Để sau GĐ2, chỉ thêm nếu người dùng yêu cầu |
| 4 | Đồng bộ nhật ký quán chiếu | Mặc định tắt, người dùng tự bật |
| 5 | Pháp đàm bằng chữ | Chỉ trong nhóm (GĐ5), có kiểm duyệt |
| 6 | Tên miền staging | `staging.vandao.ainextbrain.com` |
| 7 | `appId` Android | `com.ainextbrain.vandao` (không đổi được sau khi lên Play) |
| 8 | Tài khoản Google Play Developer | Cần trước GĐ6 |
| 9 | Hạ tầng Proxmox đã bàn trước đây | Không cần cho kiến trúc này; chỉ giữ nếu muốn dự phòng tự vận hành |

Rủi ro chính: Email Sending còn beta [12] (dự phòng: nhà cung cấp gửi mail khác qua Queue); D1 một luồng ghi [1] (giữ truy vấn ngắn, gộp ghi, tổng hợp bằng cron); WebView Android yếu với cảnh 3D (chế độ chất lượng thấp, đo trên máy thật); nội dung giáo lý sai lệch (quy trình duyệt §11).

---

## PHỤ LỤC A — Ánh xạ `localStorage['vandao.v1']` → máy chủ

| Trường cũ | Đích |
|---|---|
| `name`, `look` | `profile.tinh_danh`, `profile.look_json` |
| `music`, `birds`, `tts`, `radar`, `kface` | `profile.settings_json` |
| `pos`, `open` | `profile.island_json` |
| `day`, `lastDate`, `completed` | `journey.day`, `journey.last_done_on`, `journey.completed_at` (máy chủ kiểm lại bằng bất biến ngày) |
| `done[day][pillar] = {E, pre, during, post, wise, self, note, at}` | `kusala_entry` (E tính lại; `note` chỉ gửi nếu bật đồng bộ nhật ký) |
| `totals` | Không lưu — `SUM(e_score)` |
| `sacca`, `sessions`, `sermons` | `journey.sacca_count`, `sessions_done`, `sermons_done` |

Lần sync đầu của dữ liệu cũ dùng thao tác đặc biệt `legacy.import`: máy chủ chấp nhận ngày hiện tại của người dùng nhưng đặt `started_on = hôm nay − (day − 1)` để bất biến khóa ngày vẫn đúng.

## PHỤ LỤC B — Mẫu cấu hình Wrangler

`workers/api/wrangler.jsonc`
```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "vandao",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "../../apps/web/dist/web",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "/ws/*", "/.well-known/*"]
  },
  "routes": [{ "pattern": "vandao.ainextbrain.com", "custom_domain": true }],
  "d1_databases": [{ "binding": "DB", "database_name": "vandao-core", "database_id": "<id>",
                     "migrations_dir": "../../db/migrations" }],
  "kv_namespaces": [{ "binding": "CONFIG", "id": "<id>" }],
  "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "vandao-media" }],
  "queues": { "producers": [{ "binding": "JOBS", "queue": "vd-jobs" }],
              "consumers": [{ "queue": "vd-jobs", "max_batch_size": 50 }] },
  "send_email": [{ "name": "EMAIL" }],
  "ratelimits": [{ "name": "RL_OTP", "namespace_id": "1001", "simple": { "limit": 3, "period": 60 } },
                 { "name": "RL_SYNC", "namespace_id": "1002", "simple": { "limit": 30, "period": 60 } }],
  "analytics_engine_datasets": [{ "binding": "METRICS", "dataset": "vd_metrics" }],
  "durable_objects": { "bindings": [
    { "name": "LOBBY",  "class_name": "Lobby",      "script_name": "vandao-realtime" },
    { "name": "HALL",   "class_name": "HallRoom",   "script_name": "vandao-realtime" },
    { "name": "ISLAND", "class_name": "IslandRoom", "script_name": "vandao-realtime" } ] },
  "triggers": { "crons": ["17 19 * * *"] },
  "observability": { "enabled": true },
  "env": { "staging": { "name": "vandao-staging",
    "routes": [{ "pattern": "staging.vandao.ainextbrain.com", "custom_domain": true }] } }
}
```
Lưu ý: `period` của rate limit chỉ nhận 10 hoặc 60 giây; giới hạn "3 mã/10 phút/email" phải đếm thêm trong D1/KV.

`workers/realtime/wrangler.jsonc`
```jsonc
{
  "name": "vandao-realtime",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",
  "workers_dev": false,
  "durable_objects": { "bindings": [
    { "name": "LOBBY", "class_name": "Lobby" },
    { "name": "HALL", "class_name": "HallRoom" },
    { "name": "ISLAND", "class_name": "IslandRoom" } ] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Lobby", "HallRoom", "IslandRoom"] }],
  "observability": { "enabled": true }
}
```

## PHỤ LỤC C — Khung `ci.yml` / `deploy.yml`

```yaml
# .github/workflows/ci.yml
name: ci
on: { pull_request: {}, push: { branches: [main] } }
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run lint && npm test            # Vitest: shared + workers (vitest-pool-workers)
      - run: npm run build                        # cả 3 đích; kiểm ngân sách kích thước
      - run: npm run check:migrations             # số thứ tự liên tục, không sửa tệp cũ
      - run: npx playwright install --with-deps chromium && npm run e2e:smoke
```
```yaml
# .github/workflows/deploy.yml (rút gọn)
on:
  push: { branches: [main], tags: ['v*'] }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ startsWith(github.ref, 'refs/tags/') && 'production' || 'staging' }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: npm }
      - run: npm ci && npm run build
      - name: Migrate D1
        run: npx wrangler d1 migrations apply vandao-core --remote ${{ startsWith(github.ref, 'refs/tags/') && '' || '--env staging' }}
        working-directory: workers/api
        env: { CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}, CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }} }
      - name: Deploy realtime + api
        run: |
          (cd workers/realtime && npx wrangler deploy)
          (cd workers/api && npx wrangler deploy ${{ startsWith(github.ref, 'refs/tags/') && '' || '--env staging' }})
        env: { CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}, CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }} }
      - run: npm run e2e:smoke -- --base-url=${{ startsWith(github.ref, 'refs/tags/') && 'https://vandao.ainextbrain.com' || 'https://staging.vandao.ainextbrain.com' }}
```
(Staging cần D1 riêng `vandao-core-staging` khai báo trong `env.staging`; realtime staging tương tự. Preview PR theo mẫu chính thức của Cloudflare [9b].)

## PHỤ LỤC D — Khung `android.yml`

```yaml
name: android
on: { push: { tags: ['android-v*'] }, workflow_dispatch: {} }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: npm }
      - uses: actions/setup-java@v5          # dùng major mới nhất chạy Node 24
        with: { distribution: temurin, java-version: '21' }
      - run: npm ci && npm run build -w apps/web -- --target=android
      - run: npx cap sync android
        working-directory: apps/android
      - name: Upload key
        run: echo "$KS" | base64 -d > apps/android/android/app/upload.jks
        env: { KS: ${{ secrets.ANDROID_KEYSTORE_B64 }} }
      - run: ./gradlew assembleRelease bundleRelease -PversionCode=${{ github.run_number }}
        working-directory: apps/android/android
        env:
          VANDAO_KS_PASS: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          VANDAO_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          VANDAO_KEY_PASS: ${{ secrets.ANDROID_KEY_PASSWORD }}
      - uses: actions/upload-artifact@v5
        with:
          name: vandao-android
          path: |
            apps/android/android/app/build/outputs/apk/release/*.apk
            apps/android/android/app/build/outputs/bundle/release/*.aab
```

## PHỤ LỤC E — Bảng tra nhanh hằng số luật tu tập (phải giống nhau ở client và máy chủ)
- Kusala: `E = base × (pre + during + post)/3 × (wise ? 1,5 : 1) × (self ? 1,25 : 1)`, `base = 10`, `pre/during/post ∈ [0,5; 1,2]`, làm tròn 2 chữ số.
- Tiến ngày: `last_done_on < hôm nay` **và** đủ `duc`, `thien`, `tue` của ngày hiện tại; ngày 49 đủ 3 trục → hoàn tất chương trình.
- Phân khu mở theo `ZONES[].unlock` (Trà Đạo ngày 15; Cổng Vân Môn nửa mở ngày 29, mở hẳn ngày 43).
- Thời thiền 15 phút: 00:00 · 02:00 · 05:00 · 07:00 · 09:30 · 11:00 · 13:30.
- Tịnh danh: 2–3 chữ, ≤ 16 ký tự, chữ cái tiếng Việt NFC, có ít nhất một chữ mang nghĩa tu tập, không tự xưng quả vị/giáo phẩm.

## PHỤ LỤC F — Nguồn tham khảo (truy cập 11/2026)

1. Cloudflare D1 — Limits: https://developers.cloudflare.com/d1/platform/limits/
2. D1 — Global read replication & Sessions API: https://developers.cloudflare.com/d1/best-practices/read-replication/
3. D1 — Migrations: https://developers.cloudflare.com/d1/reference/migrations/
4. Durable Objects — Limits: https://developers.cloudflare.com/durable-objects/platform/limits/
5. Durable Objects — Use WebSockets (Hibernation): https://developers.cloudflare.com/durable-objects/best-practices/websockets/ · 5b. Hibernatable WebSockets API (32.768 kết nối/đối tượng): https://cloudflare-docs-ai.pages.dev/durable-objects/api/hibernatable-websockets-api
6. Durable Objects — Pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
7. Durable Objects — Changelog (SQLite GA, tỉ lệ 20:1 cho tin WebSocket): https://developers.cloudflare.com/durable-objects/changelog/
8. Workers — Limits (Static Assets): https://developers.cloudflare.com/workers/platform/limits/
9. Workers — Previews: https://developers.cloudflare.com/workers/previews/ · 9b. Ví dụ CI: https://developers.cloudflare.com/workers/previews/examples/
10. Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/ · 10b. Build branches (ghi chú Preview URL và Durable Object): https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
11. Rate Limiting binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ · GA: https://developers.cloudflare.com/changelog/post/2025-09-19-ratelimit-workers-ga/
12. Cloudflare Email Service: https://developers.cloudflare.com/email-service/ · Blog public beta (16/4/2026): https://blog.cloudflare.com/email-for-agents
13. Turnstile — Get started: https://developers.cloudflare.com/turnstile/get-started/
14. Wrangler v4 (chính sách hỗ trợ v3): https://developers.cloudflare.com/changelog/post/2025-03-13-wrangler-v4/
15. Better Auth — Anonymous plugin: https://better-auth.com/docs/plugins/anonymous · 15b. Email OTP: https://better-auth.com/docs/plugins/email-otp · 15c. Better Auth trên Workers + D1 (cần Drizzle/Kysely, khởi tạo theo request): https://tessl.io/registry/skills/github/secondsky/claude-skills/better-auth
16. Node.js release schedule: https://endoflife.date/nodejs
17. GitHub — Node 20 is no longer available in GitHub Actions (23/9/2026): https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions
18. Google Play — Target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878
19. Capacitor — Updating to 8.0: https://capacitorjs.com/docs/updating/8-0 · 19b. Yêu cầu công cụ Capacitor 8 (JDK 21, AGP 8.13, Gradle 8.14.3, minSdk 24, trang 16 KB): https://capgo.app/blog/troubleshooting-capacitor-android-build-errors/
20. Trusted Web Activity: https://developer.chrome.com/docs/android/trusted-web-activity · 20b. Xuất bản PWA lên Google Play 2026 (Bubblewrap 1.27): https://www.mobiloud.com/blog/publishing-pwa-app-store
21. Antigravity — Rules: https://antigravity.google/docs/rules · 21b. Giới hạn 12.000 ký tự/tệp luật: https://agentpedia.codes/blog/antigravity-agents-md-not-working-fix
22. GitHub — About protected branches: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
23. Luật BVDLCN 91/2025/QH15: https://thitruongtaichinhtiente.vn/luat-bao-ve-du-lieu-ca-nhan-tao-lap-moi-truong-so-an-toan-bao-ve-quyen-loi-hop-phap-cua-nguoi-dan-75245.html · 23b. Nghị định 356/2025/NĐ-CP: https://thuvienphapluat.vn/documents/law.aspx?id=Q%3DpnM05ESTTm · 23c. Quyền của chủ thể dữ liệu: https://thitruongtaichinhtiente.vn/nhung-diem-chinh-can-luu-y-tai-luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-tu-ngay-1-1-2026-75881.html
24. three.js — nhịp phát hành 2026 và r186: https://www.mind-verse.de/news/three-js-boom-ki-coding-webgpu-analyse-ed0965d1ad11 · Releases: https://github.com/mrdoob/three.js/releases
