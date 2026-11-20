# Đồng tu v2: Đài Đồng Tu ở Đại Thiền Đường, mời nhóm, hẹn giờ, chia sẻ và tiến trình bạn

Issue #151. Bổ sung cho `docs/thiet-ke/ban-dong-tu.md` (#121) và hợp đồng `docs/contracts/ban-dong-tu.md` (#126). Hợp đồng API của phần này ở hợp đồng §9–§12.

## 1. Yêu cầu của chủ dự án (20/11/2026)

1. **Đài Đồng Tu:**
   - Mời bạn đồng tu thì tên các nhân vật hiện ở Đại Thiền Đường, và phải thấy các nhân vật ngồi tại đây, gần nhau.
   - Người được mời ngồi cao hơn hội chúng bên dưới, đối diện và ngang tòa sen của Đức Phật, để tách rõ không gian tu tập của nhóm bạn, đồng thời gần Đức Phật hơn.
2. **Góc máy:** thấy được Đức Phật và các bạn, xoay được 360°.
3. **Kiểu mời:** ngoài cùng ngồi thiền, có Thiền tọa, Trà Đạo, Vân Mây sang thăm… khi cả hai đủ điều kiện theo chương trình.
4. **Mời nhóm:** từ hai bạn trở lên cùng thiền ở Đại Thiền Đường, chọn từ danh sách bạn.
5. **Hẹn giờ đồng tu** và nhắc giờ tham gia.
6. **Chia sẻ mã mời:** sao chép và chia sẻ mã mời tham gia ứng dụng lên Facebook, chuẩn trên điện thoại và máy tính.
7. **Điều kiện mời:** nhân vật phải được tạo và lưu thành công thì mới mời người khác được.
8. **Danh sách:**
   - Mỗi dòng có tên và ID.
   - Có liên kết xem Vân Đảo của bạn, mời ghé thăm hoặc xem nhanh tiến trình tu tập.
   - Khích lệ bạn tu tập tốt hơn; chia sẻ tiến trình tu học của mình để bạn cùng tiến lên.

## 2. Nguyên tắc giữ nguyên

- Không điểm, không xếp hạng, không so sánh Kusala giữa các bạn. Tiến trình bạn chỉ là ngày hành trình và số việc đã làm; không có bảng thi đua.
- Không bao giờ nói người dùng đã chứng đắc. Chỉ nói «đã hoàn thành chương trình» (`AGENTS.md` mục 1.6). Đài Đồng Tu là chỗ ngồi cùng bạn, không mang nghĩa phẩm vị.
- **Không chữ tự do:**
  - Lời mời, lời khích lệ và lời chia sẻ đều là lời mẫu.
  - Khích lệ là nhắc nhẹ, không trách, không đếm chuỗi ngày bỏ lỡ.
  - Không gửi thông báo đẩy cho lời khích lệ.
- **Quyền riêng tư mặc định kín:**
  - Tiến trình chi tiết chỉ bạn đồng tu thấy, và chỉ khi chính người đó bật «Chia sẻ tiến trình».
  - Ngày hành trình vẫn theo cài đặt `hien_ngay` sẵn có.
