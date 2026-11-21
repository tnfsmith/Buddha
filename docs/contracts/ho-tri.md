# Hợp đồng Bảng Hộ Trì và Sự kiện · #191

`HO_TRI_V = 1`. Phạm vi là Bảng Hộ Trì và sự kiện ở Cổng Vân Môn theo [roadmap §5 và §10](../../PROJECT_ROADMAP.md). Codex giữ API/D1 T5.1. Claude 2 giữ giao diện T5.2 sau khi hợp đồng được duyệt. Hermes và chủ dự án giữ vận hành T5.3. Nhóm, phòng và IslandRoom tiếp tục theo kế hoạch riêng.

Mã dùng chung ở `@vandao/shared/ho-tri.js`. [Fixture JSON](ho-tri-fixture.json) mô tả phản hồi cho máy chủ giả, dùng mốc thời gian thử cố định. Thời gian wire là UTC tính bằng mili giây. Khi tích hợp, Worker và UI giữ cùng phiên bản hợp đồng.

## Quyền tham gia và điều khoản

- `/me` có `community: { v, terms_version, terms_url, accepted_version, adult_confirmed, allowed, reason, guide, help_replies, help_matches }`. `v` chỉ có khi toàn bộ API hợp đồng sẵn sàng. `terms_url` là đường dẫn cùng origin tới nội dung tĩnh của đúng phiên bản để đọc trước khi xác nhận. `accepted_version` là phiên bản đã ghi của chính người dùng hoặc `null`. `adult_confirmed` phản ánh xác nhận đã ghi. `allowed` là quyền tham gia do máy chủ tính. `reason` là `null` khi được tham gia hoặc `need_adult_confirmation` khi cần xác nhận điều khoản hiện hành và 18+. `guide` lấy từ vai đã cấp trên máy chủ.
- `POST /api/v1/community/consent` nhận đúng `{ adult_confirmed: true, terms_version }` và trả `200 { community }`. Cần phiên. Máy chủ so phiên bản hiện hành, trả `409 terms_changed` khi đã đổi. Gửi lại cùng phiên bản giữ bản ghi cũ. Lưu ID chủ phiên, phiên bản và mốc xác nhận. `community_acceptance` là nguồn duy nhất của xác nhận cộng đồng. `consent` hiện giữ điều khoản chung. Không hỏi ngày sinh.
- Mọi thao tác tham gia cần phiên, xác nhận 18+ và điều khoản hiện hành. Theo quyết định chủ dự án ngày 21/11/2026, Bảng Hộ Trì mở ngay sau xác nhận, kể cả ngày 1. Giao diện dùng `community.allowed`; đặt lối vào dành cho tài khoản đủ quyền ngay cả khi Cổng Vân Môn chưa mở. Lịch mở Cổng Vân Môn và quyền Du vân vẫn theo hành trình.
- Danh sách công khai theo §5 chỉ trả nội dung đủ điều kiện hiển thị. Giao diện trong app kiểm quyền từ `/me` trước khi mở phần cộng đồng. `community` vắng mặt thì UI chưa mở Bảng Hộ Trì. API có dữ liệu theo người xem trả riêng, đặt `Cache-Control: private, no-store`.

## Bài, trả lời và báo cáo

Các đường dẫn dưới đây có tiền tố `/api/v1`. Lỗi dùng dạng hiện hành `{ error: { code, message } }`. UI ưu tiên mã trong `HO_TRI_REASON_TEXT`. Giới hạn ghi cho `POST /help`, `/reply` và `/rsvp` trả `429 rate_limited`.

