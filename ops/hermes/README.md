# Hermes — cài skill `vandao-ops` trên homelab (T0.7)

Skill nằm ở `ops/hermes/vandao-ops/`: `SKILL.md` (việc và giới hạn), `daily-report.mjs` (Node ≥ 22, không cần cài gói).

1. **Tạo token chỉ đọc**, không dùng lại token deploy:
   - Cloudflare, mỗi tài khoản một token: quyền `Account → Account Analytics → Read`, chỉ tài khoản đó.
   - GitHub fine-grained token: chỉ repo `tnfsmith/Buddha`, quyền Read cho Actions, Contents, Pull requests.
2. **Chép skill:** `cp -r ops/hermes/vandao-ops ~/.hermes/skills/` trên máy chạy Hermes.
3. **Đặt biến môi trường** cho Hermes: `CF_ANALYTICS_TOKEN_PROD`, `CF_ACCOUNT_ID_PROD=a5f038f559fac121cc2a67c4a2528506`, `CF_ANALYTICS_TOKEN_STAGING`, `CF_ACCOUNT_ID_STAGING=f8ba0d188e9921d6f3034a7bbbfb8fcc`, `GITHUB_TOKEN`.
4. **Chạy thử:** `node ~/.hermes/skills/vandao-ops/daily-report.mjs` (thiếu token phần nào thì báo cáo ghi "chưa cấu hình", không lỗi).
5. **Lịch:** tạo việc cron của Hermes lúc 07:00 giờ Việt Nam mỗi ngày, nội dung "chạy skill vandao-ops và gửi báo cáo qua Telegram".

Nghiệm thu T0.7: nhận đủ 3 báo cáo sáng liên tiếp; không token nào của Hermes có quyền ghi Worker hay repo.