- Đang thiền thì không hiện lời mời, lời khích lệ, nhắc giờ và không có âm. Xuất thiền rồi mới hiện (như #148).
- Tôn tượng luôn cao hơn mọi chỗ ngồi; máy quay không lên cao hơn tầm mắt Ngài.

## 3. Đài Đồng Tu trong Đại Thiền Đường (Claude, `world.js`)

### 3.1 Vị trí
| | Giá trị | Lý do |
|---|---|---|
| Tâm đài | `(0, 100, −520)` | Trục giữa, ngay trước tòa sen: cách tâm Tôn tượng 240. Mũi cánh sen ngoài cùng ở ≈ 190 (cao ≈ 105), vành mây đỡ tòa sen tới ≈ 220 |
| Độ cao | 100 | Ngang tòa sen: đài mây 75, cánh sen ngoài ≈ 105, cánh sen trong ≈ 133. Hội chúng ngồi ở 3; mắt Ngài ở 370 |
| Hướng | Mọi chỗ quay về tâm Tôn tượng | Đối diện tòa sen |

- **Chỗ ngồi:** 2–6 Vân Tọa xếp cung ngắn, cách nhau 7, cùng một khối mây đài. Thứ tự từ trái sang phải: chủ phiên, rồi các bạn theo thứ tự nhận lời. Mình luôn có chỗ: nhân vật của mình (`hallFig`) rời chỗ ở hội chúng (`SEAT`) lên đài khi phiên bắt đầu và trở về khi phiên tan.
- **Cỡ nhân vật trên đài:** phóng 4 lần để còn thấy dáng ngồi khi lùi xa nhìn cả Tôn tượng (tượng cao gần 400). Chỉ nhằm cho dễ nhìn, ghi rõ trong mã; tên hiển thị không đổi.
- **Nhãn tên:** nhãn HTML trên đầu mỗi người, dùng cùng kiểu nhãn bạn đồng tu ở Vân Đảo:
  - người khác: «Tịnh danh · mã»;
  - mình: «Tịnh danh (bạn)»;
  - không hiện số liệu nào.
  Nhãn tự ẩn khi khuất khỏi khung hình (`place()` trong `main.js`).
- **Lúc hiện:** đài chỉ dựng khi có phiên đồng tu ở Đại Thiền Đường (lời mời `thien` + `dtd` đã nhận lời, hoặc phiên nhóm §5).
  - Từ lúc còn 60 giây: đài hiện, các bạn đã nhận lời ngồi sẵn.
  - Hết thời thiền (15 phút): đài tan.
  - Bạn chưa vào (máy chưa mở hoặc vào trễ) vẫn có chỗ, Vân Tọa sáng mờ, nhãn ghi «đang tới».
- **Ngân sách:** ≤ 6 hình người (dùng `buildFigure` như bạn ở Vân Đảo) + 1 khối đài gộp từ hình Vân Tọa có sẵn.
  - Không thêm shader; texture chỉ có ảnh mặt của mỗi nhân vật như ở Vân Đảo.
  - Khi đài không hiện thì 0 lệnh vẽ.
  - Mức 2 có đài 6 người phải còn trong ngân sách §12.2 (`perf.spec.js` thêm một dòng «Đại Thiền Đường + Đài Đồng Tu»).

### 3.2 Góc máy
- **«Cùng ngồi»** (mặc định khi phiên bắt đầu):
  - từ sau lưng chếch bên, thấy rõ các bạn ngồi cạnh nhau;
  - Tôn tượng phía trước từ tòa sen lên ngực, nhìn chếch lên.
- **«Toàn cảnh»:**
  - lùi xa, thấy trọn Tôn tượng (cả đầu) và đài phía trước;
  - nhân vật nhỏ nhưng có nhãn tên.
- **Xoay 360°:**
  - kéo chuột hoặc vuốt một ngón xoay quanh tâm đài; chụm hai ngón hoặc cuộn để tiến lùi liên tục giữa hai cảnh;
  - góc ngẩng giới hạn sao cho máy không lên cao hơn tầm mắt Tôn tượng (≤ 360) và không chui dưới mặt mây.
- **Nút điều khiển:** nút «Cùng ngồi / Toàn cảnh» và «Xoay chậm» (tự quay quanh đài 1 vòng/2 phút, chạm vào cảnh thì dừng) nằm cạnh các nút + − ◎ sẵn có.
- **Khi đang thiền:** giữ chế độ nghỉ màn hình sẵn có (máy đứng yên dần); không tự xoay.

### 3.3 Trong thời thiền
- Âm thanh vẫn là thời thiền Web Audio như mọi khi. Mỗi máy tự phát; tất cả bắt đầu cùng một `start_at` của máy chủ.
- Hội chúng và các bạn trên đài cùng cúi lạy theo mốc (`bow`), như `hallFig`.
- Ai rời phiên (dừng thời thiền, đóng máy) thì Vân Tọa của người đó mờ dần. Không báo «X đã rời»; cuối buổi chỉ nói «Đã cùng ngồi với …».

## 4. Kiểu mời và điều kiện

Điều kiện lấy từ `canMeet` (`packages/shared/src/dong-tu.js`). Nút không đủ điều kiện vẫn hiện, bị khóa, kèm lý do (`REASON_TEXT`).

| Kiểu (tên trên nút) | `kind` · `place` | Điều kiện | Có ở |
|---|---|---|---|
| Cùng ngồi thiền ở Đại Thiền Đường | `thien` · `dtd` | Đã kết nối; bạn không vắng | #148 |
| Mời nhóm ngồi thiền / hẹn giờ | phiên §5 | Như trên, mỗi người được mời | #151 |
| Thiền tọa trên Vân Đảo của mình | `thien` · `dao` | Cổng Vân Môn người đi đã mở (ngày 29); chủ Nghênh khách | #125 |
| Cùng Trà Đạo | `tra` · `dao` | Như trên, và Trà Đạo của chủ đã mở (ngày 15) | #125 |
| Mời Vân Mây sang thăm | `tham` | Như Thiền tọa trên Vân Đảo | #125 |
| Xin sang thăm Vân Đảo bạn | `xin_tham` | Cổng mình đã mở; bạn Nghênh khách | #125 |
| Mời tham quan | `tham_quan` | Như Vân Mây sang thăm | #125 |

**Du vân sang đảo** dùng hoạt cảnh có sẵn: ra cổng, mây hạ, bước lên, bay, hạ trước Vân Môn đảo bạn. #125 nối hoạt cảnh này với đảo bạn thật, dựng theo ngày hành trình và hình dáng bạn cho hiện.

Trước khi #125 xong, các nút ở hàng «#125» hiện bị khóa, kèm dòng «Sắp có: cần du vân sang đảo bạn».

## 5. Mời nhóm và hẹn giờ: «phiên đồng tu»

- **Tạo phiên:** nút «Mời nhóm ngồi thiền» trong danh sách, hoặc «Hẹn giờ» ở một bạn.
  - Chọn 1–5 bạn bằng ô đánh dấu. Bạn không đủ điều kiện bị khóa, kèm lý do.
  - Chọn giờ: «Ngay (sau 1 phút)» hoặc một ngày giờ trong 7 ngày tới, theo bước 5 phút, giờ địa phương.
  - Nơi: Đại Thiền Đường. Kiểu: thời thiền 15 phút.
- **Người được mời:**
  - Thẻ «Tuệ Thái · 5696 mời bạn cùng ngồi thiền lúc 20:30 thứ Bảy, cùng Minh An · 2210 và 1 bạn nữa». Có hai nút: Nhận lời / Để lúc khác.
  - Đã nhận lời thì có thể «Rút lui» trước giờ.
- **Chủ phiên:** thấy từng người đã nhận / đang chờ / để lúc khác; có thể hủy phiên.
- **Danh sách:** có mục «Lịch đồng tu» liệt kê các phiên sắp tới.
- **Nhắc giờ** (ba lớp, cái nào có thì dùng):
  1. **Trong ứng dụng:** còn 10 phút và còn 1 phút, nếu ứng dụng đang mở và không đang thiền. Thẻ nhắc có nút «Vào Đại Thiền Đường».
  2. **Web Push qua ReminderClock (#106/#150): để sau.** Cần một hợp đồng DO riêng (hợp đồng §9.5). Khi có: còn 10 phút, chỉ khi người dùng đã bật thông báo; tuân Tịnh khẩu và giờ yên lặng. Chạm vào thông báo thì mở thẳng Đại Thiền Đường.
  3. **«Thêm vào lịch»:** tệp `.ics` có báo trước 10 phút. Không cần bật thông báo; mở được trên điện thoại và máy tính.
- **Tới giờ:** mọi người đã nhận lời cùng lên Đài Đồng Tu (§3), đếm ngược theo giờ máy chủ. Vào trễ thì bắt kịp đúng chỗ của người khác, như #148.
- **Hạn mức:**
  - mỗi người tối đa 3 phiên sắp tới do mình tạo;
  - mỗi ngày tạo tối đa 10 phiên;
  - mỗi phiên tối đa 6 người (mình + 5).

## 6. Chia sẻ mã mời

- **Nút «Sao chép»:** chép câu «Mời bạn cùng tu tập với mình trên Vân Đạo: <liên kết>».
- **Nút «Facebook»:** mở `https://www.facebook.com/sharer/sharer.php?u=<liên kết>`.
  - Máy tính: cửa sổ nhỏ 600×560.
  - Điện thoại: mở tab mới; ứng dụng Facebook nhận nếu có.
  - Facebook chỉ nhận liên kết, không nhận câu chữ soạn sẵn. Lời nhắn do người dùng tự gõ trong Facebook.
- **Nút «Chia sẻ»** (điện thoại, Web Share): mở bảng chia sẻ của máy, gồm Messenger, Zalo, tin nhắn…
- **Liên kết:** Facebook bỏ phần sau dấu `#` ở một số nơi, nên liên kết chia sẻ ra ngoài dùng dạng truy vấn `https://vandao.ainextbrain.com/?ban=K7M2QX9A`. Ứng dụng đổi `?ban=` thành `#ban=` khi mở.
- **Thẻ xem trước:** dùng chung cho mọi mã, đặt trong `index.html` (hợp đồng §12): «Mời bạn tu cùng trên Vân Đạo». Thẻ không có tên người mời, nên không cần trang Worker. Có tên người mời là việc cần chủ dự án xác nhận.
- QR và mã chữ lớn giữ như #148.

## 7. Điều kiện mời: nhân vật đã tạo và lưu

- **Đủ điều kiện khi:**
  - có Tịnh danh và hình dáng trên máy (`S.name`, `S.look`);
  - đã «Giữ hành trình» (có phiên);
  - hồ sơ máy chủ đã nhận Tịnh danh (`/me.profile.tinh_danh` khác rỗng).
- **Chưa đủ:** các nút Mời bạn tu cùng, Tìm bạn, Mời gặp, Mời nhóm bị khóa, kèm một dòng chỉ bước còn thiếu:
  - «Tạo nhân vật» mở màn Nhân vật;
  - «Giữ hành trình» mở Tài khoản;
  - «Đang lưu nhân vật…» khi hồ sơ chưa lên máy chủ.
- **Nhận lời mời** của người khác (mở liên kết `#ban=`) vẫn được. Kết nối xong, người mới được nhắc tạo nhân vật trước khi mời người khác.
- **Máy chủ** chặn cùng điều kiện: tạo mã mời, gửi lời kết nối, mời gặp, tạo phiên khi `profile.tinh_danh` rỗng thì trả 409 `need_character` (§11 hợp đồng).

## 8. Danh sách rõ ràng, xem nhanh, khích lệ, chia sẻ tiến trình

- **Mỗi dòng bạn:**
  - chấm trạng thái + **Tịnh danh · mã**; mã 4 số là ID công khai, cùng dạng người dùng gõ khi tìm;
  - dòng phụ: trạng thái, ngày hành trình (nếu bạn cho hiện);
  - nút: **Mời ▾** (các kiểu ở §4), **Xem nhanh**, **Vân Đảo**, **Khích lệ**.
- **Xem nhanh** (chỉ khi bạn bật «Chia sẻ tiến trình»):
  - ngày hành trình và chu kỳ;
  - số thời thiền, số buổi nghe giảng trong chu kỳ;
  - các phân khu Vân Đảo đã mở, suy từ ngày hành trình;
  - lần tu tập gần nhất theo khung «hôm nay / hôm qua / trong tuần / lâu hơn».
  Không có Kusala, không so với mình. Bạn chưa bật thì ghi «Bạn chưa chia sẻ tiến trình».
- **Vân Đảo:**
  - Liên kết `…/#dao=<tinh_danh-mã>` mở cảnh Vân Đảo của bạn nhìn từ ngoài: đảo dựng theo ngày hành trình, hình dáng và chế độ cổng (#125).
  - Bạn Nghênh khách và đủ điều kiện thì có nút «Xin sang thăm».
  - Trước khi #125 xong: chỉ hiện «Xem nhanh» kèm các phân khu đã mở.
- **Khích lệ:** chọn một trong bốn lời mẫu.
  - «Tùy hỷ công phu của bạn.»
  - «Mình cùng giữ thời thiền ngày mai nhé.»
  - «Mình nhớ bạn, khi nào rảnh mình cùng ngồi một thời nhé.»
  - «Cảm ơn bạn đã cùng tu tập.»
  Quy tắc:
  - mỗi người gửi mỗi bạn tối đa 1 lời/ngày;
  - người nhận thấy trong danh sách (mục «Lời khích lệ», giữ 7 ngày) và chấm số trên nút;
  - không thông báo đẩy, không hiện khi đang thiền;
  - người bị chặn không gửi được.
- **Chia sẻ tiến trình của mình:**
  - Bật «Chia sẻ tiến trình với bạn đồng tu» (mặc định tắt) ở Quyền riêng tư. Lần đầu bấm «Chia sẻ tiến trình» thì hỏi bật.
  - Nút «Báo bạn tiến trình của mình» gửi lời mẫu «Mình vừa đi tới ngày N của hành trình, cùng tiến lên nhé.» tới các bạn chọn, tính chung hạn mức khích lệ.
  - Đã hoàn thành chương trình thì lời mẫu là «Mình đã hoàn thành chương trình 49 ngày, cảm ơn bạn đã cùng tu tập.»
  - Chia sẻ ra ngoài (Facebook, Chia sẻ của máy): câu «Mình đang ở ngày N của hành trình 49 ngày trên Vân Đạo» kèm liên kết mời. Không kèm số Kusala.

## 9. Chia việc và thứ tự

1. **Claude:** thiết kế này + hợp đồng §9–§12, PR riêng; Codex duyệt rồi chủ dự án merge.
2. **Claude, làm song song không cần API mới** (PR xếp sau #148):
   - Đài Đồng Tu, nhãn tên, góc máy 360° cho phiên `thien` · `dtd` của #148;
   - nút Facebook, Chia sẻ, Sao chép; `?ban=`;
   - điều kiện nhân vật phía máy khách;
   - danh sách có ID, «Xem nhanh» bản rút gọn từ dữ liệu sẵn có (ngày, phân khu suy từ ngày, trạng thái).
3. **Codex, sau khi hợp đồng merge:**
   - migration và đường dẫn phiên đồng tu, tiến trình, khích lệ;
   - `need_character`;
   - mốc đã xem khích lệ, PATCH cài đặt gộp theo khóa;
   - Web Push cho phiên để sau, theo một hợp đồng DO riêng (hợp đồng §9.5).
4. **Claude, sau bước 3:** giao diện mời nhóm, hẹn giờ, lịch đồng tu, nhắc trong ứng dụng, `.ics`, Xem nhanh đầy đủ, khích lệ, chia sẻ tiến trình.
5. **Claude:** #125, Vân Đảo bạn 3D, du vân sang thăm, các kiểu gặp ở hàng «#125» của §4.

## 10. Mặc định cần chủ dự án xác nhận
- Phiên tối đa 6 người (mình + 5), hẹn trước tối đa 7 ngày, bước 5 phút.
- Nhắc trước 10 phút (Web Push và `.ics`) và 1 phút (trong ứng dụng).
- Nhân vật trên Đài Đồng Tu phóng 4 lần.
- «Chia sẻ tiến trình» mặc định tắt; khích lệ 1 lời/bạn/ngày, không thông báo đẩy.