| Đường dẫn | Quyền và dữ liệu |
|---|---|
| `GET /help?kind=&area=&cursor=` | Công khai. Trả `{ items, next_cursor }` gồm bài `hien` còn hạn, mới trước theo `created_at,id`. Mỗi trang tối đa 20 mục. Cursor mờ. Bộ lọc hoặc cursor sai trả 400. |
| `GET /help/mine?cursor=` | Phiên. Cùng cấu trúc phân trang 20 mục, chỉ bài còn lưu của mình đủ mọi trạng thái. Mỗi mục có `status`, thời gian, `hidden_reason` chung nếu bị ẩn. |
| `GET /help/{id}` | Trả `{ item, replies, actions, my_match }`. `my_match` là đề nghị của người xem khi là người giúp, hoặc `null`. Công khai thấy bài và lời trả lời đủ điều kiện hiện. Tác giả xem được nội dung của mình đang chờ hoặc bị ẩn. Chủ bài và người giúp đã được nhận có thể xem bài đã đóng theo quyền của ca. Nội dung ngoài quyền trả `404 not_found`. |
| `POST /help` | Quyền tham gia. Nhận `{ kind, title, body, area?, anonymous? }` theo `checkHelpPost`. Trả `201 { item }` nếu ghi, gồm `status` cho tác giả. |
| `POST /help/{id}/reply` | Quyền tham gia. Nhận `{ body, source_ref? }`, văn bản 1–600 ký tự. `source_ref` là chuỗi văn bản NFC, tối đa 240 ký tự sau khi bỏ khoảng trắng đầu cuối. Với `hoi_phap`, cần vai người hướng dẫn và nguồn tham khảo. Trả `201 { reply }`. Bài hết hạn/đã đóng trả `409 help_closed`. |
| `POST /help/{id}/close` | Chủ bài. Đặt `dong`, ngừng đề nghị mới, nhận đề nghị và trả lời mới. Ca đã nhận vẫn xác nhận xong được. Gửi lại trả 204. |
| `DELETE /help/{id}` · `DELETE /help/replies/{id}` | Tác giả. Xóa bài hoặc lời trả lời của mình, trả 204. Nội dung không còn hoặc ngoài quyền trả 404. Xóa bài dọn trả lời, mốc đọc và ca nhận giúp thuộc bài. |
| `POST /help/{id}/replies/seen` | Chủ bài có phiên. Nhận `{ until }` là mốc từng hiển thị. Lưu theo bài, chỉ tăng, giới hạn ở giờ máy chủ. Trả 204. |
| `POST /help/reports` | Quyền tham gia. Nhận `{ target_type: 'post'|'reply', target_id, reason? }`, ghi hàng duyệt và trả `201 { id }`. Cho phép báo cáo nội dung ẩn danh. |
| `POST /help/blocks` | Quyền tham gia. Nhận `{ target_type, target_id }` đối với nội dung có thể chặn. Máy chủ tìm tác giả và dùng `user_block`. Trả 204, không trả ID tác giả. |

`item = { id, kind, title, body, area, author, created_at, expires_at, replies, match }`. `author` là `{ tinh_danh }` hoặc `null`. Danh sách, chi tiết, bài riêng và lời trả lời không trả mã kết bạn. `replies` là số lời trả lời đang hiện theo quyền người xem. `match` chỉ có `mo` hoặc `da_co_nguoi_nhan`. Danh sách công khai chỉ trả các trường này.

`reply = { id, body, source_ref, author, created_at }`. Chủ lời trả lời nhận thêm `status` và `hidden_reason` khi phù hợp. Máy khách hiển thị nội dung dạng văn bản, không render HTML từ bài. `actions = { can_reply, can_match, can_report, can_block, can_close, can_delete }` theo người xem. Quyền đóng và xóa bài chỉ thuộc chủ bài. Lời trả lời của chính mình có thêm `can_delete: true`. Với tác giả ẩn danh, nút báo cáo vẫn có, nút chặn chỉ hiện khi người xem được phép biết danh tính từ ca nhận giúp.

Máy chủ dùng `user_block` hai chiều khi đọc nội dung có phiên và trước khi ghi. Đối với phiên đã đăng nhập, không fallback về trả lời công khai khi xác thực hoặc truy vấn kiểm chặn gặp lỗi. `/reports` hiện dùng ID tài khoản và ràng buộc ngữ cảnh riêng. Hai route theo nội dung ở trên giữ nguyên người gọi cũ và riêng tư cho bài ẩn danh.

### Kiểm đầu vào và kiểm duyệt

