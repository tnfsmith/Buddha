# Hành trình Sơ nhập — hệ thống nhiệm vụ hằng ngày (đề xuất v1)

> Trạng thái: **đề xuất, chờ chủ dự án duyệt**. Người soạn: Claude (15/11/2026), theo yêu cầu chủ dự án sau v0.16.0.
> Bổ sung cho `PROJECT_ROADMAP.md` §8 (Tầng 0), §9 (theo dõi và tích lũy), T3.1–T3.4. Không thay luật ở `AGENTS.md` mục 1.

## 0. Mục tiêu

Người tham gia Vân Đạo không chỉ "vào app cho biết". Họ sống 49 ngày Sơ nhập như một quá trình thực hành nghiêm túc:

- **Việc đời thường là chính, giáo lý là phụ.** Mỗi ngày có những việc cụ thể làm ngoài đời: giữ lời, nhường đường, thăm người thân, tắt điện thoại một giờ. Những việc này được phản chiếu vào nhân vật và Vân Đảo.
- **Hai loại nhiệm vụ:**
  - **Chủ động:** người dùng làm ngoài đời rồi tự xác nhận.
  - **Bị động:** app tự ghi nhận khi người dùng ngồi thời thiền, nghe Thuyết giảng hay nghe Đường Xưa Mây Trắng.
- **Ngũ giới và 10 Ba-la-mật** được chuyển thành hoạt động đời thường và gắn với từng khu, từng tính năng trong Vân Đạo.
- **Tích lũy tu học trực quan:** thấy được trên Bia Tích Lũy, trên Vân Đảo và trên nhân vật. Không điểm thưởng kiểu trò chơi, không xếp hạng.

## 1. Căn cứ

### 1.1 Pháp hành

- **Ngũ giới là nền của người tại gia** (§8.1). Truyền thống Làng Mai diễn đạt lại năm giới theo hướng tích cực, gắn với đời sống hiện đại: bảo vệ sự sống, hạnh phúc chân thật, tình thương đích thực, ái ngữ và lắng nghe, nuôi dưỡng và trị liệu. Cách diễn đạt này được trình bày như một khung tự soi chiếu hành động, lời nói và ý nghĩ, không phải luật cứng. [1][2]
  - Vân Đạo học **tinh thần** đó (giới = việc tích cực nên làm, không chỉ điều cấm) nhưng **viết bằng lời của mình**, không chép văn bản Làng Mai.
- **10 Ba-la-mật theo Phật Sử (Buddhavaṃsa):** bố thí, trì giới, xuất ly, trí tuệ, tinh tấn, nhẫn nại, chân thật, quyết định, tâm từ, xả. [3]
  - Có cách thực hành là chọn một Ba-la-mật làm trọng tâm trong một tuần, một tháng hay một năm, để đem phẩm chất của buổi ngồi thiền vào đời sống hằng ngày. [4] Vân Đạo dùng đúng cách này: **mỗi tuần hai Ba-la-mật trọng tâm**.
- **10 Phước nghiệp sự:** bố thí, trì giới, tu tập, cung kính, phục vụ, hồi hướng, tùy hỷ, nghe Pháp, thuyết Pháp, chỉnh trực tri kiến. [5] Mã dùng chung ở `packages/shared/src/parami.js` (Phụ lục H).

### 1.2 Khoa học hành vi (để thiết kế cho người thật bền được)

- **Kế hoạch "nếu–thì".** Một kế hoạch nói rõ khi nào, ở đâu, làm gì ("Khi tôi bực trong lúc lái xe, tôi sẽ thở ba hơi") giúp đạt mục tiêu tốt hơn so với chỉ có ý định.
  - Tổng hợp 94 thử nghiệm năm 2006 cho hiệu ứng trung bình–lớn (d = 0,65). [6]
  - Tổng hợp lớn hơn năm 2024 (642 thử nghiệm), sau khi hiệu chỉnh thiên lệch, cho ước lượng nhỏ hơn nhiều (d = 0,15 đến 0,35). [7]
  - → "Nguyện tuần" (Quyết định – adhiṭṭhāna) dùng mẫu nếu–thì, nhưng không hứa hẹn quá mức.
