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
| 2 | Codex #105 | [Hợp đồng GET/PUT hồ sơ](practice-profile.md) chốt request, response, lỗi, rev và vòng đời. Duyệt và merge hợp đồng trước khi triển khai Worker/client. Kiểm export/gộp khách/reset/xóa cùng gói mở ghi |
| 3 | Hermes #103 + Claude #104 | Hợp đồng biến thể 7 tuần/3 trục và bộ chọn tất định; không nhét nhóm mới vào 73 mục hiện hành khi chưa đổi validator có kiểm thử |
| 4 | Codex #105 | GET practice/today, POST practice/swap, GET practice/summary?range=week\|cycle sau bộ chọn; một đổi/trục/ngày, không tự ghi nhận Kusala |
| 5 | Codex #105 + Claude #104 | POST deeds và attest/invite, GET/POST attest/{token}; cap 5/ngày không điểm, chứng thực tùy chọn, token băm/một lần/hết hạn, chống trùng trong cùng batch |
| 6 | Codex #105 + Claude #106 | PUT reminders, POST/DELETE push/subscription + hợp đồng binding ReminderClock được duyệt/merge; sau đó mới có scheduler/sender |
| 7 | Codex + Claude #107 | Chốt tiêu chí Tầng 0→1 trước viết cổng; không dùng riêng S.completed hoặc sessions_done làm chứng cứ đã đủ tiêu chí |

Nhắc: mặc định tắt, tối đa hai/ngày, quiet 21:30–05:00, Tịnh khẩu 1–30 ngày; đúng ±1 phút theo tz, không lặp khi retry, 404/410 xóa subscription. Email chờ hạ tầng/quyền người dùng; thiếu VAPID/binding thì chưa bật push. Schema không chứng nhận các cửa kiểm này đã đạt.

## Ghi việc thiện thêm (#105)

- `POST /api/v1/deeds` dùng phiên tài khoản hoặc khách. Gửi `{ op_id, punna, parami, scope, shared? }`. Client tạo một UUID v4 trước lần gửi đầu và giữ cùng mã khi gửi lại. `punna` và từng mục `parami` lấy mã Phụ lục H, `parami` là mảng không lặp, `scope` là `doi_thuc` hoặc `dong_tu`. `shared` mặc định `false` và chỉ lưu lựa chọn cho phép chia sẻ sau này. API chỉ ghi sổ riêng.
- Máy chủ lấy ngày theo múi giờ của hồ sơ và giới hạn nguyên tử năm lượt ghi mới mỗi ngày. Trả 201 `{ deed: { id, date, punna, parami, scope, shared, at } }`. Gửi lại cùng dữ liệu trả 200 và dòng cũ. `400 invalid_deed` cho đầu vào sai, `409 deed_id_conflict` cho mã đã dùng khác dữ liệu và `429 deed_daily_limit` khi hết lượt. Không nhận ngày tự khai, số tiền, điểm hay ghi chú.
- Export trả `deeds` của người gọi. Gộp khách giữ dữ liệu lịch sử của hai bên, kể cả khi tổng số việc đã ghi trong ngày vượt năm sau gộp. Khi đã đủ lượt, từ chối ghi mới trong ngày. Xóa tài khoản xóa sổ. Tổng kết đếm mã Phước nghiệp sự và Ba-la-mật trong khoảng ngày, giữ điểm Kusala theo sổ xác nhận hiện hành.

## Chứng thực cuối tuần (#105)

- `POST /api/v1/attest/invite` nhận `{ week, op_id }` với phiên của chủ và UUID v4. Mỗi tuần chỉ một lời ở ngày 7, 14, …, 49 của chu kỳ. Trả `{ week, expires_at, link }` trong 7 ngày. Gửi lại cùng UUID trả cùng lời mời đang hiệu lực. D1 chỉ lưu băm của mã.
- Link chia sẻ dạng `/#attest=<mã>`. Client đọc mã trong fragment rồi gọi **`GET/POST /api/v1/attest/link`** với `Authorization: Bearer <mã>`. Đây là đường nhận mã thay cho tham số URL của bảng kế hoạch. URL HTTP của Worker có thể xuất hiện trong nhật ký Cloudflare. Không đưa URL có mã vào log client hoặc Analytics. GET chỉ trả tuần và hạn.
- Người nhận có thể dùng liên kết khi chưa đăng nhập. POST nhận `{ accept, attester_label?, note? }`. Nhãn là một trong `nguoi_than`, `dong_tu`, `ban_be`. Lời nhận xét của người chứng thực là tùy chọn và tối đa 300 ký tự; chỉ lưu riêng cho hai bên có quyền. Phản tỉnh của chủ vẫn ở máy. D1 thao tác nguyên tử một lần rồi xóa băm; liên kết hết hạn, đã dùng hoặc thuộc chu kỳ trước đều trả 404.
- `GET /api/v1/attest` cần phiên của người mời và trả riêng `{ cycle, weeks: [{ week, status, expires_at, attester_label, note, confirmed_at }] }`. Chỉ có lời mời của chính chủ ở chu kỳ hiện tại, thứ tự tuần tăng dần. Tuần chưa mời không có mục. Không có hành trình Sơ nhập hiện tại trả `404 journey_not_found`. Trạng thái gồm `cho`, `da_xac_nhan`, `tu_choi`, `het_han`. Lời chờ qua hạn trả `het_han` ngay cả trước lần dọn dữ liệu; kết quả đã trả lời vẫn giữ nguyên. Nhãn, ghi chú và thời điểm trả lời có thể là `null`. Phản hồi `Cache-Control: no-store` và không chứa mã, băm hay ID tài khoản.
- Export trả `attestations` (đã nhận) và `attestations_given` (đã gửi khi có phiên trình duyệt), không chứa mã/hash hay ID của bên kia. Chứng thực hoàn toàn tùy chọn, không cộng điểm và không ảnh hưởng mở tầng.

## Phối hợp và GĐ4

#101 đã merge vào `8fd09d4`. Claude giữ triển khai Duyên khởi/#104 và `workers/realtime/`/ReminderClock #106 theo quyền tệp ghi trên từng Issue. Codex giữ API/migration. GĐ4 theo #108, chưa có Lobby/HallRoom/codec/client thật hoặc báo cáo k6; vé HMAC hiện tại chỉ là nền T4.3.

Khi thiếu credits, bàn giao trong Issue trước đổi người: người cũ → người nhận, SHA/base, worktree, tệp đang giữ, commit/patch còn dở, kiểm đã đạt/lỗi, bước tiếp và điều kiện nhận lại. Người nhận xác nhận claim, dùng checkout riêng và tiền tố/nhãn đúng; ghi nguồn tác giả khi cherry-pick. Phân công thay đổi không bỏ qua phê duyệt công cụ, CI hoặc quyền merge/tag của chủ dự án.