- `checkHelpPost` chuẩn hóa NFC, bỏ khoảng trắng đầu cuối, kiểm loại bài, vùng, giới hạn độ dài, boolean và khóa lạ. Vùng là `null`, `truc_tuyen` hoặc mã `vn_XX` trong `HELP_AREAS`. Mã cấp tỉnh theo [bảng công bố Quyết định 19/2025/QĐ-TTg](https://xaydungchinhsach.chinhphu.vn/bang-danh-muc-va-ma-so-cua-34-tinh-thanh-moi-cac-don-vi-hanh-chinh-cap-xa-moi-11925070418263625.htm).
- Kiểm không kêu gọi tiền hoặc hiện vật cá nhân, không đăng điện thoại hay địa chỉ chi tiết. Worker sàng lọc từ khóa tiếng Việt và Llama Guard theo §10.2. Các mã `has_phone`, `has_address`, `asks_money` chỉ do máy chủ trả khi có đủ căn cứ. Hàm form kiểm hình dạng, không tự phán nội dung.
- Bài cần người kiểm duyệt ở `cho_duyet`. Bài của tài khoản dưới 7 ngày luôn chờ người duyệt. Mục `cho_duyet`, `an`, `dong` và quá hạn nằm ngoài danh sách công khai. Nếu chưa thể sàng lọc để nhận bài, trả `503 moderation_unavailable` và không công khai nội dung. Người viết thấy `content_hidden` khi bài bị ẩn, chi tiết phân loại chỉ dành cho kiểm duyệt.
- `GET /admin/moderation?state=mo&cursor=` trả `{ items, next_cursor }`. Mỗi mục có `id,target_type,target_id,source,state,created_at` và nội dung cần quyết định. `POST /admin/moderation/{id}/decision` nhận `{ decision: "giu" | "go" | "bo_qua" }`. `giu` duyệt nội dung còn đủ điều kiện, `go` ẩn nội dung, `bo_qua` khép việc kiểm mà giữ trạng thái hiện tại của bài. Cập nhật hàng duyệt và bài cùng một lần ghi. Chỉ người có quyền kiểm duyệt. Worker dùng danh tính Access đã xác thực cho đúng ứng dụng và xác minh phạm vi truy cập; header có danh tính chưa được xác thực không cấp quyền. Nhật ký chỉ giữ số đếm hoặc mã vận hành, không ghi thân bài, thông tin người dùng hoặc token. [Tài liệu xác thực ứng dụng Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

## Nhận giúp

`POST /help/{id}/match` nhận `{ action: 'de_nghi' | 'nhan' | 'xong' | 'huy', match_id? }`. Đề nghị đầu tiên tạo hoặc trả lại cùng một bản ghi theo cặp bài/người giúp. Các thao tác tiếp theo cần `match_id`, mã mờ không suy ra ID người dùng. `GET /help/{id}/matches` trả `{ items }` gồm đề nghị đúng quyền cho chủ bài hoặc đề nghị của chính người giúp. `POST /match` thành công trả 200 với ca. Mỗi ca có `{ id, post_id, state, me_done, other_done, other }`.

| Hành động | Kiểm quyền và chuyển trạng thái |
|---|---|
| `de_nghi` | Người xem đề nghị giúp bài Cần giúp còn mở. Không tự nhận bài của mình. |
| `nhan` | Chủ bài nhận một đề nghị đang mở. D1 giữ tối đa một người được nhận cho một bài. |
| `xong` | Mỗi bên chỉ ghi xác nhận của mình. Worker đặt `xong` và `done_at` trong cùng lần ghi khi có đủ hai bên. Gửi lại cùng thao tác không đổi mốc. |
| `huy` | Hai bên có thể rút/hủy trước khi xong. Trạng thái xong là trạng thái cuối. Xung đột chuyển trạng thái trả `409 match_conflict`. |

Trước khi nhận, chủ bài thấy `other: { tinh_danh }` của người đề nghị. Người giúp chỉ thấy Tịnh danh người đăng công khai hoặc `other: null` nếu bài ẩn danh. Khi nhận giúp, người đăng được thông báo rằng Tịnh danh và mã kết bạn sẽ hiện riêng cho người được nhận. `other.tag` chỉ có cho đúng hai bên khi ca ở `nhan` hoặc `xong`. Ca hủy bỏ trường này. Phản hồi không chứa ID tài khoản, điện thoại hay địa chỉ.

`/me.community.help_replies` đếm lời trả lời đang hiện của người khác sau mốc đọc trên bài của mình. `help_matches` đếm đề nghị chờ chủ bài nhận hoặc ca đã nhận mà mình còn phải xác nhận. Cả hai bỏ bản ghi bị chặn hoặc hết hiệu lực. UI dùng 0 khi máy chủ cũ chưa trả các trường này. Hoàn tất chỉ mở gợi ý tự ghi việc Thiện ở luồng tu tập §10.3, vẫn theo khóa 1 nấc/ngày.

## Sự kiện thiện nguyện

- `GET /events?area=&from=&cursor=` trả `{ items, next_cursor }`. Mỗi trang tối đa 20 mục. Mỗi mục có `id,title,description,place,area,starts_at,ends_at,capacity,rsvp_count,my,organizer`. `description` tối đa 600 ký tự. `place` là tên địa điểm công cộng, không gồm nhà hoặc địa chỉ riêng. Danh sách công khai chỉ có sự kiện mở đã duyệt. `my` là `dang_ky`, `huy` hoặc `null`. `organizer = { kind: 'partner'|'group', name, verified: true }`.
- `POST /events/{id}/rsvp` cần quyền tham gia, nhận `{ state: 'dang_ky'|'huy' }`, trả `200 { state, rsvp_count }`. D1 cập nhật một bản ghi mỗi người và kiểm chỗ trống cùng lần ghi. Gửi lại cùng trạng thái an toàn. Trả `409 event_full` hoặc `409 event_closed` khi tương ứng.
- Chỉ đăng sự kiện của đối tác đã xác minh hoặc nhóm đủ quyền Tầng 2. `sangha_group.min_tier` là dữ liệu nhóm, không dùng làm bằng chứng quyền. Khi nguồn xác minh chưa có, để tuyến tương ứng chưa khả dụng. Không cấp quyền bằng dữ liệu tự khai của client.

## D1 và bàn giao

- Codex chọn số migration kế tiếp từ `main` khi triển khai. Dùng nền `user_block` và `sangha_group`. Các bảng Hộ Trì là `community_acceptance`, `help_post`, `help_reply`, `help_match`, `help_reply_seen`, `volunteer_event`, `event_rsvp`, `moderation_queue`. Hoàn thiện các khóa, chỉ mục, trường hai bên xác nhận và quyền tổ chức trước khi mở route. Mã người dùng lưu nội bộ, các phép chiếu công khai chỉ trả trường đã mô tả.
- `/export` trả bài và lời trả lời của mình, ca nhận giúp mà mình tham gia và RSVP của mình. Không xuất ID nội bộ của người khác. Khi xóa tài khoản đã đến hạn theo `deletion_request`, dọn bài, lời trả lời, hàng chờ có dữ liệu cá nhân, ca nhận giúp, RSVP, xác nhận điều khoản cộng đồng và mốc đọc của tài khoản. Giữ số liệu tổng hợp đã tách danh tính. Xóa bản ghi Hộ Trì không thay sổ tu tập được ghi riêng theo §10.3.
- Ca Worker/D1 cần bao phủ chặn hai chiều, quyền 18+ và điều khoản, bài mới chờ duyệt, sàng lọc lỗi, quyền xem riêng, hai xác nhận đồng thời, gửi lặp, RSVP cuối và Access. Khi kiểm preview dùng dữ liệu tách riêng theo [#35](https://github.com/tnfsmith/Buddha/issues/35).
- T5.2 dùng fixture sau khi hợp đồng merge, sau đó kiểm UI với Worker/D1 thật. T5.3 dùng hàng kiểm duyệt để báo cáo mục quá 24 giờ và xác minh đối tác. T5.1 triển khai Worker/D1 theo hợp đồng này trong PR riêng.
