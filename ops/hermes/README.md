# Hermes — cài skill `vandao-ops` trên homelab (T0.7)

Bộ báo cáo T2.4 nằm ở `ops/hermes/vandao-ops/`, dùng Node 26, không cần cài thêm gói. T2.4 còn chờ đối chiếu số liệu thật.

1. **Tạo token chỉ đọc**, không dùng lại token deploy:
   - Cloudflare, mỗi tài khoản một token: quyền `Account → Account Analytics → Read`, chỉ tài khoản đó.
   - GitHub fine-grained token: chỉ repo `tnfsmith/Buddha`, quyền Read cho Actions, Contents, Pull requests.
2. **Chép skill:** `cp -r ops/hermes/vandao-ops ~/.hermes/skills/` trên máy chạy Hermes.
3. **Đặt biến môi trường** cho Hermes: `CF_ANALYTICS_TOKEN_PROD`, `CF_ACCOUNT_ID_PROD=a5f038f559fac121cc2a67c4a2528506`, `CF_ANALYTICS_TOKEN_STAGING`, `CF_ACCOUNT_ID_STAGING=f8ba0d188e9921d6f3034a7bbbfb8fcc`, `GITHUB_TOKEN`.
4. **Kiểm thử không gọi mạng**, từ gốc repo: `node --test ops/hermes/vandao-ops/daily-report.test.mjs`.
5. **Chạy thật:** `node ~/.hermes/skills/vandao-ops/daily-report.mjs`. Mã 2 nghĩa là có cảnh báo hoặc phạm vi đo chưa đủ. Vẫn chuyển nội dung báo cáo khi nhận mã 2 để chủ dự án thấy chỉ số thiếu hoặc vượt ngưỡng. Script chỉ in báo cáo.
6. **Trên homelab:** kiểm quyền token và so số với dashboard cùng ngày UTC, nhận đủ 3 báo cáo sáng liên tiếp rồi mới nghiệm thu. **Kênh đã chọn: Telegram**; còn cần đích chat, máy homelab và cấu hình chứng thực trên máy đó. Gói này chưa cài lịch hoặc gửi Telegram.

Kỳ đo là ngày UTC đã đóng trước ngày chạy (quota reset 00:00 UTC). Chạy ngay 07:00 Việt Nam có thể gặp số liệu trễ, cần kiểm lại dashboard. Workers/D1/KV truy vấn cả tài khoản. D1 và KV lấy đỉnh trong ngày theo từng DB hoặc namespace rồi cộng để cảnh báo sớm. Trong bước đối chiếu, kiểm đủ các namespace trong dashboard, gồm CONFIG. GB/MB dùng byte thập phân.

Analytics Engine dùng `SUM(_sample_interval)` để ước tính số điểm của `vd_metrics` và `vd_metrics_staging` theo từng tài khoản. Chạm 70.000 điểm ước tính sẽ cảnh báo sớm. Các giá trị này chỉ phản ánh dataset Vân Đạo. Báo cáo chưa đo AE cả tài khoản, lượt sync/auth và mã rejected, DO, chi phí hoặc tự xác nhận chuỗi 7 ngày ≥70%. Các khoảng trống vẫn đưa mã 2. `errors` của Workers là lỗi thực thi. Thiếu dataset/snapshot không coi là số 0. Web phải trả HTTP 200 và `/api/health` phải xác nhận `service=vandao-api`, `status=ok`. Hạn token deploy 11/02/2027 lấy từ hồ sơ.

GitHub lấy SHA của main trước rồi tìm CI từ sự kiện push và lượt triển khai staging ứng với SHA đó. Deploy chỉ báo đạt khi cả hai bước Deploy staging và Kiểm khói staging đạt. Kiểm sức khỏe web/API vẫn tách riêng. Báo cáo chưa đọc SHA trực tiếp từ Worker đang phục vụ.

Nguồn: [Workers](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/), [D1 analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [KV analytics](https://developers.cloudflare.com/kv/observability/metrics-analytics/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), [AE SQL](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/), [AE pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/), [GitHub workflow runs](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow).

Nghiệm thu T0.7: nhận đủ 3 báo cáo sáng liên tiếp; không token nào của Hermes có quyền ghi Worker hay repo.
