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
   - `POST /api/auth/sign-in/anonymous`: Tạo khách ẩn danh dựa trên lược đồ bảng Better Auth, cấp session token 30 ngày và cookie `vd_session` (`HttpOnly; Secure; SameSite=Lax`).
   - `GET /api/auth/session`: Lấy thông tin phiên hiện tại.
   - `POST /api/auth/sign-out`: Hủy phiên đăng nhập.
   - `GET /api/v1/me`: Trả về hồ sơ, hành trình, phân khu mở (dùng `ZONE_UNLOCK` và `gateLevel` từ `@vandao/shared`), và tính tổng Kusala 3 trục (`duc`, `thien`, `tue`).
   - `PATCH /api/v1/profile`: Cập nhật Tịnh danh (kiểm tra 4 quy tắc qua `@vandao/shared/tinh-danh.js`, giới hạn 30 ngày), múi giờ (giới hạn 7 ngày), diện mạo, cài đặt, quyền hiển thị.
   - `POST /api/v1/sync`: Giao thức đồng bộ hai chiều Offline-first:
     - Chống trùng lặp (Idempotency) bằng `sync_op` và ULID.
     - Kẹp thời gian hợp lệ `[server_now - 7 ngày, server_now + 2 phút]`.
     - **Máy chủ là trọng tài**: Tính lại `e_score` bằng `@vandao/shared/kusala.js`.
     - **Một nguồn sự thật cho khóa ngày**: Sử dụng trực tiếp hàm `advance()` từ `@vandao/shared/schedule.js`. Chỉ tiến ngày khi đã làm đủ 3 trục và `last_done_on < local_today`.
     - Bất biến cứng: `day <= (ngày địa phương - started_on) + 1`.
     - Xử lý chu kỳ mới `journey.reset_cycle` khi "Trở về ngày 1".
   - `GET /api/v1/export`: Xuất dữ liệu cá nhân theo Luật BVDLCN 91/2025 và GDPR.
   - `POST/DELETE /api/v1/account/delete`: Yêu cầu xóa tài khoản với thời gian ân hạn 7 ngày và hủy yêu cầu.
   - `POST /api/v1/rt/ticket`: Cấp vé HMAC-SHA256 (60 giây) vào phòng thời gian thực (Durable Objects).
   - `GET /api/v1/content`: Truy vấn các bài giảng, bài thiền đã duyệt (`status = 'da_duyet'`).

3. **Phục vụ Static Assets hợp nhất (Unified Worker)**:
   - Worker `vandao` phục vụ toàn bộ ứng dụng web 3D tĩnh từ `apps/web/public` qua binding `env.ASSETS`.
   - Các request `/api/*` và `/ws/*` được Hono xử lý; mọi request khác tự động fallback qua `c.env.ASSETS.fetch(c.req.raw)`.

4. **Tầng Mạng Client (`apps/web/src/net/`) & IndexedDB v2**:
   - `idb.js`: Đóng gói IndexedDB `vandao` phiên bản 2 thống nhất với các store `state`, `outbox`, `kusala`, `sessions`, `meta`.
   - `api.js`: Client fetch tự động gán token, lưu trữ bookmark D1 (`x-d1-bookmark`).
   - `sync.js`: Hàng đợi `outbox`, tự động đồng bộ khi online hoặc đổi tab.
   - `apps/web/src/state.js`: Đồng bộ trạng thái `S` trực tiếp với store `state` của IndexedDB v2.

---

## 2. Hướng dẫn dành cho các Agent phối hợp

### Dành cho Claude (Làn 3D & UI - T2.3, T1.1)
* **Kết nối UI với Client Net**:
  * Khi người dùng xác nhận trục Kusala trên giao diện, gọi:
    ```javascript
    import { enqueueOp } from '../net/sync.js';
    await enqueueOp('kusala.confirm', {
      program: 'so-nhap-49',
      cycle: S.cycle,
      day: S.day,
      pillar: 'duc', // 'duc' | 'thien' | 'tue'
      pre: 1.0, during: 1.2, post: 0.9,
      wise: true, self: true,
      note: 'Ghi chú quán chiếu...'
    });
    ```
  * Lắng nghe đồng bộ tự động để cập nhật UI:
    ```javascript
    import { onSyncComplete } from '../net/sync.js';
    onSyncComplete((newState) => {
      // Cập nhật S.totals, S.day, S.profile...
    });
    ```
  * Trạng thái `S` trong `apps/web/src/state.js` đã được kết nối sẵn với IndexedDB v2 qua `openIdb()` trong `net/idb.js`.

### Dành cho Hermes (Làn Ops & Giám sát - T2.4)
* **Số liệu cần theo dõi hàng ngày**:
  * Số lượt gọi API `/api/v1/sync` và `/api/auth/*` (hạn mức gói Free: 100.000 req/ngày).
  * Dung lượng D1 (`vandao-core-staging`: `a9c4ecd2-2084-4aa8-9a63-a2e716d06044`). Cảnh báo khi vượt 70% (3,5 GB trên Free).
  * Tỉ lệ rejected do `day_locked` hoặc `invalid_timestamp` để phát hiện bất thường.

---

## 3. Kiểm thử tự động (Vitest)

Chạy kiểm thử toàn diện từ thư mục gốc của Monorepo:
```bash
npm test
```
Toàn bộ 60 ca kiểm thử bao phủ toàn diện xác thực, tính toán Kusala, chống gian lận ngày, idempotency, xuất/xóa tài khoản và lane-guard đều đạt 100%.
Kiểm tra đóng gói Cloudflare Worker:
```bash
cd workers/api && npx wrangler deploy --dry-run --env staging
```
