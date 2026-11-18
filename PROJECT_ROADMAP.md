# VÂN ĐẠO — LỘ TRÌNH KỸ THUẬT & THIẾT KẾ PRODUCTION (bản 3)

> **Tiến độ xác minh 18/11/2026:** production v0.17.1 ở `4e84324`. Main `05e1ea3` có #111–#115 và đã qua kiểm khói staging. GĐ3 **chưa hoàn tất**, GĐ4 mới có nền vé HMAC. Trạng thái từng T3/T4 xem §19. Phân công, quyền tệp và bàn giao credits xem `docs/COORDINATION.md` §19–22. Các số đo và nhận định ngày 13/11 dưới đây là lịch sử thiết kế.

> **Quyết định nội dung hiện hành 14/11/2026 của chủ dự án (#55):** không bắt buộc Hội đồng cố vấn Pháp học phê duyệt. Nội dung tham khảo có nguồn được biên tập và chọn phát hành theo PR thông thường; tư vấn chuyên gia tùy chọn. Quyết định này thay yêu cầu cũ trong bản 3 và hợp đồng đang đề xuất; xem ADR 0003, `AGENTS.md` mục 1.6 và §16.

> **Ngày lập:** 13/11/2026 · **Thay thế:** bản 2 (12/11/2026). Bản 3 bổ sung: Tầng 0 chuẩn Pháp hành – Ba-la-mật theo hoàn cảnh từng người; theo dõi – nhắc nhở – tích lũy; không gian cộng đồng Hộ Trì & thiện nguyện; khu **Đại Công Đức** (affiliate Shopee/TikTok Shop/WooCommerce, Gieo Duyên, chiến dịch thiện nguyện, Sổ Minh Bạch); đánh giá có số đo và lộ trình hiện đại hóa 3D; chạy trên gói Workers Free rồi nâng Paid khi cần; Node.js 26 LTS; làn việc thứ ba cho **Hermes**; tách dev/staging/production không cần GitHub Pro.
> **Thứ tự ưu tiên khi mâu thuẫn:** nguyên tắc bất di bất dịch trong `AGENTS.md` (mục 1) > tài liệu này > `van-dao-tom-tat-thiet-ke.md`. Lộ trình, lược đồ DB, API và quy trình làm việc trong tài liệu này thay thế mục 4 của `CLAUDE.md`.
> **Ký hiệu:** `[n]` là nguồn ở Phụ lục I. Số chi phí/năng lực là **ước lượng** phải đo lại bằng tải thật. "Tài liệu gốc" = `chuong trinh thien-1.pdf`.
> **Mục lục:** 0 Tóm tắt · 1 Kiểm định · 2 Nguyên tắc · 3 Kiến trúc Cloudflare · 4 Dữ liệu · 5 API · 6 Tài khoản · 7 Thời gian thực · 8 Tầng 0 Pháp hành · 9 Theo dõi & nhắc nhở · 10 Cộng đồng Hộ Trì · 11 Đại Công Đức · 12 3D & trải nghiệm · 13 Android · 14 Cộng tác 3 agent · 15 Bảo mật & pháp lý · 16 Nội dung · 17 Phiên bản · 18 Cấu trúc repo · 19 Kế hoạch giai đoạn · 20 Vận hành · 21 Quyết định & rủi ro · Phụ lục A–I.

---

## 0. TÓM TẮT ĐIỀU HÀNH

**Kết luận kiểm định lịch sử:** mã tại thời điểm bản 3 vẫn là bản trải nghiệm một người dùng, **chưa production**. Sau bản 3, **thiết kế** đã có đủ các khối cần cho production (tài khoản, đồng bộ, nhiều người, cộng đồng, Đại Công Đức, Android, vận hành, pháp lý) để bắt tay GĐ0. Chỉ được gọi là production đầy đủ khi qua nghiệm thu GĐ9 (tải, bảo mật, pháp lý, hiệu năng trên máy thật). Việc ngoài mã trước khi mở cộng đồng/Đại Công Đức gồm hồ sơ pháp nhân/TMĐT/affiliate và người trực kiểm duyệt cộng đồng. **Cập nhật chủ dự án 14/11/2026:** Hội đồng Pháp học là tư vấn tùy chọn, không là điều kiện mở nội dung hay phát hành; xem ADR 0003 và `AGENTS.md` mục 1.6.

**3D:** chạy ổn định trên máy tính (không lỗi console, có chất lượng thích ứng) nhưng **nặng với điện thoại**: đo ngày 13/11/2026 ở mức chất lượng cao ra 685 lệnh vẽ và ~1,40 triệu tam giác mỗi khung ở Vân Đảo (§1.5). Hướng xử lý: tối ưu WebGL trước (GĐ1), chuyển WebGPURenderer + TSL có dự phòng WebGL2 sau (GĐ7).

**Bổ sung chính của bản 3:**
1. **Tầng 0** dựa trên 10 Phước nghiệp sự như tài liệu gốc, gắn 10 Ba-la-mật; nhiệm vụ có biến thể theo thời gian, hoàn cảnh, khả năng từng người; việc thiện luôn có lựa chọn **không tốn tiền** (§8).
2. **Theo dõi riêng tư** (không bảng xếp hạng), **nhắc nhở nhẹ** (thông báo cục bộ, Web Push, ngày Bát quan trai theo âm lịch), chứng thực chéo cuối tuần (§9).
3. **Bảng Hộ Trì:** cần giúp/có thể giúp, hỏi Pháp, sự kiện thiện nguyện; **cấm kêu gọi tiền cá nhân**; kiểm duyệt AI + người (§10).
4. **Đại Công Đức:** tách hẳn khỏi không gian tu tập; gian hàng Chánh Mạng (affiliate có kiểm duyệt theo AN 5.177), Gieo Duyên vận hành qua VietQR, chiến dịch của đối tác hợp pháp, Sổ Minh Bạch và sổ cái tác động băm chuỗi (§11).
5. **Gói Free trước:** bảng ngưỡng nâng Paid (§3.3). Khi còn Free không có Email Sending → đăng nhập bằng passkey, Google, mã QR liên kết thiết bị, mã khôi phục (§6.4).
6. **Node.js 26 LTS** cho mọi công cụ (§17); **Hermes** nhận làn vận hành – danh mục – giám sát; CI **lane-guard** + deploy theo **tag** giữ dev và production tách bạch mà không cần GitHub Pro (§14).

**Về hình mẫu Cấp Cô Độc:** ngài là **cư sĩ tại gia**, không phải vị tăng; Đức Phật tuyên bố ngài đứng đầu các nam cư sĩ về bố thí [46] và ngài chứng Tu-đà-hoàn [46b]. Đại Công Đức theo đúng vai trò đó như tài liệu gốc: người tại gia kinh doanh chân chính để hộ trì; Tăng Ni chỉ cố vấn Pháp học, không tham gia thương mại.

**Bắt đầu GĐ0:** danh sách "Sẵn sàng GĐ0" ở §19.1.

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
| Vân Nhạc, thuyết giảng 7 bài, chim cảnh, diện mạo nhân vật | Đạt ở mốc kiểm định | Nội dung tham khảo có nguồn; biên tập/phát hành theo ADR 0003, không bắt buộc Hội đồng |
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

**Thiếu lớn nhất là nội dung**, không phải mã: chương trình tu học của Tầng 1–4 chưa tồn tại (chỉ Giai đoạn 0 có 7 tuần nhiệm vụ). Cần biên soạn có nguồn và chọn phát hành; có thể tham vấn chuyên gia nhưng không bắt buộc (§16, ADR 0003).

**Nguyên tắc đạo đức sản phẩm bổ sung:**
- Không bảng xếp hạng Kusala, không so sánh điểm giữa người với người; điểm là để tự soi, chỉ chủ nhân thấy. Cộng đồng chỉ thấy số liệu tổng hợp ẩn danh ("hôm nay có N thời thiền được hồi hướng").
- Không thông báo thúc ép kiểu mạng xã hội; nhắc nhở mặc định tắt, người dùng tự bật và chọn giờ.
- Nhật ký quán chiếu (`note`) mặc định **chỉ lưu trên máy**; đồng bộ lên máy chủ phải là lựa chọn chủ động (xem §15).

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
| Hiệu năng di động | Cảnh nhiều tam giác và lệnh vẽ; chưa đo FPS trên máy thật | Trung bình | GĐ1, GĐ7 (§12) |
| Kiểm thử | Chỉ có `shot.mjs` (Chrome headless) | Cao | GĐ0 |
| Quan sát | Không log, không số liệu, không cảnh báo | Cao | GĐ2, GĐ9 |
| Pháp lý | Chưa có điều khoản, đồng ý, xuất/xóa dữ liệu theo Luật BVDLCN 2025 | Chặn trước khi mở đăng ký | GĐ2, GĐ9 |
| Khả năng tiếp cận | Có đọc giọng nói; thiếu giảm chuyển động, kiểm tra tương phản | Trung bình | GĐ9 |

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

### 1.5 Đo hiệu năng 3D (13/11/2026)

Đo bằng Chrome headless (SwiftShader), 1440×757, DPR 1, mức chất lượng 2, đọc `renderer.info` trung bình 2 khung:

| Chế độ | Lệnh vẽ/khung | Tam giác/khung |
|---|---|---|
| Vân Đảo | 685 | ~1,40 triệu |
| Đại Thiền Đường | 356 | ~1,22 triệu |
| Toàn cảnh | 705 | ~1,41 triệu |

Kèm theo: 448–468 geometry, 32 texture, 52 chương trình shader; bản HTML đơn ~0,97 MB (gồm font và three.js). Headless không đo được FPS trên GPU thật; GĐ1 thêm đo trên máy thật.

**Đánh giá:** các khuyến nghị hiệu năng Three.js 2026 đặt mục tiêu dưới ~100 lệnh vẽ mỗi khung và cho biết instancing/batching có thể giảm hơn 90 % lệnh vẽ [32]. Số hiện tại vượt nhiều lần ngưỡng cho điện thoại tầm trung → **chạy được nhưng chưa đạt chuẩn production trên mobile**. Cảnh có ~15 vật liệu shader tự viết (8 `ShaderMaterial`, 7 `onBeforeCompile`) và `EffectComposer`/`UnrealBloomPass` — đây là phần phải viết lại khi lên WebGPU (§12).

### 1.6 Bảng kiểm production sau bản 3

| Khối | Thiết kế bản 3 | Còn thiếu trước khi gọi là production |
|---|---|---|
| Tài khoản, đồng bộ, khóa ngày | Đủ (§4–§6) | Mã + kiểm thử GĐ2 |
| Tầng 0 Pháp hành, theo dõi, nhắc nhở | Đủ khung (§8–§9) | Nội dung biến thể đã biên tập/chọn phát hành; thử với nhóm người dùng thật |
| Nhiều người cùng lúc | Đủ (§7) | Kiểm thử tải §7.6 |
| Cộng đồng Hộ Trì | Đủ (§10) | Người trực kiểm duyệt; quy chế cộng đồng |
| Đại Công Đức | Đủ (§11) | Pháp nhân DNXH, tài khoản affiliate, tài khoản ngân hàng + cổng xác nhận chuyển khoản, ý kiến luật sư/kế toán |
| 3D trên mobile | Có ngân sách & lộ trình (§12) | Đạt ngân sách trên máy thật |
| Android | Đủ (§13) | Tài khoản Play, khóa ký, thử máy thật |
| Bảo mật & dữ liệu cá nhân | Đủ (§15) | Đánh giá ASVS L1, đánh giá tác động xử lý dữ liệu, điều khoản |
| Vận hành | Đủ (§20) | Bảng theo dõi, cảnh báo, diễn tập khôi phục |
| Quy trình 3 agent | Đủ (§14) | Chạy thử lane-guard và deploy theo tag ở GĐ0 |

---

## 2. NGUYÊN TẮC THIẾT KẾ (giữ nguyên CLAUDE.md, bổ sung cho production)

1. **Offline-first:** thiền, xác nhận nhiệm vụ, nghe nhạc, thuyết giảng chạy được không cần mạng; có mạng thì tự đồng bộ.
2. **Máy chủ là trọng tài cho tiến trình:** client hiển thị ngay, máy chủ tính lại Kusala và quyết định ngày. Hai bên dùng **chung một mã** (`packages/shared`).
3. **Riêng tư mặc định:** thu thập tối thiểu; email là tùy chọn (chỉ khi muốn giữ hành trình); nhật ký chỉ lưu trên máy nếu không bật đồng bộ.
4. **Client không framework nặng:** giữ Three.js + JS module; máy chủ tách thư mục, không trộn logic máy chủ vào vòng lặp render.
5. **Không có file âm thanh lớn trong mã nguồn:** âm thanh sinh bằng thuật toán; bản ghi tham khảo (nếu có) để trên R2, tải theo yêu cầu.
6. **Một nguồn sự thật cho luật tu tập:** công thức Kusala, luật Tịnh danh, lịch 49 ngày, điều kiện mở tầng nằm trong `packages/shared` và dữ liệu nội dung, không viết lặp ở nhiều nơi.
7. **Thương mại tách bạch tuyệt đối với Pháp bảo** (tài liệu gốc): không quảng cáo, không gắn sản phẩm vào Kinh Đài, Tịnh Thất, Đài Thiền, Đại Thiền Đường hay thời thiền; mọi giao dịch chỉ ở khu Đại Công Đức; không bán dữ liệu người dùng.
8. **Công đức không tính theo tiền** (tài liệu gốc): điểm gốc mỗi việc như nhau dù giàu hay nghèo; mua hàng qua affiliate hay Gieo Duyên **không** cộng Kusala, không huy hiệu, không xếp hạng.
9. **Không thuật toán gây nghiện** (tài liệu gốc): không "chuỗi ngày đứt là mất", không thông báo thúc ép, không bảng tin cuộn vô tận.
10. **Hoạt động được trên gói Free:** tính năng cần gói Paid đặt sau cờ (feature flag) và có đường dự phòng.

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
| KV | Cờ tính năng, cache nội dung đã chọn phát hành | Đọc nhiều, ghi ít |
| R2 | Âm thanh tham khảo, gói xuất dữ liệu, lưu trữ nhật ký cũ | Không phí egress |
| Queues | Gửi mail, tổng hợp, xóa tài khoản theo hẹn | Tách việc chậm khỏi request |
| Cron Triggers | Tổng hợp hằng ngày, dọn dẹp | Chạy trên Worker `vandao` |
| Email Service (`send_email`) | Gửi mã OTP | Public beta từ 16/4/2026, cần gói Workers Paid [12] |
| Turnstile | Chống bot ở bước gửi OTP | Bắt buộc kiểm token ở máy chủ qua Siteverify [13] |
| Rate Limiting binding | Giới hạn OTP, sync, mời | Đã GA cho production; khai báo `ratelimits` cần Wrangler ≥ 4.36 [11] |
| Analytics Engine | Số liệu kỹ thuật ẩn danh (FPS, lỗi sync, thời thiền hoàn tất) | Không chứa dữ liệu định danh |
| Workers Builds / Previews | Preview mỗi PR | Mỗi PR có URL preview cố định theo nhánh [9][10] |

**Gói:** bắt đầu bằng **Workers Free**; nâng **Workers Paid** (tối thiểu 5 USD/tháng) khi chạm ngưỡng ở §3.3, khi cần Email Sending (chỉ có ở gói Paid [12]) hoặc cần D1 10 GB/CSDL và Time Travel 30 ngày [1].

### 3.2 Vì sao tách hai Worker
- Worker `vandao-realtime` có vòng đời triển khai riêng (thay đổi lớp DO cần `migrations` có thẻ), không làm chậm việc phát hành web/API.
- Tài liệu Workers Builds từng ghi Preview URL không được tạo cho Worker **hiện thực** Durable Object [10b]; để Worker web/API luôn có preview cho mỗi PR, các lớp DO đặt ở Worker riêng và được gọi qua binding liên script (`script_name`). Cần kiểm lại hành vi này với Worker Previews mới khi làm GĐ0.
- Client chỉ thấy **một nguồn gốc** (`vandao.ainextbrain.com`) → cookie phiên dùng chung, không cần CORS cho web.

### 3.3 Gói Free trước, nâng Paid khi cần

| Dịch vụ | Workers Free | Workers Paid | Cách Vân Đạo dùng khi còn Free |
|---|---|---|---|
| Workers | 100.000 yêu cầu/ngày, 10 ms CPU mỗi lần gọi [27] | 10 triệu yêu cầu + 30 triệu ms CPU/tháng, sau đó 0,30 USD/triệu yêu cầu, 0,02 USD/triệu ms CPU [29] | API gọn; không dùng mật khẩu nên không có bước băm chậm; gộp thao tác vào `/sync` |
| D1 | 5 triệu dòng đọc/ngày, 100.000 dòng ghi/ngày, 5 GB [27b] | Đã gồm 25 tỉ dòng đọc và 50 triệu dòng ghi/tháng [27c] | Ghi theo lô; số liệu cộng đồng tổng hợp định kỳ, không ghi theo lượt xem |
| Durable Objects | 100.000 yêu cầu/ngày, 13.000 GB-giây/ngày; chỉ lớp SQLite [27][28] | Đã gồm 1 triệu yêu cầu + 400.000 GB-giây/tháng [6] | Phòng ngủ đông khi im lặng; client chỉ gửi khi đổi trạng thái |
| Workers AI | 10.000 neuron/ngày (cả hai gói) [31] | 0,011 USD/1.000 neuron vượt mức [31] | Sàng lọc bài Hộ Trì bằng Llama Guard 3 8B (~44.003 neuron/1 triệu token vào [31]) → ~227.000 token vào/ngày trong phần miễn phí |
| Workflows | Có ở cả hai gói; trạng thái giữ 3 ngày [30] | Giữ 30 ngày [30] | Quy trình giải ngân tác động xã hội có bước chờ duyệt |
| Email Sending | Không có | Có (beta) [12] | Đăng nhập không cần email (§6.4) |

**Sức chứa ước lượng trên gói Free** (giả định ~13 lệnh API và ~10 dòng ghi D1 cho mỗi người hoạt động/ngày; tài sản tĩnh không chạy mã Worker): khoảng **5.000–7.000 người tu tập mỗi ngày**. Phần thời gian thực: 13.000 GB-giây/ngày ÷ 0,128 GB ≈ 101.000 giây ≈ **28 giờ-phòng hoạt động/ngày** (ví dụ 3 shard Đại Thiền Đường mở 9 giờ/ngày).

**Ngưỡng nâng Paid** (bất kỳ điều nào kéo dài 7 ngày ở ≥ 70 % hạn mức): yêu cầu Workers, dòng ghi D1, yêu cầu hoặc thời lượng DO; cần Email OTP hay thư tổng kết tuần; cần CPU > 10 ms (ví dụ tạo ảnh chia sẻ); D1 > 4 GB. Hermes báo cáo hằng ngày (§14.6). Khi nâng: bật cờ `EMAIL_OTP`, `EMAIL_DIGEST`, tăng nhịp phát khung realtime nếu cần.

### 3.4 Dịch vụ bổ sung trong bản 3

| Thành phần | Dùng cho |
|---|---|
| Durable Object `ReminderClock` (alarm) | Lịch nhắc theo giờ địa phương, chia 16 shard theo `user_id` |
| Web Push (VAPID) bằng thư viện chạy được trên Workers, ví dụ PushForge [51] | Nhắc nhở cho PWA |
| Workers AI (Llama Guard) | Sàng lọc bài viết cộng đồng trước khi hiện |
| Workflows | Giải ngân tác động xã hội: tạo bút toán → chờ duyệt → đính chứng từ → báo Tùy hỷ |
| R2 | Chứng từ giải ngân, báo cáo Sổ Minh Bạch, âm thanh tham khảo |
| Analytics Engine | Lượt bấm affiliate ẩn danh, FPS theo nhóm máy, lỗi sync |
| Cloudflare Access | Bảo vệ `/admin/*` (duyệt sản phẩm, bài viết, sổ cái) |
| Cloudflare Web Analytics | Core Web Vitals người dùng thật, không cookie |

---

## 4. LƯỢC ĐỒ DỮ LIỆU (D1 `vandao-core`)

### 4.1 Quy ước
- Thời điểm: `INTEGER` mili-giây Unix (UTC). Ngày tu tập: `TEXT 'YYYY-MM-DD'` theo **múi giờ của người dùng** (`profile.tz`).
- Khóa chính tự sinh: ULID (sắp xếp theo thời gian, client sinh được khi offline → dùng làm khóa chống trùng).
- Migration **chỉ tiến**, đánh số `NNNN_ten.sql` trong `db/migrations/`; `wrangler d1 migrations apply` chạy theo thứ tự và ghi lịch sử vào bảng `d1_migrations` [3]. Không bao giờ sửa migration đã merge; không đặt script lùi trong thư mục này.
- Chỉ **lane Dữ liệu** (xem §14) được tạo migration mới.

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
  variant_id  TEXT,                            -- biến thể nhiệm vụ đã làm (§8.3); NULL với dữ liệu chuyển từ bản cũ
  punna       TEXT,                            -- mã Phước nghiệp sự (Phụ lục H)
  parami_json TEXT NOT NULL DEFAULT '[]',      -- mã Ba-la-mật (Phụ lục H)
  scope       TEXT CHECK (scope IS NULL OR scope IN ('doi_thuc','dong_tu')),  -- việc ngoài đời / trong app (§9.3)
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

### 4.6 Bảng bổ sung của bản 3

```sql
-- 0006_practice_plus.sql
CREATE TABLE practice_profile (                 -- chỉ thông tin cần cho chọn biến thể; hoàn cảnh riêng tư ở lại trên máy (§8.3)
  user_id       TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  level         TEXT NOT NULL DEFAULT 'vua' CHECK (level IN ('nhe','vua','sau')),
  minutes       INTEGER NOT NULL DEFAULT 15 CHECK (minutes BETWEEN 5 AND 120),
  time_window   TEXT NOT NULL DEFAULT 'linh_hoat' CHECK (time_window IN ('sang','trua','toi','linh_hoat')),
  familiarity   TEXT CHECK (familiarity IN ('moi','da_quy_y','tu_lau')),
  precepts_json TEXT NOT NULL DEFAULT '[1,2,3,4,5]',   -- giới phát nguyện giữ trong chu kỳ
  uposatha      TEXT NOT NULL DEFAULT 'vn_4' CHECK (uposatha IN ('vn_2','vn_4','vn_6','vn_10','khong')),
  no_money      INTEGER NOT NULL DEFAULT 0 CHECK (no_money IN (0,1)),   -- chỉ gợi ý việc thiện không tốn tiền
  at_home       INTEGER NOT NULL DEFAULT 0 CHECK (at_home IN (0,1)),    -- ưu tiên việc làm được tại nhà/trực tuyến
  updated_at    INTEGER NOT NULL
);

CREATE TABLE deed_log (                          -- việc thiện ghi thêm ngoài 3 nhiệm vụ: KHÔNG cộng Kusala, không ghi số tiền
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  local_date  TEXT NOT NULL,
  punna       TEXT NOT NULL,                       -- mã Phước nghiệp sự (Phụ lục H)
  parami_json TEXT NOT NULL DEFAULT '[]',
  scope       TEXT NOT NULL CHECK (scope IN ('doi_thuc','dong_tu')),
  shared      INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0,1)),   -- cho phép hiện ẩn danh ở Tùy hỷ
  at          INTEGER NOT NULL
);
CREATE INDEX deed_user_date ON deed_log(user_id, local_date);   -- máy chủ giới hạn 5 dòng/ngày/người

CREATE TABLE reminder (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL CHECK (kind IN ('thien','nhiem_vu','ghi_nhan','uposatha','tong_ket_tuan','nhom')),
  local_hm  TEXT NOT NULL CHECK (local_hm GLOB '[0-2][0-9]:[0-5][0-9]'),
  days_mask INTEGER NOT NULL DEFAULT 127,          -- bit 0 = Chủ nhật
  channel   TEXT NOT NULL CHECK (channel IN ('push','email','local')),
  next_at   INTEGER,                               -- UTC ms, ReminderClock tính lại sau mỗi lần gửi
  active    INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  paused_until INTEGER,                            -- "Tịnh khẩu" tạm dừng 1–30 ngày
  created_at INTEGER NOT NULL
);
CREATE INDEX reminder_due ON reminder(next_at) WHERE active = 1;

CREATE TABLE push_subscription (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  fail_count  INTEGER NOT NULL DEFAULT 0,          -- 404/410 từ dịch vụ push → xóa
  created_at  INTEGER NOT NULL,
  last_ok_at  INTEGER
);

CREATE TABLE attestation (                       -- chứng thực chéo cuối tuần (ngày 7, 14, … 49), luôn tùy chọn
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  cycle        INTEGER NOT NULL,
  week         INTEGER NOT NULL CHECK (week BETWEEN 1 AND 7),
  attester_id  TEXT REFERENCES user(id) ON DELETE SET NULL,   -- NULL khi là người thân không có tài khoản
  attester_label TEXT CHECK (attester_label IN ('nguoi_than','dong_tu','ban_be')),
  token_hash   TEXT UNIQUE,                        -- SHA-256 của liên kết mời dùng một lần
  note         TEXT CHECK (note IS NULL OR length(note) <= 300),
  status       TEXT NOT NULL DEFAULT 'cho' CHECK (status IN ('cho','da_xac_nhan','tu_choi','het_han')),
  created_at   INTEGER NOT NULL,
  confirmed_at INTEGER
);

-- 0007_community.sql
CREATE TABLE partner (                           -- đối tác thiện nguyện/nhà bán đã xác minh; dùng cho sự kiện (0007) và Đại Công Đức (0008)
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('quy_tu_thien','chua','to_chuc_xa_hoi','doanh_nghiep_xa_hoi','nha_ban')),
  name        TEXT NOT NULL,
  legal_ref   TEXT NOT NULL,                       -- mã số thuế/giấy phép/quyết định thành lập
  public_contact TEXT,
  verified_at INTEGER,
  status      TEXT NOT NULL DEFAULT 'cho' CHECK (status IN ('cho','da_xac_minh','tam_dung'))
);
CREATE TABLE help_post (
  id          TEXT PRIMARY KEY,
  author_id   TEXT REFERENCES user(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('can_giup','co_the_giup','hoi_phap','tuy_hy')),
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 5 AND 80),
  body        TEXT NOT NULL CHECK (length(body) <= 1000),
  area        TEXT,                                -- tỉnh/thành hoặc 'truc_tuyen', không địa chỉ chi tiết
  anonymous   INTEGER NOT NULL DEFAULT 0 CHECK (anonymous IN (0,1)),
  status      TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (status IN ('cho_duyet','hien','an','dong')),
  ai_label    TEXT,                                -- kết quả Llama Guard
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX help_post_list ON help_post(status, kind, created_at);
CREATE TABLE help_reply (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES help_post(id) ON DELETE CASCADE,
  author_id  TEXT REFERENCES user(id) ON DELETE SET NULL,
  body       TEXT NOT NULL CHECK (length(body) <= 600),
  source_ref TEXT,                                 -- bắt buộc với trả lời 'hoi_phap' của người hướng dẫn
  status     TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (status IN ('cho_duyet','hien','an')),
  created_at INTEGER NOT NULL
);
CREATE TABLE help_match (                        -- một người nhận giúp; "xong" khi cả hai xác nhận
  post_id    TEXT NOT NULL REFERENCES help_post(id) ON DELETE CASCADE,
  helper_id  TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  state      TEXT NOT NULL CHECK (state IN ('de_nghi','nhan','xong','huy')),
  created_at INTEGER NOT NULL,
  done_at    INTEGER,
  PRIMARY KEY (post_id, helper_id)
);
CREATE TABLE volunteer_event (
  id           TEXT PRIMARY KEY,
  partner_id   TEXT REFERENCES partner(id) ON DELETE SET NULL,
  group_id     TEXT REFERENCES sangha_group(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  area         TEXT NOT NULL,
  starts_at    INTEGER NOT NULL,
  ends_at      INTEGER NOT NULL,
  capacity     INTEGER,
  status       TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (status IN ('cho_duyet','mo','dong','huy')),
  CHECK (partner_id IS NOT NULL OR group_id IS NOT NULL)
);
CREATE TABLE event_rsvp (
  event_id   TEXT NOT NULL REFERENCES volunteer_event(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  state      TEXT NOT NULL CHECK (state IN ('dang_ky','huy','co_mat')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, user_id)
);
CREATE TABLE moderation_queue (
  id          TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','reply','name','product','event')),
  target_id   TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('ai','bao_cao','he_thong')),
  reason      TEXT,
  state       TEXT NOT NULL DEFAULT 'mo' CHECK (state IN ('mo','giu','go','bo_qua')),
  decided_by  TEXT,
  created_at  INTEGER NOT NULL,
  decided_at  INTEGER
);

-- 0008_dai_cong_duc.sql
CREATE TABLE product (
  id              TEXT PRIMARY KEY,
  source          TEXT NOT NULL CHECK (source IN ('shopee','tiktok','woo','khac')),
  source_ref      TEXT NOT NULL,                   -- itemId/shopId, product id…
  title           TEXT NOT NULL,
  image_url       TEXT,
  price_vnd       INTEGER,
  category        TEXT NOT NULL,                   -- danh mục nội bộ đã cho phép (Phụ lục G)
  affiliate_url   TEXT NOT NULL,                   -- chỉ máy chủ dùng ở /go/{id}
  policy_json     TEXT NOT NULL,                   -- kết quả checklist Chánh Mạng
  status          TEXT NOT NULL DEFAULT 'ung_vien' CHECK (status IN ('ung_vien','cho_duyet','hien','an')),
  reviewed_by     TEXT,
  reviewed_at     INTEGER,
  refreshed_at    INTEGER,
  UNIQUE (source, source_ref)
);
CREATE INDEX product_list ON product(status, category);
CREATE TABLE affiliate_click_day (               -- chỉ đếm tổng theo ngày; lượt bấm chi tiết ở Analytics Engine, không user_id
  product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  clicks     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day)
);
CREATE TABLE affiliate_conversion (
  id             TEXT PRIMARY KEY,                 -- mã đơn/chuyển đổi do nền tảng trả về
  source         TEXT NOT NULL,
  product_id     TEXT REFERENCES product(id) ON DELETE SET NULL,
  order_day      TEXT NOT NULL,
  commission_vnd INTEGER NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('cho','xac_nhan','huy')),
  imported_at    INTEGER NOT NULL
);
CREATE TABLE gieo_receipt (                      -- không lưu số tài khoản người gieo
  id           TEXT PRIMARY KEY,
  provider     TEXT NOT NULL CHECK (provider IN ('payos','casso','sepay','thu_cong')),
  provider_tx  TEXT NOT NULL UNIQUE,               -- chống trùng webhook
  memo_code    TEXT NOT NULL,                      -- 'VD' + 6 ký tự từ /gieo/intent
  amount_vnd   INTEGER NOT NULL CHECK (amount_vnd > 0),
  user_id      TEXT REFERENCES user(id) ON DELETE SET NULL,   -- chỉ khi người gieo chủ động gắn
  display      TEXT NOT NULL DEFAULT 'an_danh' CHECK (display IN ('an_danh','tinh_danh')),
  received_at  INTEGER NOT NULL
);
CREATE TABLE campaign (
  id           TEXT PRIMARY KEY,
  partner_id   TEXT NOT NULL REFERENCES partner(id),
  title        TEXT NOT NULL,
  purpose      TEXT NOT NULL,
  receive_info TEXT NOT NULL,                      -- tài khoản tiếp nhận RIÊNG của đối tác; Vân Đạo không giữ tiền
  goal_vnd     INTEGER,
  starts_on    TEXT NOT NULL,
  ends_on      TEXT NOT NULL,
  report_r2_key TEXT,
  status       TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (status IN ('cho_duyet','mo','dong','da_bao_cao'))
);
CREATE TABLE pledge (                            -- "tôi đã gieo" do người dùng tự ghi, không số tiền, không kiểm chứng
  campaign_id TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  at          INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, user_id)
);
CREATE TABLE impact_ledger (                     -- sổ cái tác động xã hội, băm chuỗi (tài liệu gốc)
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_id        TEXT NOT NULL UNIQUE,
  beneficiary  TEXT NOT NULL,                      -- mã băm ẩn danh của hành giả/nhóm
  milestone    TEXT NOT NULL CHECK (milestone IN ('hoan_tat_49','nhom_dat_nguyen','khac')),
  category     TEXT NOT NULL CHECK (category IN ('trong_cay','suat_an','an_tong_kinh','khac')),
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  partner_id   TEXT REFERENCES partner(id),
  evidence_r2_key TEXT,
  prev_hash    TEXT NOT NULL,
  hash         TEXT NOT NULL UNIQUE,               -- SHA-256(prev_hash‖tx_id‖beneficiary‖milestone‖category‖quantity‖created_at)
  created_at   INTEGER NOT NULL
);
CREATE TABLE ledger_month (                      -- Sổ Minh Bạch tháng
  month        TEXT PRIMARY KEY,                   -- 'YYYY-MM'
  revenue_json TEXT NOT NULL,
  cost_json    TEXT NOT NULL,
  allocation_json TEXT NOT NULL,
  impact_count INTEGER NOT NULL,
  head_hash    TEXT NOT NULL,
  approved_by  TEXT,
  published_at INTEGER
);
```

Ghi chú: `kusala_entry` (0003) được bổ sung cột `variant_id`, `punna`, `parami_json`, `scope` (đã sửa trực tiếp ở §4.3 vì chưa triển khai). Các bảng mới đều nhỏ (dưới vài trăm MB/năm ở 10.000 người hoạt động/ngày) trừ `deed_log`, đã giới hạn 5 dòng/ngày/người.

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
| `GET/POST /api/v1/companions`, `/companions/link`, `/presence`, `/meet`, `/visits/away`, `/blocks`, `/reports`, `/groups` | phiên | Xã hội tu tập (GĐ5); Bạn đồng tu theo [hợp đồng #121](docs/contracts/ban-dong-tu.md) | theo loại |
| `GET /api/v1/content?tier=&kind=` | công khai | Nội dung **đã chọn phát hành**, trạng thái kỹ thuật `da_duyet` (cache KV; không chứng nhận Hội đồng) | cache 1 giờ |

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

### 5.2 Endpoint bổ sung của bản 3

| Phương thức & đường dẫn | Xác thực | Mục đích |
|---|---|---|
| `GET /api/v1/practice/today` | phiên | 3 nhiệm vụ trong ngày theo biến thể đã chọn + gợi ý thời thiền |
| `PUT /api/v1/practice/profile` | phiên | Cập nhật mức độ, thời gian, khung giờ, giới nguyện, cờ `no_money`/`at_home` |
| `POST /api/v1/practice/swap` | phiên | Đổi biến thể nhiệm vụ của hôm nay (1 lần/trục/ngày) |
| `POST /api/v1/deeds` | phiên | Ghi việc thiện thêm (≤ 5/ngày, không cộng điểm) |
| `GET /api/v1/practice/summary?range=week\|cycle` | phiên | Thống kê riêng tư: ba trụ, hoa sen Ba-la-mật, Phước nghiệp sự, nhịp thiền |
| `POST /api/v1/attest/invite` · `GET/POST /attest/{token}` | phiên · liên kết 1 lần | Mời và nhận chứng thực tuần |
| `PUT /api/v1/reminders` · `POST/DELETE /api/v1/push/subscription` | phiên | Lịch nhắc, đăng ký Web Push |
| `GET /api/v1/help?kind=&area=` · `POST /api/v1/help` | công khai · phiên | Bảng Hộ Trì |
| `POST /api/v1/help/{id}/reply` · `POST /api/v1/help/{id}/match` | phiên | Trả lời, nhận giúp, xác nhận xong |
| `GET /api/v1/events` · `POST /api/v1/events/{id}/rsvp` | công khai · phiên | Sự kiện thiện nguyện |
| `GET /api/v1/cong-duc/products?cat=` | công khai (cache KV) | Danh mục Chánh Mạng Thị |
| `GET /go/{product_id}` | — | Chuyển hướng 302 tới link affiliate, đếm ẩn danh |
| `POST /api/v1/gieo/intent` | phiên hoặc khách | Trả payload VietQR + mã nội dung `VDxxxxxx` |
| `POST /hooks/payment/{provider}` | chữ ký cổng | Webhook xác nhận chuyển khoản (payOS/Casso/SePay) |
| `GET /api/v1/campaigns` · `POST /api/v1/campaigns/{id}/pledge` | công khai · phiên | Chiến dịch đối tác, "tôi đã gieo" |
| `GET /api/v1/ledger/{YYYY-MM}` · `GET /api/v1/impact?cursor=` | công khai | Sổ Minh Bạch, sổ cái tác động |
| `/admin/*` | Cloudflare Access | Duyệt sản phẩm, bài viết, sự kiện, đối tác, bút toán |

Thao tác mới đi qua `/sync` khi offline: `deed.add`, `practice.swap`, `profile.practice`, `pledge.add` — cùng quy tắc chống trùng §5.1.

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

### 6.4 Đăng nhập khi còn gói Free (thay bước 3–4 của §6.1 cho đến khi bật `EMAIL_OTP`)

Email Sending của Cloudflare chỉ có ở gói Paid [12], nên khi còn gói Free, nút "Giữ hành trình của tôi" đưa ra bốn cách, cách nào cũng **không cần mật khẩu**:

| Cách | Cách hoạt động | Phù hợp |
|---|---|---|
| Passkey | Plugin `passkey` của Better Auth; vân tay/Face ID/PIN máy | Điện thoại và máy tính đời mới |
| Google | OAuth Google (tùy chọn) | Ai đã có tài khoản Google |
| Mã QR liên kết thiết bị | Máy mới hiện mã QR chứa mã dùng một lần (sống 2 phút); máy đã đăng nhập quét và bấm đồng ý → máy mới nhận phiên | Chuyển giữa điện thoại và máy tính |
| Mã khôi phục | 26 ký tự Base32 (128 bit ngẫu nhiên) hiện **một lần**, chia nhóm 4 ký tự; máy chủ chỉ lưu SHA-256 (đủ an toàn vì mã có độ ngẫu nhiên cao, không cần hàm băm chậm vượt 10 ms CPU) | Người cao tuổi, máy không hỗ trợ passkey |

Giới hạn phải nói rõ trong app: mất cả thiết bị mà không có passkey đồng bộ, Google hay mã khôi phục thì không lấy lại được hành trình. Khi nâng Paid, bật Email OTP như §6.1 và vẫn giữ bốn cách trên.

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
- Mục tiêu GĐ9: 2.000 kết nối đồng thời trên 10 shard; sync 50 yêu cầu/giây trong 10 phút với lỗi < 0,1 %.

### 7.7 Thời gian thực trên gói Free

Hạn mức DO miễn phí (100.000 yêu cầu và 13.000 GB-giây mỗi ngày [27]) với tỉ lệ tính tin WebSocket 20:1 [7] tương đương ~2 triệu tin đến/ngày và ~28 giờ-phòng hoạt động/ngày. Cấu hình mặc định khi còn Free: tối đa 3 shard Đại Thiền Đường, khung gộp 2 lần/giây, IslandRoom chỉ mở khi có khách; vượt hạn mức thì client tự chuyển sang đám đông mô phỏng và ghi "đang đông, hiển thị mô phỏng" — thời thiền không bị ảnh hưởng.

---

## 8. TẦNG 0 — SƠ NHẬP TỊNH CẢNH CHUẨN PHÁP HÀNH, BA-LA-MẬT VÀ PHỤNG SỰ THEO HOÀN CẢNH TỪNG NGƯỜI

### 8.1 Căn cứ
- Ba trụ **Đức – Thiện – Tuệ** của app tương ứng ba nền tảng làm phước **Trì giới – Bố thí – Tu tập** (sīla, dāna, bhāvanā) có trong Tam tạng; truyền thống Chú giải mở rộng thành **10 Phước nghiệp sự**: bố thí, trì giới, tu tập, cung kính, phục vụ, hồi hướng, tùy hỷ, nghe Pháp, thuyết Pháp, chỉnh trực tri kiến [47]. Tài liệu gốc chọn đúng khung này (Chú giải Atthasālinī) làm nền cho chuỗi 49 ngày.
- **10 Ba-la-mật** theo Phật Sử (Buddhavaṃsa): bố thí, trì giới, xuất ly, trí tuệ, tinh tấn, nhẫn nại, chân thật, quyết định, tâm từ, xả [48].
- Pháp hành cốt lõi của người tại gia ở Tầng 0: Tam quy – Ngũ giới, Bát quan trai vào ngày trai; niệm hơi thở (MN 118); tâm từ (Snp 1.8); quán thọ – tâm – pháp ở mức nhập môn (MN 10); nghe và đọc Pháp có trích dẫn; tự vấn chánh kiến nhân quả. Bản dịch dùng trong app được biên tập, ghi nguồn và quyền sử dụng; tham vấn chuyên gia khi cần, không bắt buộc Hội đồng.
- **Giữ nguyên** công thức Kusala, hệ số Tam thời tư tâm sở, Trí tương ưng, Vô trợ, khóa 1 nấc/ngày, 7 tuần nhiệm vụ trong `data.js` và thời thiền 15 phút 7 mốc.

### 8.2 Ánh xạ 7 tuần ↔ Phước nghiệp sự ↔ Ba-la-mật (đề xuất biên tập, tham vấn tùy chọn)

| Tuần | Đức (trì giới) | Thiện (bố thí – phụng sự) | Tuệ (tu tập – chánh kiến) |
|---|---|---|---|
| 1 An trú hơi thở | Không làm hại · sīla · *giới, từ* | Bố thí sự hiện diện · dāna · *bố thí, từ* | Niệm hơi thở 10' + đọc Pháp nhân quả · bhāvanā, nghe Pháp · *trí tuệ, tinh tấn* |
| 2 Tịnh hóa khẩu | Chân ngữ & hòa ngữ · sīla · *chân thật, nhẫn* | Bố thí lời lành · dāna · *từ* | Quán thọ 15' · bhāvanā · *trí tuệ, xả* |
| 3 Ngũ giới & tri túc | Trọn Ngũ giới, tri túc · sīla · *giới, xuất ly* | San sẻ vật chất (luôn có lựa chọn không tốn tiền) · dāna · *bố thí* | Ngồi Đại Thiền Đường; phước thế gian và Ba-la-mật · bhāvanā, nghe Pháp · *trí tuệ, quyết định* |
| 4 Xả tài vô cầu | Chánh mạng · sīla · *chân thật* | Phụng sự vô danh · phục vụ · *bố thí, xuất ly* | Quán tâm 20' · bhāvanā · *trí tuệ, tinh tấn* |
| 5 Khiêm hạ & hộ trì | Đoạn giảm ngã mạn · cung kính · *nhẫn, xả* | Phụng sự cộng đồng + khích lệ 3 người sơ nhập · phục vụ (đời thực/đồng tu) · *tinh tấn, từ* | Thiền tâm từ · bhāvanā · *từ* |
| 6 Nhẫn trước 8 gió | Nhẫn nhục · sīla · *nhẫn* | Vô úy thí – tha thứ · dāna · *nhẫn, từ* | Quán tam tướng 25–30' · bhāvanā, chỉnh trực tri kiến · *trí tuệ, xả* |
| 7 Chánh kiến viên mãn | Bát quan trai 1 ngày · sīla · *giới, xuất ly, quyết định* | Hồi hướng & tùy hỷ, chia sẻ Pháp · hồi hướng, tùy hỷ, thuyết Pháp · *bố thí, từ* | Tổng kết 49 ngày, vấn đáp chánh kiến · chỉnh trực tri kiến, nghe Pháp · *trí tuệ, quyết định* |

Mỗi lần xác nhận trục, app gắn mã Phước nghiệp sự và Ba-la-mật vào `kusala_entry` (mã ở Phụ lục H). Thành thật nhận lỗi (Sám hối) gắn thêm *chân thật* như tài liệu gốc, không trừ điểm.

### 8.3 Cá nhân hóa: "Duyên khởi hành trình"
Hỏi 6 câu khi bắt đầu (bỏ qua được, sửa lại bất cứ lúc nào):
1. Mỗi ngày dành được bao lâu: 10 · 15 · 20–30 · 45+ phút.
2. Khung giờ thuận tiện: sáng · trưa · tối · linh hoạt.
3. Hoàn cảnh: học sinh–sinh viên · đi làm · nội trợ · cha mẹ con nhỏ · nghỉ hưu · khác.
4. Mức quen thuộc với Phật pháp: mới tìm hiểu · đã quy y · tu tập lâu năm.
5. Giới nguyện trong chu kỳ: chọn các giới phát nguyện giữ trọn; khuyến khích đủ năm giới (cách diễn đạt do nhóm biên tập chọn, không bắt buộc Hội đồng).
6. Giới hạn hiện tại (chỉ lưu trên máy): ít di chuyển · không muốn chi tiền · thời gian bất định · không tham gia nơi đông người.

**Dữ liệu ở đâu:** máy chủ chỉ nhận `level`, `minutes`, `time_window`, `familiarity`, giới nguyện, ngày trai, cờ `no_money`, `at_home` (§4.6). Hoàn cảnh cụ thể (câu 3, 6) ở lại trên máy để tránh thu thập dữ liệu nhạy cảm.

**Biến thể nhiệm vụ:** mỗi ô (tuần, trục) trong `content/program/so-nhap-49/` có 3–6 biến thể với thuộc tính `{level, minutes, money: false|optional, outdoors, needs_others, punna, parami[], scope}`. Bộ chọn trong `packages/shared/variant.js`:
1. Lọc theo cờ người dùng (ví dụ `no_money=1` loại mọi biến thể `money=optional`).
2. Chọn tất định theo `(user_id, cycle, day, pillar)` để offline và máy chủ ra cùng kết quả.
3. Cho đổi một lần mỗi trục mỗi ngày (`/practice/swap`).

**Ví dụ tuần 3 – Thiện "San sẻ vật chất":** nhẹ, không tốn tiền: chia sẻ đồ dùng còn tốt cho người cần · tại nhà: dạy kèm trực tuyến miễn phí 30 phút, gọi hỏi thăm người neo đơn · vừa: góp một suất ăn qua chiến dịch đối tác trên Đại Công Đức (không cộng thêm điểm, điểm gốc như mọi biến thể). App không bao giờ gợi ý số tiền, không gợi ý vay mượn để bố thí, không khuyến khích mua sinh vật để phóng sinh.

**Thời thiền:** thời 15 phút chuẩn giữ nguyên tỉ lệ 7 mốc. Người chọn 10 phút dùng bản 15 phút với lời mời "ngồi tới đâu an tới đó"; người chọn 20–45 phút ngồi 15 phút chuẩn rồi tĩnh tọa tự do, có chuông báo hết giờ — không kéo giãn kịch bản âm thanh.

### 8.4 Một ngày trong app
- **Sáng:** Bia Tích Lũy hiện 3 việc của ngày và giờ thiền đã chọn.
- **Trong ngày:** làm ngoài đời thực; có thể ngồi thiền ở Đài Thiền hoặc Đại Thiền Đường.
- **Tối:** ghi nhận từng trục (thanh trượt tam thời, như lý tác ý, tự giác, 1–2 dòng quán chiếu lưu trên máy); tùy chọn ghi việc thiện thêm (không cộng điểm, ≤ 5/ngày); Sám hối chân thật nếu lỡ phạm.
- **Cuối tuần:** phản tỉnh tuần (nhận diện tham, sân, si trong tuần) và mời chứng thực (tùy chọn).
- **Ngày 49:** tổng kết, xét điều kiện Tầng 1, kích hoạt sổ cái tác động (§11.6).

### 8.5 Bốn hàng rào chống "ảo tưởng công đức" (tài liệu gốc) — cách triển khai
1. **Khóa nhịp thời gian thực:** máy chủ quyết định ngày (§5.1). Xác thực thời thiền bằng nhịp thở qua micro để sau GĐ9, chỉ xử lý trên máy như tài liệu gốc yêu cầu.
2. **Phản tỉnh có AI:** chỉ chạy khi người dùng bật; gửi câu chữ đã bỏ tên riêng; trả lời dạng câu hỏi gợi mở, có nhãn "gợi ý, không phải lời thầy"; lời nhắc hệ thống được biên tập theo ADR 0003, không bắt buộc Hội đồng duyệt.
3. **Chứng thực chéo cuối tuần:** §9.4.
4. **Quy đổi thành hành động xã hội có sổ cái:** §11.6.

### 8.6 Từ Tầng 0 lên Tầng 1
Điều kiện đề xuất (xem §16): hoàn tất 49 ngày, ≥ 30 thời thiền trọn, bài tự vấn tuần 7, tùy chọn ≥ 1 chứng thực. Giao diện chỉ nói "đã hoàn thành chương trình Sơ nhập", không nói đã chứng đắc.

---

## 9. THEO DÕI TU TẬP, NHẮC NHỞ VÀ TÍCH LŨY

### 9.1 Theo dõi (chỉ chủ nhân xem)
Bia Tích Lũy có thêm các mặt:
- **Ba trụ Đức – Thiện – Tuệ** (đã có).
- **Hoa sen 10 cánh Ba-la-mật:** mỗi cánh sáng theo số lần được rèn trong chu kỳ, chuẩn hóa theo cánh mạnh nhất, để thấy sự cân bằng chứ không phải điểm số.
- **10 Phước nghiệp sự:** phân bố việc đã làm.
- **Lịch tu:** tô màu ngày đã làm; ngày trống để trống, không tô đỏ.
- **Nhịp thiền:** số phút mỗi tuần.
- **Phản tỉnh tuần:** câu trả lời của chính người dùng.

Một hàm thống kê dùng chung (`packages/shared/stats.js`) chạy được offline trên IndexedDB và trên máy chủ. Không có bảng xếp hạng; cộng đồng chỉ thấy số tổng hợp ẩn danh.

### 9.2 Nhắc nhở
**Loại nhắc:** giờ thiền · việc của ngày (sáng) · ghi nhận (tối) · ngày Bát quan trai theo âm lịch · tổng kết tuần · lời mời nhóm.

| Nền tảng | Kênh | Ghi chú |
|---|---|---|
| App Android | Thông báo cục bộ (Capacitor LocalNotifications) | Chạy cả khi offline, đúng giờ |
| PWA Android/máy tính | Web Push từ Worker | Cần quyền thông báo |
| iPhone/iPad | Web Push | Chỉ khi đã "Thêm vào Màn hình chính", iOS/iPadOS 16.4 trở lên [50] |
| Email | Thư tổng kết tuần | Chỉ khi gói Paid và người dùng bật |
| Mọi nơi | Thông báo trong app khi mở | Dự phòng |

**Nguyên tắc:** mặc định tắt (chỉ gợi ý bật một nhắc giờ thiền); tối đa 2 nhắc/ngày; giờ yên lặng mặc định 21:30–05:00; nút "Tịnh khẩu" tạm dừng 1–30 ngày; không câu chữ gây áy náy; nội dung nhắc được biên tập, không đòi phê duyệt Hội đồng.

**Máy chủ:** `reminder` trong D1 là nguồn chính. Durable Object `ReminderClock` chia 16 shard theo `user_id`; mỗi shard giữ chỉ mục đến hạn trong SQLite và đặt alarm đến lần gửi gần nhất. Khi alarm chạy: gửi Web Push theo lô, tính `next_at` theo múi giờ người dùng, xóa subscription trả 404/410. Âm lịch tính bằng `packages/shared/amlich.js` (thuật toán âm lịch Việt Nam, múi giờ +7, chạy offline) để ra ngày trai theo lựa chọn 2/4/6/10 ngày.

### 9.3 Tích lũy
- **Kusala** mỗi trục mỗi ngày, công thức không đổi.
- **Thẻ Ba-la-mật và Phước nghiệp sự** cho cả 3 nhiệm vụ và việc thiện thêm.
- **Chân thật (Sacca)** khi Sám hối, không trừ điểm (tài liệu gốc).
- **Cân bằng Thiện 70/30:** tài liệu gốc đặt 70 % Thiện từ việc tử tế ngoài đời và 30 % từ nâng đỡ đồng tu trong app. App hiển thị tỉ lệ trong chu kỳ và gợi ý nhẹ khi phần trong app vượt 30 %; không chặn.
- **Số liệu cộng đồng** (thời thiền, việc thiện, hồi hướng) tổng hợp mỗi ngày vào `community_day`.

### 9.4 Chứng thực chéo cuối tuần
Ngày 7, 14, … 49: người dùng có thể mời một người (người thân không cần tài khoản) bằng liên kết dùng một lần (lưu SHA-256, hết hạn sau 7 ngày). Người chứng thực viết ≤ 300 ký tự về thay đổi tích cực họ thấy. Không bắt buộc, không công khai, giới hạn 1 lời mời/tuần.

---

## 10. KHÔNG GIAN CỘNG ĐỒNG HỘ TRÌ & THIỆN NGUYỆN

### 10.1 Mục đích
Một nơi trao đổi và nâng đỡ nhau, đặt ở **Cổng Vân Môn** của Vân Đảo (nơi gặp gỡ), không đặt trong Đại Công Đức. Bốn loại bài:
- **Cần giúp** — chỉ giúp không bằng tiền: lời khuyên, đồng hành, kỹ năng, sức lực.
- **Có thể giúp** — nhận dạy kèm, sửa máy, chở người già đi khám…
- **Hỏi Pháp** — người hướng dẫn trả lời, bắt buộc kèm trích dẫn (`source_ref`).
- **Tùy hỷ** — chia sẻ việc thiện, không ghi số tiền, có thể ẩn danh.

Thêm **Sự kiện thiện nguyện** do đối tác đã xác minh hoặc nhóm đồng tu từ Tầng 2 tổ chức.

### 10.2 Quy tắc an toàn
- **Không kêu gọi tiền hay hiện vật cá nhân.** Cá nhân vận động từ thiện phải mở tài khoản riêng tại ngân hàng cho từng cuộc vận động và công khai theo Nghị định 93/2021/NĐ-CP [43]; nền tảng không kiểm soát được việc đó nên chỉ cho phép chiến dịch của đối tác đã xác minh (§11.5).
- Không đăng địa chỉ hay số điện thoại; khu vực chỉ tới tỉnh/thành; khuyên gặp ở nơi công cộng; nhắn tin riêng chỉ khi cả hai đồng ý (GĐ5).
- **Tuổi:** cộng đồng và Đại Công Đức dành cho người từ 18 tuổi (tự xác nhận + điều khoản); người dưới 18 chỉ dùng phần tu tập cá nhân.
- **Kiểm duyệt ba lớp:**
  1. Luật từ khóa tiếng Việt.
  2. Llama Guard trên Workers AI.
  3. Hàng chờ người duyệt: mọi bài của tài khoản dưới 7 ngày tuổi đều qua người.
- Báo cáo và chặn có hiệu lực ngay; Hermes gom báo cáo mỗi ngày và đề xuất xử lý, người quyết.

### 10.3 Nối việc giúp với tu tập
Khi một yêu cầu "Cần giúp" được nhận và cả hai bấm "xong", mỗi bên có thể chọn việc đó làm nhiệm vụ Thiện (phục vụ – veyyāvacca) của ngày, vẫn theo luật 1 nấc/ngày. Giúp ngoài đời → `scope = doi_thuc`; giúp trong app → `scope = dong_tu`.

### 10.4 Bạn đồng tu — người quen ngoài đời cùng tu (#121, chủ dự án giao 18/11/2026)
- **Kết nối:**
  - liên kết/QR/mã mời 8 ký tự (7 ngày, 5 lượt); người mới vào qua liên kết thì thành bạn ngay và được ghi người dẫn dắt (`guidance`, tiêu chí Tầng 1);
  - hoặc gõ đúng «Tịnh danh · mã» rồi bên kia đồng ý.
  - Không danh bạ công khai, không tìm gần đúng, không GPS.
- **Danh sách:** Thân thiết · Quen biết · Đang chờ. Trạng thái `online/thien/tham/tra/vang` qua nhịp hiện diện 2 phút; vắng sau 3 phút; người dùng tắt được.
- **Lời mời gặp:** Ghé thăm đảo mình · Xin ghé thăm đảo bạn · Cùng ngồi thiền · Trà Đạo · Tham quan.
  - Theo phân khu đã mở: đi thăm cần Cổng Vân Môn của người đi nửa mở (ngày 29) và chủ đảo đang Nghênh khách; Trà Đạo cần chủ đảo từ ngày 15; thiền từ ngày 1, ngồi chung ở Đại Thiền Đường khi chưa đi được.
  - Thiền/trà bắt đầu cùng giờ máy chủ sau 60 giây. Lời mời không làm gián đoạn thời thiền.
- **«Ở gần»** là Vân Đảo bạn đồng tu dựng cạnh đảo mình: thân thiết vòng gần nhất, quen biết vòng kế, tối đa 4 + 4. Thân thiết do hai người cùng chọn; bạn thân thiết có thể cho ghé khi vắng.
- **Không chữ tự do, không điểm/xếp hạng**, không cộng Kusala.
- Thiết kế: [docs/thiet-ke/ban-dong-tu.md](docs/thiet-ke/ban-dong-tu.md). Hợp đồng D1/API: [docs/contracts/ban-dong-tu.md](docs/contracts/ban-dong-tu.md). Luật dùng chung: `packages/shared/src/dong-tu.js`. Đợt thời gian thực (đi cùng trên đảo) ở T5.2 sau GĐ4.

---

## 11. ĐẠI CÔNG ĐỨC — CHÁNH MẠNG THỊ · GIEO DUYÊN · HỘ TRÌ · MINH BẠCH

### 11.1 Triết lý (theo tài liệu gốc)
- **Mô hình hai động cơ.** Động cơ 1 là doanh nghiệp Chánh Mạng, tạo dòng tiền và hạ tầng — đúng vai trò của cư sĩ Cấp Cô Độc. Động cơ 2 là hệ sinh thái phụng sự và hoằng pháp phi lợi nhuận: công cụ Pháp học/Pháp hành mở, hộ trì Tứ sự, từ thiện. Không thu phí Kinh điển, không bán khóa học giải thoát, không thương mại hóa tín ngưỡng.
- **Bốn nguyên tắc đạo đức:**
  - *Chân thật:* minh bạch 100 % nguồn gốc và chất lượng.
  - *Phi thương mại trong không gian Pháp:* không quảng cáo, không bán dữ liệu.
  - *Không buôn thần bán thánh:* không "khai quang, điểm nhãn, cải mệnh, trừ tà".
  - *Đúng Pháp – đúng Luật:* không hợp tác với hoạt động trái giới luật.
- **Pháp nhân (đã chốt 13/11/2026): Công ty TNHH Opalina Kim Bảo**, pháp nhân có sẵn của chủ dự án, vận hành Vân Đạo và Đại Công Đức. Dòng tiền Vân Đạo tách bằng tài khoản ngân hàng riêng và mã hạch toán riêng; tỉ lệ phân bổ thặng dư bên dưới áp cho **phần của Vân Đạo** bằng quy chế nội bộ và công khai ở Sổ Minh Bạch. Đăng ký tư cách doanh nghiệp xã hội (gửi Cam kết thực hiện mục tiêu xã hội, môi trường tới cơ quan đăng ký kinh doanh [53]) là bước tùy chọn: cam kết ≥ 51 % lợi nhuận sau thuế ràng buộc **toàn bộ** Opalina, kể cả mảng tư vấn AINextBrain, nên chỉ làm khi chủ dự án chấp nhận ràng buộc đó. Tăng Ni có thể tham gia tư vấn Pháp học độc lập, không tham gia thương mại.
- **Phân bổ thặng dư** lấy cảm hứng từ Kinh Giáo thọ Thi-ca-la-việt (DN 31) — ¼ chi dùng và bổn phận, 2/4 tái đầu tư, ¼ dự trữ (tài liệu gốc). Đề xuất cho Vân Đạo: 2/4 tái đầu tư nền tảng và công cụ Pháp học miễn phí · ¼ Quỹ Phụng Sự (sổ cái tác động) · ¼ dự phòng. Như vậy 75 % dành cho mục tiêu xã hội, vượt ngưỡng 51 %. Chủ đầu tư chốt tỉ lệ.

### 11.2 Không gian 3D "Đại Công Đức Viên"
- **Vị trí:** một đảo riêng, **thấp hơn Tầng 1**, ở phía sau – bên phải Vân Đảo, xa Đại Thiền Đường; nối bằng vân lộ từ Cổng Vân Môn; không lọt vào camera Đại Thiền Đường hay Đài Thiền. Tôn tượng vẫn là điểm cao nhất.
- **Kiến trúc:** gợi Kỳ Viên (Jetavana) nhưng không phô vàng bạc. Không đặt tượng Phật hay vật thờ trong khu này để thương mại không gắn với thờ cúng.
- **Bốn gian:**
  1. *Chánh Mạng Thị* — gian hàng affiliate và sản phẩm của doanh nghiệp xã hội.
  2. *Gieo Duyên Đường* — hộ trì vận hành nền tảng.
  3. *Hộ Trì Đài* — chiến dịch của đối tác và Quỹ Phụng Sự.
  4. *Bia Minh Bạch* — Sổ Minh Bạch tháng và sổ cái tác động.
- **Giao diện:** bảng 2D trong suốt theo `CLAUDE.md`; ảnh tải lười; mọi sản phẩm có nhãn "Liên kết tiếp thị".

### 11.3 Chánh Mạng Thị (affiliate)

| Nguồn | Cách tích hợp | Ghi chú |
|---|---|---|
| Shopee Affiliate (VN) | Open API trong mục "Open API" của bảng affiliate: lấy danh sách offer (Shopee, thương hiệu, sản phẩm), tạo short link, lấy báo cáo chuyển đổi [36b]; yêu cầu GraphQL ký HMAC-SHA256 bằng App ID/Secret | API chỉ trả thông tin cơ bản: tên, ảnh chính, giá; không có mô tả đầy đủ [36] |
| TikTok Shop | Affiliate APIs: tìm sản phẩm open collaboration, tạo link quảng bá sản phẩm [37] | Quyền truy cập tùy thị trường và loại tài khoản; chưa được cấp ở VN thì nhập link thủ công |
| WooCommerce của doanh nghiệp | REST API v3; sản phẩm loại external/affiliate có `external_url`, `button_text` [38]; sản phẩm của chính doanh nghiệp thanh toán trên site Woo | Phù hợp nhóm "sản phẩm có giá trị thực" của tài liệu gốc |

**Quy trình đưa sản phẩm lên:**
1. Hermes hoặc lịch chạy lấy ứng viên → `product.status = 'ung_vien'`.
2. Lọc tự động theo danh mục cấm.
3. Người duyệt chấm checklist Chánh Mạng (Phụ lục G) → `hien`.
4. Cache vào KV; làm mới giá mỗi ngày; link hỏng thì ẩn.

**Khi người dùng bấm mua:** `/go/{id}` trên Worker đếm lượt bấm ẩn danh (Analytics Engine, không `user_id`) rồi chuyển 302 tới link affiliate có subId theo kênh (web/android). Không gắn danh tính người dùng vào link.

**Danh mục cấm cứng:**
- Năm nghề cư sĩ không nên làm theo AN 5.177: vũ khí, sinh vật (người, thú), thịt, chất say, chất độc [45] — bao gồm rượu bia, thuốc lá, chất kích thích, thuốc diệt chuột/trừ sâu, đồ săn bắt.
- Vật phẩm "khai quang, cải mệnh, trừ tà", bùa, phong thủy cải vận (tài liệu gốc).
- Cờ bạc, xổ số, vay tiêu dùng, tiền mã hóa; thực phẩm chức năng hoặc thuốc không có giấy tờ quảng cáo hợp lệ.

**Ưu tiên:** sách Phật học có bản quyền, đồ thiền (bồ đoàn, tọa cụ), trà, thực phẩm chay, đồ thủ công của doanh nghiệp xã hội, sản phẩm xanh, sản phẩm giá trị thực của doanh nghiệp như tài liệu gốc nêu (trang sức tự nhiên kiểm định minh bạch, ấn phẩm) — định vị là giá trị thẩm mỹ, không công năng tâm linh.

**Công bố và pháp lý:**
- Mọi sản phẩm mang nhãn "Liên kết tiếp thị — Vân Đạo nhận hoa hồng nếu bạn mua; giá của bạn không đổi", kèm trang chính sách affiliate. Luật Quảng cáo sửa đổi 2025 yêu cầu nội dung quảng cáo có dấu hiệu nhận diện rõ ràng [40].
- Luật TMĐT 2025, hiệu lực 1/7/2026, lần đầu điều chỉnh tiếp thị liên kết [41]. Người tiếp thị phải cung cấp thông tin xác thực danh tính cho đơn vị cung cấp dịch vụ affiliate, từ chối hàng vi phạm và chủ động gỡ link khi phát hiện vi phạm [42].

**Giai đoạn B (sau, cần luật sư):** cho đồng tu đã xác minh mở "gian hàng Chánh Mạng" dẫn link về Shopee/TikTok/Woo của họ. Khi đó Vân Đạo có thể thành **nền tảng TMĐT trung gian** — nền tảng cho phép người khác đăng ký tài khoản để giới thiệu, bán hàng trên chính nền tảng [41b]. Nghĩa vụ đi kèm: xác thực người bán, kiểm duyệt thông tin sản phẩm, lưu dữ liệu hàng hóa, tiếp nhận khiếu nại [41c]. Không làm ở GĐ6.

### 11.4 Gieo Duyên (hộ trì vận hành nền tảng)
- **Ý nghĩa:** góp vào chi phí máy chủ, phát triển, kiểm duyệt. Ghi rõ đây không phải cúng dường Tam Bảo và không phải từ thiện. Không đổi lấy quyền lợi, không cộng điểm, không huy hiệu.
- **Luồng kỹ thuật:**
  1. `POST /api/v1/gieo/intent` trả mã nội dung `VD` + 6 ký tự và payload VietQR tới tài khoản của pháp nhân.
  2. Cổng xác nhận chuyển khoản (payOS, Casso hoặc SePay) gọi webhook có chữ ký.
  3. Worker kiểm chữ ký và chống xử lý trùng theo mã giao dịch — Casso yêu cầu chống trùng để chặn tấn công replay [44].
  4. Ghi `gieo_receipt`, gửi lời Tùy hỷ.
  5. Đối soát mỗi ngày bằng API lấy giao dịch để không sót khi webhook lỗi.
- Mặc định ẩn danh; người gieo có thể cho hiện Tịnh danh trong danh sách tri ân, **không kèm số tiền**. Không lưu số tài khoản của người gieo.
- **Kế toán:** Opalina chưa là doanh nghiệp xã hội thì tiền Gieo Duyên là thu nhập của công ty, phải hạch toán, có chứng từ và chịu thuế; kế toán xác nhận cách ghi nhận trước khi mở (Issue `lane:owner`).
- **Android:** bản Play ẩn Gieo Duyên cho tới khi chốt cách tuân thủ chính sách thanh toán của Google Play (§13.4).

### 11.5 Hộ Trì Đài (chiến dịch thiện nguyện)
- Chỉ đối tác có tư cách pháp lý đã xác minh (quỹ từ thiện được phép hoạt động, tổ chức xã hội, chùa có tài khoản pháp nhân, doanh nghiệp xã hội).
- Mỗi chiến dịch phải có: mục tiêu, thời hạn, tài khoản tiếp nhận **riêng của đối tác**, cam kết báo cáo.
- **Vân Đạo không giữ tiền chiến dịch:** người dùng chuyển thẳng cho đối tác; app chỉ hiển thị, nhắc báo cáo, lưu "tôi đã gieo" (tự khai, không số tiền).
- Báo cáo giải ngân của đối tác lưu ở R2 và hiện trên Bia Minh Bạch.

### 11.6 Quỹ Phụng Sự và sổ cái tác động (Proof-of-Merit, theo tài liệu gốc)
- **Nguồn quỹ:** phần ¼ thặng dư (§11.1) từ Động cơ 1. Không dùng tiền Gieo Duyên cho quỹ này trừ khi công bố.
- **Kích hoạt:** hoàn tất 49 ngày; nhóm đạt 100 % nguyện chung.
- **Hạng mục:** trồng cây, suất ăn, ấn tống kinh (tài liệu gốc).
- **Ngân sách tháng có trần:** vượt trần thì xếp hàng sang tháng sau và công khai.
- **Quy trình (Workflows):**
  1. Tạo bút toán chờ.
  2. Chủ quỹ duyệt (Workflows hỗ trợ chờ sự kiện bên ngoài, ví dụ một lần phê duyệt [30b]).
  3. Chuyển khoản thủ công cho đối tác.
  4. Đính chứng từ lên R2.
  5. Ghi `impact_ledger` với `hash = SHA-256(prev_hash ‖ tx_id ‖ beneficiary ‖ milestone ‖ category ‖ quantity ‖ created_at)`.
  6. Báo Tùy hỷ cho hành giả hoặc nhóm.
- **Công bố hằng tháng:** `head_hash` hiện trên Bia Minh Bạch và đẩy vào một repo **công khai** riêng (ví dụ `tnfsmith/vandao-ledger`) qua PR của Hermes, để ai cũng kiểm được chuỗi không bị sửa.
- Người hưởng công đức được định danh bằng mã băm ẩn danh; chỉ hiện Tịnh danh khi người đó đồng ý.

### 11.7 Sổ Minh Bạch tháng
- **Doanh thu theo nguồn:** hoa hồng affiliate đã xác nhận, doanh thu bán hàng của doanh nghiệp xã hội, Gieo Duyên.
- **Chi phí:** Cloudflare, tên miền, phát triển, AI, kiểm duyệt.
- Phân bổ thặng dư theo §11.1, số tác động đã giải ngân và `head_hash` của sổ cái.
- **Quy trình:** Hermes soạn nháp từ dữ liệu → chủ quỹ duyệt → công bố ở `/api/v1/ledger/{YYYY-MM}`.

---

## 12. GIAO DIỆN 3D & TRẢI NGHIỆM — ĐÁNH GIÁ VÀ HIỆN ĐẠI HÓA

### 12.1 Đánh giá
- **Ổn định chức năng:** đủ các cảnh (Vân Đảo, Đại Thiền Đường, Toàn cảnh, cõi mở rộng, Tịnh Thất), chất lượng thích ứng, không lỗi console trong kiểm thử headless.
- **Chưa đạt hiệu năng mobile:** số đo ở §1.5.
- **Nợ kỹ thuật cho WebGPU:** ~15 shader tự viết và `EffectComposer`.
- **Kết luận:** giữ kiến trúc (Three.js, không framework nặng), tối ưu trước rồi mới đổi renderer.

### 12.2 Ngân sách hiệu năng (dùng làm tiêu chí nghiệm thu)

| Thiết bị | Lệnh vẽ | Tam giác | Khung hình | Ghi chú |
|---|---|---|---|---|
| Điện thoại tầm trung (Android 12+, đời 2022) | ≤ 120 | ≤ 400.000 | 30 fps ổn định khi thiền; 45–60 fps khi di chuyển | DPR tối đa 1,5 |
| Máy tính | ≤ 250 | ≤ 1 triệu | 60 fps | |

**Tải trang trên 4G:** giao diện 2D tương tác < 2,5 giây, cảnh 3D đầu tiên < 5 giây, mở lại khi đã cache < 1,5 giây.

### 12.3 Đợt 1 — Tối ưu WebGL (GĐ1, Claude)
1. Gộp geometry tĩnh theo vật liệu (`BufferGeometryUtils.mergeGeometries`).
2. Dùng `InstancedMesh`/`BatchedMesh` cho cây, đá, Vân Tọa, đảo xa; r183 có điều khiển từng instance của BatchedMesh, gồm độ mờ riêng [35].
3. 300 đảo xa dùng LOD/impostor; frustum culling theo cụm.
4. Biên dịch shader trước bằng `renderer.compileAsync` để không giật khi chuyển cảnh.
5. Độ phân giải động theo thời gian khung; bloom nửa độ phân giải trên mobile.
6. Dừng render khi tab ẩn.
7. Đo `renderer.info` tự động trong CI (Playwright) và báo vượt ngân sách.

### 12.4 Đợt 2 — WebGPURenderer + TSL (GĐ7, Claude)
- three.js r182 đã đưa WebGPURenderer lên làm renderer khuyến nghị [33b]; renderer tự lùi về WebGL 2 khi trình duyệt không có WebGPU, không cần viết hai nhánh mã [32].
- **Hỗ trợ trình duyệt:**
  - Chrome/Edge 113, Firefox 141, Safari 26 [34].
  - Android: Chrome 121 trở lên trên Android 12+ với GPU Qualcomm/ARM [34].
  - Firefox Android dự kiến cuối 2026 [34b].
- **Việc phải làm:**
  1. Đổi import sang `three/webgpu`, `await renderer.init()`, `setAnimationLoop` [33].
  2. Viết lại ~15 shader thành TSL; TSL biên dịch ra cả WGSL và GLSL [32].
  3. Thay `EffectComposer`/`UnrealBloomPass` bằng `RenderPipeline` (r183 đổi tên PostProcessing thành RenderPipeline [35]).
  4. Bỏ `onBeforeCompile`.
- **Triển khai:** chạy song song sau cờ `?r=webgpu`, so ảnh và số đo trên ma trận thiết bị; chỉ đổi mặc định khi đạt cả hình ảnh lẫn hiệu năng.
- **Lợi ích nhắm tới:** compute shader cho mây, hạt công đức, đám đông; giảm tải CPU khi nhiều người.

### 12.5 Mềm mại, thao tác nhanh
- **2D trước, 3D sau:** giao diện, Bia Tích Lũy, thời thiền dùng được ngay khi 3D còn đang tải. Đích build `web` tách gói `core`, `island`, `realm`, `cong-duc` và tải lười.
- **Phản hồi thao tác:** pointer events và listener passive; camera có damping; chuyển cảnh có easing; phản hồi chạm < 100 ms; `prefers-reduced-motion` tắt chuyển động lớn; rung nhẹ trên Android.
- **Chế độ "Thiền tiết kiệm":** trong thời thiền, giảm còn 30 fps hoặc dừng hẳn render (chỉ giữ âm thanh) — tiết kiệm pin và ít phóng dật.

### 12.6 Offline/online thông minh
- **Service worker:**
  - App shell precache, tên tệp băm, `Cache-Control: immutable`.
  - Nội dung đã chọn phát hành: stale-while-revalidate.
  - `/api/v1/me`: network-first, dự phòng bằng IndexedDB.
- Gọi `navigator.storage.persist()` để trình duyệt không tự xóa IndexedDB chứa hành trình.
- **Đồng bộ khi:** mở app, có mạng trở lại (`online`), app quay lại foreground, Background Sync (Chromium). Luôn idempotent nhờ ULID.
- Hiển thị trạng thái nhẹ: "đang lưu trên máy · sẽ đồng bộ".
- **Khi offline:** Đại Thiền Đường dùng đám đông mô phỏng và ghi "ngoại tuyến"; Đại Công Đức chỉ xem danh mục đã cache, không giao dịch.

### 12.7 Tận dụng hạ tầng Cloudflare cho trải nghiệm
- Static Assets với cache `immutable`.
- KV cho danh mục và nội dung đã chọn phát hành.
- D1 bản sao đọc + Sessions API.
- Durable Objects cho thời gian thực và nhắc nhở.
- R2 cho âm thanh tham khảo và chứng từ.
- Web Analytics cho Core Web Vitals; Analytics Engine cho FPS theo nhóm máy.

---

## 13. ỨNG DỤNG ANDROID (APK để thử, AAB để lên Google Play)

### 13.1 Chọn công nghệ
| Tiêu chí | Capacitor 8 (đề xuất) | TWA + Bubblewrap (phương án nhẹ) |
|---|---|---|
| Cách chạy | WebView hệ thống, **đóng gói sẵn tài nguyên trong app** | Mở PWA trong Chrome toàn màn hình [20] |
| Offline lần đầu | Có ngay (tài nguyên nằm trong APK) | Phụ thuộc service worker |
| Plugin gốc | Giữ màn hình sáng khi thiền, thông báo nhắc giờ, chia sẻ, rung nhẹ | Hạn chế |
| Cập nhật | Phát hành bản mới (hoặc tải tài nguyên web mới khi mở app) | Cập nhật web là xong |
| Kích thước | Lớn hơn | Rất nhỏ |

Đề xuất **Capacitor 8** vì thời thiền cần chạy chắc chắn offline và giữ màn hình sáng; TWA giữ làm phương án dự phòng (cần PWA đạt chuẩn từ GĐ1).

### 13.2 Yêu cầu công cụ (11/2026)
- Google Play: **ứng dụng mới và bản cập nhật phải nhắm Android 16 (API 36) từ 31/8/2026** [18].
- Capacitor 8 cần Android Studio Otter 2025.2.1 trở lên [19]; Node 22+, JDK 21, `compileSdk/targetSdk 36`, `minSdk 24`, AGP 8.13, Gradle 8.14.3 [19b].
- Hỗ trợ trang bộ nhớ 16 KB cho thư viện native (Play Console sẽ cảnh báo nếu thiếu) [19b].

### 13.3 Cấu trúc & build
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

### 13.4 Bổ sung bản 3 cho Android
- Toàn bộ chuỗi build dùng Node 26 LTS; Capacitor 8 chỉ yêu cầu Node 22 trở lên [19b].
- **Nhắc nhở:** thông báo cục bộ (LocalNotifications), chạy cả khi offline.
- **Đại Công Đức trong bản Google Play:**
  - Link affiliate dẫn tới sàn mua hàng hóa vật lý.
  - Chính sách thanh toán của Google Play chỉ miễn Play Billing cho một số loại thanh toán như quyên góp được miễn thuế [39]. Trong app, nhà phát triển không được dẫn người dùng tới phương thức thanh toán khác Play Billing, trừ khi chính sách cho phép [39b].
  - Vì vậy bản Play **ẩn Gieo Duyên**, còn chiến dịch đối tác chỉ hiển thị thông tin, cho tới khi có kết luận chính sách (hoặc tích hợp Play Billing cho Gieo Duyên).
  - Bản web/PWA vẫn có đủ chức năng.

---

## 14. QUY TRÌNH CỘNG TÁC SONG SONG CLAUDE ↔ ANTIGRAVITY ↔ HERMES

> **Cập nhật phân công 14/11/2026 theo chủ dự án:** Codex thực hiện cả làn Antigravity và Hermes; Claude tiếp tục làn riêng. Ký hiệu [AG]/[H] và các tiền tố `ag/`/`hermes/` bên dưới vẫn chỉ phạm vi công việc, không phải mở quyền sửa mọi nơi. Bản bàn giao hiện tại ở `docs/COORDINATION.md`; phần kiểm định §1 là mốc lịch sử 12–13/11, không phải trạng thái triển khai hôm nay.

### 14.1 Luật dùng chung cho mọi agent
- Tạo **`AGENTS.md`** ở gốc repo làm luật chung; Antigravity đọc `AGENTS.md` và `GEMINI.md`, cùng thư mục `.agents/rules/` [21]. `CLAUDE.md` giữ ngắn: nhập `@AGENTS.md` + phần riêng cho Claude. Antigravity giới hạn 12.000 ký tự mỗi tệp luật [21b] → luật ngắn gọn, chi tiết để trong `docs/`.
- Mỗi việc = **một GitHub Issue** có: phạm vi thư mục được sửa, tiêu chí nghiệm thu, phụ thuộc. Nhận việc bằng nhãn `lane:claude` / `lane:antigravity` / `lane:hermes` + `status:claimed`. Không nhân bản bảng việc GitHub trong repo. **Ngoại lệ được chủ dự án yêu cầu ngày 14/11:** `docs/COORDINATION.md` lưu phân công, hợp đồng, quyền sửa tệp và bản bàn giao đã xác minh; chỉ Codex cập nhật. Claude ghi bàn giao qua Issue/PR. Trạng thái nhận việc vẫn lấy từ GitHub.
- Nhánh ngắn: `claude/<số-issue>-<mô-tả>`, `ag/<số-issue>-<mô-tả>` hoặc `hermes/<số-issue>-<mô-tả>`; rebase lên `main` trước khi mở PR; PR < ~400 dòng thay đổi (không tính tệp sinh); **squash merge**.
- **Không ai đẩy thẳng lên `main`, kể cả từ máy cá nhân.** Quyết định ngày 13/11/2026: **không nâng GitHub Pro** (repo private trên gói Free không có branch protection [22]). Thay bằng ba lớp: CI `lane-guard` (§14.7), production chỉ deploy từ **tag** và workflow tag tự chạy lại toàn bộ kiểm thử (§14.8), chỉ chủ dự án tạo tag.

### 14.2 Phân lane theo thư mục (sở hữu chính)
| Lane | Agent chính | Thư mục sở hữu |
|---|---|---|
| **3D & trải nghiệm** | Claude | `apps/web/src/world.js, island.js, people.js, realm.js, birds.js, gfx.js, audio.js, music.js, sermon.js`, `apps/web/src/rt/` (client thời gian thực) |
| **Thời gian thực máy chủ** | Claude | `workers/realtime/` |
| **API, Auth, Dữ liệu** | Antigravity | `workers/api/`, `db/migrations/` (**độc quyền tạo migration**), `apps/web/src/net/` (client sync) |
| **Hạ tầng & CI** | Antigravity | `.github/workflows/`, `wrangler.jsonc` các Worker, `apps/android/` |
| **Dùng chung (tuần tự)** | Người tạo Issue chỉ định 1 agent | `packages/shared/` (Kusala, Tịnh danh, giao thức, schema), `apps/web/src/ui/`, `data.js`, `package.json` gốc |
| **Nội dung** | Người biên soạn + chủ dự án | `content/` (bài chia sẻ, chương trình các tầng; biên tập/phát hành qua PR) |
| **Vận hành, danh mục, giám sát** | Hermes | Biên soạn có nguồn trong `content/`, trạng thái phát hành theo Issue/PR; `ops/`, `docs/reports/` (§14.6) |

Thay đổi chạm lane khác → mở Issue cho lane đó hoặc ghi rõ trong PR và chờ lane đó xác nhận.

Codex nhận cả [AG] và [H] nhưng mỗi PR vẫn theo một làn; không ghép thay đổi API, vận hành và 3D vào cùng PR. Vùng dùng chung phải được Issue giao đích danh một người, có danh sách tệp và điều kiện trả quyền sửa; PR có `shared-ok`. Mỗi tác vụ dùng worktree/checkout riêng.

### 14.3 Điểm nóng xung đột và cách khóa
1. **File build trong repo:** ngừng commit `van-dao.html`, `dist/`, `public/`; bản HTML đơn để tải offline lấy từ GitHub Release do CI đính kèm.
2. **Lockfile:** commit `package-lock.json`, CI dùng `npm ci`. Xung đột lockfile → không sửa tay, chạy lại `npm install` sau khi rebase.
3. **`main.js` (465 dòng, ai cũng sửa):** tách ở GĐ0 thành `state.js`, `ui/panel.js`, `ui/creator.js`, `ui/journey.js`, `ui/account.js`, `boot.js`.
4. **Đánh số migration:** chỉ lane Dữ liệu tạo; CI kiểm số thứ tự liên tục, không trùng, không sửa tệp đã merge.
5. **Lớp Durable Object:** chỉ lane Thời gian thực sửa `migrations` trong `workers/realtime/wrangler.jsonc`.
6. **Xuống dòng:** thêm `.gitattributes` (`* text=auto eol=lf`) và `.editorconfig` — người dùng đẩy từ Windows.
7. **Hợp đồng trước, cài đặt sau:** schema API (`packages/shared/api.ts`) và codec giao thức (`packages/shared/rt-codec.js`) được merge **trước**; sau đó hai lane làm song song với dữ liệu giả (mock) theo cùng hợp đồng.
8. **Kiểm kết quả tích hợp:** trước khi đề nghị merge, cập nhật/rebase `main`, kiểm cả PR phụ thuộc và chạy lại bộ kiểm tra trên cây mã đã tích hợp. Git không báo conflict chưa chứng minh tương thích API, lược đồ, nội dung hay runtime. Khi `main` đổi phải kiểm lại; không sửa nhánh của agent khác. PR xếp chồng phải ghi rõ base và thứ tự merge.

### 14.4 Dòng chảy từ nhánh đến production
```
nhánh claude/*, ag/* hoặc hermes/*
   └─ PR ──▶ ci.yml: lane-guard · lint · unit (Vitest) · test Worker (vitest-pool-workers) · build + ngân sách kích thước
            · e2e khói (Playwright, WebGL headless) · kiểm migration
         └─ preview.yml: `wrangler preview --name pr-N` → URL preview bình luận vào PR [9b]
              (D1/KV riêng cho preview qua khối `previews` trong cấu hình [9])
   └─ squash merge vào main ──▶ deploy.yml: áp migration lên D1 staging → deploy `vandao-staging`
                                (tài khoản Cloudflare staging, `*.workers.dev`) → kiểm khói tự động
   └─ gắn tag vX.Y.Z ──▶ deploy.yml (production):
          0) chạy lại toàn bộ ci.yml trên đúng commit được gắn tag (§14.8)
          1) áp migration production (chỉ kiểu "mở rộng": thêm bảng/cột, không xóa)
          2) deploy realtime (nếu đổi) → deploy web/api
          3) kiểm khói; lỗi → `wrangler rollback`; dữ liệu → D1 Time Travel (7 ngày ở gói Free, 30 ngày ở gói Paid [1])
```
- Thay đổi phá vỡ lược đồ làm theo **mở rộng → chuyển → thu hẹp** qua 2 bản phát hành.
- Secret trong repo GitHub chỉ dùng cho nhánh/tag của repo này; workflow preview kiểm `head.repo == repository` trước khi dùng secret [9b].

### 14.5 Định nghĩa "Xong" (DoD) cho mọi PR
Build xanh · kiểm thử mới cho logic mới · không tăng kích thước HTML đơn quá 3 % nếu không giải thích · không phá invariants trong `CLAUDE.md` · preview đã được mở thử trên điện thoại · cập nhật tài liệu liên quan · commit có dòng ghi công của agent.

### 14.6 Làn Hermes (agent thứ ba)
- **Hermes Agent** (Nous Research) có:
  - bộ lập lịch cron chạy việc không cần người trực, gửi kết quả qua cổng nhắn tin (Telegram, Discord, Slack, WhatsApp, Signal, Email) [49];
  - hỗ trợ MCP để nối thêm công cụ [49b];
  - danh sách lệnh được phép theo mẫu duyệt [49c].
- Chạy trên máy chủ homelab của anh.

**Nhiệm vụ của Hermes:**

| Nhóm | Việc |
|---|---|
| Giám sát | Báo cáo hằng ngày: hạn mức Free/Paid (§3.3), lỗi 5xx, dung lượng D1, chi phí, PR đã merge khi CI đỏ |
| Đại Công Đức | Lấy ứng viên sản phẩm từ Shopee/TikTok/Woo, lọc sơ bộ danh mục cấm, mở PR vào `content/catalog/` hoặc gọi API quản trị chỉ ở mức "ứng viên"; soạn nháp Sổ Minh Bạch; nhắc đối tác nộp báo cáo; mở PR công bố `head_hash` vào repo ledger công khai |
| Cộng đồng | Tóm tắt báo cáo vi phạm và đề xuất xử lý (không tự xử lý) |
| Nội dung | Biên soạn lời nhắc và bài chia sẻ kèm nguồn → PR `content/`; phân biệt nháp với bản đã chọn phát hành, không đòi Hội đồng |
| Kiểm thử | Chạy kiểm thử tải (k6) và đo hiệu năng định kỳ vào **staging** |

**Không được:**
- sửa `apps/`, `workers/`, `db/`, `.github/`;
- tạo tag hay deploy;
- trả lời người dùng về giáo lý;
- chạm vào tiền.

**Quyền tối thiểu:**
- GitHub token chỉ cho repo này và repo ledger.
- Cloudflare API token chỉ đọc số liệu.
- Service token Cloudflare Access cho API quản trị, phạm vi "ứng viên/nháp".
- Danh sách lệnh được phép tối thiểu.
- Nhánh `hermes/<issue>-<mô-tả>`; nhãn Issue `lane:hermes`.

### 14.7 Lane-guard (thay branch protection)
- `.github/lanes.yml` (mẫu ở Phụ lục F) khai báo glob được phép cho từng tiền tố nhánh: `claude/`, `ag/`, `hermes/`, `hotfix/`, `owner/`.
- `scripts/lane-guard.mjs` chạy đầu tiên trong `ci.yml`:
  1. Đọc tiền tố nhánh nguồn.
  2. Lấy `git diff --name-only origin/main...HEAD`.
  3. Đánh đỏ CI khi có tệp ngoài làn.
- **Quy tắc kèm theo:**
  - Tệp thuộc vùng "dùng chung" chỉ qua được khi PR có nhãn `shared-ok`.
  - Migration mới chỉ được đến từ nhánh `ag/`.
  - Sửa migration đã merge luôn bị chặn.
- Quy ước merge: squash; không merge PR đỏ; Hermes báo cáo mọi vi phạm.

### 14.8 Tách local – preview – staging – production

| Môi trường | Kích hoạt | Worker | Dữ liệu | Người dùng |
|---|---|---|---|---|
| Local | `wrangler dev` | Miniflare | D1/KV/DO cục bộ + `db/seed/` | Từng agent, không chia sẻ |
| Preview | Mỗi PR | Preview Workers của Worker staging theo PR (§14.4) [9b] | Tài khoản staging; bindings khối `previews`: D1 `vandao-core-preview` [9] | Người duyệt PR |
| Staging | Merge vào `main` | `vandao-staging`, `vandao-realtime-staging` trên **tài khoản Cloudflare staging** (Free, riêng), URL `*.workers.dev` | D1 `vandao-core-staging`, KV/R2 staging | Thử nghiệm, Hermes kiểm thử tải |
| Production | Tag `vX.Y.Z` | `vandao`, `vandao-realtime` trên tài khoản Cloudflare hiện tại | D1 `vandao-core`… | Người dùng thật |

**Quy tắc vận hành:**
- `concurrency` trong GitHub Actions: nhóm `deploy-staging` và `deploy-production` (gồm cả bước migration) với `cancel-in-progress: false` → hai agent merge sát nhau thì bản sau xếp hàng, không deploy chồng (mẫu ở Phụ lục C).
- Workflow tag chạy lại lint, test, build, e2e **trước** migration/deploy → mã đỏ không thể lên production dù đã lỡ merge.
- **Hai tài khoản Cloudflare:** hạn mức gói Free tính theo tài khoản (ví dụ 100.000 yêu cầu Workers/ngày [27]). Nếu preview, staging và kiểm thử tải dùng chung tài khoản production thì chúng tiêu hạn mức của người dùng thật. Vì vậy preview/staging chạy trên một tài khoản Cloudflare thứ hai (Free); production giữ tài khoản hiện tại. Staging dùng `*.workers.dev` vì tên miền tùy chỉnh phải thuộc zone trong cùng tài khoản.
- **Secrets khi không có GitHub Pro:** repo private ở gói Free không tạo được GitHub Environments, nên không có secret theo môi trường [52]. Dùng secrets cấp repo, đặt tên theo môi trường: `CF_STAGING_API_TOKEN`/`CF_STAGING_ACCOUNT_ID` và `CF_PROD_API_TOKEN`/`CF_PROD_ACCOUNT_ID`. Token production chỉ có quyền tối thiểu (Workers Scripts, D1, KV, R2; không DNS, không cài đặt zone). Chỉ job production trong `deploy.yml` (chạy theo tag) tham chiếu `CF_PROD_*`.
- Secrets cấp repo về lý thuyết đọc được từ mọi workflow trong repo, nên thêm ba lớp: chỉ nhánh `ag/` được sửa `.github/` (lane-guard); Hermes báo cáo mọi thay đổi trong `.github/` hằng ngày; bật cảnh báo Audit Log của Cloudflare cho token production và xoay vòng token mỗi quý.
- Chỉ chủ dự án tạo tag; Claude hoặc Antigravity chỉ tạo tag khi Issue ghi rõ.
- **Hotfix:** nhánh `hotfix/*` từ tag → PR → merge → tag bản vá.
- **PR có migration mới:** tạo D1 tạm `vandao-pr-<N>` nếu hạn mức số CSDL cho phép và xóa khi đóng PR; nếu không đủ hạn mức thì kiểm migration bằng Vitest/D1 cục bộ, preview dùng lược đồ của `main`.

---

## 15. BẢO MẬT, QUYỀN RIÊNG TƯ, TUÂN THỦ

- **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 có hiệu lực từ 1/1/2026** [23], cùng Nghị định 356/2025/NĐ-CP (thay Nghị định 13) [23b]. Người dùng có quyền được biết, đồng ý, truy cập, chỉnh sửa và yêu cầu xóa dữ liệu [23c]. Đáp ứng bằng: điều khoản + đồng ý có phiên bản (`consent`), xuất dữ liệu, xóa tài khoản, nhật ký mặc định không lên máy chủ.
- Dữ liệu thực hành tu tập có thể bị xem là thể hiện **niềm tin tôn giáo** (thuộc nhóm nhạy cảm theo quy định trước đây) → cần luật sư xác nhận theo danh mục mới của Nghị định 356 trước khi mở đăng ký rộng; trong lúc chờ, áp dụng mức bảo vệ của dữ liệu nhạy cảm.
- Máy chủ: secret qua `wrangler secret`; truy vấn tham số hóa; kiểm đầu vào ở biên; tiêu đề CSP, HSTS, `Permissions-Policy`; không ghi email/nhật ký vào log; Analytics Engine chỉ nhận số liệu ẩn danh.
- Thời gian thực: vé HMAC 60 giây; chặn người bị chặn ngay trong DO; giới hạn tốc độ khung; báo cáo vi phạm có hàng chờ xử lý.
- Đánh giá theo OWASP ASVS mức 1 trước khi mở công khai (GĐ9).

### 15.1 Pháp lý cho cộng đồng và Đại Công Đức

| Văn bản | Ảnh hưởng | Thiết kế đáp ứng |
|---|---|---|
| Luật Quảng cáo sửa đổi 75/2025/QH15, hiệu lực 1/1/2026 [40] | Nội dung quảng cáo phải có dấu hiệu nhận diện rõ ràng | Nhãn "Liên kết tiếp thị" trên mọi sản phẩm; trang chính sách affiliate |
| Luật TMĐT 122/2025/QH15, hiệu lực 1/7/2026 [41][42] | Điều chỉnh tiếp thị liên kết; định nghĩa nền tảng trung gian [41b] | Xác thực danh tính với Shopee/TikTok; gỡ link vi phạm; chưa mở gian hàng thành viên (§11.3) |
| Nghị định 93/2021/NĐ-CP [43] | Cá nhân vận động từ thiện phải có tài khoản riêng theo từng cuộc vận động, công khai | Cấm gây quỹ cá nhân trên Bảng Hộ Trì; chỉ chiến dịch của đối tác; Vân Đạo không giữ tiền chiến dịch |
| Luật BVDLCN 91/2025/QH15 + NĐ 356/2025 [23][23b] | Đồng ý, quyền truy cập/xóa | Đánh giá tác động xử lý dữ liệu cho cộng đồng và Đại Công Đức; không lưu số tài khoản người gieo; lượt bấm affiliate không gắn danh tính |
| Chính sách thanh toán Google Play [39][39b] | Hạn chế thanh toán ngoài Play Billing trong app | Bản Play ẩn Gieo Duyên (§13.4) |

Mọi dòng trên cần luật sư/kế toán xác nhận trước GĐ6. Tài liệu này không phải tư vấn pháp lý.

---

## 16. QUẢN TRỊ NỘI DUNG TU HỌC

- **Quyết định chủ dự án 14/11/2026 (ADR 0003):** Vân Đạo hỗ trợ thực hành và chia sẻ tham khảo; không phải hoạt động thuyết pháp chính thức của chùa/tu viện. Hội đồng/chuyên gia là tư vấn tùy chọn, không là điều kiện hiển thị, phát âm thanh hay phát hành.
- Mọi bài giảng, bài thiền, chương trình tầng nằm trong `content/` (Markdown + front-matter: `id, version, tier, source_ref, status`) → CI nạp vào `content_item`/KV. `da_duyet` giữ làm tên kỹ thuật cho nội dung đã chọn phát hành qua quy trình biên tập/PR; không chứng nhận Hội đồng. `reviewed_by`/`reviewed_at` là truy vết tùy chọn, không bắt buộc ở client/công cụ nạp. Nháp/ẩn/ngừng không tự công khai.
- Bảy bài tóm lược cũ và các loạt mới được biên tập có nguồn, ghi rõ tóm lược bằng lời mới; có thể chọn phát hành qua PR mà không chờ thành lập Hội đồng hoặc biên bản duyệt riêng. Issue #53/PR #54 giữ loạt «Lời Phật dạy»; #47/#52 giữ thiết kế «Đường Xưa Mây Trắng».
- Giữ tab Thuyết giảng. Khi chưa có nội dung công khai, hiện "Chưa có bài chia sẻ. Nội dung đang được cập nhật."; lỗi tải có trạng thái thử lại riêng. Không dùng câu thiếu Hội đồng để khóa bài hoặc khẳng định mọi bài đã được Hội đồng duyệt.
- **Khung điều kiện mở tầng (đề xuất, chủ dự án quyết sau biên tập):**
  - 0 → 1: hoàn tất 49 ngày (đã có) + ≥ 30 thời thiền trọn + bài tự vấn cuối chương trình.
  - 1 → 2: hoàn tất chương trình Tầng 1 + đã dẫn dắt ≥ 3 người sơ nhập hoàn thành ít nhất tuần đầu.
  - 2 → 3: tham gia hoặc khởi xướng một nhóm đồng tu và hoàn thành mục tiêu chung.
  - 3 → 4: giữ vai trò điều phối nhóm sơ nhập trong một chu kỳ.
  - Điều kiện lưu ở dữ liệu nội dung (không viết cứng trong mã); giao diện chỉ nói "đã hoàn thành chương trình Tầng N", **không nói đã chứng đắc**.
- AI/Hermes có thể hỗ trợ biên soạn, tóm lược và giải thích có nguồn; phân biệt trích dẫn với lời biên soạn, không tự nhận là lời dạy chính thức hoặc xác nhận chứng đắc. Nội dung tham khảo không bị khóa vì thiếu Hội đồng; phát hành theo PR thông thường, không thêm vòng duyệt chuyên môn bắt buộc thay Hội đồng.

### 16.1 Tư vấn Pháp học tùy chọn
Theo quyết định chủ dự án, đề xuất lập Hội đồng trong tài liệu gốc chuyển thành tùy chọn. Có thể mời người am hiểu góp ý độc lập, không tham gia thương mại; không đặt việc mời/nhận lời hoặc hồ sơ duyệt thành đường găng. Các nội dung có thể tham vấn:
1. Biến thể nhiệm vụ Tầng 0 và ánh xạ Phước nghiệp sự/Ba-la-mật (§8.2).
2. Lời nhắc hệ thống của AI phản tỉnh (§8.5).
3. Điều kiện mở tầng.
4. Danh mục sản phẩm nhạy cảm về tâm linh trong Chánh Mạng Thị.
5. Câu chữ của lời nhắc và thông báo Tùy hỷ.

Hermes biên soạn có nguồn; nội dung được chọn phát hành qua Issue/PR thông thường. `da_duyet` chỉ là trạng thái công khai hiện có; không tự ghi dấu duyệt Hội đồng không có thật. Chủ dự án merge PR nội dung là quyết định phát hành, không đòi một lần phê duyệt chuyên môn riêng.

---

## 17. CÔNG NGHỆ & PHIÊN BẢN CHUẨN (mốc 13/11/2026)

| Thành phần | Phiên bản | Lý do / ghi chú |
|---|---|---|
| **Node.js** (CI, công cụ, build Android) | **26 LTS** (`.nvmrc` = 26, `engines.node` ≥ 26) | Vào Active LTS ngày 28/10/2026, hỗ trợ tới 30/4/2029 [16][26]. 26 là bản cuối theo lịch cũ; từ Node 27, mỗi năm một bản lớn phát hành tháng 4 và lên LTS tháng 10 [25]. Trong GĐ0 chạy thêm một job Node 24 để bắt lỗi tương thích, gỡ khi ổn |
| Wrangler | ^4, bản mới nhất | v3 chỉ còn vá bảo mật nghiêm trọng đến Q1/2027 [14]; cần ≥ 4.36 cho `ratelimits` [11] |
| GitHub Actions | `actions/checkout@v5+`, `actions/setup-node@v5+` (`node-version: 26`), `cloudflare/wrangler-action@v3` | Runner đã bỏ Node 20 từ 23/9/2026 [17] |
| `compatibility_date` | `2026-11-01`, cập nhật mỗi quý; cờ `nodejs_compat` | |
| three.js | r187 (đang dùng); nâng mỗi 1–2 bản có kiểm thử ảnh | Nhịp 8–11 tuần/bản trong 2026; r186 đã gỡ một số định dạng build cũ [24] |
| esbuild | 0.28.x | Giữ đóng gói nhanh, không thêm bundler nặng |
| Renderer | WebGL2 → WebGPURenderer + TSL ở GĐ7 | §12.4 |
| Hono | 4.x | Router nhẹ cho Workers |
| Better Auth | Bản stable mới nhất (v1.6 không còn là stable; v1.8 đang beta) [15] | Plugin `anonymous`, `passkey`, `bearer`, `emailOTP` (bật khi Paid) |
| Drizzle ORM + drizzle-kit | Mới nhất | Better Auth trên D1 cần Drizzle hoặc Kysely [15c] |
| Valibot | Mới nhất | Kiểm schema dùng chung client/máy chủ |
| Vitest + `@cloudflare/vitest-pool-workers` | Mới nhất | Kiểm thử trong runtime Workers |
| Playwright | Mới nhất | e2e khói, ảnh WebGL, đo `renderer.info` |
| Web Push | PushForge hoặc thư viện tương đương chỉ dùng Web Crypto [51] | Thư viện `web-push` gốc dùng API riêng của Node, không chạy trên Workers [51] |
| Capacitor | 8.x, `targetSdk 36` | Đáp ứng yêu cầu API 36 của Play [18][19] |
| Bubblewrap (dự phòng TWA) | 1.27+ | [20b] |

**Lịch nâng cấp dài hạn** (Renovate mở PR):
- Bản vá: hằng tuần.
- Bản nhỏ: hằng tháng.
- `compatibility_date`: mỗi quý.
- `targetSdk` Android: mỗi tháng 8.
- Node: sang Node 28 LTS vào quý 4/2028 (Node 26 hết hạn 4/2029).

---

## 18. CẤU TRÚC REPO ĐÍCH (npm workspaces)

```
Buddha/
├── AGENTS.md                  # luật chung mọi agent (≤ 12.000 ký tự)
├── CLAUDE.md                  # @AGENTS.md + phần riêng Claude
├── PROJECT_ROADMAP.md         # tài liệu này
├── .nvmrc  .gitattributes  .editorconfig  package.json  package-lock.json
├── .github/
│   ├── lanes.yml              # làn sở hữu (Phụ lục F)
│   └── workflows/             # ci.yml · preview.yml · deploy.yml · android.yml
├── scripts/                   # lane-guard.mjs, check-migrations.mjs, size-budget.mjs
├── docs/                      # thiết kế, ADR, runbook, reports/ (Hermes)
├── content/                   # nội dung có nguồn, trạng thái biên tập/phát hành
│   ├── program/so-nhap-49/    # biến thể nhiệm vụ Tầng 0
│   ├── sermons/  reminders/
│   └── catalog/               # sản phẩm Chánh Mạng Thị (ứng viên/đã duyệt)
├── ops/                       # cấu hình Hermes, kịch bản k6
├── apps/
│   ├── web/src/
│   │   ├── world.js island.js people.js realm.js birds.js gfx.js audio.js music.js sermon.js   # 3D & âm thanh (Claude)
│   │   ├── cong-duc/          # đảo Đại Công Đức Viên (Claude)
│   │   ├── rt/                # client thời gian thực (Claude)
│   │   ├── net/               # sync, IndexedDB, push (Antigravity)
│   │   ├── ui/                # panel, creator, journey, account, help, cong-duc (dùng chung)
│   │   └── boot.js state.js data.js
│   └── android/               # Capacitor 8 (Antigravity)
├── workers/
│   ├── api/src/               # auth/ sync/ practice/ reminders/ community/ congduc/ admin/ hooks/ (Antigravity)
│   └── realtime/src/          # lobby.js hall.js island.js group.js reminder-clock.js (Claude)
├── packages/shared/           # kusala.js tinh-danh.js schedule.js variant.js amlich.js parami.js stats.js
│                              # policy.js (danh mục cấm) api.ts rt-codec.js schemas.js
├── db/migrations/  db/seed/
└── tests/e2e/  tests/load/
```

Dời `van-dao-src/` sang `apps/web/` bằng **một PR duy nhất** (`git mv`, không đổi nội dung), làm lúc không có nhánh nào đang mở.

---

## 19. KẾ HOẠCH THEO GIAI ĐOẠN VÀ NHIỆM VỤ CHO TỪNG AGENT

Ký hiệu: **[C]** Claude · **[AG]** Antigravity · **[H]** Hermes · **[O]** chủ dự án. Thời lượng là ước lượng. Mỗi giai đoạn kết thúc bằng một tag; mỗi nhiệm vụ là một Issue có phạm vi thư mục khớp `lanes.yml`.

### 19.1 Sẵn sàng GĐ0 (phải xong trước khi mở nhánh đầu tiên)
- [O] Duyệt tài liệu này; tạo nhãn Issue `lane:claude`, `lane:antigravity`, `lane:hermes`, `lane:owner`, `status:claimed`, `shared-ok`, `gd0` … `gd10` — **xong 13/11/2026**.
- [O] Tạo tài khoản Cloudflare thứ hai (Free) cho preview/staging; tạo hai API token quyền tối thiểu và lưu thành secrets cấp repo `CF_STAGING_*`, `CF_PROD_*` (§14.8). Không dùng GitHub Environments vì repo private gói Free không hỗ trợ [52]. Secrets nhập qua giao diện web GitHub, vì proxy của phiên agent chặn API secrets.
- [O] Xác nhận cả hai tài khoản Cloudflare đang ở gói Free; nâng riêng tài khoản production khi chạm ngưỡng §3.3.
- [O] Ngừng đẩy thẳng lên `main`; từ đây mọi thay đổi qua nhánh + PR. Từ 13/11/2026: workflow chỉ build khi PR/push `main`, production chỉ deploy khi gắn tag `v*`; hook `pre-push` trên máy chủ dự án chặn đẩy thẳng `main` (`scripts/hooks/pre-push`, cài bằng `git config core.hooksPath scripts/hooks`).
- [O] Bắt đầu song song các việc không phải mã theo các Issue `lane:owner`: hồ sơ pháp nhân Opalina, tài khoản affiliate/cổng xác nhận chuyển khoản, tài khoản Google Play tổ chức. Tư vấn Pháp học tùy chọn, không chặn GĐ3.
- [O] Gắn tag `v0.10.0` cho `main` (commit `d3489d5`) làm điểm rollback — **xong 13/11/2026**. [AG] đóng hoặc merge các nhánh và thay đổi còn treo trước T0.1.

### GĐ0 — Nền móng repo, CI, Node 26 (≈ 1–1,5 tuần)

| ID | Việc | Làn | Nghiệm thu |
|---|---|---|---|
| T0.1 | PR đóng băng: `git mv van-dao-src apps/web` và sửa đường dẫn trong `deploy.yml` hiện tại cùng PR; workspaces; `.gitattributes` (`* text=auto eol=lf`), `.editorconfig`, `.nvmrc` 26; commit `package-lock.json`; ngừng commit `van-dao.html`, `dist/`, `public/` | AG | `npm ci && npm run build` sạch trên Linux và Windows |
| T0.2 | `.github/lanes.yml` (Phụ lục F), `scripts/lane-guard.mjs`, mẫu PR/Issue; `ci.yml`: lane-guard → lint → Vitest → build 3 đích + ngân sách kích thước → kiểm migration → Playwright khói + đo `renderer.info`; ma trận Node 26 (+ job Node 24 tạm) | AG | PR mẫu đỏ khi sửa tệp ngoài làn; xanh khi đúng |
| T0.3 | `preview.yml` (preview alias theo PR), `deploy.yml` (staging khi merge, production khi tag, `concurrency`), Wrangler 4, actions v5+ | AG | PR có URL preview; merge lên staging; tag `v0.11.0` lên production |
| T0.4 | Tài nguyên trên **tài khoản staging**: Worker `vandao-staging`/`vandao-realtime-staging`, D1 `vandao-core-staging`/`-preview`, KV, R2; khối `env.staging` trong Wrangler (Phụ lục B) | AG | `wrangler whoami`/`d1 list` của từng tài khoản khớp bảng §14.8 |
| T0.5 | Tách `main.js` → `boot.js`, `state.js`, `ui/*.js`; tạo `packages/shared` (kusala, tinh-danh, schedule/zones, amlich, parami) + Vitest | C | Ảnh `shot.mjs` trước/sau giống nhau; kiểm thử công thức, tên, âm lịch xanh |
| T0.6 | `AGENTS.md`, rút gọn `CLAUDE.md` (`@AGENTS.md`), chi tiết luật chuyển vào `docs/` | C | Antigravity và Hermes đọc cùng bộ luật; `AGENTS.md` ≤ 12.000 ký tự |
| T0.7 | Hermes: skill `vandao-ops` (đọc số liệu Cloudflare, GitHub Issues/PR), báo cáo sáng qua Telegram; thư mục `ops/` | H | Có 3 báo cáo liên tiếp; không token nào có quyền ghi Worker |

### GĐ1 — PWA, offline-first, hiệu năng 3D đợt 1 (≈ 2 tuần)
| ID | Việc | Làn | Nghiệm thu |
|---|---|---|---|
| T1.1 | Đích build `single`/`web`/`android`; service worker; IndexedDB + `outbox`; `storage.persist()`; chuyển `vandao.v1` | C | Tắt mạng vẫn mở app và ngồi đủ 15 phút; dữ liệu cũ chuyển đủ |
| T1.2 | Tối ưu WebGL (§12.3) | C | Mức chất lượng mobile đạt ngân sách §12.2 trong đo tự động |
| T1.3 | Lighthouse CI, Web Analytics, Analytics Engine (FPS) | AG | Số liệu hiện trên staging |
| T1.4 | Đo trên máy thật hằng tuần (thiết bị của anh qua Playwright/ADB hoặc thủ công) và báo cáo | H | Báo cáo FPS 3 máy |

### GĐ2 — API, D1, tài khoản, đồng bộ (≈ 2–3 tuần)
| ID | Việc | Làn | Nghiệm thu |
|---|---|---|---|
| T2.1 | `workers/api`: Hono, Better Auth (anonymous, passkey, Google, bearer; emailOTP sau cờ), Drizzle, migration 0001–0005 | AG | Kiểm thử vitest-pool-workers xanh |
| T2.2 | `/me`, `/sync`, `/profile`, `/export`, xóa tài khoản; QR liên kết thiết bị; mã khôi phục; Turnstile; ratelimits | AG | Bất biến khóa ngày đúng khi chỉnh giờ máy; E máy chủ = E client |
| T2.3 | Client sync, màn "Giữ hành trình"/"Tôi đã có hành trình", trang Tài khoản, xử lý xung đột chu kỳ | C | Điện thoại → máy tính khôi phục nhân vật < 10 giây |
| T2.4 | Theo dõi hạn mức Free hằng ngày, cảnh báo ở 70 % | H | Báo cáo đúng số so với dashboard Cloudflare |

### GĐ3 — Tầng 0 chuẩn Pháp hành, theo dõi, nhắc nhở (≈ 3 tuần)
**Kiểm toán 18/11/2026 — chưa hoàn tất GĐ3.** Base main `4e84324`, v0.17.1 đã deploy production; CI [44002540504](https://github.com/tnfsmith/Buddha/actions/runs/44002540504), staging [44004041369](https://github.com/tnfsmith/Buddha/actions/runs/44004041369), production [44005737082](https://github.com/tnfsmith/Buddha/actions/runs/44005737082) xanh. API staging/production đã đối chiếu: 42 bài giảng/nghi thức + 73 nhiệm vụ. Phân biệt mã đã có với tiêu chí chưa nghiệm thu; không lấy thư viện TTS hoặc việc đóng PR làm bằng chứng xong cả pha.

| ID | Việc | Làn | Nghiệm thu |
|---|---|---|---|
| T3.1 | Nội dung biến thể 7 tuần × 3 trục × 3–6 biến thể; ánh xạ §8.2; lời nhắc | O + H | **Một phần:** 73 mục #87/#90 đã duyệt/phát hành (25/40/7/1). Hợp đồng [#112](https://github.com/tnfsmith/Buddha/pull/112) đã merge, tiếp theo là bộ nạp và tối thiểu 63 biến thể ở [#103](https://github.com/tnfsmith/Buddha/issues/103). Chủ dự án chọn phát hành nội dung |
| T3.2 | `variant.js`, Duyên khởi, Bia (hoa sen/lịch/nhịp thiền/phản tỉnh), chứng thực tuần | C | **Một phần:** A/C #89/#92 và đồng bộ #96 đã merge; thiếu onboarding/biến thể/phản tỉnh/chứng thực tuần/E phản chiếu. [#104](https://github.com/tnfsmith/Buddha/issues/104); #101 là cảnh 3D, chưa thay phần chức năng này |
| T3.3 | Schema; API practice/deeds/attest/reminders/push; ReminderClock/Web Push | AG (DO: C) | **Một phần:** 0009 + practice.event/#97/#100 đã phát hành. Nền 0010 ở staging qua #109. Hợp đồng #111 đã merge, Codex triển khai GET/PUT hồ sơ và vòng đời ở [#105](https://github.com/tnfsmith/Buddha/issues/105). Còn today/swap/summary, deed, chứng thực, nhắc giờ và push. Claude làm DO [#106](https://github.com/tnfsmith/Buddha/issues/106) |
| T3.4 | Điều kiện Tầng 0 → 1, `tier_progress` | AG + C | **Mới có bảng:** chưa có cổng máy chủ/UI theo tiêu chí đã chốt; S.completed hiện chưa thay tier_progress. [#107](https://github.com/tnfsmith/Buddha/issues/107), chốt đề xuất §8.6/§16 trước; không nói chứng đắc |
| T3.5 | Thiết kế hai loạt và hợp đồng nội dung/giọng đọc R2 (ADR 0002, #47/#52) | C | **Đã merge/phát hành:** #52/#72 và điều chỉnh nghi thức đã vào main, hợp đồng áp dụng cho 42 mục hiện hành |
| T3.6 | 7 Lời Phật dạy v2/96k; 33 Đường Xưa B10/#76, C11/#77, D12/#78 | H + O | **Đã phát hành:** #76–78 đã merge, v0.16.0 có đủ 33/498 cue; hiện v0.17.1 API thật 7+33 bài và 2 nghi thức. Chủ dự án đã chọn cả 33 bài; giữ nguồn/chương/thứ tự và sáu cờ ASR gốc |
| T3.7 | Google Chirp 3 HD Sadaltager 0,85 cho Lời Phật dạy/Đường Xưa; ngoại lệ nghi thức kết P1/Puck 1,00 đã duyệt (#49/#80) | H + AG | **Đạt bản phát hành:** LINEAR16→MP3 96k mono 24k, −16 LUFS/−1,5 dBTP, cues/ID3; khóa/giọng/tốc độ theo mục. Khóa cũ ≥30 ngày còn theo dõi ở #49, không đổi giọng chung |
| T3.8 | Nạp D1, API body_r2_key/meta, /media Range; guard schema | AG | Nạp và phục vụ 115 mục đang chạy. Rút bài qua phiên bản `ngung` của [#46](https://github.com/tnfsmith/Buddha/issues/46) đã qua kiểm D1/R2, preview và điện thoại thật, merge [#110](https://github.com/tnfsmith/Buddha/pull/110) vào `c9edcaa`. Theo dõi triển khai từ main trước khi ghi nhận phát hành |
| T3.9 | Menu/cues/mobile/nghe lần lượt, nghi thức/đảnh lễ, kiểm live | C | **Đã phát hành:** #81/#82/#84 đã merge, #83 đóng; v0.16.0 đã được Claude/chủ dự án nghiệm thu ([#33](https://github.com/tnfsmith/Buddha/issues/33#issuecomment-6893229532)). #101 chưa merge, thay máy quay cần nghiệm thu riêng; không dùng số của PR đó cho main |

T3.7 đã đạt bộ audio phát hành (Sadaltager/Puck đúng ngoại lệ); #49 còn quản lý khóa cũ sau ≥30 ngày, là việc vận hành tiếp diễn. #3 là tư vấn tùy chọn, không là cửa chặn. #85 giữ mở cho các phần chưa xong; #93 chờ Claude ghi chốt nghiệm thu hai thiết bị thật.

### GĐ4 — Đại Thiền Đường thời gian thực (≈ 2–3 tuần)
**Chưa hoàn tất/chưa chuyển pha thay cho GĐ3.** Checklist [#108](https://github.com/tnfsmith/Buddha/issues/108). Có thể chuẩn bị hợp đồng độc lập theo song song hóa cuối §19; đợt này Codex ưu tiên phần GĐ3 còn thiếu. Quyền tệp/luân chuyển theo COORDINATION §19.
| ID | Việc | Làn | Nghiệm thu |
|---|---|---|---|
| T4.1 | `workers/realtime`: Lobby, HallRoom, codec 16 byte, hibernation, Free budget | C | **Chưa có worker trên main**; duyệt/merge hợp đồng ticket/room/codec trước, rồi kiểm §7.6 |
| T4.2 | Đám đông thật, nội suy, reconnect, fallback | C | **Mới mô phỏng cảnh**; chưa nối người thật; cần ≥30 fps/150 người trên máy tầm trung |
| T4.3 | `/rt/ticket`, chặn/báo cáo, số liệu shard | AG | **Có vé HMAC nền**, chưa khép quyền phòng/kiểm tầng/block/report/shard metrics; cần T4.1/T3.4 và kiểm người bị chặn không thấy nhau |
| T4.4 | Kịch bản k6 vào staging | H | **Chưa có báo cáo tải**; chỉ chạy staging sau worker, nêu budget/giới hạn trước, ghi p95/lỗi/thời lượng DO |

### GĐ5 — Cộng đồng Hộ Trì và xã hội tu tập (≈ 3 tuần)
| ID | Việc | Làn | Nghiệm thu |
|---|---|---|---|
| T5.1 | Migration mới kế tiếp; API help/events/moderation; Llama Guard; Cloudflare Access cho `/admin` | AG | Bài vi phạm mẫu bị giữ lại; tài khoản mới phải qua duyệt |
| T5.2 | UI Bảng Hộ Trì ở Cổng Vân Môn, sự kiện, đồng tu, thăm đảo (IslandRoom), nhóm, phòng nhóm | C | Hai người thật thăm đảo nhau, cùng an tọa |
| T5.3 | Tóm tắt kiểm duyệt hằng ngày; xác minh đối tác sự kiện | H + O | Không việc kiểm duyệt nào tồn quá 24 giờ |

**Đợt 5A — Bạn đồng tu (§10.4, #121).** Không cần thời gian thực hay kiểm duyệt nên bắt đầu sớm, song song GĐ4: Codex sau #105, Claude sau #104. Hai bên không sửa chung tệp.

| ID | Việc | Làn | Nghiệm thu |
|---|---|---|---|
| T5.4 | Thiết kế trải nghiệm, hợp đồng D1/API, luật dùng chung `dong-tu.js` + kiểm thử | C | Codex duyệt hợp đồng; gộp trước T5.5–T5.8 |
| T5.5 | Migration kế tiếp (`companion` thêm cột, `presence`, `meet_invite`, `island_visit`); API liên kết/tìm/đồng ý/thân thiết/hiện diện/mời gặp/ghé khi vắng/chặn; xuất/xóa | AG | Đủ 9 nhóm ca ở hợp đồng §6 trên D1 cục bộ |
| T5.6 | `apps/web/src/net/dong-tu.js`: gọi API, nhịp hiện diện, đọc `#ban=`, đẩy cài đặt riêng tư/Nghênh khách lên hồ sơ, đọc `me.social` | AG | Kiểm thử với máy chủ giả; không gửi khi chưa có tài khoản hoặc `dong_tu` chưa bật |
| T5.7 | UI: nút Bạn đồng tu, danh sách + trạng thái, Mời bạn tu cùng (QR), thẻ lời mời, thẻ bạn, cài đặt riêng tư | C | E2E hai thiết bị: kết bạn bằng liên kết, mời thiền, cùng đếm ngược; giao diện điện thoại ≤ 44vh |
| T5.8 | 3D: đảo bạn thật gần đảo mình (thân thiết/quen biết), đèn hiện diện, ghé thăm/ghé khi vắng, cùng ngồi, Trà Đạo hai người | C | `perf.spec.js` trong ngân sách §12.2; e2e ghé thăm, cùng ngồi |
| T5.9 | Thử với bạn thật; xác nhận các mặc định ở thiết kế §9 | O | Hai người thật kết bạn và cùng ngồi một thời thiền |

### GĐ6 — Đại Công Đức (≈ 3 tuần; chỉ mở khi xong các việc pháp lý của [O])
| ID | Việc | Làn | Nghiệm thu |
|---|---|---|---|
| T6.1 | Migration mới kế tiếp; danh mục, `/go/{id}`, connector Shopee (GraphQL HMAC) và WooCommerce REST, TikTok nếu được cấp quyền; nhập báo cáo chuyển đổi | AG | Link có subId; không lộ danh tính người bấm |
| T6.2 | `/gieo/intent`, webhook cổng chuyển khoản (chữ ký, chống trùng, đối soát), chiến dịch, pledge, sổ cái băm chuỗi + Workflows duyệt | AG | Webhook gửi lại 3 lần chỉ ghi 1 dòng; chuỗi hash kiểm lại được |
| T6.3 | Đảo Đại Công Đức Viên (4 gian), UI danh mục, Gieo Duyên (VietQR), Bia Minh Bạch; ẩn Gieo trên bản Play | C | Không thấy từ camera Đại Thiền Đường; nhãn affiliate luôn hiện |
| T6.4 | Pipeline ứng viên sản phẩm, nháp Sổ Minh Bạch, PR `head_hash` vào repo ledger công khai | H | Không sản phẩm nào lên `hien` mà thiếu người duyệt |
| T6.5 | Pháp nhân DNXH, tài khoản affiliate, tài khoản ngân hàng + cổng xác nhận, chính sách affiliate/Gieo, ý kiến luật sư/kế toán | O | Có văn bản |

### GĐ7 — 3D đợt 2: WebGPURenderer + TSL (≈ 2–3 tuần; làm song song từ sau GĐ1)
| ID | Việc | Làn | Nghiệm thu |
|---|---|---|---|
| T7.1 | Port ~15 shader sang TSL, `RenderPipeline`, cờ `?r=webgpu` | C | Ảnh so khớp; số đo không kém WebGL |
| T7.2 | Đổi mặc định sang WebGPU khi đạt trên ma trận thiết bị | C + O | WebGL2 vẫn chạy cho máy không có WebGPU |

### GĐ8 — Android (≈ 1–2 tuần; bắt đầu được sau GĐ2)
| ID | Việc | Làn | Nghiệm thu |
|---|---|---|---|
| T8.1 | Capacitor 8, đích `android`, bearer auth, keep-awake, LocalNotifications, `android.yml` ký APK/AAB | AG | Cài APK trên Android 10–16; AAB được Play chấp nhận (API 36) |
| T8.2 | Ẩn Gieo Duyên trên bản Play; App Links `assetlinks.json` | AG + C | Duyệt Internal testing |

### GĐ9 — Gia cố và ra mắt (≈ 2 tuần)
- Tải 2.000 kết nối; đánh giá ASVS L1; điều khoản, chính sách dữ liệu, đánh giá tác động xử lý dữ liệu; bảng theo dõi và cảnh báo.
- Xuất D1 hằng tuần sang R2 (ngoài Time Travel); diễn tập khôi phục; runbook sự cố.
- Khả năng tiếp cận; ngân sách hiệu năng trên máy thật; beta kín → công khai.

### GĐ10 — Sau ra mắt
iOS (Capacitor), sự kiện hồi hướng chung ngày rằm, gian hàng thành viên (giai đoạn B của §11.3, cần luật sư), tra cứu kinh có trích dẫn, xác thực thời thiền bằng nhịp thở trên máy, phân vùng dữ liệu khi vượt ngưỡng §4.4.

**Song song hóa:** GĐ0 (tuần tự) → (GĐ1 ∥ GĐ2) → (GĐ3 ∥ GĐ4 ∥ GĐ8) → (GĐ5 ∥ GĐ7) → GĐ6 → GĐ9. Riêng đợt 5A Bạn đồng tu (T5.4–T5.9) chạy cùng GĐ4 vì chỉ cần GĐ2. Việc pháp lý của [O] chạy song song từ ngày đầu vì GĐ6 phụ thuộc vào nó.

**Đánh số migration thực tế (18/11/2026):** main `da45e04` có 0001–0010 sau #109. Production v0.17.1 dùng 0001–0009. Số 0006/0007 trong ví dụ §4.6 đã dùng cho auth/recovery. Kiểm origin/main trước khi tạo migration và giữ nguyên migration đã merge.

---

## 20. VẬN HÀNH & QUAN SÁT

| Chỉ số (SLO) | Mục tiêu |
|---|---|
| API sẵn sàng | ≥ 99,9 %/tháng |
| Đồng bộ thành công | ≥ 99,5 % lượt sync |
| Vào phòng thời gian thực | ≥ 99 % trong < 2 giây |
| Lỗi JS phía client | < 0,5 % phiên |

- Bật `observability` cho cả hai Worker; Analytics Engine ghi: thời thiền hoàn tất, lỗi sync theo mã, FPS theo nhóm máy, số người mỗi shard.
- Cảnh báo: tỉ lệ lỗi 5xx, D1 > 6 GB, chi phí DO tăng bất thường, OTP gửi tăng đột biến (dấu hiệu lạm dụng).
- Runbook: rollback Worker, khôi phục D1 bằng Time Travel, tắt tính năng bằng cờ KV, khóa đăng ký khi bị spam.

**Bổ sung bản 3:**
- Bảng hạn mức Free (§3.3): Hermes báo mỗi sáng, cảnh báo ở 70 %.
- Chỉ số Đại Công Đức: webhook lỗi, đối soát lệch, sản phẩm có link hỏng.
- Sổ cái tác động: kiểm lại chuỗi hash mỗi đêm; phát hiện sai lệch → khóa ghi và báo động.

---

## 21. QUYẾT ĐỊNH ĐÃ CHỐT, QUYẾT ĐỊNH CẦN ANH CHỐT, RỦI RO

**Đã chốt (13/11/2026):**
- Không nâng GitHub Pro; production deploy theo tag.
- Dùng gói Workers Free trước, nâng Paid theo ngưỡng §3.3.
- Node.js 26 LTS.
- Có làn thứ ba cho Hermes.
- Pháp nhân vận hành: Công ty TNHH Opalina Kim Bảo (§11.1).
- Preview/staging chạy trên tài khoản Cloudflare thứ hai (Free) để không tiêu hạn mức của production.

| # | Cần chốt | Đề xuất |
|---|---|---|
| 1 | Pháp nhân cho Đại Công Đức | **Đã chốt:** Công ty TNHH Opalina Kim Bảo (§11.1); đăng ký tư cách DNXH là tùy chọn vì ràng buộc cả công ty |
| 2 | Tỉ lệ phân bổ thặng dư | 2/4 nền tảng · ¼ Quỹ Phụng Sự · ¼ dự phòng (§11.1) |
| 3 | Tư vấn Pháp học | Tùy chọn theo quyết định chủ dự án 14/11/2026, không là điều kiện GĐ3/phát hành |
| 4 | Người trực kiểm duyệt cộng đồng | Cần trước GĐ5 |
| 5 | Cổng xác nhận chuyển khoản | payOS hoặc Casso/SePay (chọn theo ngân hàng của pháp nhân) |
| 6 | TikTok Shop Affiliate API ở VN | Đăng ký; chưa có thì nhập link thủ công |
| 7 | Gieo Duyên trên Android | Ẩn ở bản Play cho tới khi có kết luận chính sách |
| 8 | Repo ledger công khai | `tnfsmith/vandao-ledger` |
| 9 | Đồng bộ nhật ký quán chiếu | Mặc định tắt |
| 10 | `appId` Android | `com.ainextbrain.vandao` |
| 11 | Hạ tầng Proxmox trước đây | Không cần cho kiến trúc này; Hermes chạy trên homelab |

**Rủi ro chính:**
- Email Sending còn beta và chỉ có ở gói Paid [12] — đã có đăng nhập không cần email (§6.4).
- D1 xử lý tuần tự [1] — giữ truy vấn ngắn, ghi theo lô.
- Điện thoại yếu với cảnh 3D — có ngân sách hiệu năng và chế độ tiết kiệm.
- Nội dung tham khảo sai lệch — nguồn rõ ràng, biên tập, phản hồi và sửa/rút bài theo §16; tư vấn chuyên gia tùy chọn.
- Lừa đảo hoặc gây quỹ trá hình trong cộng đồng — cấm gây quỹ cá nhân, kiểm duyệt ba lớp.
- Tranh cãi về "thương mại hóa" — tách không gian, công khai Sổ Minh Bạch, không cộng điểm theo tiền.
- Chính sách affiliate của sàn thay đổi — nguồn hàng đa dạng, có Woo của doanh nghiệp.

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

---

## PHỤ LỤC B — Mẫu cấu hình Wrangler

`workers/api/wrangler.jsonc`
```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "vandao",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-01",
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
  "env": { "staging": { "name": "vandao-staging", "workers_dev": true, "routes": [],
    "d1_databases": [{ "binding": "DB", "database_name": "vandao-core-staging", "database_id": "<id-staging>",
                       "migrations_dir": "../../db/migrations" }],
    "kv_namespaces": [{ "binding": "CONFIG", "id": "<id-staging>" }],
    "durable_objects": { "bindings": [
      { "name": "LOBBY",  "class_name": "Lobby",      "script_name": "vandao-realtime-staging" },
      { "name": "HALL",   "class_name": "HallRoom",   "script_name": "vandao-realtime-staging" },
      { "name": "ISLAND", "class_name": "IslandRoom", "script_name": "vandao-realtime-staging" } ] } } }
}
```
Lưu ý:
- `period` của rate limit chỉ nhận 10 hoặc 60 giây; giới hạn "3 mã/10 phút/email" phải đếm thêm trong D1/KV.
- Khối `env.staging` phải khai báo lại các binding (binding không kế thừa từ cấu hình gốc); tài khoản đích do biến `CLOUDFLARE_ACCOUNT_ID` của job CI quyết định (§14.8).
- Khi còn gói Free: bỏ `send_email` (chỉ có ở gói Paid [12]); kiểm lại từng binding với bảng §3.3 trước khi deploy.

`workers/realtime/wrangler.jsonc`
```jsonc
{
  "name": "vandao-realtime",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-01",
  "workers_dev": false,
  "durable_objects": { "bindings": [
    { "name": "LOBBY", "class_name": "Lobby" },
    { "name": "HALL", "class_name": "HallRoom" },
    { "name": "ISLAND", "class_name": "IslandRoom" } ] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Lobby", "HallRoom", "IslandRoom"] }],
  "observability": { "enabled": true },
  "env": { "staging": { "name": "vandao-realtime-staging",
    "durable_objects": { "bindings": [
      { "name": "LOBBY", "class_name": "Lobby" },
      { "name": "HALL", "class_name": "HallRoom" },
      { "name": "ISLAND", "class_name": "IslandRoom" } ] } } }
}
```

---

## PHỤ LỤC C — Khung `ci.yml` / `deploy.yml`

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request: {}
  push: { branches: [main] }
  workflow_call: {}                               # deploy.yml gọi lại khi gắn tag
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  check:
    runs-on: ubuntu-latest
    strategy: { matrix: { node: [26, 24] } }      # job Node 24 chỉ giữ trong GĐ0 để bắt lỗi tương thích
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }                  # lane-guard cần lịch sử để so với main
      - uses: actions/setup-node@v5
        with: { node-version: ${{ matrix.node }}, cache: npm }
      - run: npm ci
      - name: Lane-guard (§14.7)
        if: github.event_name == 'pull_request'
        run: node scripts/lane-guard.mjs
        env:                                      # truyền qua env, không nội suy thẳng vào lệnh
          BASE_REF: ${{ github.base_ref }}
          HEAD_REF: ${{ github.head_ref }}
          PR_LABELS: ${{ toJson(github.event.pull_request.labels.*.name) }}
      - run: npm run lint && npm test            # Vitest: shared + workers (vitest-pool-workers)
      - run: npm run build                        # cả 3 đích; kiểm ngân sách kích thước
      - run: npm run check:migrations             # số thứ tự liên tục, không sửa tệp cũ
      - run: npx playwright install --with-deps chromium && npm run e2e:smoke
```
```yaml
# .github/workflows/deploy.yml (rút gọn)
name: deploy
on:
  push: { branches: [main], tags: ['v*'] }
jobs:
  staging:                                        # merge vào main → tài khoản Cloudflare staging
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    concurrency: { group: deploy-staging, cancel-in-progress: false }   # bản sau xếp hàng, không hủy bản đang chạy
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CF_STAGING_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_STAGING_ACCOUNT_ID }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 26, cache: npm }
      - run: npm ci && npm run build
      - run: npx wrangler d1 migrations apply vandao-core-staging --remote --env staging
        working-directory: workers/api
      - run: |
          (cd workers/realtime && npx wrangler deploy --env staging)
          (cd workers/api && npx wrangler deploy --env staging)
      - run: npm run e2e:smoke -- --base-url=https://vandao-staging.<tai-khoan-staging>.workers.dev

  verify:                                         # tag: chạy lại toàn bộ kiểm thử trên đúng commit được gắn tag
    if: startsWith(github.ref, 'refs/tags/v')
    uses: ./.github/workflows/ci.yml

  production:                                     # chỉ job này tham chiếu CF_PROD_*
    needs: [verify]
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    concurrency: { group: deploy-production, cancel-in-progress: false }
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CF_PROD_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_PROD_ACCOUNT_ID }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 26, cache: npm }
      - run: npm ci && npm run build
      - name: Migrate D1 (chỉ kiểu mở rộng)
        run: npx wrangler d1 migrations apply vandao-core --remote
        working-directory: workers/api
      - name: Deploy realtime → api/web
        run: |
          (cd workers/realtime && npx wrangler deploy)
          (cd workers/api && npx wrangler deploy)
      - run: npm run e2e:smoke -- --base-url=https://vandao.ainextbrain.com
```
(Không dùng khóa `environment:` vì repo private gói Free không có GitHub Environments [52]. Staging dùng D1 `vandao-core-staging` và Worker `vandao-realtime-staging` khai báo trong `env.staging` (Phụ lục B). Preview PR theo mẫu chính thức của Cloudflare [9b], dùng secrets staging. Lỗi sau deploy → `wrangler rollback`; dữ liệu → D1 Time Travel.)

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
        with: { node-version: 26, cache: npm }
      - uses: actions/setup-java@v5          # major mới nhất (runtime Node 24 của Actions)
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

---

## PHỤ LỤC E — Bảng tra nhanh hằng số luật tu tập (phải giống nhau ở client và máy chủ)
- Kusala: `E = base × (pre + during + post)/3 × (wise ? 1,5 : 1) × (self ? 1,25 : 1)`, `base = 10`, `pre/during/post ∈ [0,5; 1,2]`, làm tròn 2 chữ số.
- Tiến ngày: `last_done_on < hôm nay` **và** đủ `duc`, `thien`, `tue` của ngày hiện tại; ngày 49 đủ 3 trục → hoàn tất chương trình.
- Phân khu mở theo `ZONES[].unlock` (Trà Đạo ngày 15; Cổng Vân Môn nửa mở ngày 29, mở hẳn ngày 43).
- Thời thiền 15 phút: 00:00 · 02:00 · 05:00 · 07:00 · 09:30 · 11:00 · 13:30.
- Tịnh danh: 2–3 chữ, ≤ 16 ký tự, chữ cái tiếng Việt NFC, có ít nhất một chữ mang nghĩa tu tập, không tự xưng quả vị/giáo phẩm.
- Mã Phước nghiệp sự / Ba-la-mật và biến thể Tầng 0: Phụ lục H, `packages/shared/parami.js`, `packages/shared/variant.js`.

---

## PHỤ LỤC F — Mẫu `.github/lanes.yml`

```yaml
# Làn sở hữu: tiền tố nhánh → glob được phép sửa. Tệp trong "shared" cần nhãn PR `shared-ok`.
owner:                                  # nhánh owner/ (việc [O]): sửa mọi nơi, vẫn phải qua PR
  - '**'
claude:
  - apps/web/src/{world,island,people,realm,birds,gfx,audio,music,sermon}.js
  - apps/web/src/{rt,cong-duc}/**
  - workers/realtime/**
  - tests/e2e/**
antigravity:
  - workers/api/**
  - db/**
  - apps/web/src/net/**
  - apps/android/**
  - .github/**
  - scripts/**
  - tests/load/**
hermes:
  - content/**
  - ops/**
  - docs/reports/**
shared:
  - packages/shared/**
  - apps/web/src/{ui/**,boot.js,state.js,data.js,index.template.html}
  - apps/web/build.mjs
  - package.json
  - package-lock.json
  - AGENTS.md
  - CLAUDE.md
  - PROJECT_ROADMAP.md
rules:
  migrations_only_from: antigravity     # tệp mới trong db/migrations chỉ từ nhánh ag/
  migrations_append_only: true          # sửa tệp đã merge → đỏ
  hotfix_allows: [claude, antigravity, shared]
```

## PHỤ LỤC G — Checklist Chánh Mạng cho sản phẩm (người duyệt chấm, lưu vào `product.policy_json`)

1. Không thuộc năm nghề cư sĩ không nên làm theo AN 5.177: vũ khí, sinh vật, thịt, chất say, chất độc [45].
2. Không quảng cáo công năng tâm linh ("khai quang, điểm nhãn, cải mệnh, trừ tà", bùa, phong thủy cải vận).
3. Không cờ bạc, xổ số, vay tiêu dùng, tiền mã hóa, đa cấp.
4. Nguồn gốc, chất lượng ghi rõ; nhà bán có đánh giá ổn định; không hàng giả, hàng nhái.
5. Hàng cần giấy phép (thực phẩm chức năng, mỹ phẩm, thiết bị y tế) phải có giấy tờ quảng cáo hợp lệ; nếu không có thì loại.
6. Phù hợp tinh thần tri túc: không hàng xa xỉ phô trương; ưu tiên đồ bền, dùng cho tu tập, sống xanh.
7. Mô tả không thổi phồng; giá khớp với sàn tại thời điểm duyệt.
8. Link affiliate hoạt động; nhãn "Liên kết tiếp thị" hiển thị.
9. Người duyệt không có lợi ích riêng với nhà bán (khai báo nếu có).

## PHỤ LỤC H — Mã Phước nghiệp sự và Ba-la-mật (dùng trong `kusala_entry`, `deed_log`, `content/`)

| Mã `punna` | Phước nghiệp sự | Mã `parami` | Ba-la-mật |
|---|---|---|---|
| `dana` | Bố thí | `dana` | Bố thí |
| `sila` | Trì giới | `sila` | Trì giới |
| `bhavana` | Tu tập (thiền) | `nekkhamma` | Xuất ly |
| `apacayana` | Cung kính | `panna` | Trí tuệ |
| `veyyavacca` | Phục vụ | `viriya` | Tinh tấn |
| `pattidana` | Hồi hướng | `khanti` | Nhẫn nại |
| `pattanumodana` | Tùy hỷ | `sacca` | Chân thật |
| `dhammassavana` | Nghe Pháp | `adhitthana` | Quyết định |
| `dhammadesana` | Thuyết Pháp / chia sẻ Pháp | `metta` | Tâm từ |
| `ditthujukamma` | Chỉnh trực tri kiến | `upekkha` | Xả |

Nguồn: 10 Phước nghiệp sự theo truyền thống Chú giải [47]; 10 Ba-la-mật theo Buddhavaṃsa [48].

---

## PHỤ LỤC I — Nguồn tham khảo (truy cập 11/2026)

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
25. Node.js — Evolving the Node.js Release Schedule: https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule
26. Node.js 26 vào Active LTS ngày 28/10/2026, EOL 4/2029: https://fireup.pro/news/nodejs-26-lts-whats-new-upgrade · https://www.devx.com/coding/nodejs-26-lts-new-features-release-date/
27. Cloudflare — Pricing (hạn mức Free của Workers, Durable Objects): https://www.cloudflare.com/pricing/ · 27b. Hạn mức Free của D1/KV/R2: https://dev.to/0012303/cloudflare-workers-has-a-free-tier-100k-requestsday-at-the-edge-with-kv-r2-and-d1-52k9 · 27c. Giá D1 gói Paid: https://toolradar.com/tools/cloudflare-workers/pricing
28. Durable Objects — Pricing (gói Free chỉ dùng lớp SQLite): https://developers.cloudflare.com/durable-objects/platform/pricing/
29. Workers — Pricing: https://developers.cloudflare.com/workers/platform/pricing/
30. Workflows — Limits: https://developers.cloudflare.com/workflows/reference/limits/ · 30b. Workflows GA (waitForEvent): https://blog.cloudflare.com/workflows-ga-production-ready-durable-execution/
31. Workers AI — Pricing (10.000 neuron/ngày; Llama Guard 3 8B): https://developers.cloudflare.com/workers-ai/platform/pricing/
32. 100 Three.js Tips (2026) — WebGPU, TSL, lệnh vẽ: https://www.utsubo.com/blog/threejs-best-practices-100-tips
33. three.js manual — WebGPURenderer: https://threejs.org/manual/en/webgpurenderer.html · 33b. r182 đưa WebGPURenderer lên khuyến nghị: https://www.youngju.dev/blog/culture/2026-05-16-webgpu-webgl-2026-three-js-r3f-babylon-playcanvas-tres-needle-native-webgpu-wgsl-deep-dive.en
34. web.dev — WebGPU is now supported in major browsers: https://web.dev/blog/webgpu-supported-major-browsers · 34b. Firefox Android dự kiến cuối 2026: https://abratabia.com/webgpu/browser-support.php
35. three.js r183 — PostProcessing thành RenderPipeline, BatchedMesh theo instance: https://app.cinevva.com/zh-CN/news/2026-03-18-threejs-r183-render-pipeline
36. Shopee Affiliate API — dữ liệu sản phẩm cơ bản: https://ce-docs.keywordrush.com/modules/affiliate/shopee · 36b. Shopee — API Access (offer list, short link, báo cáo): https://help.shopee.sg/10/article/191702-API-Access
37. TikTok for Developers — TikTok Shop Affiliate APIs: https://developers.tiktok.com/blog/2024-tiktok-shop-affiliate-apis-launch-developer-opportunity
38. WooCommerce REST API v3 — Products (external_url, button_text): https://developer.woocommerce.com/docs/apis/rest-api/v3/products/
39. Google Play — Payments policy: https://play.google.com/about/monetization-ads/payments · 39b. Payments policy clarification: https://support.google.com/googleplay/android-developer/contact/ppa
40. Luật Quảng cáo sửa đổi 2025 — nhận diện quảng cáo: https://luatvietnam.vn/linh-vuc-khac/kols-quang-cao-san-pham-can-luu-y-04-quy-dinh-moi-tu-01-01-2026-883-106335-article.html
41. Luật TMĐT 2025 hiệu lực 1/7/2026, điều chỉnh affiliate: https://techcombank.com/thong-tin/blog/luat-thuong-mai-dien-tu · 41b. Định nghĩa nền tảng TMĐT trung gian: https://thuvienphapluat.vn/van-ban/Thuong-mai/Luat-Thuong-mai-dien-tu-2025-so-122-2025-QH15-662035.aspx · 41c. Nghĩa vụ của nền tảng: https://baovanhoa.vn/phap-luat/ban-hang-online-khong-con-duoc-an-danh-nguoi-ban-can-lam-gi-de-khong-vi-pham-242177.html
42. Trách nhiệm người tiếp thị liên kết (Điều 26 Luật TMĐT 2025): https://hethongphapluat.com/phap-luat/huong-dan/kockol-lam-video-review-gan-link-affiliate-nhung-lan-ranh-do-phap-ly-can-biet-nam-2026.html
43. Nghị định 93/2021/NĐ-CP — cá nhân vận động từ thiện: https://baophapluat.vn/ca-nhan-lam-tu-thien-tu-bay-gio-phai-dung-luat-post426883.html
44. Casso — Webhook, chống trùng lặp: https://developer.casso.vn/webhook/thiet-lap-webhook-thu-cong
45. Vaṇijjā Sutta (AN 5.177): https://www.dhammatalks.org/suttas/AN/AN5_177.html
46. AN 1.248–257 — các nam cư sĩ đệ tử tối thắng: https://suttafriends.org/?p=5221 · 46b. Anāthapiṇḍika: https://www.encyclopediaofbuddhism.org/wiki/Anathapindika
47. 10 Phước nghiệp sự (3 trong Tam tạng, 10 theo Chú giải): https://so06.tci-thaijo.org/index.php/tmd/article/download/296883/195597/1373313
48. 10 Ba-la-mật theo Buddhavaṃsa: https://newworldencyclopedia.org/entry/Paramita
49. Hermes Agent (cron, cổng nhắn tin): https://agentic-ai.readthedocs.io/en/latest/AgentPlatforms/hermes-agent/ · 49b. Hermes Agent docs (MCP): https://hermes-agent.nousresearch.com/docs · 49c. Hermes Agent README (danh sách lệnh được phép): https://github.com/nousresearch/hermes-agent
50. PWA push trên iOS 16.4+ chỉ khi đã thêm vào Màn hình chính: https://www.mobiloud.com/blog/pwa-push-notifications
51. PushForge — Web Push chạy trên Cloudflare Workers: https://github.com/draphy/pushforge
52. GitHub — Managing environments for deployment (repo private cần GitHub Pro/Team): https://docs.github.com/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment
53. Nghị định 47/2021/NĐ-CP hướng dẫn Luật Doanh nghiệp (doanh nghiệp xã hội, tiếp nhận tài trợ): https://www.vcci.com.vn/legal-document/nghi-dinh-472021nd-cp-huong-dan-luat-doanh-nghiep · 53b. Thủ tục chuyển công ty TNHH thành doanh nghiệp xã hội: https://ketoananpha.vn/chuyen-doi-cong-ty-thanh-doanh-nghiep-xa-hoi.html
