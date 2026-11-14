# Vân Đạo API Worker (`@vandao/api`)

Phân hệ API máy chủ và phục vụ tài nguyên tĩnh của dự án Vân Đạo, xây dựng bằng [Hono](https://hono.dev), chạy trên Cloudflare Workers kết nối SQLite Cloudflare D1 và binding Static Assets (`apps/web/public`).

> Thuộc sở hữu của làn **Antigravity** (`ag/`, `PROJECT_ROADMAP.md §14.2, §19`).

---

## 1. Trách nhiệm & Phạm vi hoàn thành (GĐ2 T2.1 & T2.2)

1. **CSDL D1 (`db/migrations/`)**:
   - `0001_auth.sql`: Chuẩn lược đồ bảng của Better Auth (`user`, `session`, `account`, `verification`, `passkey`).
   - `0002_profile_journey.sql`: `profile` (Tịnh danh NFC, tag 4 số, diện mạo, cài đặt, múi giờ) và `journey` (tiến trình 49 ngày, khóa ngày).
   - `0003_practice.sql`: `kusala_entry` (nhật ký Kusala, tính lại tại máy chủ), `practice_session` (thời thiền), `tier_progress` (mở tầng).
   - `0004_social.sql`: `companion` (đồng tu), `invite` (mã mời), `guidance` (dẫn dắt), `sangha_group`, `user_block`, `report`.
   - `0005_content_ops.sql`: `content_item` (nội dung duyệt), `community_day` (tổng hợp ẩn danh), `device`, `sync_op` (chống trùng), `consent`, `deletion_request`.

2. **Endpoints API REST (`/api/v1` & `/api/auth`)**:
   - `/api/auth/*` do **Better Auth 1.7** xử lý (`src/auth/index.js`, ADR `docs/adr/0001-worker-api-va-dang-nhap.md`):
     - `POST /sign-in/anonymous` → `{ token, user }`, cookie `vd.session_token`, header `set-auth-token` (bearer cho Android).
     - `GET /get-session`, `POST /sign-out`.
     - Passkey: `/passkey/generate-register-options`, `/passkey/verify-registration`, `/passkey/generate-authenticate-options`, `/passkey/verify-authentication`.
     - `/sign-in/social` (Google, khi có secret); `/email-otp/*` (khi `EMAIL_OTP=1`).
     - Tịnh danh để trống tới khi người dùng tự đặt qua `PATCH /api/v1/profile`.
     - Khách đăng nhập vào tài khoản đã có thì dữ liệu được gộp (`src/auth/link.js`).
     - **Gói Free (§6.4, `src/auth/free-login.js`):**
       - Mã khôi phục: `POST /recovery-code/generate` hiện mã 26 ký tự một lần (máy chủ chỉ lưu SHA-256); `GET /recovery-code/status`; `POST /sign-in/recovery-code {code}` (gõ thường, có khoảng trắng đều được).
       - QR liên kết thiết bị:
         1. Máy mới gọi `POST /device-link/start` → `{code, secret, qr}`; mã sống 2 phút.
         2. Máy đã đăng nhập xem `GET /device-link/info?code=` rồi `POST /device-link/approve {code}`.
         3. Máy mới hỏi `POST /sign-in/device-link {code, secret}` mỗi 2 giây: `{status:'pending'}` → `{status:'approved', token, user}`. Mã dùng một lần.
       - Gắn passkey hoặc tạo mã khôi phục → tài khoản thôi là khách (`isAnonymous = 0`).
   - **Giới hạn tần suất và Turnstile** (`src/guard.js`): bảng giới hạn ở `docs/infra.md`. Turnstile (header `cf-turnstile-response`) bắt buộc cho `sign-in/recovery-code`, `device-link/start`, `email-otp/send-verification-otp` khi Worker có `TURNSTILE_SECRET`.
   - `GET /api/auth/session`: Lấy thông tin phiên hiện tại.
   - `POST /api/auth/sign-out`: Hủy phiên đăng nhập.
   - `GET /api/v1/me`: Trả về hồ sơ, hành trình, phân khu mở (dùng `ZONE_UNLOCK` và `gateLevel` từ `@vandao/shared`), và tính tổng Kusala 3 trục (`duc`, `thien`, `tue`). Thêm `?entries=1` để lấy các dòng Kusala của chu kỳ hiện tại (không kèm ghi chú); client dùng khi khôi phục hành trình trên máy mới.
   - `PATCH /api/v1/profile`: Cập nhật Tịnh danh (kiểm tra 4 quy tắc qua `@vandao/shared/tinh-danh.js`, giới hạn 30 ngày), múi giờ (mọi tên vùng `Intl` nhận, kể cả `UTC` và bí danh cũ như `Asia/Saigon`; giới hạn 7 ngày), diện mạo, cài đặt, quyền hiển thị.
   - `POST /api/v1/sync`: đồng bộ Offline-first (tối đa **8** thao tác mỗi lần: gói Free cho 50 truy vấn D1 mỗi lần gọi Worker; client tự chia lô):
     - Mỗi thao tác ghi trong **một `db.batch`** (giao dịch D1) cùng dấu vết `sync_op`; gửi lại trùng `op.id` được trả trong `applied` để client xóa khỏi outbox.
     - Từ chối kèm `retry`: `false` là vĩnh viễn (client bỏ thao tác), `true` là lỗi tạm (`db_error`, giữ lại gửi sau).
     - Kẹp thời gian `[server_now - 7 ngày, server_now + 2 phút]`; thao tác có ngày trước `started_on` bị từ chối (`before_start`).
     - **Máy chủ là trọng tài**: hệ số chỉ nhận 0,5–1,2 (`validFactor`), `e_score` tính lại bằng `@vandao/shared/kusala.js`; `program`/`cycle` lấy từ hành trình hiện tại, không tin client.
     - **Khóa ngày một nguồn sự thật**: trước mỗi `kusala.confirm`, gọi `advance()` của `@vandao/shared/schedule.js` với ngày địa phương *của thao tác*; `payload.day` phải bằng ngày hiện tại (`day_locked` nếu vượt, `day_closed` nếu ngày đã qua). Đồng bộ dồn nhiều ngày ngoại tuyến vẫn tiến đúng 1 nấc mỗi ngày. `last_done_on` theo đúng nghĩa `S.lastDate` ở client (ngày xác nhận gần nhất).
     - `GET /api/v1/me` và cuối mỗi lần `sync` tự tiến ngày tới hôm nay theo cùng luật.
     - `journey.reset_cycle` ("Trở về ngày 1") mở chu kỳ mới, giữ Tịnh danh và diện mạo.
     - `sacca.add` cộng một lời Chân thật (`sacca_count`).
     - `legacy.import` đưa hành trình đang có trên máy lên lần đầu ("Giữ hành trình", T2.3): chỉ nhận khi hành trình máy chủ còn trống (`not_empty`); các ngày đã qua phải đủ ba trục và hệ số hợp lệ (`invalid_import`); máy chủ đặt `started_on = hôm nay − (day − 1)` và tính lại mọi `e_score`; ghi chú quán chiếu không gửi lên.
   - `GET /api/v1/export`: Xuất dữ liệu cá nhân theo Luật BVDLCN 91/2025 và GDPR.
   - `POST/DELETE /api/v1/account/delete`: Yêu cầu xóa tài khoản với thời gian ân hạn 7 ngày và hủy yêu cầu.
   - `POST /api/v1/rt/ticket`: vé HMAC-SHA256 (60 giây) vào phòng thời gian thực. Cần secret `RT_SECRET` (`npx wrangler secret put RT_SECRET [--env staging]`); thiếu thì trả 503, không có khóa mặc định.
   - `GET /api/v1/content`: Truy vấn các bài giảng, bài thiền đã duyệt (`status = 'da_duyet'`).

3. **Phục vụ Static Assets hợp nhất (Unified Worker)**:
   - Worker `vandao` phục vụ toàn bộ ứng dụng web 3D tĩnh từ `apps/web/public` qua binding `env.ASSETS`.
   - Các request `/api/*` và `/ws/*` được Hono xử lý (`/api/*` không tồn tại trả 404 JSON); mọi request khác qua `c.env.ASSETS.fetch(c.req.raw)`.
   - CORS chỉ mở cho nguồn của Vân Đạo (production, staging, preview `*-vandao-staging…workers.dev`, `127.0.0.1`/`localhost`); trình duyệt gọi cùng nguồn gốc nên thường không cần.

4. **Tầng Mạng Client (`apps/web/src/net/`) & IndexedDB v2**:
   - `idb.js`: Đóng gói IndexedDB `vandao` phiên bản 2 thống nhất với các store `state`, `outbox`, `kusala`, `sessions`, `meta`.
   - `api.js`: gọi API bằng cookie phiên của Better Auth (cùng nguồn gốc): phiên, khách ẩn danh, passkey (WebAuthn), mã khôi phục, liên kết thiết bị, hồ sơ, đồng bộ, xuất/xóa dữ liệu. Lỗi ném `ApiError(status, code, message)`.
   - `turnstile.js`: lấy token Turnstile (chỉ hiện thử thách khi Cloudflare cần) cho mã khôi phục và liên kết thiết bị.
   - `account.js`: nối `S` trên máy với tài khoản: `keepJourney` (khách ẩn danh + hồ sơ + `legacy.import`), `afterSignIn` (khôi phục / đẩy lên / xung đột), `useSaved`/`useLocal`, `record`/`recordProfile`. Khi xung đột, đồng bộ chưa bật cho tới lúc người dùng chọn, nên bản trên máy không bị ghi đè.
   - `sync.js`: hàng đợi `outbox`. **Chỉ đồng bộ khi đã có phiên** (người dùng bật "Giữ hành trình", T2.3 #12): gửi theo lô 8 thao tác; gọi `triggerSync()` trong lúc đang đồng bộ thì xếp thêm đúng một lượt ngay sau (thao tác vừa vào outbox không bị bỏ lại); `startAutoSync()` bật tự đồng bộ khi có mạng lại hoặc quay lại tab; không tự tạo tài khoản khách cho mọi người mở trang. Bản trạng thái máy chủ lưu ở `meta['serverState']`.
   - `apps/web/src/state.js`: `net/idb.js` là chủ lược đồ duy nhất; `state.js` giữ bản sao `S` ở store `state`, khóa `'vandao.v1'`, khôi phục khi localStorage bị xóa (T1.1).

---

## 2. Hướng dẫn dành cho các Agent phối hợp

### Dành cho Claude (Làn 3D & UI - T2.3, T1.1)
* **Kết nối UI với Client Net**:
  * Khi người dùng xác nhận trục Kusala trên giao diện, gọi:
    ```javascript
    import { enqueueOp } from '../net/sync.js';
    await enqueueOp('kusala.confirm', {
      day: S.day,   // phải là ngày hiện tại của hành trình; program/cycle máy chủ tự lấy
      pillar: 'duc', // 'duc' | 'thien' | 'tue'
      pre: 1.0, during: 1.2, post: 0.9,
      wise: true, self: true,
      note: 'Ghi chú quán chiếu...'
    });
    ```
  * Lắng nghe đồng bộ tự động để cập nhật UI:
    ```javascript
    import { onSyncComplete } from '../net/sync.js';
    onSyncComplete((newState, res) => {   // res.rejected: [{ id, code, retry }]
      // Cập nhật S.totals, S.day, S.profile...
    });
    ```
  * Sau khi người dùng bật "Giữ hành trình": `await signInAnonymous(S.name || undefined)` (`net/api.js`) rồi `startAutoSync()`.

### Dành cho Hermes (Làn Ops & Giám sát - T2.4)
* **Số liệu cần theo dõi hàng ngày**:
  * Số lượt gọi API `/api/v1/sync` và `/api/auth/*` (hạn mức gói Free: 100.000 req/ngày).
  * Dung lượng D1 (`vandao-core-staging`: `a9c4ecd2-2084-4aa8-9a63-a2e716d06044`). Cảnh báo khi vượt 70% (3,5 GB trên Free).
  * Tỉ lệ rejected do `day_locked` hoặc `invalid_timestamp` để phát hiện bất thường.

---

## 2b. Việc định kỳ (Cron, `src/cron.js`)

Chạy mỗi đêm 02:17 giờ Việt Nam (`triggers.crons: "17 19 * * *"` UTC, cả production và staging). Mỗi lần xử lý tối đa 200 tài khoản; log chỉ ghi số lượng.

1. Thực thi yêu cầu xóa tài khoản đã qua 7 ngày ân hạn: xóa `user`, các bảng khác xóa theo CASCADE; dọn thêm `sync_op`, `deletion_request`.
2. Xóa khách (`isAnonymous = 1`) không hoạt động quá 90 ngày. Hoạt động tính theo lần gần nhất của hồ sơ, phiên, đồng bộ, Kusala hoặc thời thiền. `GET /api/v1/me` trả `guest_purge_after` để app báo trước; tài khoản đã gắn passkey hoặc mã khôi phục trả `null`.
3. Dọn `sync_op` quá 30 ngày, phiên hết hạn, mã dùng một lần hết hạn.

## 3. Kiểm thử và chạy thử

```bash
npm test                      # Vitest toàn repo; workers/api/test chạy trong workerd với D1 thật (@cloudflare/vitest-plugin)
npm run dev:api               # dựng web, migration lên D1 cục bộ, Worker ở http://127.0.0.1:8787
                              # (cần workers/api/.dev.vars chứa BETTER_AUTH_SECRET=<chuỗi bất kỳ ≥ 32 ký tự>)
cd workers/api && npx wrangler deploy --dry-run --env staging   # kiểm đóng gói (CI chạy cả staging lẫn production)
```

CI chạy thêm `wrangler d1 migrations apply --local` để kiểm SQL trên SQLite của workerd (đúng môi trường D1).
## Nạp bài giảng (#46)

Từ gốc repo: `node scripts/import-content.mjs --check` kiểm Markdown/front-matter YAML (có khối `meta` lồng).
Chỉ bài `da_duyet` đủ id, version, tên, nguồn và ý được nạp; `reviewed_*` tùy chọn.
`[[hiển thị|cách đọc]]` chỉ ghi phần hiển thị vào D1; giữ câu Pāli bắt đầu bằng `>`.

- Cục bộ: áp migration trước, rồi `node scripts/import-content.mjs --env staging --local`.
- CI staging: sau migration, `node scripts/import-content.mjs --env staging --remote`.
- CI production (chỉ khi chủ dự án gắn tag): `node scripts/import-content.mjs --env production --remote`.

Mặc định chỉ kiểm, không gọi D1. Công cụ upsert theo `(id, version)`, không xóa bản khác;
ghi `body_r2_key` khi có, không bịa thông tin duyệt. `meta` được đọc nhưng chưa ghi trước migration 0008;
phải bổ sung ghi/trả `meta` trước bài Đường Xưa đầu tiên. Bí mật lấy từ biến môi trường của đúng job deploy.