- **Thói quen cần thời gian, và lỡ một ngày không sao.** Nghiên cứu UCL trên 96 người cho thời gian đạt gần tự động trung vị 66 ngày, dao động 18–254 ngày. Lỡ một lần không ảnh hưởng đáng kể; chỉ làm rất thất thường mới không thành thói quen. [8]
  - → **Không có chuỗi ngày liên tiếp bị "đứt"**. Đếm "số ngày đã tu", không đếm chuỗi. 49 ngày là chặng mở đầu, không phải lúc thói quen đã thành.
- **Phần thưởng bên ngoài làm hao động lực bên trong; phản hồi mang tính thông tin thì giúp.**
  - Tổng hợp 128 nghiên cứu: phản hồi tích cực làm tăng hứng thú tự nguyện (d ≈ 0,33). [9]
  - Phần thưởng hữu hình gắn với việc làm hay việc hoàn thành làm giảm động lực sau khi thôi thưởng (d từ −0,24 đến −0,48). [10]
  - → Hợp với luật dự án: **không huy hiệu, không xếp hạng, không điểm đổi quà**. "Quả ngọt" là phản hồi thông tin: cảnh Vân Đảo đổi, hoa sen 10 cánh cho thấy sự cân bằng, lịch tu cho thấy mình đã đi bao xa.

## 2. Luật giữ nguyên

1. **Công thức Kusala, ba trục Đức–Thiện–Tuệ, khóa 1 nấc mỗi ngày** không đổi (`AGENTS.md` mục 1.5, `packages/shared/kusala.js`, `schedule.js`).
   - Nhiệm vụ mới **không cộng thêm Kusala**. Chúng làm sáng hoa sen 10 cánh, lịch tu, sổ nghe Pháp và cảnh Vân Đảo (mục 6).
   - Ghi nhận ba trục mỗi tối vẫn như hiện nay; app chỉ đính kèm "bằng chứng" đã tự ghi nhận để người dùng tự đánh giá trung thực.
2. **Không tiền:** mọi việc thiện luôn có lựa chọn không tốn tiền. Mua hay gieo không tạo nhiệm vụ, không cộng gì (mục 1.1).
3. **Không xếp hạng, không huy hiệu.** Cộng đồng chỉ thấy số tổng hợp ẩn danh (§9.1).
4. **Trung thực trước hết:** việc ngoài đời do người dùng tự xác nhận. Nhận mình lỡ (Sám hối) được ghi *chân thật*, không trừ gì (§8.2).
5. **Riêng tư:** ghi chú, phản tỉnh và hoàn cảnh cá nhân chỉ ở trên máy. Máy chủ chỉ nhận mã nhiệm vụ, ngày, số phút, mã Ba-la-mật (mục 8).
6. **Không nói chứng đắc.** Cuối chặng chỉ nói "đã hoàn thành chương trình Sơ nhập" (§8.6).
7. **Offline-first:** ngồi thiền, nghe đã tải và xác nhận nhiệm vụ chạy được không cần mạng.

## 3. Một ngày Sơ nhập: bốn nhóm việc

| Nhóm | Ai ghi nhận | Mỗi ngày | Gắn với |
|---|---|---|---|
| **A. Ba việc chính** (Đức · Thiện · Tuệ) | Người dùng, mỗi tối, bằng thanh trượt như hiện nay | 3, theo tuần (`WEEKS`, sau này là biến thể §8.3) | Kusala (không đổi) |
| **B. Giữ giới hôm nay** | Người dùng chạm 1 lần cho mỗi giới đã giữ, hoặc Sám hối | 5 giới đã phát nguyện | Hoa sen (cánh Trì giới và cánh của việc), lịch tu |
| **C. Hạnh của tuần** | Người dùng chọn 1 trong 3 việc nhỏ của Ba-la-mật trọng tâm, làm xong thì xác nhận | 1 (tối đa 2) | Hoa sen, Vân Đảo |
| **D. Tự ghi nhận** | App, khi người dùng thực hành trong Vân Đạo | Không giới hạn; mỗi loại sáng cánh hoa 1 lần mỗi ngày, số phút cộng dồn | Hoa sen, nhịp thiền, sổ nghe Pháp, Vân Đảo |

