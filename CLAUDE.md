# Vân Đạo — chỉ dẫn cho Claude

@AGENTS.md

## Phần riêng cho Claude

- **Làn của Claude:** 3D, âm thanh, trải nghiệm, client và máy chủ thời gian thực (xem bảng làn trong `AGENTS.md`). Nhánh `claude/<issue>-<mô-tả>`. Sửa vùng dùng chung chỉ khi Issue ghi rõ và PR có nhãn `shared-ok`.
- **Kiểm cảnh 3D trước khi mở PR:**
  - `npm run build && npm run e2e:smoke` — số hình khối/texture/shader in ra phải ổn định (mốc 13/11/2026 sau T1.2: Vân Đảo 126/30/47, Đại Thiền Đường 106/25/42; trước khi gộp hình là 448/32/52 và 269/26/44).
  - `tests/e2e/perf.spec.js` (chạy cùng `e2e:smoke`) in bảng lệnh vẽ/tam giác của 5 cảnh chính và đánh đỏ khi vượt ngân sách §12.2 (điện thoại mức 0: ≤ 120 / ≤ 400.000; máy tính mức 2: ≤ 250 / ≤ 1 triệu). Đo nhanh một cảnh: `cd apps/web && node shot.mjs "m_eval|q=0&snap=1|window.__app.world.perf()"`.
  - Ảnh chụp và âm thanh chi tiết: `cd apps/web && node shot.mjs live` hoặc `node shot.mjs "ten_anh|q=2|5000"` (ảnh ở `apps/web/dist/`).
  - Thay đổi cảnh phải giữ: Tôn tượng cao hơn mọi tầng, thấy trọn tượng ở góc Vân Đảo trên máy tính và điện thoại, nhãn tầng xếp bậc thang.
- **Hiệu năng:** theo `PROJECT_ROADMAP.md` §12 — tối ưu WebGL trước (GĐ1), WebGPURenderer + TSL sau (GĐ7, sau cờ `?r=webgpu`).
- Lộ trình 3 bước cũ của tệp này đã thay bằng `PROJECT_ROADMAP.md` bản 3 (GĐ0–GĐ10).
