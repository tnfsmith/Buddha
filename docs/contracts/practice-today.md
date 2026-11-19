# Hợp đồng gợi ý hôm nay, đổi gợi ý và tổng kết · #105

Áp dụng cho Bia Tích Lũy Sơ nhập 49 ngày sau [hồ sơ #111](practice-profile.md) và [bộ chọn #128](so-nhap-variants.md). Codex triển khai Worker/D1, Claude nối giao diện. Bản hợp đồng cần merge trước khi hai bên nối API. Chưa có endpoint, cờ hay migration mới trong PR hợp đồng.

## Đường dẫn và dữ liệu chung

| Đường dẫn | Đầu vào | Thành công |
|---|---|---|
| `GET /api/v1/practice/today` | Phiên hiện tại | `{ program, cycle, day, date, profile_rev, snap, suggestions, meditation }` |
| `POST /api/v1/practice/swap` | JSON `{ op_id, cycle, day, date, pillar, current }` | Cùng hình dạng với `today`, áp cho ngày hiện tại |
| `GET /api/v1/practice/summary?range=week\|cycle` | `range` bắt buộc, theo chu kỳ hiện tại | `{ program, cycle, range, from, to, pillars, lotus, punna, meditation_minutes }` |

- Dùng phiên hiện hành, kể cả khách, giới hạn theo người dùng và `Cache-Control: no-store`. Worker tự lấy `user_id`, hành trình hiện tại và ngày địa phương `YYYY-MM-DD` theo `profile.tz`. Ngày hành trình theo luật tiến ngày hiện có, một nấc/ngày. `cycle/day/date` khách gửi chỉ dùng để phát hiện trạng thái cũ. Không dùng tên, múi giờ hay hồ sơ do request tự khai.
- `profile_rev` theo #111, bằng `0` khi chưa có hồ sơ. `snap` là `snapHash` của danh mục công khai hiện hành theo #112. Hai thiết bị chỉ tính ra cùng lựa chọn khi cùng tài khoản, ngày, chu kỳ, hồ sơ và danh mục.
- `suggestions` có ba khóa `duc`, `thien`, `tue`. Mỗi khóa là `{ variant, swapped, confirmed }`. `variant` là `null` hoặc `{ id, version, title, text, source_ref }` theo bộ chọn. `swapped` cho biết đã đổi ngày này; `confirmed` là trục đã xác nhận trong sổ. `null` → giữ thẻ gợi ý chung của tuần. Hành trình hoàn thành có thể đọc tổng kết, không tạo gợi ý cá nhân mới.
- `meditation` gửi `{ time_window, standard_minutes: 15, suggested_minutes }` khi có hồ sơ, còn lại `null`. `suggested_minutes` lấy từ lựa chọn đã lưu. Thời thiền chuẩn vẫn 15 phút và 7 mốc. Nếu chọn dài hơn, phần còn lại là tĩnh tọa tự do.

## Lựa chọn và đổi

1. Lấy danh mục `chuong_trinh`/`tier=0` theo cùng quy tắc công khai của API danh mục. Khi đủ độ phủ, tạo gợi ý bằng #128 và lưu `variant_id, version, snap, profile_rev` kèm `user_id, program, cycle, day, local_date, pillar`. Lượt đọc đầu có thể lưu lựa chọn nhưng không ghi nhận trục hoặc sửa điểm. Khóa duy nhất theo người/chương trình/chu kỳ/ngày địa phương/trục. Hai thiết bị đọc lần đầu cùng lúc nhận bản đã thắng trong D1.
2. Đọc lại lựa chọn đã lưu trong ngày. Khi danh mục có bản mới, bản đã chọn vẫn giữ nếu phiên bản đó còn công khai, đúng ô và phù hợp hồ sơ. Nếu bản đó bị rút/ngừng hoặc không còn phù hợp, trả `variant: null` để hiện gợi ý tuần. Giữ trạng thái đã đổi và đã xác nhận. Không đưa câu chữ đã rút vào payload mới. Khi chưa có lựa chọn, không tạo dòng rỗng nếu chưa có hồ sơ hoặc chưa có gợi ý hợp lệ.
3. `current` là `{ id, version }` của lựa chọn đang thấy. `op_id` theo quy tắc ID của `/sync`. Dùng `swapVariant` trên danh mục hiện hành. So sánh chu kỳ, ngày, phiên bản hồ sơ, trạng thái xác nhận và lựa chọn hiện tại ngay lúc cập nhật có điều kiện. Kiểm lại bản thay thế còn công khai khi ghi. Chỉ đổi **một lần** mỗi trục mỗi ngày địa phương. Lưu lựa chọn mới, dấu thao tác và cờ đã đổi trong cùng giao dịch, giữ nguyên sổ và Kusala. Đồng thời hai thiết bị chỉ một lượt thắng. Gửi lại cùng ID và dữ liệu sau khi mất phản hồi trả kết quả hiện hành mà không ghi lần nữa; tái dùng ID cho thao tác khác là lỗi.
4. Offline có thể xem cache của đúng tài khoản và chu kỳ, ghi thao tác `practice.swap` vào outbox theo §5.1. Dùng cùng `op_id` cho lần gửi trực tiếp và lần gửi lại qua `/sync`. Payload outbox là `{ cycle, day, date, pillar, current }`, ID nằm ở `ops[].id`. Khi đồng bộ, máy chủ dùng chung quy tắc đổi; thao tác đã thắng luôn có thể nhận lại xác nhận. Thao tác chưa thắng và đã qua ngày hoặc đổi chu kỳ hết hiệu lực, không áp lên ngày mới. Khi nối lại, giao diện đọc `today` rồi hiển thị kết quả đã lưu; không đưa lựa chọn offline của một tài khoản sang tài khoản khác.

### Lỗi và cập nhật trạng thái

Lỗi theo `{ "error": { "code": "...", "message": "..." } }`. `400 invalid_practice_swap` hoặc `invalid_range` cho đầu vào sai; `401 unauthorized` khi thiếu phiên; `404 journey_not_found` khi chưa có hành trình. Nhóm `409`: `stale_cycle`, `stale_day`, `practice_choice_changed`, `practice_swap_used`, `practice_pillar_confirmed`, `practice_no_alternative`, `practice_swap_id_conflict`. Với các lỗi trạng thái, đọc lại `today`; chỉ cho người dùng đổi lại khi trạng thái mới còn cho phép. Không tiêu lượt đổi khi từ chối. `/sync` trả code trong `rejected`; xung đột trạng thái trên đây không tự thử lại, lỗi tạm thời theo quy tắc outbox hiện hành.

## Tổng kết và vòng đời

- `range=week` là 7 ngày địa phương đến cuối khoảng, cắt đầu tại ngày bắt đầu chu kỳ. `range=cycle` là từ ngày bắt đầu đến hôm nay; sau khi hoàn thành, giới hạn đến ngày hoàn thành. `from` và `to` bao gồm hai đầu, theo múi giờ hồ sơ; nếu tuần đã qua mốc kết thúc, dùng tuần kết thúc tại ngày hoàn thành. Đây là khoảng thống kê, không đổi số ngày hành trình. Tổng kết dùng chung phép đếm thuần để dữ liệu offline và Worker cho cùng kết quả khi đầu vào trùng.
- `pillars` là tổng E đã ghi riêng cho ba trục và `all`. `lotus` trả `counts` và `norm` từ quy tắc hoa sen dùng chung; dùng dữ liệu đã ghi nhận của khoảng yêu cầu. `punna` đếm theo mã Phước nghiệp sự có trong danh mục của việc đã ghi nhận hoặc mã tự ghi nhận hợp lệ; không suy mã từ gợi ý chưa làm. `meditation_minutes` chỉ cộng thời thiền `thoi_thien` trong sổ tự ghi nhận đã gộp bằng `foldPractice` để không cộng đôi với `practice_session`. Mục không còn mã nguồn phù hợp không được suy đoán. Gói deeds sẽ bổ sung số liệu việc thiện khi có API. Không đưa chữ quán chiếu, ghi chú, danh sách người khác hoặc dữ liệu xếp hạng vào phần tổng kết.
- Export thêm `practice_choices` cho các chu kỳ đã lưu, gồm khóa hành trình, ngày, trục, ID/phiên bản, dấu danh mục và thời điểm chọn/đổi; không xuất câu đã rút hay ID thao tác nội bộ. Mỗi lượt ghi phải thuộc hành trình của người gọi và xóa cùng tài khoản. Đổi chu kỳ giữ lịch sử và mở khóa của chu kỳ mới. Gộp khách áp cùng quyết định giữ hành trình của luồng #111: giữ dữ liệu đích nếu chọn hành trình đích, chuyển lựa chọn của khách cùng giao dịch nếu chuyển hành trình khách. Dòng không thuộc hành trình được giữ không được làm mất lượt đổi của hành trình đích.

## Nghiệm thu trước khi nối giao diện

- Worker/D1 với 63 mục đã duyệt: gợi ý trùng `rankVariants`, kiểm tuần 1/2, ngày 49 và hồ sơ 5 phút tại nhà miễn phí. Khi thiếu hồ sơ, thiếu độ phủ hoặc đã rút mục có lưu, trả gợi ý tuần đúng quy tắc.
- Hai thiết bị đọc lần đầu/đổi cùng lúc, gửi lại qua hai đường, gửi lại qua nửa đêm và ngay sau đổi chu kỳ. Chứng minh chỉ một lần đổi được ghi, một lần từ chối không tiêu lượt, xác nhận trục không bị thay hoặc tăng Kusala.
- Tổng kết rỗng và có dữ liệu qua biên tuần; chứng minh không cộng đôi thời thiền, không đưa gợi ý chưa làm vào hoa sen hoặc Phước nghiệp sự. Export, gộp khách giữ/chuyển, reset, xóa và tách phiên phải được kiểm trước khi mở ghi.