**Gánh nặng mỗi ngày cho người mới:** 3 việc chính + 1 thẻ giới (5 chạm nhanh) + 1 hạnh nhỏ. Phần tự ghi nhận không đòi gì thêm. Người chọn "10 phút/ngày" ở Duyên khởi chỉ được gợi ý các việc ngắn nhất.

### 3.1 Bảng "Hôm nay" (giao diện)

Mở từ Bia Tích Lũy, hiện đầu tiên mỗi sáng. Nền trong suốt, chữ gọn, chạm được bằng một tay trên điện thoại.

```
Hôm nay · Ngày 12/49 · Tuần 2: Tịnh hóa khẩu nghiệp
─ Ba việc chính ──────────────── (ghi nhận buổi tối)
  Đức · Chân ngữ & hòa ngữ        ○
  Thiện · Bố thí lời lành         ○
  Tuệ · Quán thọ 15'              ● đã ngồi 15' lúc 06:10 (tự ghi nhận)
─ Giữ giới hôm nay ──────────────
  [Sự sống] [Của người] [Thủy chung] [Lời thật ✓] [Tỉnh thức ✓]   · Sám hối
─ Hạnh của tuần: Chân thật · Nhẫn nại ─
  ◯ Giữ trọn một lời hứa nhỏ hôm nay
  ◯ Dừng ba hơi thở trước khi trả lời lúc bực      ← chọn 1
  ◯ Lắng nghe trọn ý người kia rồi mới nói
─ Tự ghi nhận ───────────────────
  ✓ Thời thiền 15' (Đài Thiền, 06:10)
  ✓ Nghe «Đường xưa mây trắng» (Đường Xưa, chương 33)
  ✓ Hồi hướng cuối buổi nghe
```

## 4. Ngũ giới → việc đời thường → Vân Đạo

Tên gọi tích cực và việc nhỏ do Vân Đạo tự viết. Bản cuối do Codex biên soạn và chủ dự án duyệt (mục 9). Mỗi giới có 4–6 việc, ít nhất 2 việc không tốn tiền và làm được tại nhà.

| Giới | Tên trong app | Việc nhỏ hằng ngày (ví dụ) | Trong Vân Đạo | Ba-la-mật |
|---|---|---|---|---|
| 1. Không sát sinh | **Bảo vệ sự sống** | Đưa con côn trùng ra ngoài thay vì giết · tưới cây, cho thú nuôi ăn uống · đội mũ, lái chậm, nhường đường · một bữa ăn chay hoặc ít thịt (tùy chọn, không ép) · không nói lời làm tổn thương | Thiền tâm từ (mốc 11:00 của thời thiền) · Vườn Tâm Thức | trì giới, tâm từ |
| 2. Không trộm cắp | **Tôn trọng của người** | Trả đồ mượn, trả khoản nợ nhỏ đúng hẹn · đúng giờ, làm đủ giờ · dùng phần mềm, phim, nhạc có bản quyền; ghi nguồn khi chia sẻ · tiết kiệm điện nước của chung · cho đi một món còn tốt mình không dùng | Hồi hướng cuối buổi nghe · Hộ Trì (GĐ5) | trì giới, bố thí, chân thật |
| 3. Không tà dâm | **Thủy chung và tôn trọng** | 20 phút trọn vẹn cho người thương hay gia đình, không điện thoại · giữ lời hứa với người bạn đời · tiết chế nội dung kích dục · không trêu ghẹo, không bình phẩm thân thể người khác | Thời thiền buổi tối · phản tỉnh tuần | trì giới, xuất ly, tâm từ |
| 4. Không nói dối | **Lời thật, lời lành** | Không nói dối kể cả chuyện nhỏ · không chuyển tiếp tin chưa kiểm chứng · thở ba hơi trước khi gửi tin lúc bực · nói một lời cảm ơn hay khen thật lòng · nghe trọn ý rồi mới đáp | Sám hối chân thật · ghi nhận đúng mức trên thanh trượt | chân thật, nhẫn nại, tâm từ |
| 5. Không dùng chất say | **Tỉnh thức khi tiêu thụ** | Hôm nay không rượu bia, thuốc lá · một giờ không mạng xã hội trước khi ngủ · ăn một bữa chậm, không màn hình · ngủ trước 23:00 · một chén trà trong chánh niệm | Trà Đạo Tỉnh Thức (mở ngày 15) · Vân Du (ngồi yên) | trì giới, xuất ly, quyết định |

