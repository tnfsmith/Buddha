# Hạ tầng Vân Đạo (cập nhật 13/11/2026)

Hai tài khoản Cloudflare (gói Workers Free), tách để preview/staging/kiểm thử tải không ăn hạn mức của production (PROJECT_ROADMAP.md §14.8).

| Môi trường | Kích hoạt | Worker | URL | Tài khoản Cloudflare | Secrets GitHub |
|---|---|---|---|---|---|
| Preview | Mỗi PR (`preview.yml`) | `vandao-staging`, phiên bản alias `pr-N` | `https://pr-N-vandao-staging.vandao-staging.workers.dev` | staging `f8ba0d18…` | `CF_STAGING_*` |
| Staging | Merge vào `main` (`deploy.yml`) | `vandao-staging` | `https://vandao-staging.vandao-staging.workers.dev` | staging `f8ba0d18…` | `CF_STAGING_*` |
| Production | Tag `vX.Y.Z` (`deploy.yml`) | `vandao` | `https://vandao.ainextbrain.com` | production `a5f038f5…` | `CF_PROD_*` |

## Tài nguyên staging đã tạo (T0.4)

Chưa gắn vào Worker; GĐ2 (`workers/api`) khai báo binding trong `env.staging`.

| Loại | Tên | ID |
|---|---|---|
| D1 | `vandao-core-staging` | `a9c4ecd2-2084-4aa8-9a63-a2e716d06044` |
| D1 | `vandao-core-preview` | `549c6cff-0e8b-4ebe-8f14-45999f47d8aa` |
| KV | `vandao-config-staging` | `52f5a88f999344b5a04ec7aa1ae84325` |
| R2 | `vandao-media-staging` | — |
| workers.dev | subdomain `vandao-staging` | — |

## Token

| Secret | Phạm vi | Hết hạn |
|---|---|---|
| `CF_PROD_API_TOKEN` (`vandao-ci-production`) | Tài khoản production + zone `ainextbrain.com`: Workers Scripts/Routes, D1, KV, R2, Queues (Edit); Account Settings, Workers Tail (Read); User Details, Memberships (Read) | 11/02/2027 — tạo token mới và cập nhật secret trước ngày này |
| `CF_STAGING_API_TOKEN` | Tài khoản staging: Workers Scripts, D1, KV, R2, Queues (Edit) | theo cài đặt của chủ dự án |

## Bản web và offline (T1.1)

- `public/` (Worker phục vụ): `index.html` + `manifest.webmanifest` + `sw.js` + biểu tượng SVG. Service worker: trang ưu tiên mạng, mất mạng hoặc chậm quá 3 giây thì dùng bản đã lưu; tài nguyên tĩnh ưu tiên bộ đệm; bỏ qua `/api/`, `/ws/`. Tên bộ đệm theo băm của `index.html`, bản mới tự xóa bộ đệm cũ.
- Dữ liệu trên máy: `localStorage['vandao.v1']` (đọc lúc khởi động) + IndexedDB `vandao` (store `state`, `outbox`, `meta`). localStorage bị xóa mà IndexedDB còn thì tự khôi phục.
- Bản HTML đơn (`dist/van-dao.html`, Release) không có service worker; mở bằng file:// vẫn chạy offline.

## Runbook ngắn

- **Phát hành production:** GitHub (web/app) → Releases → Draft a new release → tag mới `vX.Y.Z` từ `main` → Publish. Workflow `deploy` chạy lại toàn bộ CI rồi mới deploy; theo dõi ở tab Actions.
- **Quay lui production:** `cd apps/web && npx wrangler rollback` (cần `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` của production), hoặc Cloudflare dashboard → Workers → `vandao` → Deployments → chọn bản trước. Sau đó sửa lỗi qua nhánh `hotfix/*` và gắn tag bản vá.
- **Deploy staging thủ công:** `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run deploy:staging`.
- **Bản HTML đơn chạy offline:** tải ở GitHub Release của mỗi tag (`van-dao-vX.Y.Z.html`), hoặc artifact `van-dao-html` của lần chạy CI.
