# Hợp đồng hồ sơ tu tập Sơ nhập · #105

Áp dụng cho bước Duyên khởi (§8.3 của roadmap) và sửa lựa chọn sau đó, trên bảng `practice_profile` của migration 0010. Codex triển khai Worker/D1, Claude triển khai giao diện #104. PR hợp đồng cần được duyệt và merge trước khi hai bên triển khai. API chưa mở ở thời điểm soạn.

## Đọc và lưu

| Đường dẫn | Dữ liệu gửi | Thành công |
|---|---|---|
| `GET /api/v1/practice/profile` | Không body | 200, `{ "profile": null, "rev": 0 }` nếu chưa lưu, hoặc hồ sơ đã lưu và rev hiện tại |
| `PUT /api/v1/practice/profile` | JSON `{ "profile": {…}, "rev": 0 }` với đủ tám trường và rev lần đọc gần nhất | 200, `{ "profile": {…}, "rev": <rev hiện tại> }` |

Cả hai dùng cơ chế phiên sẵn có (tài khoản hoặc khách) và giới hạn theo người dùng `RL_API`. Worker lấy danh tính từ phiên. Phản hồi hồ sơ và lỗi dùng `Cache-Control: no-store`. GET không khởi tạo hồ sơ hay ghi vào hành trình. Bỏ qua Duyên khởi không gọi PUT. Người dùng bấm lưu mới gửi lựa chọn.

| Trường trong `profile` | Giá trị hợp lệ |
|---|---|
| `level` | `nhe`, `vua`, `sau` |
| `minutes` | Số nguyên 5–120. Đây là thời gian có thể dành cho thực hành |
| `time_window` | `sang`, `trua`, `toi`, `linh_hoat` |
| `familiarity` | `moi`, `da_quy_y`, `tu_lau` hoặc `null` |
| `precepts` | Mảng 0–5 số nguyên khác nhau từ 1 đến 5. Phản hồi sắp tăng dần |
| `uposatha` | `vn_2`, `vn_4`, `vn_6`, `vn_10`, `khong` |
| `no_money` | Boolean, chỉ gợi ý miễn phí khi là `true` |
| `at_home` | Boolean, chỉ gợi ý việc làm được tại nhà khi là `true` |

Ví dụ lưu lần đầu:

```json
{
  "profile": {
    "level": "vua",
    "minutes": 15,
    "time_window": "toi",
    "familiarity": null,
    "precepts": [1, 2, 3, 4, 5],
    "uposatha": "vn_4",
    "no_money": true,
    "at_home": true
  },
  "rev": 0
}
```

PUT thay toàn bộ lựa chọn, kiểm đúng kiểu và từ chối trường ngoài hợp đồng ở cả hai cấp. Các cờ được lưu là lựa chọn có chủ đích. Hoàn cảnh, lý do hạn chế, nội dung phản tỉnh, thông tin nhận diện và ghi chú ở lại trên máy. Không đưa body hay thông tin cá nhân vào log. `minutes` dùng để gợi ý nhiệm vụ và thời gian, lịch thiền chuẩn 15 phút và bảy mốc âm thanh tiếp tục theo AGENTS.md §1.

## Xung đột và gửi lại

- `rev` là số nguyên an toàn không âm. Chỉ rev 0 nghĩa là chưa có hồ sơ. Client lưu/so sánh rev và không suy ra thời gian hay số ngày từ rev.
- Worker lấy rev từ `practice_profile.updated_at` (UTC ms), tăng ít nhất một đơn vị sau mỗi thay đổi. Việc tạo với rev 0 chỉ thành công nếu chưa có hàng. Việc sửa so khớp rev ngay trong lệnh ghi D1, kể cả khi hai thiết bị lưu cùng lúc.
- Nếu yêu cầu hợp lệ trùng lựa chọn hiện tại sau khi chuẩn hóa, trả 200 với rev hiện tại và không ghi lại. Điều này bao gồm gửi lại cùng payload sau khi mất phản hồi. Nếu rev đã cũ và lựa chọn khác, trả 409 `practice_profile_conflict`; client đọc lại và để người dùng quyết định trước khi gửi bản sửa mới.
- 400 `invalid_practice_profile` cho JSON hỏng, thiếu/thừa trường, rev hoặc giá trị sai. 401 `unauthorized` khi không có phiên. Lỗi dùng cấu trúc hiện hành `{ "error": { "code": "...", "message": "..." } }`. Giữ cơ chế 429/503 hiện hành của giới hạn và xác thực.

## Vòng đời và nghiệm thu

- `GET /api/v1/export` thêm `practice_profile` dạng `null` hoặc tám trường chuẩn hóa cộng `updated_at` UTC ms. Không sửa các trường export đang dùng.
- Khi liên kết phiên khách, chuyển hồ sơ trong cùng giao dịch với phần gộp nếu tài khoản đích chưa có lựa chọn. Nếu đích đã có thì giữ hồ sơ đích. Kiểm nhánh giữ tiến trình đích và nhánh chuyển tiến trình khách, kể cả khi người dùng chỉ mới lưu lựa chọn và chưa hoàn thành ngày đầu.
- Hồ sơ theo tài khoản. Đổi chu kỳ giữ lựa chọn và rev. Xóa tài khoản hoặc dọn khách xóa hàng bằng FK. Lần ghi hồ sơ không đổi `profile.rev`, `journey.rev`, ngày, điểm Kusala hay quyền lên tầng.
- Kiểm qua Worker/D1 với phiên thật: GET rỗng không tạo hàng, phiên khác không đọc/ghi thay, biên kiểu/dữ liệu, tạo và sửa, hai ghi khác nhau cùng rev, gửi lại khi mất phản hồi, xung đột trên rev cũ, export, gộp khách, đổi chu kỳ và xóa. Triển khai PUT cùng các kiểm vòng đời.

`today/swap`, deed, chứng thực và kênh nhắc là các gói tiếp theo của #105. Hợp đồng hồ sơ có thể dùng độc lập với danh mục biến thể #103 và ReminderClock #106.