**Ghi chú an toàn cho giới 5:** người đang phụ thuộc rượu hay chất gây nghiện không nên bỏ đột ngột. App nói nhẹ một dòng: «Nếu bạn đang phụ thuộc, hãy giảm dần cùng nhân viên y tế». Không phán xét, không bắt chạm «đã giữ» mới được đi tiếp.

**Ngày trai (Bát quan trai)** theo âm lịch (`amlich.js`, lựa chọn 2/4/6/10 ngày ở Duyên khởi): thẻ giới đổi thành 8 giới, kèm lời mời ngồi thêm một thời thiền. Đây vẫn là lời mời, không bắt buộc.

## 5. 10 Ba-la-mật → việc đời thường → Vân Đạo

| Ba-la-mật | Việc đời thường (ví dụ, luôn có bản không tốn tiền) | Trong Vân Đạo (tự ghi nhận ✦ hoặc tự xác nhận) |
|---|---|---|
| **Bố thí** (dāna) | Cho 30 phút giúp người khác · lắng nghe trọn vẹn người cần tâm sự · chia sẻ đồ dùng còn tốt · dạy miễn phí một kỹ năng | ✦ Hồi hướng cuối buổi nghe · Hộ Trì "Có thể giúp" (GĐ5) |
| **Trì giới** (sīla) | Thẻ Giữ giới hôm nay; Bát quan trai ngày trai | Thẻ giới · lịch tu |
| **Xuất ly** (nekkhamma) | Một giờ không điện thoại · hôm nay không mua thứ không cần · bỏ bớt một món đồ thừa · một bữa đơn giản | Tịnh khẩu (tắt nhắc nhở) · ✦ thời thiền |
| **Trí tuệ** (paññā) | Ghi một dòng điều mình học được · tự hỏi «chuyện này do nhân nào» · đọc một đoạn Pháp có nguồn | ✦ Nghe Thuyết giảng · ✦ nghe Đường Xưa · phản tỉnh tối |
| **Tinh tấn** (viriya) | Ngồi thiền đúng giờ đã hẹn · làm một việc khó đã hoãn · dậy sớm 15 phút | ✦ Thời thiền trọn · nhịp thiền tuần |
| **Nhẫn nại** (khanti) | Thở ba hơi khi bực · nghe ý trái chiều đến hết · chờ đợi không cáu gắt | Quán thọ (tuần 2) · ghi "đã nhận ra tâm sân" |
| **Chân thật** (sacca) | Giữ trọn một lời hứa nhỏ · nhận lỗi trước khi bị hỏi · ghi nhận đúng mức, không tô vẽ | Sám hối · thanh trượt trung thực |
| **Quyết định** (adhiṭṭhāna) | Phát **Nguyện tuần** theo mẫu nếu–thì: «Khi ___ thì tôi ___» và giữ 7 ngày | Thẻ Nguyện tuần (đầu mỗi tuần) |
| **Tâm từ** (mettā) | Nhắn một lời tử tế · rải tâm từ 5 phút · giúp một người lạ | ✦ Thời thiền (mốc Tâm từ) · khích lệ người sơ nhập (GĐ5) |
| **Xả** (upekkhā) | Không đáp trả một bình luận khó chịu · bình thản trước lời khen chê · làm việc thiện rồi buông, không kể | ✦ Vân Du (ngồi yên) · quán vô thường (tuần 6) |

### 5.1 Ba-la-mật trọng tâm theo 7 tuần

Rút từ bảng ánh xạ §8.2. Bảy tuần phủ đủ 10 Ba-la-mật.

