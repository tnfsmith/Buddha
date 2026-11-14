# Loạt bài giảng «Đường Xưa Mây Trắng» — dàn bài và văn phong

- **Ngày:** 14/11/2026 · **Thiết kế:** Claude · **Viết nội dung:** Codex (làn Hermes) · **Duyệt:** chủ dự án (xem #3)
- **Hợp đồng kỹ thuật:** [ADR 0002](../adr/0002-bai-giang-giong-doc-r2.md) · **Issue:** #47 thiết kế, #48 nội dung, #49 giọng đọc
- **Mã loạt:** `duong-xua` · 33 bài, chia ba phần theo ba quyển của sách
- **Loạt song song:** bảy bài v0.14.0 thuộc loạt riêng «Lời Phật dạy», có menu riêng ([`loi-phat-day.md`](loi-phat-day.md))

## 1. Tinh thần

Mỗi bài là **một câu chuyện có thật trong cuộc đời Đức Phật**, kể theo đúng trình tự của *Đường Xưa Mây Trắng* (Thích Nhất Hạnh, Lá Bối 1988; 81 chương), kèm **lời Ngài dạy trong chính chuyện đó**.

Người nghe không cần biết giáo lý. Nghe xong, họ phải thấy được ba điều:

- cảnh đang diễn ra trước mắt mình;
- tấm lòng bao dung, bác ái của Đức Phật với mọi loài: người nghèo, người bị khinh rẻ, phụ nữ, kẻ lầm lỗi, con vật;
- một việc thương người, thương vật mà mình làm được ngay hôm nay.

App dành cho mọi người hướng thiện, không riêng người tu. Vì vậy giáo lý chỉ giữ ý chính, nói bằng lời đời thường.

## 2. Cách kể một bài (năm nhịp)

| Nhịp | Số ý | Viết gì |
|---|---|---|
| 1. Mở cảnh | 1–2 | Nơi chốn, thời khắc, ánh sáng, âm thanh. Đặt người nghe đứng ngay trong cảnh. |
| 2. Diễn biến | 4–7 | Khoảnh khắc then chốt. Cho thấy Đức Phật **nhìn, lắng nghe, hành động** bằng lòng thương qua cử chỉ cụ thể: cúi xuống, mỉm cười, đưa tay, im lặng. Lời thoại ngắn, diễn ý. |
| 3. Lời dạy | 2–4 | Điều Ngài dạy trong chuyện, đúng ý kinh gốc, bằng lời giản dị. Thuật ngữ (nếu có) giải nghĩa ngay. Tối đa một câu Pāli (dòng `>`). |
| 4. Soi vào đời mình | 1–2 | Một việc nhỏ làm được hôm nay, hướng về thương người, thương vật. Mời, không ra lệnh, không dọa. |
| 5. Lắng | 1 | Một hình ảnh để người nghe mang theo. |

**Khuôn khổ:** 10–16 ý, mỗi ý 1–3 câu, tối đa 260 ký tự; 450–750 tiếng mỗi bài (đọc chậm khoảng 4–6 phút). Câu nên dưới 35 tiếng để giọng đọc ngắt nghỉ tự nhiên.

**Luôn làm:**

- **Viết lời mới hoàn toàn.** Không chép câu văn của sách; không chép nguyên đoạn bản dịch kinh. Câu Pāli gốc thì được, nhưng phải khớp SuttaCentral.
- Ghi nguồn trong `source_ref`: "Phỏng theo Đường Xưa Mây Trắng (Thích Nhất Hạnh), chương N · <kinh gốc>".
  - Cảnh do tác giả sách dựng, không có trong kinh (ví dụ quả quýt ở chương 19), ghi rõ "cảnh do tác giả sách kể".
- Xưng "Đức Phật", "Ngài". Trước khi thành đạo: "thái tử Tất Đạt Đa", "vị tu sĩ trẻ". Ở nhịp 4 gọi người nghe là "ta" hoặc "chúng ta", giữ nhất quán.
- Tên riêng dùng âm Hán Việt quen thuộc, viết hoa từng tiếng, không gạch nối (bảng ở mục 6).
- Số đọc lên viết bằng chữ, hoặc dùng `[[hiển thị|cách đọc]]` (ADR 0002 mục 1).

**Không bao giờ:**

- Hứa quả báo, phép màu, chứng đắc; nói người nghe đã hay sẽ chứng đắc (`AGENTS.md` 1.6). Chuyện thần thông truyền thống nếu có thì kể nhẹ, như "truyện xưa kể lại".
- Công kích tôn giáo, giai cấp hay người nào. Chuyện giai cấp nhấn vào sự bình đẳng, không vào lỗi của người khác.
- Gắn với tiền, cúng dường, Gieo Duyên hay Đại Công Đức (`AGENTS.md` 1.1). Chuyện Cấp Cô Độc nói về lòng rộng rãi và niềm vui sống lương thiện, không kêu gọi đóng góp.
- Dồn quá một thuật ngữ vào một ý; viết tắt; dùng chữ Hán khó mà không giải nghĩa.

## 3. Dàn bài 33 bài theo trình tự sách

**Cột Chương:**

- Số theo bản 81 chương. Codex đối chiếu bản tiếng Việt và phụ lục nguồn kinh của sách trước khi viết.
- ✓ = chuyện đã rõ theo tên chương; ? = cần xác nhận chương. Khi xác nhận, Codex sửa `thu_tu` cho đúng vị trí (bước 10 để chèn).

**Cột Đợt:** B/C/D theo phần (mục 5). Ba bài 80, 180, 220 kể chuyện; bài kinh cùng tên giảng kỹ ở loạt «Lời Phật dạy».

### Phần Một — Ánh sao mai (quyển 1, chương 1–29)

| thu_tu | id | Tên bài | Chương | Chuyện | Lời dạy, hướng thương | Nguồn kinh | Đợt |
|---|---|---|---|---|---|---|---|
| 10 | `cau-be-chan-trau` | Cậu bé chăn trâu và bó cỏ | 1–3 ✓ | Svastika, cậu bé chăn trâu nghèo bị xem là hạ tiện, cắt cỏ dâng vị tu sĩ trẻ; vị ấy cảm ơn, hỏi tên, coi cậu như bạn | Không ai thấp hèn trước lòng thương; bước đi thong thả, có mặt cho người trước mặt | Truyện khung của sách; truyền thống người cắt cỏ dâng cỏ kusa (chú giải Jātaka) | B |
| 20 | `con-thien-nga` | Con thiên nga bị thương | 4 ✓ | Thái tử nhỏ cứu thiên nga bị Đề Bà Đạt Đa bắn; hội đồng phán sự sống thuộc về người cứu | Mọi loài đều sợ đau, quý mạng sống; lấy mình mà so | Phật truyện (Lalitavistara); Dhp 129–130 | B · **bài mẫu, mục 7** |
| 30 | `goc-cay-hong-tao` | Dưới gốc cây hồng táo | 6 ✓ | Lễ hạ điền: cậu bé thấy con sâu bị chim mổ, chim bị diều hâu bắt; ngồi lặng dưới bóng cây | Lòng thương mở ra khi thấy nỗi khổ của muôn loài; giây phút tĩnh lặng đầu tiên | MN 36 (ký ức ngồi dưới cây jambu) | B |
| 40 | `dem-trang-ra-di` | Đêm trăng ra đi | 9–12 ✓ | Thấy người già, người bệnh, người chết, người tu; đêm trăng cưỡi ngựa Kiền Trắc cùng Xa Nặc rời cung | Ra đi không vì chán đời mà vì thương người, muốn tìm lối ra khỏi khổ cho mọi người | AN 3.38; MN 26 | B |
| 50 | `con-duong-o-giua` | Con đường ở giữa | 13–17 ✓ | Sáu năm khổ hạnh đến kiệt sức; nhận bát sữa của cô bé Sujata; năm bạn tu bỏ đi | Hành hạ thân hay chiều theo ham muốn đều không đưa đến bình an; chăm thân và tâm vừa đủ | MN 36; MN 26 | B · gộp nháp `con-duong-o-giua` |
| 60 | `sao-mai-da-moc` | Sao mai đã mọc | 18 ✓ | Đêm dưới cội bồ đề; những cám dỗ và sợ hãi kéo đến; tay chạm đất; sao mai mọc | Bình an đến từ hiểu và thương, không từ chiến thắng ai; tâm thương trải khắp | MN 26; MN 36 | B |
| 70 | `qua-quyt-chanh-niem` | Quả quýt chánh niệm | 19 ✓ | Đức Phật dạy lũ trẻ trong làng ăn quýt từng múi, thấy cả cây, mưa, nắng trong quả quýt | Sống trọn từng phút; biết ơn những gì đang có | Cảnh do tác giả sách kể | B |
| 80 | `loc-uyen` | Lần đầu ở Lộc Uyển | 20–22 ✓ | Năm bạn tu cũ hẹn nhau không đứng dậy chào, nhưng thấy sự an tĩnh của Ngài thì tự đứng lên; Ngài kiên nhẫn giảng cho họ nhiều ngày; Kiều Trần Như hiểu ra đầu tiên | Lòng kiên nhẫn và tôn trọng với những người từng bỏ mình mà đi; con đường ở giữa (bài kinh giảng kỹ ở «Lời Phật dạy» › Chuyển Pháp Luân, Vô Ngã Tướng) | SN 56.11; SN 22.59; Luật tạng, Đại phẩm I.6 | B |
| 100 | `lua-dang-chay` | Lửa đang cháy | 27 ✓ | Trên núi Tượng Đầu, trước ngàn người thờ lửa theo anh em Ca Diếp | Tham, giận, si mê là lửa đốt chính mình; biết dừng thì lửa tắt, lòng mát | SN 35.28 | B |
| 110 | `nhan-duyen` | Gặp gỡ trên đường Vương Xá | 29 ✓ | Xá Lợi Phất gặp A Thuyết Thị đi khất thực, nghe một câu về nhân duyên rồi cùng Mục Kiền Liên tìm đến Đức Phật | Mọi sự do nhiều duyên mà có; thấy vậy thì bớt trách người, thêm hiểu và thương | Luật tạng, Đại phẩm I.23 | B |

### Phần Hai — Thương là hiểu (quyển 2, chương 30–55)

| thu_tu | id | Tên bài | Chương | Chuyện | Lời dạy, hướng thương | Nguồn kinh | Đợt |
|---|---|---|---|---|---|---|---|
| 120 | `lam-lanh-lanh-du` | Làm lành, lánh dữ | 30 ✓ | Vua Tần Bà Sa La dâng rừng Trúc Lâm; đêm trăng tròn, đông đủ đệ tử tụ hội | Không làm điều ác, làm mọi điều lành, giữ tâm trong sạch | Dhp 183–185 | C · gộp nháp `lam-lanh-lanh-du` |
| 140 | `sum-hop` | Ngày trở về | 34 ✓ | Về Ca Tỳ La Vệ: vua Tịnh Phạn, Da Du Đà La, bé La Hầu La; Ngài ôm bát đi khất thực trên con phố cũ | Thương gia đình bằng cách sống tỉnh thức, tử tế; đem bình an về cho người thân | Luật tạng, Đại phẩm I.54; chú giải Pháp Cú | C |
| 150 | `oi-hanh-phuc` | Ôi, hạnh phúc! | 38 ✓ | Bạt Đề, vốn là vua, ngồi dưới gốc cây giữa đêm và reo lên "Ôi, hạnh phúc!" | Hạnh phúc đến từ lòng nhẹ và không sợ hãi, không từ quyền lực hay của cải | Ud 2.10 | C |
| 160 | `phu-dat-bang-vang` | Phủ đất bằng vàng | 40 ✓ | Ông Cấp Cô Độc, người hay giúp kẻ không nơi nương tựa, trải tiền vàng mua vườn của thái tử Kỳ Đà để dựng chỗ ở cho Tăng | Lòng rộng rãi; bốn niềm vui của người sống đời gia đình: làm ra của lương thiện, dùng của ấy, không nợ, sống không điều đáng chê | Luật tạng, Tiểu phẩm VI.4; AN 4.62 | C · gộp nháp `bon-niem-vui` |
| 180 | `thuong-la-hieu` | Thương là hiểu | 42 ? | Một nhóm tăng sĩ vào rừng tu, đêm đêm sợ hãi bỏ về; Đức Phật dạy họ trải lòng thương rồi trở lại rừng | Thương là hiểu; thương mọi loài như mẹ che chở đứa con một (bài kinh giảng kỹ ở «Lời Phật dạy» › Tâm Từ) | Sn 1.8 và chú giải | C · gộp nháp `thuong-nhu-me-hien` |
| 190 | `nuoc-mat-ai-cung-man` | Nước mắt ai cũng mặn | 43 ✓ | Sunita, người gánh phân bị cả thành xa lánh, nép vào tường tránh đường; Đức Phật dừng lại, gọi anh, nhận anh làm đệ tử | Máu ai cũng đỏ, nước mắt ai cũng mặn; không ai sinh ra đã thấp hèn | Thag 12.2 | C |
| 200 | `mo-cua` | Mở cửa | 45 ✓ | Bà Ma Ha Ba Xà Ba Đề cùng nhiều phụ nữ cắt tóc, đi chân trần đến xin tu; A Nan thưa giúp; Đức Phật mở cửa | Nữ giới cũng đi được trọn con đường; lòng thương không phân biệt | AN 8.51 | C |
| 210 | `nam-la-simsapa` | Nắm lá trong tay | 46 ✓ | Trong rừng, Ngài nắm một nắm lá, hỏi lá trong tay nhiều hay lá trong rừng nhiều | Ngài chỉ dạy điều giúp người bớt khổ; sống được một điều còn hơn biết thật nhiều | SN 56.31 | C |
| 220 | `cau-thiem-di` | Lấy cỏ che bùn | 48 ✓ | Câu Thiểm Di: hai nhóm tăng sĩ tranh cãi không dứt; Ngài một mình vào rừng Pārileyyaka, có voi chúa chăm sóc; hai bên tỉnh ra tìm Ngài làm hòa ("lấy cỏ che bùn") | Ngài không ép ai, lặng lẽ ra đi bằng lòng thương; hận thù chỉ lắng xuống bằng lòng không hận thù (câu kệ giảng kỹ ở «Lời Phật dạy» › Pháp Cú) | MN 128; Dhp 5–6; Luật tạng, Đại phẩm X | C · gộp nháp `han-thu` |
| 230 | `bai-hoc-cua-dat` | Bài học của đất | 49 ✓ | Đức Phật dạy La Hầu La: tấm gương soi lại việc làm; tập như đất nhận mọi thứ mà không giận, như nước, lửa, gió | Lòng rộng như đất thì không gì làm mình tổn thương; từ, bi, hỷ, xả | MN 61; MN 62 | C · gộp nháp `tam-guong` |
| 240 | `song-trong-hien-tai` | Sống trọn hôm nay | 53 ✓ | Một buổi chiều, Ngài dạy về người biết sống một ngày cho trọn | Quá khứ đã qua, tương lai chưa tới; sống sâu sắc phút này | MN 131 | C |

### Phần Ba — Về với mây trắng (quyển 3, chương 56–81)

| thu_tu | id | Tên bài | Chương | Chuyện | Lời dạy, hướng thương | Nguồn kinh | Đợt |
|---|---|---|---|---|---|---|---|
| 260 | `tro-ve-hoi-tho` | Trở về hơi thở | 56 ✓ | Đêm trăng tròn cuối mùa mưa, tăng chúng ở lại thêm một tháng để nghe Ngài dạy về hơi thở | Thở vào biết thở vào; mỗi hơi thở là một lần thân tâm gặp lại nhau | MN 118 | D · gộp nháp `tro-ve-hoi-tho` |
| 270 | `noi-dau-ba-visakha` | Nỗi đau của bà Tỳ Xá Khư | 60 ✓ | Bà Tỳ Xá Khư mất đứa cháu, tóc ướt áo ướt đến gặp Ngài giữa trưa | Ngồi bên nỗi đau của người khác; thương là có mặt; ai thương nhiều thì đau nhiều | Ud 8.8 | D |
| 280 | `tam-long-nhu-dat` | Tấm lòng như đất | 62 ✓ | Xá Lợi Phất bị vu là xúc phạm người khác; ông bình thản ví lòng mình như đất; người vu cáo xin lỗi | Nhẫn nhục, khiêm cung, tha thứ | AN 9.11 | D |
| 290 | `bon-trai-nui` | Bốn trái núi | 66 ✓ | Vua Ba Tư Nặc kể chuyện việc nước; Ngài hỏi nếu bốn phía có núi đang lăn tới thì vua làm gì | Già, bệnh, chết đến với mọi người; hãy sống lành ngay bây giờ | SN 3.25 | D |
| 300 | `chim-cut-va-chim-ung` | Chim cút và chim ưng | 70 ✓ | Truyện ngụ ngôn: chim cút ra khỏi bờ ruộng thì bị ưng bắt, ở lại trong luống cày thì an toàn | Giữ tâm ở chỗ an toàn của mình; đừng để lòng chạy theo mọi cám dỗ | SN 47.6 | D |
| 310 | `day-dan` | Dây đàn | 71 ✓ | Sona tu quá sức đến rướm máu chân, muốn bỏ về; Ngài hỏi về dây đàn quá căng, quá chùng | Siêng năng mà không ép mình; thương chính mình cũng là tu | AN 6.55 | D |
| 320 | `bong-mat-ho-hang` | Bóng mát của họ hàng | 72 ✓ | Vua Tỳ Lưu Ly kéo quân đánh dòng họ Thích; Đức Phật ngồi dưới cây khô bên đường, ba lần quân phải quay về | Lặng lẽ đứng giữa bạo lực bằng lòng thương; không dùng hận đáp hận | Chú giải Pháp Cú (truyện Tỳ Lưu Ly) | D |
| 330 | `ta-da-dung-lai` | Ta đã dừng lại | ? | Ương Quật Ma La đuổi theo mà không kịp; "Ta đã dừng lại, anh hãy dừng lại" | Không ai là không thể đổi thay; người lầm lỗi vẫn bắt đầu lại được | MN 86 | D · gộp nháp `ta-da-dung-lai` |
| 340 | `voi-say` | Con voi say | ? | Đề Bà Đạt Đa thả voi Nalagiri say rượu lên đường Ngài đi; Ngài đứng yên, trải lòng thương; voi quỳ xuống | Lòng thương mạnh hơn sợ hãi và ác ý; không oán người hại mình | Luật tạng, Tiểu phẩm VII.3 | D |
| 350 | `bat-com-cuoi-cung` | Bữa cơm cuối cùng | 79 ✓ | Thuần Đà, người thợ rèn, dâng bữa cơm có nấm; Ngài lâm bệnh nhưng dặn A Nan an ủi để Thuần Đà không tự trách | Đến phút cuối vẫn lo cho nỗi lòng người khác | DN 16 | D |
| 360 | `hay-tinh-tan` | Hãy tinh tấn | 80 ✓ | Rừng sala ở Câu Thi Na; Ngài nhận người đệ tử cuối là Tu Bạt Đà La; lời dặn cuối | Tự thắp đuốc mà đi; mọi thứ hợp rồi tan, hãy chuyên cần | DN 16 | D · gộp nháp `tu-thap-duoc` |
| 370 | `duong-xua-may-trang` | Đường xưa mây trắng | 81 ✓ | Svastika, nay đã lớn, nhìn lại con đường đã theo Ngài | Con đường thương yêu vẫn còn đó cho mỗi người bước tiếp | Truyện khung của sách | D |

**Ngoài loạt:** bản nháp `le-sau-phuong` (DN 31) chưa thấy trong mục lục sách. Giữ trong kho nháp cho một loạt sau ("Đời sống gia đình"), không chặn loạt này.

## 4. Quan hệ với loạt «Lời Phật dạy»

Bảy bài v0.14.0 (Chuyển Pháp Luân, Vô Ngã Tướng, Tâm Từ, Điềm Lành, Kālāma, Niệm Xứ, Pháp Cú) là một loạt riêng, có menu riêng trong app (chủ dự án quyết định ngày 14/11/2026).

- Loạt Đường Xưa không chép lại các bài ấy. Ở chương có bài kinh tương ứng (bài 80, 180, 220), Đường Xưa **kể chuyện**; lời kinh giảng kỹ để ở «Lời Phật dạy».
- Không dùng chung `id` giữa hai loạt.

## 5. Đợt sản xuất và mốc

Bảng tiến độ chung nằm ở `PROJECT_ROADMAP.md` §19 GĐ3 (T3.5–T3.9), do Codex cập nhật. Trạng thái từng việc theo dõi trên Issue.

| Đợt | Bài | Codex viết xong (PR `cho_duyet` + giọng đọc) | Ghi chú |
|---|---|---|---|
| Mẫu giọng | đoạn `con-thien-nga`, 6 giọng | 18/11/2026 | Chủ dự án nghe xác nhận giọng chính |
| Lời Phật dạy | 7 bài v0.14.0 bản chi tiết | Claude viết xong 14/11 ([PR #54](https://github.com/tnfsmith/Buddha/pull/54)) | Chủ dự án duyệt → v0.15.0 (chữ); có tiếng ở bản kế tiếp |
| B | 10 bài Phần Một | 01/12/2026 | |
| C | 11 bài Phần Hai | 10/12/2026 | |
| D | 12 bài Phần Ba | 20/12/2026 | |
| Hạn cứng | giọng đọc mọi bài đã có văn bản | **05/01/2027** | OpenAI ngừng Speech API ngày 06/01/2027 (ADR 0002 mục 7) |

## 6. Tên riêng thường gặp

Viết như cột trái. Từ điển cách đọc (`content/tu-dien-doc.yml`) xử lý tên phiên âm Ấn Độ nếu giọng đọc sai.

| Viết | Gốc Pāli |
|---|---|
| Đức Phật, Ngài; thái tử Tất Đạt Đa | Buddha; Siddhattha |
| Vua Tịnh Phạn · Da Du Đà La · La Hầu La · Ma Ha Ba Xà Ba Đề | Suddhodana · Yasodharā · Rāhula · Mahāpajāpatī |
| Đề Bà Đạt Đa · A Nan · Xá Lợi Phất · Mục Kiền Liên · Kiều Trần Như · A Thuyết Thị | Devadatta · Ānanda · Sāriputta · Moggallāna · Koṇḍañña · Assaji |
| Ngựa Kiền Trắc · Xa Nặc | Kanthaka · Channa |
| Vua Tần Bà Sa La · vua Ba Tư Nặc · vua Tỳ Lưu Ly | Bimbisāra · Pasenadi · Viḍūḍabha |
| Cấp Cô Độc · Tỳ Xá Khư · Thuần Đà · Ương Quật Ma La · Bạt Đề · Tu Bạt Đà La | Anāthapiṇḍika · Visākhā · Cunda · Aṅgulimāla · Bhaddiya · Subhadda |
| Svastika · Sujata · Sunita · Sona · voi Nalagiri | Sotthiya · Sujātā · Sunīta · Soṇa · Nāḷāgiri |
| Ca Tỳ La Vệ · Vương Xá · Xá Vệ · Câu Thiểm Di · Câu Thi Na · Ba La Nại | Kapilavatthu · Rājagaha · Sāvatthī · Kosambī · Kusinārā · Bārāṇasī |
| Lộc Uyển · Trúc Lâm · Kỳ Viên · núi Tượng Đầu · sông Ni Liên Thiền · sông Hằng | Isipatana · Veḷuvana · Jetavana · Gayāsīsa · Nerañjarā · Gaṅgā |

## 7. Bài mẫu: `con-thien-nga`

Bài mẫu để Codex giữ đúng văn phong, và là đoạn chuẩn để thử giọng (ADR 0002 mục 7). Trạng thái `cho_duyet`; Codex được sửa cho hợp cả loạt.

```markdown
---
id: con-thien-nga
version: 1
kind: bai_giang
tier: 0
lang: vi
title: Con thiên nga bị thương
source_ref: "Phỏng theo Đường Xưa Mây Trắng (Thích Nhất Hạnh), chương 4 · Phật truyện (Lalitavistara) · Pháp Cú 129–130"
status: cho_duyet
meta: { loat: duong-xua, phan: 1, thu_tu: 20, chuong: [4], dot: B }
---
Buổi sáng mùa xuân ở thành Ca Tỳ La Vệ. Trong vườn thượng uyển, nắng còn non, mặt hồ phẳng lặng, và cậu bé Tất Đạt Đa đang ngồi một mình dưới tán cây, ngước nhìn một đàn thiên nga bay ngang trời.
Bỗng có tiếng dây cung bật lên. Một con thiên nga trắng chao đi, rồi rơi xuống bãi cỏ ngay trước mặt cậu, một mũi tên cắm sâu trong cánh.
Cậu chạy tới, quỳ xuống, đỡ con chim lên hai tay. Con chim run rẩy, đôi mắt tròn đen đầy sợ hãi. Cậu nói thật khẽ: "Đừng sợ, không ai làm đau em nữa đâu."
Cậu từ từ rút mũi tên ra, lấy vạt áo lau máu, đắp lên vết thương mấy chiếc lá thuốc, rồi ôm con chim vào lòng cho ấm. Con chim thôi giãy giụa, nằm yên nghe nhịp tim của người vừa cứu mình.
Lát sau, người anh họ Đề Bà Đạt Đa chạy đến, tay vẫn cầm cung: "Con chim ấy của tôi. Tôi đã bắn rơi nó. Trả đây!"
Tất Đạt Đa ôm con chim chặt hơn: "Nếu nó chết, có lẽ nó thuộc về anh. Nhưng nó còn sống, và em sẽ không để ai làm nó đau thêm."
Không ai chịu ai, hai anh em cùng đến trước hội đồng các bậc cao niên trong triều. Một vị hiền giả tóc bạc nhìn con chim trong tay cậu bé, rồi chậm rãi nói: sự sống thuộc về người biết giữ gìn sự sống, không thuộc về người muốn lấy đi.
Tất Đạt Đa chăm con thiên nga nhiều ngày. Khi cánh đã lành, cậu mang nó ra bờ hồ, mở rộng hai tay. Con chim vỗ cánh, lượn một vòng trên đầu cậu, rồi bay vút về phía đàn của nó.
Nhiều năm sau, khi đã thành Phật, Ngài vẫn dạy điều mà cậu bé năm xưa đã biết bằng cả trái tim: mọi loài đều run sợ trước roi gậy, mọi loài đều quý mạng sống của mình.
Ngài dạy: hãy lấy chính mình ra mà so. Mình sợ đau thế nào thì muôn loài cũng sợ đau thế ấy. Hiểu như vậy, ta sẽ không nỡ làm hại, và cũng không khiến người khác làm hại.
> Sabbe tasanti daṇḍassa, sabbe bhāyanti maccuno; attānaṃ upamaṃ katvā, na haneyya na ghātaye.
Lòng thương của Đức Phật không chọn người hay chọn vật. Một con chim nhỏ, một chú chó bên đường, cả một người ta không ưa, đều mang một trái tim biết đau và biết sợ như ta.
Hôm nay, khi gặp một sinh mệnh yếu hơn mình, một con vật, một em bé, hay một người đang gặp khó, ta hãy dừng lại một hơi thở và tự hỏi: mình có thể là người đỡ lấy, thay vì là người làm đau?
Hãy hình dung con thiên nga trắng ấy đang bay giữa trời xanh. Mỗi lần ta chọn thương thay vì làm hại, lại có thêm một đôi cánh được tự do.
```
