# GĐ3 — nền dữ liệu và thứ tự hợp đồng (#102)

Ngày 18/11/2026, base `4e84324` / production v0.17.1. **GĐ3 chưa hoàn tất.** Tài liệu này cùng migration 0010 phải được duyệt/merge trước khi hai phía triển khai API/client mới. Các endpoint dưới đây là kế hoạch, chưa có trên main.

## Nền đã có

`practice.event`, `PRACTICE_V=1`, `MAX_EVENTS_PER_DAY=60`, `/me?entries=1` và export theo #93/#94/#99 vẫn là hợp đồng đang chạy. Không thay bằng cấu trúc sự kiện cũ ở §9.4 của thiết kế Sơ nhập. Không nhập lại sổ đã đánh dấu hoặc đổi công thức Kusala.

0010 chỉ thêm năm bảng theo ROADMAP §4.6, không tạo dòng cho người dùng và không gửi thông báo:

| Bảng | Dữ liệu | Ràng buộc và phần API phải kiểm thêm |
|---|---|---|
| practice_profile | level, minutes, time_window, familiarity, precepts_json, uposatha, no_money, at_home | Enum/5–120 phút/JSON array tại DB; API kiểm giới 1–5, không trùng, không chữ riêng tư |
| deed_log | ngày, mã punna/parami, scope, shared, at | Không trường số tiền/điểm/ghi chú; API kiểm mã parami, ngày theo tz và tối đa 5/ngày |
| reminder | loại, HH:MM, days_mask, channel, next_at, paused_until | HH 00–23, mask 0–127; **active mặc định 0** theo §9.2, khác ví dụ SQL active=1; chỉ opt-in mới bật |
| push_subscription | endpoint HTTPS, p256dh, auth, fail_count | Endpoint duy nhất; API kiểm URL/khóa và quyền chủ sở hữu, không chiếm đăng ký của người khác |
| attestation | chu kỳ, tuần, người chứng thực/nhãn, token_hash, trạng thái | Tuần 1–7, token hash duy nhất; người chứng thực bị xóa thì SET NULL, chủ nhân bị xóa thì CASCADE |

Mọi timestamp là UTC milliseconds; ngày nghiệp vụ theo profile.tz. Không log nội dung phản tỉnh, token mời, endpoint/khóa push. Trường note của ví dụ attestation chưa được endpoint nào nhận; phản tỉnh cá nhân tiếp tục ở máy.

## Gói tiếp theo và cửa kiểm

| Thứ tự | Người / Issue | Kết quả trước khi bên kia dùng |
|---|---|---|
| 1 | Codex #102 | Schema + kiểm nâng DB 9→10, mặc định tắt, FK/cascade, rollback; không tự bật API |
| 2 | Codex #105 | PUT practice/profile trước; chốt request/response/error và rev trong PR hợp đồng rồi mới viết client. Export/gộp khách/reset/xóa phải xử lý bảng mới trước bật ghi |
| 3 | Hermes #103 + Claude #104 | Hợp đồng biến thể 7 tuần/3 trục và bộ chọn tất định; không nhét nhóm mới vào 73 mục hiện hành khi chưa đổi validator có kiểm thử |
| 4 | Codex #105 | GET practice/today, POST practice/swap, GET practice/summary?range=week\|cycle sau bộ chọn; một đổi/trục/ngày, không tự ghi nhận Kusala |
| 5 | Codex #105 + Claude #104 | POST deeds và attest/invite, GET/POST attest/{token}; cap 5/ngày không điểm, chứng thực tùy chọn, token băm/một lần/hết hạn, chống trùng trong cùng batch |
| 6 | Codex #105 + Claude #106 | PUT reminders, POST/DELETE push/subscription + hợp đồng binding ReminderClock được duyệt/merge; sau đó mới có scheduler/sender |
| 7 | Codex + Claude #107 | Chốt tiêu chí Tầng 0→1 trước viết cổng; không dùng riêng S.completed hoặc sessions_done làm chứng cứ đã đủ tiêu chí |

Nhắc: mặc định tắt, tối đa hai/ngày, quiet 21:30–05:00, Tịnh khẩu 1–30 ngày; đúng ±1 phút theo tz, không lặp khi retry, 404/410 xóa subscription. Email chờ hạ tầng/quyền người dùng; thiếu VAPID/binding thì chưa bật push. Schema không chứng nhận các cửa kiểm này đã đạt.

## Phối hợp và GĐ4

Claude giữ 8 tệp 3D và tests/e2e/smoke.spec.js của #101; Codex không sửa. `workers/realtime/`/ReminderClock do Claude nhận ở #106 sau hợp đồng, API/migration do Codex. Không hai người sửa package-lock hoặc vùng shared cùng lúc. GĐ4 theo #108, chưa có Lobby/HallRoom/codec/client thật hoặc báo cáo k6; vé HMAC hiện tại chỉ là nền T4.3.

Khi thiếu credits, bàn giao trong Issue trước đổi người: người cũ → người nhận, SHA/base, worktree, tệp đang giữ, commit/patch còn dở, kiểm đã đạt/lỗi, bước tiếp và điều kiện nhận lại. Người nhận xác nhận claim, dùng checkout riêng và tiền tố/nhãn đúng; ghi nguồn tác giả khi cherry-pick. Phân công thay đổi không bỏ qua phê duyệt công cụ, CI hoặc quyền merge/tag của chủ dự án.