| Tuần | Chủ đề (`WEEKS`) | Hai Ba-la-mật trọng tâm | Nguyện tuần gợi ý (nếu–thì) |
|---|---|---|---|
| 1 | An trú hơi thở | Tinh tấn · Tâm từ | Khi vừa thức dậy, tôi ngồi thở 10 phút trước khi mở điện thoại |
| 2 | Tịnh hóa khẩu nghiệp | Chân thật · Nhẫn nại | Khi muốn gửi tin lúc bực, tôi thở ba hơi rồi mới gửi |
| 3 | Ngũ giới & tri túc | Trì giới · Xuất ly | Khi muốn mua thứ không cần, tôi đợi qua một đêm |
| 4 | Xả tài vô cầu | Bố thí · Chân thật | Khi làm một việc tốt, tôi không kể với ai trong ngày |
| 5 | Khiêm hạ & hộ trì | Tâm từ · Nhẫn nại | Khi gặp người lớn tuổi hay người đến sau, tôi chào trước |
| 6 | Nhẫn trước 8 gió | Nhẫn nại · Xả | Khi bị chê, tôi ghi nhận "đang có tâm sân" rồi mới đáp |
| 7 | Chánh kiến viên mãn | Quyết định · Trí tuệ | Khi tối đến, tôi viết một dòng điều học được trong ngày |

## 6. Tự ghi nhận trong Vân Đạo (nhiệm vụ bị động)

App ghi nhận khi người dùng **thực sự** thực hành, tính theo thời gian đã nghe hay đã ngồi, không theo việc bấm tua.

| Mã | Hoạt động | Điều kiện ghi nhận (đề xuất) | Phước nghiệp sự | Ba-la-mật |
|---|---|---|---|---|
| `thoi_thien` | Thời thiền 15' ở Đài Thiền hay Đại Thiền Đường | Phát ≥ 12/15 phút khi app đang mở; số phút thật được cộng | tu tập | tinh tấn, quyết định |
| `nghe_loi_phat_day` | Nghe một bài Lời Phật dạy | Bài viên mãn và đã phát ≥ 70 % thời lượng tiếng (chữ hoặc giọng máy: ≥ 70 % số ý đọc trọn) | nghe Pháp | trí tuệ |
| `nghe_duong_xua` | Nghe một chương Đường Xưa | Như trên; chương hiện dấu sen nhỏ «đã nghe» | nghe Pháp | trí tuệ, tâm từ |
| `hoi_huong` | Nghe hồi hướng cuối buổi | Phát ≥ 80 % lời hồi hướng (hoặc đọc trọn bằng chữ) | hồi hướng | bố thí, tâm từ |
| `van_du` | Vân Du: ngồi yên nhìn cảnh | ≥ 5 phút ngồi yên | tu tập | xả |
| `tra_dao` | Trà Đạo Tỉnh Thức (từ ngày 15) | Hết một tuần trà | trì giới | xuất ly |

- **Nghe lần lượt:** mỗi bài nghe trọn ghi nhận riêng.
- **Mỗi loại** chỉ làm sáng cánh hoa **một lần mỗi ngày**; số phút và số bài vẫn cộng đủ. Nhờ vậy nghe mười bài không biến thành "cày điểm".
- **Khi tối ghi nhận trục Tuệ,** app hiện «đã ngồi 15' lúc 06:10» làm bằng chứng. Người dùng vẫn tự kéo thanh trượt tam thời, như lý tác ý và tự giác; công thức không đổi.

## 7. Thăm viếng, đồng tu, phụng sự

- **Ngay ở Tầng 0 (đời thực):** thăm hoặc gọi hỏi thăm ông bà, cha mẹ, người neo đơn, bạn ốm · phụ một việc nhà cho người thân · cùng một người bạn ngồi thiền 10 phút. Những việc này ghi vào nhóm C (hạnh tuần 5) hoặc việc thiện thêm (`deed_log`, ≤ 5 mỗi ngày, không cộng Kusala).
- **Khi mở Cổng Vân Môn** (nửa mở ngày 29, mở hẳn ngày 43):
  - Du Vân sang thăm đảo bạn đồng tu.
  - Mời ngồi chung ở Đại Thiền Đường (cần thời gian thực GĐ4).
  - Gửi lời khích lệ người sơ nhập (Hộ Trì GĐ5).
  - Tỉ lệ Thiện 70 % đời thực / 30 % trong app giữ như §9.3: chỉ gợi ý nhẹ, không chặn.

## 8. Tích lũy tu học và "quả ngọt" trực quan

