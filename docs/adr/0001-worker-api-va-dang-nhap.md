# ADR 0001 — Một Worker cho API và trang tĩnh; đăng nhập GĐ2 bước 1

- **Ngày:** 13/11/2026
- **Trạng thái:** đã áp dụng. Chủ dự án chốt dùng Better Auth theo lộ trình (13/11/2026); áp dụng ở T2.1 bước 2.
- **Issue:** #10 (T2.1), liên quan #11 (T2.2), #12 (T2.3)

## Bối cảnh

Trước GĐ2, `apps/web/worker.js` chỉ trả tài sản tĩnh (`env.ASSETS`). GĐ2 cần API (Hono + D1) cùng tên miền `vandao.ainextbrain.com`. PROJECT_ROADMAP.md Phụ lục B gợi ý một Worker có `assets` và `run_worker_first` cho `/api/*`.

Issue #10 ghi Better Auth + Drizzle. Bản đầu của `workers/api` dùng phiên tự viết (`auth/session.js`), với lược đồ bảng theo Better Auth (`user`, `session`, `account`, `verification`, `passkey`).

## Quyết định

1. **Một Worker `workers/api`** cho cả production (`vandao`) và staging (`vandao-staging`):
   - phục vụ `apps/web/public` qua binding `ASSETS`;
   - `/api/*`, `/ws/*`, `/.well-known/*` chạy Worker trước;
   - xóa `apps/web/{wrangler.jsonc,worker.js}`;
   - `deploy.yml` và `preview.yml` deploy từ `workers/api`.
   - Lợi ích: cùng nguồn gốc, không cần CORS cho trình duyệt, một lần deploy, cookie phiên dùng chung tên miền.
2. **Đăng nhập GĐ2 bước 1:** khách ẩn danh với token bearer hoặc cookie `vd_session`, giữ trong bảng `session` có hạn 30 ngày.
   - Lược đồ bảng giữ tương thích Better Auth.
   - Khi thêm passkey, Google, mã khôi phục, QR liên kết thiết bị (T2.2 #11), đề xuất chuyển sang thư viện Better Auth, khởi tạo theo từng request vì D1 chỉ có trong `fetch`. Phiên cũ vẫn dùng được vì cùng bảng.
3. **Tài nguyên production** tạo ngày 13/11/2026 ở tài khoản `a5f038f5…`: D1 `vandao-core`, KV `vandao-config`, R2 `vandao-media`. Migration chạy tự động trước bước deploy trong `deploy.yml`.

## Hệ quả

- Kiểm thử API chạy bằng Vitest với D1 giả lập (`node:sqlite`, batch có giao dịch). CI kiểm thêm:
  - đóng gói Worker (`wrangler deploy --dry-run`, staging và production);
  - SQL trên SQLite của workerd (`wrangler d1 migrations apply --local`).
- `@cloudflare/vitest-pool-workers` (nghiệm thu gốc của #10) chưa dùng. Nên thêm khi chuyển sang Better Auth, vì lúc đó cần chạy đúng runtime workerd.
- **Chủ dự án cần chốt:**
  - (a) chuyển sang Better Auth ở T2.2, hay giữ phiên tự viết;
  - (b) đặt secret `RT_SECRET` cho staging/production khi bắt đầu phòng thời gian thực (`npx wrangler secret put RT_SECRET [--env staging]` trong `workers/api`).

## Cập nhật 13/11/2026 — chốt Better Auth (T2.1 bước 2)

Chủ dự án chốt dùng Better Auth như lộ trình. Thay `auth/session.js` tự viết bằng:

- **Better Auth 1.7** (`workers/api/src/auth/index.js`), khởi tạo theo từng request.
  - **Plugin:** `anonymous` (khách), `bearer` (Android), `passkey`. Google chỉ bật khi có secret `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. `emailOTP` chỉ bật khi `EMAIL_OTP=1` và có binding `EMAIL` (gói Paid).
  - **Cookie:** `vd.session_token` (`HttpOnly; Secure; SameSite=Lax`). Ứng dụng Android gửi `Authorization: Bearer`.
  - **Chống gửi chéo nguồn:** Better Auth từ chối mọi request có cookie đến từ nguồn khác (403 `INVALID_ORIGIN`).
  - **Tắt sẵn:** rate limit có sẵn của Better Auth (dùng binding `ratelimits` của Workers, T2.2) và telemetry.
  - **Định danh:** ULID 26 ký tự (sửa `generateId` từ 20 lên 26 ký tự).
- **Drizzle** (`auth/schema.js`) chỉ cho các bảng của Better Auth, khớp từng cột với 0001 + 0006. Bảng ứng dụng giữ câu lệnh D1 trực tiếp.
- **Migration 0006:** thêm `passkey.credentialID`, `passkey.aaguid`, chỉ mục `verification(identifier)`.
- **Hồ sơ người dùng mới:** `databaseHooks.user.create.after` tạo profile + journey ngày 1, Tịnh danh để trống. Tên và múi giờ đặt sau bằng `PATCH /api/v1/profile`; Better Auth `user.name` đi theo dạng "Tịnh danh · thẻ".
- **Khi khách đăng nhập vào tài khoản đã có** (`onLinkAccount` → `auth/link.js`):
  - đích chưa có tiến trình: chuyển nguyên dữ liệu của khách sang;
  - đích đã có tiến trình: giữ bản đã lưu, hành trình của khách thành chu kỳ cũ. Không mất dữ liệu.
- **Thoát trạng thái "khách":** gắn passkey thì `isAnonymous = 0`, để không bị cron dọn khách sau 90 ngày.
- **Kiểm thử:** `@cloudflare/vitest-plugin` (tên mới của `vitest-pool-workers`, chạy với vitest 5) trong workerd với D1 thật và đủ migration. Bỏ `d1-mock.js`.
- **Secret bắt buộc:** `BETTER_AUTH_SECRET` ở cả staging và production. Thiếu thì `/api/auth/*` và `/api/v1/*` trả 503; trang 3D không bị ảnh hưởng.

Đổi hợp đồng API: `POST /api/auth/sign-in/anonymous` của Better Auth không nhận `tinh_danh`/`tz` và trả `{ token, user }`; client đặt tên bằng PATCH `/api/v1/profile`. `GET /api/auth/session` cũ thay bằng `GET /api/auth/get-session`.

