# Hermes — cài skill `vandao-ops` trên homelab (T0.7)

Gói đầu Workers/D1/KV của T2.4 nằm ở `ops/hermes/vandao-ops/`, dùng Node 26, không cần cài thêm gói; T2.4 chưa nghiệm thu.

1. **Tạo token chỉ đọc**, không dùng lại token deploy:
   - Cloudflare, mỗi tài khoản một token: quyền `Account → Account Analytics → Read`, chỉ tài khoản đó.
   - GitHub fine-grained token: chỉ repo `tnfsmith/Buddha`, quyền Read cho Actions, Contents, Pull requests.
2. **Chép skill:** `cp -r ops/hermes/vandao-ops ~/.hermes/skills/` trên máy chạy Hermes.
3. **Đặt biến môi trường** cho Hermes: `CF_ANALYTICS_TOKEN_PROD`, `CF_ACCOUNT_ID_PROD=a5f038f559fac121cc2a67c4a2528506`, `CF_ANALYTICS_TOKEN_STAGING`, `CF_ACCOUNT_ID_STAGING=f8ba0d188e9921d6f3034a7bbbfb8fcc`, `GITHUB_TOKEN`.
4. **Kiểm thử không gọi mạng**, từ gốc repo: `node --test ops/hermes/vandao-ops/daily-report.test.mjs`.
5. **Chạy thật:** `node ~/.hermes/skills/vandao-ops/daily-report.mjs`. Mã 2: có cảnh báo/không đo được, kể cả thiếu cấu hình hoặc phạm vi đo chưa đủ. Gói hiện tại luôn cảnh báo phạm vi T2.4 chưa đủ, dù các nguồn Workers/D1/KV đều tốt; chưa thể trả mã 0. Script chỉ in báo cáo, không gửi tin hay tạo lịch.
6. **Trên homelab:** kiểm quyền token và so số với dashboard cùng ngày UTC, nhận đủ 3 báo cáo sáng liên tiếp rồi mới nghiệm thu. **Kênh đã chọn: Telegram**; còn cần đích chat, máy homelab và cấu hình chứng thực trên máy đó. Gói này chưa cài lịch hoặc gửi Telegram.

Kỳ đo là ngày UTC đã đóng trước ngày chạy (quota reset 00:00 UTC); chạy ngay 07:00 Việt Nam có thể gặp số liệu trễ, cần kiểm lại dashboard. Workers/D1/KV tính toàn tài khoản, không chỉ Vân Đạo. D1 dung lượng là mức tối đa trong ngày theo từng DB; GB/MB dùng byte thập phân, cảnh báo sớm theo hướng bảo thủ.

Giới hạn: chưa đo AE, số lượt sync/auth và mã rejected, KV storage, DO, chi phí; chưa tự xác nhận chuỗi 7 ngày ≥70%. Những khoảng trống này xuất hiện là "không đo được" và mã 2. `errors` của Workers là lỗi thực thi, không phải số HTTP 5xx. Thiếu dataset/snapshot không coi là số 0. Web phải trả đúng HTTP 200; `/api/health` còn phải xác nhận `service=vandao-api`, `status=ok`. Hạn token deploy 11/02/2027 lấy từ hồ sơ, chưa truy vấn TTL.

GitHub hiển thị kết quả và SHA của lần chạy `ci`/`deploy` mới nhất trên nhánh main; chưa đối chiếu SHA với HEAD hiện tại hoặc phiên bản thật đang phục vụ. Trạng thái success không chứng minh toàn bộ main/deployment hiện tại đã được kiểm tra.

Nguồn: [Workers](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/), [D1 analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [KV analytics](https://developers.cloudflare.com/kv/observability/metrics-analytics/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/).

Nghiệm thu T0.7: nhận đủ 3 báo cáo sáng liên tiếp; không token nào của Hermes có quyền ghi Worker hay repo.