Tên hiển thị đề xuất: **«Tích lũy tu học»** (chủ dự án chọn, xem mục 10). Không có cấp bậc, không con số tổng để so với người khác.

- **Ba trục Kusala** (đã có) → cảnh Vân Đảo đổi theo tuần (`WEEKS[].reward`, đã có).
- **Hoa sen 10 cánh Ba-la-mật** (§9.1): mỗi cánh sáng theo số lần được rèn trong chu kỳ, chuẩn hóa theo cánh mạnh nhất, để thấy cân bằng chứ không phải điểm. Cánh yếu nhất gợi ý Hạnh tuần sau.
- **Lịch tu 49 ô:** ngày có thực hành tô màu nhạt, ngày trống để trống, **không tô đỏ**. Chấm nhỏ cho biết có thiền, có nghe Pháp, có giữ đủ giới.
- **Nhịp thiền:** số phút mỗi tuần.
- **Sổ nghe Pháp:** Lời Phật dạy x/7, Đường Xưa x/33; mỗi chương đã nghe có dấu sen trong danh sách.
- **Vân Đảo phản chiếu** (giữ ngân sách hiệu năng §12.2, dùng instancing):
  - mỗi chương Đường Xưa đã nghe thắp một **đèn mây** dọc lối đi (tối đa 33);
  - mỗi ngày giữ đủ giới nở một **nụ sen** ở Hồ Sen;
  - cánh hoa sen 10 cánh hiện nhỏ trên Bia Tích Lũy và quanh nhân vật khi ngồi thiền.
- **Ngày 49:** tổng kết bằng chính dữ liệu của người dùng: số ngày đã tu, phút thiền, bài đã nghe, hoa sen, câu phản tỉnh. Câu kết: «đã hoàn thành chương trình Sơ nhập».

## 9. Dữ liệu, nội dung và phân làn

### 9.1 Danh mục nhiệm vụ là nội dung (Codex, làn Hermes)

- Thêm `content/nhiem-vu/so-nhap/*.md`, `kind: nhiem_vu` (D1 đã cho phép). Nạp qua cùng công cụ với bài giảng; API hiện có `GET /api/v1/content?kind=nhiem_vu`.
- `meta` của mỗi mục: `nhom` (`gioi` | `hanh` | `tuan` | `nguyen`), `gioi` (1–5), `parami[]`, `punna`, `tuan` (1–7), `truc` (`duc` | `thien` | `tue`), `minutes`, `money` (`false` | `optional`), `at_home`, `outdoors`, `needs_others`, `scope` (`doi_thuc` | `dong_tu`).
- **Số lượng tối thiểu:**
  - Ngũ giới: 5 × 5 việc.
  - 10 Ba-la-mật: 10 × 4 việc.
  - 7 Nguyện tuần.
  - Biến thể 7 tuần × 3 trục × 3 (T3.1).
- Trạng thái `cho_duyet` → chủ dự án duyệt → `da_duyet`.

### 9.2 Bộ chọn và luật (vùng dùng chung, cần giữ tệp)

`packages/shared/src/missions.js` cùng kiểm thử Vitest:
- danh mục mã tự ghi nhận, ngưỡng ghi nhận và gắn mã Ba-la-mật / Phước nghiệp sự;
- hàm chọn 3 việc Hạnh tuần **tất định** theo `(user, chu kỳ, ngày)` và cờ Duyên khởi (`no_money`, `at_home`, số phút);
- hàm thống kê hoa sen, lịch tu, nhịp thiền (dùng chung cho máy và máy chủ, như `stats.js` ở §9.1).

### 9.3 Ghi trên máy (Claude)

IndexedDB `vandao` thêm store `events`:

```
{ id, date, kind, ref, minutes, punna, parami[], scope: 'app'|'doi_thuc', auto, at }
```

Không có chữ tự do. Ghi chú quán chiếu nằm ở store riêng và không bao giờ đồng bộ.

### 9.4 Đồng bộ máy chủ (Codex, làn Antigravity)

- Migration kế tiếp thêm bảng `practice_event`, cùng cột như trên, không có chữ tự do.
- `POST /api/v1/sync` nhận sự kiện qua outbox.
- Máy chủ giới hạn ≤ 40 sự kiện/ngày/người và kiểm `kind` theo danh mục.
- Kusala và khóa ngày vẫn do `kusala_entry` và `schedule.js` quyết định.

