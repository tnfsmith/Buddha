# Hạ tầng Vân Đạo (cập nhật 13/11/2026)

Hai tài khoản Cloudflare (gói Workers Free), tách để preview/staging/kiểm thử tải không ăn hạn mức của production (PROJECT_ROADMAP.md §14.8).

| Môi trường | Kích hoạt | Worker | URL | Tài khoản Cloudflare | Secrets GitHub |
|---|---|---|---|---|---|
| Preview | Mỗi PR (`preview.yml`) | `vandao-staging`, phiên bản alias `pr-N` | `https://pr-N-vandao-staging.vandao-staging.workers.dev` | staging `f8ba0d18…` | `CF_STAGING_*` |
| Staging | Merge vào `main` (`deploy.yml`) | `vandao-staging` | `https://vandao-staging.vandao-staging.workers.dev` | staging `f8ba0d18…` | `CF_STAGING_*` |
| Production | Tag `vX.Y.Z` (`deploy.yml`) | `vandao` | `https://vandao.ainextbrain.com` | production `a5f038f5…` | `CF_PROD_*` |

Cả ba môi trường dùng **một Worker** `workers/api` (Hono): phục vụ trang tĩnh `apps/web/public` và API `/api/*` (ADR `docs/adr/0001-worker-api-va-dang-nhap.md`).

## Tài nguyên staging (T0.4, gắn vào Worker từ GĐ2)

Khai báo trong `workers/api/wrangler.jsonc` → `env.staging`. Migration D1 chạy tự động trước bước deploy staging.

| Loại | Tên | ID |
|---|---|---|
| D1 | `vandao-core-staging` | `a9c4ecd2-2084-4aa8-9a63-a2e716d06044` |
| D1 | `vandao-core-preview` | `549c6cff-0e8b-4ebe-8f14-45999f47d8aa` |
| KV | `vandao-config-staging` | `52f5a88f999344b5a04ec7aa1ae84325` |
| R2 | `vandao-media-staging` | — |
| workers.dev | subdomain `vandao-staging` | — |

## Tài nguyên production (tạo 13/11/2026, tài khoản `a5f038f5…`)

| Loại | Tên | ID |
|---|---|---|
| D1 | `vandao-core` | `9930849b-af4f-46b7-b7f1-c58cade859d5` |
| KV | `vandao-config` | `561aec70f7ee4098a30d054ad224cdbb` |
| R2 | `vandao-media` (APAC) | — |

Migration D1 production chạy trong job `production` của `deploy.yml`, trước bước deploy.

## Secret của Worker (đặt một lần, không nằm trong repo)

| Secret | Bắt buộc | Dùng cho | Đặt bằng |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | Có, cả staging và production (giá trị khác nhau) | Ký cookie/phiên Better Auth. Thiếu thì `/api/auth/*`, `/api/v1/*` trả 503 | `cd workers/api && npx wrangler secret put BETTER_AUTH_SECRET [--env staging]`, hoặc dashboard → Worker → Settings → Variables and Secrets |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Không | Đăng nhập Google (OAuth client loại Web; redirect `https://<miền>/api/auth/callback/google`) | như trên |
| `RT_SECRET` | Khi mở phòng thời gian thực (GĐ4) | Ký vé `/api/v1/rt/ticket` | như trên |
| `TURNSTILE_SECRET` | Có, cả staging và production (cùng một giá trị) | Kiểm token Turnstile ở máy chủ cho đăng nhập bằng mã khôi phục, bắt đầu QR liên kết, gửi OTP. Thiếu thì không kiểm (chỉ còn giới hạn tần suất) | Dashboard tài khoản production → Turnstile → widget `vandao` → Settings → Secret key; rồi đặt như trên |

**Turnstile:** widget `vandao` (tài khoản production, chế độ managed), sitekey công khai `0x4AAAAAAF_iytQJWvfn-nya`. Widget phủ miền `vandao.ainextbrain.com` và `vandao-staging.workers.dev`, tức cả staging lẫn mọi preview `pr-N`. Client gửi token trong header `cf-turnstile-response`.

**Giới hạn tần suất** (binding `ratelimits`, khai báo ở cả hai môi trường trong `workers/api/wrangler.jsonc`):

| Binding | Giới hạn | Áp cho |
|---|---|---|
| `RL_AUTH` | 5/phút/IP | đăng nhập khách, mã khôi phục, passkey, bắt đầu QR |
| `RL_POLL` | 60/phút/IP | máy mới hỏi trạng thái QR; `/api/v1/metrics` |
| `RL_OTP` | 3/phút/IP | gửi OTP (khi bật) |
| `RL_SYNC` | 30/phút/người | `/api/v1/sync` |
| `RL_API` | 60/phút/người | `/api/v1/me`, `PATCH /api/v1/profile` |
| `RL_TICKET` | 20/phút/người | `/api/v1/rt/ticket` |
| KV `quota:export` | 2/ngày/người | `/api/v1/export` |

Đổi `BETTER_AUTH_SECRET` làm mọi người phải đăng nhập lại (khách ẩn danh mất phiên, không mất dữ liệu nếu đã gắn passkey/mã khôi phục).

## Token

