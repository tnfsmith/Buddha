# Hợp đồng mở Tầng 1 (#107)

Chủ dự án đã duyệt tiêu chí ngày 20/11/2026. Hợp đồng dùng cho chương trình «Sơ nhập Tịnh Cảnh» (`so-nhap-49`) và cổng Nhập Lưu Tịnh Cảnh. [Quyết định #107](https://github.com/tnfsmith/Buddha/issues/107#issuecomment-7036036276)

## 1. Ba điều kiện bắt buộc

| Điều kiện | Nguồn phía máy chủ |
|---|---|
| Hoàn tất 49 ngày Sơ nhập | `journey.is_current = 1`, đúng chương trình, `day >= 49` và có `completed_at` |
| Ít nhất 30 thời thiền trọn | `practice_event` của đúng chủ tài khoản, chương trình và chu kỳ. Đếm từng sự kiện `kind='tu'`, `slot='thoi_thien'` có `n=1` và `min >= 12`, theo ngưỡng 12/15 phút đã chốt cho Sơ nhập |
| Đã tự vấn tuần 7 | Cờ hoàn tất của đúng tài khoản và chu kỳ ghi trong `tier_progress.criteria_json` |

Chứng thực tuần là tùy chọn. Điều kiện mở được khai báo bằng dữ liệu phiên bản hóa trong `content/` và đưa vào bản dựng Worker. Cấu hình ghi chương trình, tầng đích, mốc 49 ngày, tối thiểu 30 thời thiền, ngưỡng 12 phút và tuần phản tỉnh 7. Thay đổi giá trị cần quyết định của chủ dự án. Công thức Kusala và quy tắc tiến một nấc mỗi ngày giữ theo luật dùng chung.

`practice_event` đã tách chu kỳ và chống trùng theo `(user_id, id)`. Một thời thiền có thể được ghi cả vào `practice_event` và `practice_session`, nên bộ đếm dùng một nguồn. Bản nhập cũ có một thời và đủ số phút vẫn có thể được tính. Bản gộp chỉ có tổng số lần và tổng phút không chứng minh độ dài từng thời, nên giữ trong sổ và để ngoài bộ đếm mở tầng. [Thiết kế Sơ nhập, mục 10](../noi-dung/nhiem-vu-so-nhap.md#10-quyết-định-của-chủ-dự-án-15112026-85)

Máy khách ghi số phút thực hành của thời thiền vào `practice_event`. Kéo thanh thời gian không tăng số phút thực hành. Các thời thiền đã đồng bộ dùng theo dữ kiện hiện có trong sổ.

## 2. Cờ tự vấn và trạng thái mở

- Máy khách hiện quyền xác nhận khi đến ngày 49 hoặc đã hoàn thành. Sau khi người dùng lưu tự vấn tuần 7 và xác nhận tiến độ, máy khách gửi một cờ `done: true` cùng số chu kỳ. Câu trả lời, ghi chú và mức tự đánh giá lưu trên máy.
- Máy chủ lấy danh tính và chương trình từ phiên. Chỉ ghi cờ sau khi đối chiếu đúng chu kỳ hiện hành và đã tới mốc tự vấn. Gửi lại cùng cờ không tạo thêm dữ liệu. Mỗi bản ghi `tier_progress` ở tầng 1 lưu phiên bản tiêu chí, mã chương trình, chu kỳ và cờ trong `criteria_json`.
- Khi chưa mở tầng, `dang_tu` hoặc `du_dieu_kien` được tính từ dữ liệu hiện hành. Yêu cầu mở kiểm đủ ba điều kiện rồi ghi `da_mo` và `opened_at`. Kiểm chu kỳ và ghi kết quả trong cùng thao tác nhất quán để lần đặt lại chu kỳ ở tab khác không đem cờ cũ sang chu kỳ mới.
- Tầng đã mở thuộc tài khoản. Đổi chu kỳ làm mới phần điều kiện đang xét nếu tầng chưa mở. Khi tầng đã mở, giữ `opened_at` và bằng chứng của chu kỳ đã đạt. Dùng bảng `tier_progress` hiện có. Danh mục xuất và luồng xóa tài khoản xử lý trường này theo quy tắc dữ liệu cá nhân của dự án.

## 3. API phía máy chủ

Các đường dẫn dưới đây cần phiên hợp lệ và trả `Cache-Control: no-store`. Chỉ chiếu dữ liệu của chủ phiên.

| Đường dẫn | Gửi | Trả |
|---|---|---|
| `GET /api/v1/tier-progress/1` | — | `200` và ảnh chụp trạng thái dưới đây |
| `POST /api/v1/tier-progress/1/reflection` | `{ "cycle": 1, "done": true }` | `200` sau khi lưu hoặc khi cờ đã có |
| `POST /api/v1/tier-progress/1/open` | `{ "cycle": 1 }` | `200` khi đủ điều kiện hoặc tầng đã mở |

```json
{
  "tier": 1,
  "cycle": 1,
  "status": "dang_tu",
  "criteria": {
    "journey_completed": false,
    "full_sessions": 24,
    "min_full_sessions": 30,
    "week_7_reflected": true
  },
  "opened_at": null
}
```

`opened_at` là UTC ms. Thân yêu cầu sai kiểu hoặc có khóa ngoài hợp đồng trả `400 invalid_payload`. Chu kỳ đã đổi trả `409 cycle_conflict`. Ghi tự vấn trước mốc trả `409 reflection_too_early`. Mở khi còn thiếu điều kiện trả `409 tier_not_ready`. Lấy thân phản hồi theo cùng dạng lỗi `error.code` của API hiện hành.

## 4. Giao diện và nghiệm thu

- Claude nối API ở cổng và Bia Tích Lũy. Giao diện hiện điều kiện còn thiếu, cho tải lại khi mạng lỗi và chuyển sang Tầng 1 sau khi máy chủ trả `da_mo`. Khi đủ điều kiện, dùng câu «Đã hoàn thành chương trình Sơ nhập». Giữ góc nhìn cảnh theo AGENTS.md.
- Kiểm mốc 29/30 thời, sự kiện lặp, sai chương trình và chu kỳ, ngưỡng 12 phút, kéo thanh tới cuối và bản nhập cũ chỉ có số liệu gộp. Kiểm ngày 48/49, chu kỳ đã hoàn tất, gửi lại cờ hoặc thao tác mở, đặt lại chu kỳ từ thiết bị khác và tài khoản khác. Chứng thực vắng mặt vẫn mở được nếu ba điều kiện đạt.
- Kiểm phản hồi, lưu trữ, export và log chỉ chứa số đếm, cờ cùng thông tin chu kỳ cần thiết. Câu chữ tự vấn ở trên thiết bị. Kiểm hai phiên cùng tài khoản thấy trạng thái cổng thống nhất.

Codex giữ cấu hình điều kiện, Worker, D1 và kiểm API. Claude giữ màn tự vấn, cổng và kiểm giao diện. Hai bên triển khai sau khi hợp đồng này vào `main`.