### 9.5 Lộ trình đề xuất (v0.17.0 → v0.18.0)

| Đợt | Việc | Làn | Phụ thuộc |
|---|---|---|---|
| A | Tự ghi nhận (thời thiền, nghe Pháp, hồi hướng, Vân Du), store `events`, bảng «Hôm nay» bản đầu, dấu «đã nghe» trong danh sách, lịch tu, nhịp thiền | Claude | Duyệt tài liệu này; giữ tệp `main.js`, `state.js`, `index.template.html`, `packages/shared/src/missions.js` |
| B | Danh mục nhiệm vụ: Ngũ giới, 10 Ba-la-mật, Nguyện tuần, biến thể T3.1 | Codex (Hermes) + chủ dự án duyệt | Duyệt mục 4–5 |
| C | Thẻ Giữ giới, Hạnh tuần, Nguyện tuần, hoa sen 10 cánh, Sám hối gắn *chân thật* | Claude | B có bản `da_duyet` (hoặc bản tạm trong kiểm thử) |
| D | `practice_event`, sync, giới hạn, xuất dữ liệu | Codex (Antigravity) | A |
| E | Vân Đảo phản chiếu: đèn mây, nụ sen; đo ngân sách hiệu năng | Claude | A |
| F | Nhiệm vụ đồng tu trong app (thăm đảo, ngồi chung, khích lệ) | Claude + Codex | GĐ4–GĐ5 |

## 10. Chủ dự án cần quyết

1. **Tên hiển thị phần tích lũy:** «Tích lũy tu học» (đề xuất, tránh cảm giác cấp bậc kiểu "tu vi" trong truyện) hay giữ «Tu vi».
2. **Gánh nặng mỗi ngày:** 3 việc chính + thẻ giới + 1 hạnh nhỏ (đề xuất), hay nhiều hơn.
3. **Tự ghi nhận có tự hoàn thành trục Tuệ không:** đề xuất **không**. Chỉ đính kèm bằng chứng, người dùng vẫn tự ghi nhận theo công thức, để giữ khóa 1 nấc mỗi ngày và tính trung thực.
4. **Ngưỡng nghe trọn:** 70 % thời lượng (đề xuất).
5. **Cho bắt đầu đợt A ngay** và giao đợt B cho Codex song song.

## Nguồn

1. Plum Village — The Five Mindfulness Trainings: https://plumvillage.org/mindfulness/the-5-mindfulness-trainings/
2. Buddhistdoor — Thích Nhất Hạnh's Five Mindfulness Trainings: https://www.buddhistdoor.net/?p=48942 · Thai Plum Village — Engaged Ethics: https://www.thaiplumvillage.org/engaged-ethics
3. Pāramitā (Buddhavaṃsa, Khuddaka Nikāya): https://EN.wikipedia.com/wiki/Paramita · palikanon.com — pāramī: https://palikanon.com/english/wtb/n_r/paramii.htm
4. Gil Fronsdal — An Introduction to the Ten Pāramīs: https://sati.org/an-introduction-to-the-ten-paramis/
5. Encyclopedia of Buddhism — Merit (10 bases): https://www.encyclopediaofbuddhism.org/wiki/Merit
6. Gollwitzer & Sheeran (2006), Implementation intentions and goal achievement: https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f
7. Tóm lược tổng hợp Sheeran, Listrom & Gollwitzer (2024): https://www.thebehavioralscientist.com/glossary/implementation-intentions
8. UCL — How long does it take to form a habit? (Lally và cộng sự): https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit · tóm lược: https://www.dailygood.org/story/715/how-long-does-it-actually-take-to-form-a-new-habit-/
9. Deci, Koestner & Ryan (1999), Psychological Bulletin 125(6): https://pubmed.ncbi.nlm.nih.gov/10589297/ · số liệu: https://leeds-faculty.colorado.edu/dahe7472/deci%201999.pdf
10. Lehtivuori (2023), When do extrinsic rewards undermine intrinsic motivation? A meta-analysis: https://utupub.fi/handle/10024/173853
