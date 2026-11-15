# Danh mục nhiệm vụ Sơ nhập — đợt B (#87)

73 mục, `kind: nhiem_vu`, `tier: 0`, `lang: vi`, `version: 1`; **toàn bộ đã `da_duyet`** theo quyết định duyệt bảng 73 mục của chủ dự án ngày 15/11/2026 ([ghi nhận #87](https://github.com/tnfsmith/Buddha/issues/87#issuecomment-6897073087)). Theo chỉ thị trực tiếp mới nhất ở #87: 25 Ngũ giới, 40 Hạnh, 7 Nguyện tuần, **một** thẻ Bát quan trai. Các biến thể T3.1 chưa thuộc đợt giao này.

Đây là câu hành động do Vân Đạo viết mới, có nguồn tham khảo trong từng tệp; không phải lời trích kinh hoặc văn bản Năm Giới Tân Tu. Mỗi việc là một bước nhỏ để thực hành, không đồng nghĩa đã giữ trọn một giới hoặc hoàn thành cả ngày trai. Không cộng Kusala, không tự đánh dấu trục Tuệ, không xếp hạng hay trao huy hiệu.

## Hợp đồng cho Claude — đợt C

Chủ dự án đã chọn `da_duyet`; sau khi merge/deploy, đọc `GET /api/v1/content?kind=nhiem_vu&tier=0`. API hiện có trả `meta` dưới dạng chuỗi JSON như bài giảng; client cần đọc JSON. Không có thay đổi API, migration hoặc client trong đợt B.

| Trường `meta` | Ý nghĩa |
|---|---|
| `nhom` | Chỉ `gioi`, `hanh`, `nguyen`, `trai` |
| `gioi` | 1–5 với nhóm `gioi`, `null` với nhóm khác; tên tích cực nằm ở `title` |
| `parami` | Mảng mã Ba-la-mật, không rỗng/trùng, theo `packages/shared/src/parami.js` |
| `punna` | Một mã Phước nghiệp sự theo Phụ lục H |
| `tuan` | 1–7 với nhóm `nguyen`, `null` với nhóm khác; hai trọng tâm đúng thiết kế §5.1 |
| `minutes` | Số phút gợi ý cho việc nhỏ, không phải số điểm hoặc chứng nhận hoàn tất |
| `money` | `false` hoặc `optional`; cả 73 mục đợt này là `false` |
| `at_home` | Có thể làm tại nhà |
| `outdoors` | Việc này cần ra ngoài |
| `needs_others` | Cần tương tác/người nhận, có thể từ xa; không tự coi là hoạt động đông người |
| `scope` | `doi_thuc` hoặc `dong_tu`; đợt này toàn bộ `doi_thuc` |
| `safety_note` | Ghi chú tĩnh bắt buộc cho giới 5 và thẻ trai, hiển thị cùng thẻ, tách khỏi câu hành động |
| `gioi_trai` | Tám mô tả giới trong đúng một thẻ `trai`; không gán số 6–8 vào trường `gioi` của Ngũ giới |

Các cờ hoàn cảnh là boolean thật; `money: false` không phải chuỗi `"false"`. `body_inline` là một câu hành động không quá 90 ký tự sau NFC. Không có MP3 hoặc `body_r2_key` cho nhiệm vụ. Các mã ổn định: `sn-gioi-N-XX`, `sn-hanh-<parami>-XX`, `sn-nguyen-tuan-N`, `sn-trai-bat-quan`.

Thẻ Bát quan trai là lời mời tự nguyện. `minutes: 3` dành để đọc và chọn nguyện; không xác nhận giữ đủ tám giới sau ba phút. Giới phạm hạnh của ngày trai khác giới thứ ba của người tại gia. Các lưu ý ăn, nghỉ, chất gây nghiện và thuốc nằm trong `safety_note`; tôn trọng sức khỏe và hướng dẫn y tế. Ghi chú/phản tỉnh cá nhân nếu người dùng viết vẫn chỉ lưu trên máy; danh mục này không chứa hoặc đồng bộ dữ liệu đó.

## Nạp và duyệt

- `node scripts/import-content.mjs --check`: kiểm cả thư mục con và cả nháp nhiệm vụ; chỉ chọn `da_duyet`.
- Sau duyệt: bộ nạp chọn **115 mục = 42 bài giảng + 73 nhiệm vụ**. API môi trường thật chỉ có dữ liệu mới sau khi chủ dự án merge và workflow nạp/deploy; không nạp thủ công trong lúc review. Các bản nháp khác vẫn không được chọn.
- Chỉ đổi trạng thái các mục chủ dự án đã chọn sau khi có quyết định duyệt ghi trong #87/PR. Không cần Hội đồng hoặc dấu `reviewed_*` để mở nội dung, theo ADR 0003.
- Sau duyệt, công cụ deploy hiện hành nạp cùng pipeline; không cần nạp thủ công vào tài khoản thật trong lúc review.
- Bộ chọn việc, ghi nhận người dùng, hiển thị và thống kê thuộc Claude A/C; máy chủ đồng bộ là đợt D, không triển khai trong PR này.

Nguồn đã đối chiếu: [Ngũ giới, AN 8.39](https://www.dhammatalks.org/suttas/AN/AN8_39.html), [tinh thần diễn đạt tích cực của Làng Mai](https://plumvillage.org/mindfulness/the-5-mindfulness-trainings), [Ba-la-mật trong đời thường, Gil Fronsdal](https://sati.org/an-introduction-to-the-ten-paramis/), [Bát quan trai, AN 8.43](https://accesstoinsight.org/tipitaka/an/an08/an08.043.khan.html), [NHS về phụ thuộc rượu và hỗ trợ y tế](https://www.nhs.uk/conditions/alcohol-use-disorder/). Không chép lại đoạn văn từ các nguồn.

## Bảng 73 mục đã được chủ dự án duyệt

Tất cả `money: false`. Mỗi liên kết mở tệp nguồn có đủ metadata, ghi chú an toàn và nguồn tham khảo. Bảng dưới là bản tổng hợp để đọc duyệt, không thay trạng thái trong tệp.

| Mã | Nhóm | Giới/tuần | Phút | Ở nhà | Cần người khác | Câu hành động |
|---|---|---|---:|---|---|---|
| [sn-gioi-1-01](sn-gioi-1-01.md) | gioi | 1 | 2 | Có | Không | Chừa lối ra an toàn cho một con côn trùng trong nhà. |
| [sn-gioi-1-02](sn-gioi-1-02.md) | gioi | 1 | 3 | Có | Không | Kiểm tra và thêm nước sạch vào bát uống của thú nuôi. |
| [sn-gioi-1-03](sn-gioi-1-03.md) | gioi | 1 | 2 | Có | Không | Dọn một vật sắc khỏi lối đi để người trong nhà không bị thương. |
| [sn-gioi-1-04](sn-gioi-1-04.md) | gioi | 1 | 5 | Không | Có | Đi chậm ở đoạn đông người và nhường lối cho người cần đi trước. |
| [sn-gioi-1-05](sn-gioi-1-05.md) | gioi | 1 | 2 | Có | Không | Dành hai phút chăm một cây đang héo bằng lượng nước phù hợp. |
| [sn-gioi-2-01](sn-gioi-2-01.md) | gioi | 2 | 3 | Có | Có | Đặt lại một món đồ mượn đúng nơi và báo người cho mượn. |
| [sn-gioi-2-02](sn-gioi-2-02.md) | gioi | 2 | 1 | Có | Có | Xin phép trước khi dùng đồ hoặc mở tệp riêng của người khác. |
| [sn-gioi-2-03](sn-gioi-2-03.md) | gioi | 2 | 1 | Có | Không | Tắt một thiết bị không cần dùng để giữ gìn điện chung. |
| [sn-gioi-2-04](sn-gioi-2-04.md) | gioi | 2 | 3 | Có | Không | Ghi nguồn rõ ràng khi chia sẻ một nội dung mình đã kiểm tra. |
| [sn-gioi-2-05](sn-gioi-2-05.md) | gioi | 2 | 5 | Có | Không | Sắp lại đồ dùng chung để người đến sau dễ tìm và sử dụng. |
| [sn-gioi-3-01](sn-gioi-3-01.md) | gioi | 3 | 10 | Có | Có | Dành mười phút lắng nghe người thân mà không nhìn điện thoại. |
| [sn-gioi-3-02](sn-gioi-3-02.md) | gioi | 3 | 1 | Có | Không | Giữ một khoảng riêng tư của người khác bằng cách không xem tin nhắn của họ. |
| [sn-gioi-3-03](sn-gioi-3-03.md) | gioi | 3 | 1 | Có | Có | Đổi một lời trêu về ngoại hình thành cách xưng hô tôn trọng. |
| [sn-gioi-3-04](sn-gioi-3-04.md) | gioi | 3 | 2 | Có | Không | Rời một nội dung kích dục và chuyển sang việc đang cần làm. |
| [sn-gioi-3-05](sn-gioi-3-05.md) | gioi | 3 | 5 | Có | Có | Làm đúng một lời hẹn nhỏ với người mình thương quý. |
| [sn-gioi-4-01](sn-gioi-4-01.md) | gioi | 4 | 3 | Có | Không | Kiểm lại một thông tin trước khi chuyển tiếp cho người khác. |
| [sn-gioi-4-02](sn-gioi-4-02.md) | gioi | 4 | 1 | Có | Không | Thở ba hơi trước khi gửi một tin nhắn lúc đang bực. |
| [sn-gioi-4-03](sn-gioi-4-03.md) | gioi | 4 | 1 | Có | Có | Nói một lời cảm ơn cụ thể về điều người khác đã làm. |
| [sn-gioi-4-04](sn-gioi-4-04.md) | gioi | 4 | 2 | Có | Có | Nhận một lỗi nhỏ bằng lời rõ ràng, không đổ cho người khác. |
| [sn-gioi-4-05](sn-gioi-4-05.md) | gioi | 4 | 3 | Có | Có | Nghe người đối diện nói hết một ý rồi mới trả lời. |
| [sn-gioi-5-01](sn-gioi-5-01.md) | gioi | 5 | 10 | Có | Không | Để điện thoại ngoài tầm tay trong mười phút trước khi ngủ. |
| [sn-gioi-5-02](sn-gioi-5-02.md) | gioi | 5 | 5 | Có | Không | Ăn chậm một phần bữa ăn mà không bật màn hình. |
| [sn-gioi-5-03](sn-gioi-5-03.md) | gioi | 5 | 1 | Có | Không | Dừng một nội dung làm mình kích động và thở ba hơi. |
| [sn-gioi-5-04](sn-gioi-5-04.md) | gioi | 5 | 3 | Có | Không | Rót một chén nước và uống chậm, nhận rõ từng ngụm. |
| [sn-gioi-5-05](sn-gioi-5-05.md) | gioi | 5 | 2 | Có | Không | Chọn nước lọc thay một đồ uống có cồn khi điều đó an toàn với mình. |
| [sn-hanh-dana-01](sn-hanh-dana-01.md) | hanh | — | 5 | Có | Có | Dành năm phút giúp một người làm việc họ đang cần. |
| [sn-hanh-dana-02](sn-hanh-dana-02.md) | hanh | — | 5 | Có | Không | Chuẩn bị một món đồ còn tốt để sẵn lòng trao khi có người cần. |
| [sn-hanh-dana-03](sn-hanh-dana-03.md) | hanh | — | 5 | Có | Có | Nghe một người tâm sự trong năm phút mà chưa vội khuyên. |
| [sn-hanh-dana-04](sn-hanh-dana-04.md) | hanh | — | 5 | Có | Có | Chia sẻ một mẹo nhỏ mình biết với người đang cần, không thu phí. |
| [sn-hanh-sila-01](sn-hanh-sila-01.md) | hanh | — | 3 | Có | Không | Xem lại một việc hôm nay và chọn cách ít làm phiền người khác hơn. |
| [sn-hanh-sila-02](sn-hanh-sila-02.md) | hanh | — | 1 | Có | Không | Giữ yên tiếng điện thoại để người bên cạnh được nghỉ. |
| [sn-hanh-sila-03](sn-hanh-sila-03.md) | hanh | — | 2 | Có | Không | Đặt một vật dùng chung về chỗ sau khi dùng xong. |
| [sn-hanh-sila-04](sn-hanh-sila-04.md) | hanh | — | 1 | Có | Có | Giữ một ranh giới người khác đã nói rõ với mình. |
| [sn-hanh-nekkhamma-01](sn-hanh-nekkhamma-01.md) | hanh | — | 10 | Có | Không | Tắt thông báo không cần thiết trong một khoảng mười phút. |
| [sn-hanh-nekkhamma-02](sn-hanh-nekkhamma-02.md) | hanh | — | 5 | Có | Không | Xếp riêng một món ít dùng để cân nhắc cho đi sau. |
| [sn-hanh-nekkhamma-03](sn-hanh-nekkhamma-03.md) | hanh | — | 1 | Có | Không | Hoãn chọn một món đồ chưa cần sang ngày mai. |
| [sn-hanh-nekkhamma-04](sn-hanh-nekkhamma-04.md) | hanh | — | 5 | Có | Không | Dọn một góc bàn để chỉ giữ những thứ cần cho việc hiện tại. |
| [sn-hanh-panna-01](sn-hanh-panna-01.md) | hanh | — | 5 | Có | Không | Đọc một đoạn Pháp có nguồn và tự nhắc lại điều mình hiểu. |
| [sn-hanh-panna-02](sn-hanh-panna-02.md) | hanh | — | 3 | Có | Không | Tự hỏi một điều khó chịu hôm nay đã bắt đầu từ những điều kiện nào. |
| [sn-hanh-panna-03](sn-hanh-panna-03.md) | hanh | — | 2 | Có | Không | Phân biệt một điều mình biết chắc với điều chỉ đang suy đoán. |
| [sn-hanh-panna-04](sn-hanh-panna-04.md) | hanh | — | 3 | Có | Không | Ghi riêng một điều học được và một câu hỏi mình còn chưa rõ. |
| [sn-hanh-viriya-01](sn-hanh-viriya-01.md) | hanh | — | 2 | Có | Không | Bắt đầu trong hai phút một việc có ích mình đã hẹn làm. |
| [sn-hanh-viriya-02](sn-hanh-viriya-02.md) | hanh | — | 3 | Có | Không | Trở lại việc đang làm sau khi nhận ra mình vừa xao nhãng. |
| [sn-hanh-viriya-03](sn-hanh-viriya-03.md) | hanh | — | 5 | Có | Không | Dành năm phút hoàn tất một việc nhỏ đã để dở. |
| [sn-hanh-viriya-04](sn-hanh-viriya-04.md) | hanh | — | 2 | Có | Không | Sắp chỗ ngồi yên cho thời thiền theo giờ đã tự hẹn. |
| [sn-hanh-khanti-01](sn-hanh-khanti-01.md) | hanh | — | 1 | Có | Có | Chờ ba hơi thở trước khi đáp một lời khiến mình khó chịu. |
| [sn-hanh-khanti-02](sn-hanh-khanti-02.md) | hanh | — | 3 | Có | Có | Nghe hết một ý trái với mình rồi mới nói phần mình hiểu. |
| [sn-hanh-khanti-03](sn-hanh-khanti-03.md) | hanh | — | 1 | Có | Không | Làm chậm một động tác khi việc đang không theo ý mình. |
| [sn-hanh-khanti-04](sn-hanh-khanti-04.md) | hanh | — | 3 | Không | Có | Chọn chờ đến lượt mà không thúc ép người đang bận. |
| [sn-hanh-sacca-01](sn-hanh-sacca-01.md) | hanh | — | 1 | Có | Có | Nói rõ một việc mình chưa biết thay vì đoán như đã chắc. |
| [sn-hanh-sacca-02](sn-hanh-sacca-02.md) | hanh | — | 5 | Có | Có | Thực hiện một lời hứa nhỏ mình đã nhận hôm nay. |
| [sn-hanh-sacca-03](sn-hanh-sacca-03.md) | hanh | — | 2 | Có | Không | Ghi nhận một việc đúng với điều đã làm, không thêm cho đẹp. |
| [sn-hanh-sacca-04](sn-hanh-sacca-04.md) | hanh | — | 2 | Có | Có | Chủ động sửa một thông tin mình đã nói nhầm. |
| [sn-hanh-adhitthana-01](sn-hanh-adhitthana-01.md) | hanh | — | 2 | Có | Không | Chọn một giờ cụ thể cho việc nhỏ mình muốn làm hôm nay. |
| [sn-hanh-adhitthana-02](sn-hanh-adhitthana-02.md) | hanh | — | 3 | Có | Không | Viết riêng một nguyện nếu–thì cho một việc nhỏ có thể giữ trong tuần. |
| [sn-hanh-adhitthana-03](sn-hanh-adhitthana-03.md) | hanh | — | 2 | Có | Không | Đặt một vật nhắc ở chỗ dễ thấy để nhớ việc đã tự hẹn. |
| [sn-hanh-adhitthana-04](sn-hanh-adhitthana-04.md) | hanh | — | 3 | Có | Không | Thực hiện lại việc đã chọn sau một lần lỡ, không tự trách. |
| [sn-hanh-metta-01](sn-hanh-metta-01.md) | hanh | — | 1 | Có | Không | Thầm chúc một người mình đang nhớ tới được bình an. |
| [sn-hanh-metta-02](sn-hanh-metta-02.md) | hanh | — | 2 | Có | Có | Nhắn một lời tử tế không kèm đòi hỏi người nhận phải đáp. |
| [sn-hanh-metta-03](sn-hanh-metta-03.md) | hanh | — | 5 | Không | Có | Giúp một người lớn tuổi nếu họ muốn nhận sự giúp đỡ. |
| [sn-hanh-metta-04](sn-hanh-metta-04.md) | hanh | — | 1 | Có | Không | Nói với mình một câu nhẹ nhàng khi vừa làm chưa tốt. |
| [sn-hanh-upekkha-01](sn-hanh-upekkha-01.md) | hanh | — | 1 | Có | Không | Để một lời khen đi qua rồi trở lại việc mình đang làm. |
| [sn-hanh-upekkha-02](sn-hanh-upekkha-02.md) | hanh | — | 2 | Có | Không | Tạm dừng đáp một bình luận khó chịu để nhận rõ cảm xúc của mình. |
| [sn-hanh-upekkha-03](sn-hanh-upekkha-03.md) | hanh | — | 3 | Có | Không | Làm xong một việc tốt rồi buông ý muốn được người khác nhắc đến. |
| [sn-hanh-upekkha-04](sn-hanh-upekkha-04.md) | hanh | — | 3 | Có | Không | Nhìn một thay đổi nhỏ quanh mình mà chưa vội gọi là được hay mất. |
| [sn-nguyen-tuan-1](sn-nguyen-tuan-1.md) | nguyen | 1 | 3 | Có | Không | Khi vừa thức dậy thì tôi thở ba phút và thầm chúc mọi người bình an. |
| [sn-nguyen-tuan-2](sn-nguyen-tuan-2.md) | nguyen | 2 | 2 | Có | Có | Khi muốn đáp lúc bực thì tôi thở ba hơi rồi nói điều mình biết là thật. |
| [sn-nguyen-tuan-3](sn-nguyen-tuan-3.md) | nguyen | 3 | 1 | Có | Không | Khi muốn lấy thêm phần chưa cần thì tôi dừng lại và để dành cho người khác. |
| [sn-nguyen-tuan-4](sn-nguyen-tuan-4.md) | nguyen | 4 | 5 | Có | Có | Khi đã hứa giúp ai thì tôi dành năm phút làm đúng điều đã hứa. |
| [sn-nguyen-tuan-5](sn-nguyen-tuan-5.md) | nguyen | 5 | 3 | Có | Có | Khi người khác nói chậm thì tôi lắng nghe hết và đáp một lời tử tế. |
| [sn-nguyen-tuan-6](sn-nguyen-tuan-6.md) | nguyen | 6 | 2 | Có | Có | Khi nhận lời chê thì tôi dừng ba hơi thở trước khi chọn cách đáp. |
| [sn-nguyen-tuan-7](sn-nguyen-tuan-7.md) | nguyen | 7 | 3 | Có | Không | Khi tối đến thì tôi dành ba phút viết điều học được và việc sẽ thực hành. |
| [sn-trai-bat-quan](sn-trai-bat-quan.md) | trai | — | 3 | Có | Không | Ngày trai, tự nguyện chọn thực tập Bát quan trai theo sức khỏe và hoàn cảnh. |
