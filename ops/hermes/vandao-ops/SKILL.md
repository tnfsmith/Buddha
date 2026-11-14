---
name: vandao-ops
description: Báo cáo vận hành hằng ngày của Vân Đạo (hạn mức Cloudflare Free, sức khỏe production/staging, CI và PR trên GitHub) và cảnh báo khi chạm ngưỡng. Dùng khi chạy lịch buổi sáng hoặc khi chủ dự án hỏi tình trạng Vân Đạo.
---

# vandao-ops

Làn Hermes theo `AGENTS.md` §3 và `PROJECT_ROADMAP.md` §14.6.

## Việc cần làm

1. Chạy fixture `node --test daily-report.test.mjs`, rồi `node daily-report.mjs`. Script in Markdown; mã 2 = cảnh báo hoặc không đo được (kể cả thiếu token/phạm vi). Gói Workers/D1/KV hiện chưa đủ nguồn T2.4 nên luôn cảnh báo phạm vi và chưa trả mã 0; không suy ra đã nghiệm thu.
2. Chỉ gửi qua kênh/lịch đã được chủ dự án chỉ định. Script không tự tạo lịch hay gửi tin nhắn; chưa đủ 3 báo cáo thật thì chưa nghiệm thu T0.7/T2.4.
3. Chỉ đề xuất nâng Paid sau khi đối chiếu đủ 7 báo cáo ngày UTC liên tiếp ≥ 70 %, không có ngày thiếu; script chưa tự kiểm chuỗi này. Không tự nâng gói.
4. Muốn lưu báo cáo vào repo thì mở PR từ nhánh `hermes/<issue>-bao-cao`, chỉ thêm tệp trong `docs/reports/`.

## Không được

- Sửa `apps/`, `workers/`, `db/`, `.github/`, `packages/`; tạo tag; merge PR; deploy.
- Trả lời người dùng về giáo lý; chạm vào tiền hay tài khoản ngân hàng.
- Ghi token vào báo cáo, log hay repo.

## Ngưỡng cảnh báo

| Chỉ số | Cảnh báo |
|---|---|
| Yêu cầu Workers / ngày (tính chung cả tài khoản) | ≥ 70 % của 100.000 |
| D1 dòng đọc/ghi / ngày, cả tài khoản | ≥ 70 % của 5 triệu/100.000 |
| D1 dung lượng, snapshot tối đa trong ngày | ≥ 70 % của 500 MB/DB hoặc 5 GB/account |
| KV đọc/ghi/xóa/list / ngày, cả tài khoản | ≥ 70 % của 100.000/1.000/1.000/1.000 |
| Lỗi Worker `vandao` / ngày | > 1 % số yêu cầu |
| Production hoặc staging không trả HTTP 200 | luôn cảnh báo |
| Lần chạy `deploy` hoặc `ci` mới nhất trên `main` thất bại | luôn cảnh báo |
| Token `CF_PROD_API_TOKEN` | nhắc trước 14 ngày khi sắp hết hạn (11/02/2027) |

AE, đếm sync/auth và mã rejected, KV storage, DO, chi phí: chưa đo trong gói này, phải báo "không đo được" và mã 2. Không gọi số lỗi thực thi Workers là HTTP 5xx. Đọc `../README.md` để chuẩn bị token chỉ đọc và đối chiếu dashboard; không in token hoặc ghi vào repo.