| Secret | Phạm vi | Hết hạn |
|---|---|---|
| `CF_PROD_API_TOKEN` (`vandao-ci-production`) | Tài khoản production + zone `ainextbrain.com`: Workers Scripts/Routes, D1, KV, R2, Queues (Edit); Account Settings, Workers Tail (Read); User Details, Memberships (Read) | 11/02/2027 — tạo token mới và cập nhật secret trước ngày này |
| `CF_STAGING_API_TOKEN` | Tài khoản staging: Workers Scripts, D1, KV, R2, Queues (Edit) | theo cài đặt của chủ dự án |

## Bản web và offline (T1.1)

- `public/` (Worker phục vụ): `index.html` + `manifest.webmanifest` + `sw.js` + biểu tượng SVG. Service worker: trang ưu tiên mạng, mất mạng hoặc chậm quá 3 giây thì dùng bản đã lưu; tài nguyên tĩnh ưu tiên bộ đệm; bỏ qua `/api/`, `/ws/`. Tên bộ đệm theo băm của `index.html`, bản mới tự xóa bộ đệm cũ.
- Dữ liệu trên máy: `localStorage['vandao.v1']` (đọc lúc khởi động) + IndexedDB `vandao` v2 (lược đồ do `apps/web/src/net/idb.js` giữ: store `state`, `outbox`, `meta`, `kusala`, `sessions`; máy đang ở v1 được nâng cấp tại chỗ). localStorage bị xóa mà IndexedDB còn thì tự khôi phục.
- Bản HTML đơn (`dist/van-dao.html`, Release) không có service worker; mở bằng file:// vẫn chạy offline.

## Số liệu và giám sát (T1.3, #8)

- **Analytics Engine** (`vd_metrics` production, `vd_metrics_staging` staging; binding `METRICS`): `apps/web/src/net/metrics.js` lắng nghe `vandao:perf` (world.js phát mỗi 10 giây) và lỗi JS, gửi tóm tắt mỗi 5 phút hoặc khi rời trang tới `POST /api/v1/metrics`.
  - Mỗi lần gửi tối đa 1 điểm hiệu năng (FPS p50/p10, lệnh vẽ, tam giác, mức chất lượng, DPR) và 10 điểm lỗi.
  - Chỉ kèm nhóm máy thô: điện thoại, máy tính bảng hoặc máy tính; bậc số lõi; bậc bộ nhớ.
  - Không cookie, không IP, không User-Agent. Thông điệp lỗi đã lược URL, email và chuỗi số. Tắt khi trình duyệt bật Do Not Track hoặc GPC.
  - Gói Free cho 100.000 điểm/ngày. Truy vấn bằng SQL API của Analytics Engine, ví dụ `SELECT blob3 AS nhom, quantileWeighted(0.5)(double1, 1) AS fps FROM vd_metrics WHERE blob1 = 'perf' GROUP BY nhom`.
- **Cloudflare Web Analytics** (không cookie):
  - Production: zone `ainextbrain.com` đã bật tự chèn beacon, lọc theo host `vandao.ainextbrain.com` trong dashboard.
  - Staging: site `vandao-staging.vandao-staging.workers.dev` (tạo ở tài khoản production), `net/metrics.js` chèn token công khai.
- **Kiểm thử tài khoản (T2.3)**: `tests/e2e/account.spec.js` có hai nhóm. Nhóm giao diện luôn chạy trong CI với API giả lập. Nhóm đầy đủ cần Worker thật nên chỉ chạy tay trước khi phát hành: tạo `workers/api/.dev.vars` có `BETTER_AUTH_SECRET=<chuỗi bất kỳ ≥ 32 ký tự>` (không commit), chạy `npm run dev:api`, rồi `E2E_ACCOUNT=http://localhost:8787/ npx playwright test tests/e2e/account.spec.js`. Nhóm này đi trọn điện thoại → máy tính bằng mã khôi phục, liên kết thiết bị (nghiệm thu < 10 giây), passkey (trình xác thực ảo) và hai nhánh xung đột.
- **Lighthouse CI**: `preview.yml` chạy cho mỗi PR, đo cả điện thoại lẫn máy tính, bình luận bảng điểm vào PR và lưu báo cáo làm artifact. Runner không có GPU nên Lighthouse chạy khi WebGL tắt, đo lớp giao diện 2D; hiệu năng 3D đo bằng `tests/e2e/perf.spec.js`.

## Runbook ngắn

- **Phát hành production:** GitHub (web/app) → Releases → Draft a new release → tag mới `vX.Y.Z` từ `main` → Publish. Workflow `deploy` chạy lại toàn bộ CI rồi mới deploy; theo dõi ở tab Actions.
- **Quay lui production:** `cd workers/api && npx wrangler rollback` (cần `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` của production), hoặc Cloudflare dashboard → Workers → `vandao` → Deployments → chọn bản trước. Sau đó sửa lỗi qua nhánh `hotfix/*` và gắn tag bản vá.
- **Deploy staging thủ công:** `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run deploy:staging` (dựng web rồi deploy `workers/api`).
- **Chạy thử cục bộ:** `npm run dev:api` (dựng web, migration lên D1 cục bộ, Worker ở `http://127.0.0.1:8787`).
- **Quay lui migration:** migration chỉ thêm (append-only); sửa lỗi lược đồ bằng migration mới, không sửa tệp đã chạy.
- **Bản HTML đơn chạy offline:** tải ở GitHub Release của mỗi tag (`van-dao-vX.Y.Z.html`), hoặc artifact `van-dao-html` của lần chạy CI.
