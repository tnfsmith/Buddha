# ADR 0001 — Một Worker cho API và trang tĩnh; đăng nhập GĐ2 bước 1

- **Ngày:** 13/11/2026
- **Trạng thái:** đã áp dụng cho phần Worker; phần đăng nhập chờ chủ dự án chốt trước T2.2 (#11)
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
