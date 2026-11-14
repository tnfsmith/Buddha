# ADR 0003 — Nội dung tham khảo không bắt buộc Hội đồng phê duyệt

- Trạng thái: quyết định trực tiếp của chủ dự án ngày 14/11/2026; triển khai mã theo các Issue/PR liên quan.
- Nguồn: [Issue #55](https://github.com/tnfsmith/Buddha/issues/55), yêu cầu trong chat Codex, bàn giao Claude ở [#51](https://github.com/tnfsmith/Buddha/issues/51#issuecomment-6878514111) và [PR #52](https://github.com/tnfsmith/Buddha/pull/52#issuecomment-6878514332).
- Thay thế: yêu cầu Hội đồng bắt buộc trong AGENTS 1.6, roadmap §16/§16.1, bản tóm tắt thiết kế và phần duyệt của hợp đồng bài giảng đang đề xuất ở ADR 0002. Không thay các phần khác của ADR 0002.

## Bối cảnh và quyết định

Chủ dự án xác định Vân Đạo là ứng dụng hỗ trợ thực hành và chia sẻ tham khảo; không phải hoạt động thuyết pháp chính thức của chùa hay tu viện. Vì vậy không lấy việc thành lập Hội đồng hoặc có biên bản duyệt Pháp học làm điều kiện mở nội dung.

Hội đồng/chuyên gia có thể góp ý khi phù hợp; việc này tùy chọn. Nội dung có nguồn rõ ràng, phân biệt trích dẫn và tóm lược bằng lời mới, được biên tập và chọn phát hành theo quy trình PR thông thường. Chủ dự án merge PR nội dung là quyết định phát hành; không đòi một vòng phê duyệt chuyên môn riêng. Giữ nguyên luật không thương mại hóa Pháp, không tuyên bố chứng đắc và các hằng số thời thiền/Kusala/Tịnh danh.

AI/Hermes có thể hỗ trợ biên soạn, tóm lược và giải thích có dẫn nguồn; không tự nhận là thầy, lời dạy chính thức hoặc chứng nhận của Hội đồng. Không tự ghi tên người duyệt hay mốc duyệt không có thật.

## Hợp đồng nội dung tương thích

Không cần đổi lược đồ chỉ để bỏ yêu cầu Hội đồng. Các tên hiện có được hiểu như sau:

| Trường/trạng thái | Ý nghĩa theo quyết định này |
|---|---|
| `status: da_duyet` | Nội dung đã chọn phát hành theo quy trình biên tập/PR; tên kỹ thuật cũ, không chứng nhận Hội đồng |
| `nhap`, `cho_duyet` | Bản đang biên soạn hoặc chờ chọn phát hành; không tự công khai để lấp danh sách trống |
| `ngung` | Đã ngừng phát hành, không đưa ra API công khai hoặc `/media` |
| `reviewed_by`, `reviewed_at` | Thông tin truy vết nếu có thật; tùy chọn, không là cổng bắt buộc ở client/công cụ nạp |
| `title`, `source_ref`, nội dung | Vẫn kiểm tính đầy đủ; lời giới thiệu ghi là chia sẻ/tóm lược tham khảo |

API vẫn lọc trạng thái công khai để tránh lộ nháp. Không bỏ tất cả bộ lọc hoặc tự chuyển mọi bài `cho_duyet` sang `da_duyet`. Các Issue #46/#48/#50 thực hiện biên soạn, nạp D1 và phục vụ media theo nghĩa phát hành mới; không đòi hồ sơ Hội đồng. Cơ chế thu hồi phiên bản/tài sản tiếp tục theo hợp đồng triển khai, không thay bằng một lời khẳng định đã duyệt.

## Giao diện và kiểm thử

Giữ tab Thuyết giảng. Bỏ thông báo thiếu Hội đồng và câu khẳng định mọi bài đã được Hội đồng duyệt. Khi API chưa có nội dung công khai, dùng: **“Chưa có bài chia sẻ. Nội dung đang được cập nhật.”** Lỗi mạng có thông báo tải thất bại và nút thử lại riêng.

Claude sửa `main.js`/`sermon.js`, template, kiểm thử và hai tệp thiết kế đang giữ trong #47/#51. Ca kiểm phải chứng minh bài công khai, đủ nguồn và nội dung vẫn phát khi không có `reviewed_at`; nháp/ngừng không lộ; mã bài lạ hoặc lỗi nguồn không làm crash. Không giả danh dấu duyệt để giữ test cũ xanh.

## Phân công và trạng thái

Codex giữ bộ quy tắc, roadmap, tệp phối hợp và ADR này ở #55. Claude giữ ADR 0002, dàn bài và mã UI/giọng đọc theo #47/#51; Codex không sửa đè các tệp đó. Codex làm API/công cụ nạp ở tác vụ riêng #46/#50; Hermes làm nội dung/giọng đọc theo #48/#49. Các bước sinh giọng, chi phí và phát hành production vẫn theo phân công hiện hành.

PR tài liệu không tự làm cổng UI đang chạy biến mất, không tạo bài công khai hoặc đưa bản nháp vào D1. Bàn giao phải ghi riêng: quyết định đã ghi, mã đã đổi, CI đã đạt, staging đã đạt, production đã phát hành. Agent không tự merge/tag; quyết định này chỉ bỏ rào cản Hội đồng, không bỏ kiểm thử và quy trình phát hành.
