# Triển khai Vân Đạo lên Cloudflare Workers

Trang chạy tại https://vandao.ainextbrain.com — Worker `vandao` (tài khoản Cloudflare của anh Le), phục vụ `van-dao.html` dưới dạng Workers Static Assets tại `/index.html`.

## Cấu hình hiện tại

- Worker: `vandao`, một module chỉ chuyển tiếp `env.ASSETS.fetch(request)`; binding `ASSETS`; `compatibility_date` 2026-10-01.
- Assets: `html_handling: auto-trailing-slash`, `not_found_handling: single-page-application` (đường dẫn lạ trả về trang chính).
- Tên miền: Custom Domain `vandao.ainextbrain.com` trên zone `ainextbrain.com`; Cloudflare tự tạo bản ghi DNS và chứng chỉ.
- Chưa có dữ liệu phía máy chủ: tiến trình, nhân vật, thiết lập nhạc lưu trong localStorage của từng trình duyệt.

## Cập nhật bản mới bằng Wrangler

```
npm install && node build.mjs          # tạo dist/van-dao.html
mkdir -p public && cp dist/van-dao.html public/index.html
npx wrangler deploy                    # dùng wrangler.jsonc bên dưới
```

`wrangler.jsonc`:

```jsonc
{
  "name": "vandao",
  "main": "worker.js",
  "compatibility_date": "2026-10-01",
  "assets": { "directory": "./public", "binding": "ASSETS", "html_handling": "auto-trailing-slash", "not_found_handling": "single-page-application" },
  "routes": [{ "pattern": "vandao.ainextbrain.com", "custom_domain": true }]
}
```

`worker.js`:

```js
export default { async fetch(request, env) { return env.ASSETS.fetch(request); } };
```

## Cập nhật qua API (cách đã dùng lần đầu)

1. `POST /accounts/{account}/workers/scripts/vandao/assets-upload-session` với manifest `{"/index.html": {hash, size}}` (hash = 32 ký tự hex đầu của SHA-256 tệp).
2. `POST /accounts/{account}/workers/assets/upload?base64=true` kèm JWT của bước 1, trường form tên là hash, nội dung là tệp mã hóa base64, kiểu `text/html`.
3. `PUT /accounts/{account}/workers/scripts/vandao` với metadata có `assets.jwt` là JWT hoàn tất của bước 2.
