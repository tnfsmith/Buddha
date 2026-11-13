# Triển khai

Từ GĐ0 (13/11/2026) mọi lần deploy chạy bằng GitHub Actions, không deploy từ máy cá nhân:

- PR → preview `pr-N` trên tài khoản Cloudflare staging (`.github/workflows/preview.yml`)
- merge `main` → staging `https://vandao-staging.vandao-staging.workers.dev`
- tag `vX.Y.Z` → production `https://vandao.ainextbrain.com`

Chi tiết môi trường, token và runbook quay lui: `docs/infra.md`. Cấu hình Worker: `wrangler.jsonc` (production ở cấp gốc, staging ở `env.staging`).
