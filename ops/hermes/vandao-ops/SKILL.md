---
name: vandao-ops
description: Báo cáo vận hành hằng ngày của Vân Đạo (hạn mức Cloudflare Free, sức khỏe production/staging, CI và PR trên GitHub) và cảnh báo khi chạm ngưỡng. Dùng khi chạy lịch buổi sáng hoặc khi chủ dự án hỏi tình trạng Vân Đạo.
---

# vandao-ops

Làn Hermes theo `AGENTS.md` §3 và `PROJECT_ROADMAP.md` §14.6.

## Việc cần làm

1. Chạy `node daily-report.mjs` trong thư mục skill này. Script in ra báo cáo Markdown, mã thoát 0 = bình thường, 2 = có cảnh báo.
2. Gửi nguyên văn báo cáo qua kênh đã cấu hình (Telegram). Có cảnh báo thì đặt dòng cảnh báo lên đầu tin.
3. Có dòng ⚠ về hạn mức ≥ 70 % liên tục 7 ngày → đề xuất nâng Workers Paid cho tài khoản production (§3.3). Chỉ đề xuất, không tự nâng.
4. Muốn lưu báo cáo vào repo thì mở PR từ nhánh `hermes/<issue>-bao-cao`, chỉ thêm tệp trong `docs/reports/`.

## Không được

- Sửa `apps/`, `workers/`, `db/`, `.github/`, `packages/`; tạo tag; merge PR; deploy.
- Trả lời người dùng về giáo lý; chạm vào tiền hay tài khoản ngân hàng.
- Ghi token vào báo cáo, log hay repo.

## Ngưỡng cảnh báo

| Chỉ số | Cảnh báo |
|---|---|
| Yêu cầu Workers / ngày (tính chung cả tài khoản) | ≥ 70 % của 100.000 |
| Lỗi Worker `vandao` / ngày | > 1 % số yêu cầu |
| Production hoặc staging không trả HTTP 200 | luôn cảnh báo |
| Lần chạy `deploy` hoặc `ci` mới nhất trên `main` thất bại | luôn cảnh báo |
| Token `CF_PROD_API_TOKEN` | nhắc trước 14 ngày khi sắp hết hạn (11/02/2027) |
