# Vân Đạo — tóm tắt dự án và việc còn lại (cập nhật 2026-11-12, bản 9)

"Vân Đạo" là tên tạm. Nguồn gốc thiết kế: tệp "chuong trinh thien-1.pdf" (47 trang, toàn bộ cuộc trao đổi) trong thư mục Buddha. Tệp này thay bản tóm tắt cũ, vốn lệch tài liệu ở bốn điểm (xem cuối).

## Sáu khối của dự án

| Khối | Nội dung đã chốt trong tài liệu | Trạng thái |
| --- | --- | --- |
| 1. Chiến lược | Doanh nghiệp xã hội hai động cơ, không bán Pháp, hội đồng cố vấn Pháp học | Định hướng |
| 2. Kinh Đài AI | GraphRAG 3 tầng Chánh tạng – Chú giải – Phụ chú giải, 3 chốt chặn, máy chủ MCP | Thiết kế; chưa có mã chạy |
| 3. Cảnh giới 3D | Giai đoạn 0 Sơ nhập + 4 tầng, Vân Đảo 6 phân khu, Đại Thiền Đường | **Đã có bản chạy một người** |
| 4. Chuỗi 49 ngày | 7 tuần × 3 trục Đức – Thiện – Tuệ, công thức Kusala, khóa 1 nấc/ngày | **Đã có trong bản chạy** (lưu trên máy) |
| 5. Âm thanh | Thời thiền 15 phút 7 mốc, 3 chế độ sinh học, dao động liên tục | **Đã có trong bản chạy**; bản 45 phút và file master chưa xuất |
| 6. Hạ tầng | 7 container LXC trên Proxmox, PostgreSQL + Neo4j + Qdrant, khung 16 byte, n8n | Thiết kế + schema; chưa triển khai |

## Đã giao: bản web chạy được

- `van-dao.html` trong thư mục Buddha: một tệp, mở bằng trình duyệt là chạy, không cần mạng.
- `van-dao-src/`: mã nguồn (Three.js + Web Audio, dựng bằng esbuild) và kịch bản kiểm thử.
- Có: Vân Đảo 6 phân khu, nhân vật thiền hành, Đại Thiền Đường với khoảng 550 Vân Tọa mô phỏng, Tôn tượng và hào quang, thời thiền 15 phút đồng bộ cảnh và radar, 3 chế độ sinh học chọn tay, bảng 49 ngày với công thức Kusala, xem trước Giai đoạn 0 và 4 tầng.
- Bản 3 (2026-11-12) làm lại cảnh và nhân vật: Tịnh Thất mái cong, cây lá thật, cỏ, hồ sen, thác; 40 đảo xếp trên 4 tầng cao dần về phía Tôn tượng, mỗi đảo có nhóm người tu ngồi quây quần; Tầng 4 là các Vân Tọa sáng không còn đảo; người tu là hình người mặc áo tràng cư sĩ.
- Nhân vật: đặt Tịnh danh theo 4 quy tắc (2–3 chữ, tối đa 16 ký tự; chỉ chữ cái tiếng Việt; có ít nhất một chữ mang nghĩa tu tập; không tự xưng quả vị hay giáo phẩm), có gợi ý tên kèm nghĩa; 5 phong cách dựng sẵn; chỉnh màu da, tóc, vóc dáng, độ tuổi, nét mặt, màu áo, viền, phụ kiện.
- Tương tác: bấm lên mặt đảo để đi tới đó; với bạn đồng tu có chắp tay chào, tùy hỷ công đức, du vân sang thăm, mời cùng tọa thiền.
- Bản 4 (2026-11-12) thêm Vân Nhạc: 7 khúc nhạc nền sinh trực tiếp, cùng hệ âm với thời thiền (Vân Thủy, Sớm Mai, Trà Chiều, Hoàng Hôn, Đêm Tịnh, Phong Linh, Từ Tâm). Chọn khúc theo buổi trong ngày, theo tuần của chuỗi 49 ngày, theo tâm trạng hoặc chọn tay; phát liên tục một khúc, lần lượt hoặc ngẫu nhiên (đổi khúc sau 3/5/10 phút, hòa tan 5 giây). Nhạc nền tự lắng khi vào thời thiền 15 phút và dâng lại sau đó. Đo ngoại tuyến 90 giây mỗi khúc: 0 bước nhảy, đỉnh 0,36–0,45 ở âm lượng mặc định. Chưa ai nghe bằng tai.
- Bản 4 mở rộng cõi: thêm khoảng 300 đảo xa và 15 bảo tháp ở mọi hướng và độ cao, 4 đàn hạc, góc nhìn "Toàn cõi" trong tab Hành trình. Mây làm lại: họa tiết mịn hơn, mép tan dần, biển mây trôi ngang liên tục, thêm 230 cụm mây phiêu giữa trời.
- Bản 5 (2026-11-12): nhúng phông Be Vietnam Pro và Noto Serif, chuẩn hóa NFC (hết lỗi rời dấu); bảng rộng hơn, thanh phát thu gọn ngoài Đại Thiền Đường, radar âm thanh ẩn mặc định có nút bật.
- Các tầng (chỉnh ở bản 8 và 9): Tôn tượng phóng 1,5 lần và ngự trên đài mây cao 75, nên luôn cao nhất (vai ≈ 305, mắt ≈ 370, đỉnh đầu ≈ 460). Tầng 1 cao 62–84, Tầng 2 cao 140–165, Tầng 3 cao 225–252; Tầng 4 cao 355–372, ngang tầm mắt và tai Ngài, chia ba cụm (hai bên vai và trước mặt), các vị ở Tầng 4 dựng lớn gấp 2,2 lần. Góc nhìn Vân Đảo thấy trọn Tôn tượng; trên điện thoại, bảng Vân Đảo thu gọn mặc định.
- Bản 5, Vân Đảo: chọn một khu thì máy quay bám theo nhân vật suốt đường đi; thềm đá dẫn vào trong Tịnh Thất; Thiền Đài và Trà Đạo là đài đá hai bậc (Trà Đạo có bàn đá, bốn đôn đá); Vườn Tâm Thức có cổng trăng, vòng đá quanh cây Bồ-đề, gương tâm, đèn đá, thêm 5 cây; hồ rộng hơn, có gợn nước và ánh lấp lánh; lưu vị trí gần nhất của nhân vật.
- Bản 5, Thuyết giảng (trong Đại Thiền Đường): 7 bài tóm lược ý kinh viết lời mới, không phải bản dịch (SN 56.11, SN 22.59, Sn 1.8, Sn 2.4, AN 3.65, MN 10, Dhp 1–5), kèm câu Pāli. Tôn tượng mở mắt, cử động miệng, giơ ấn; hội chúng chắp tay, đảnh lễ lúc mở đầu và ba lần khi kết; sóng hào quang và hồi hướng cuối bài. **Nội dung cần hội đồng cố vấn Pháp học duyệt.**
- Bài nhạc YouTube Music anh gửi: không xác định được tác giả và giấy phép nên không đưa tệp vào ứng dụng; chỉ thêm đường dẫn mở ngoài trong Vân Nhạc.
- Bản 6 (2026-11-12): chỗ tọa thiền trong Tịnh Thất (bục gỗ, chiếu, bồ đoàn), ngồi quay được bốn hướng, mặc định nhìn ra cửa chính. Tiến hóa theo 49 ngày: Đài Thiền đi từ đá ngồi thô (tuần 1) → một bậc đá trơn (tuần 2–3) → đài hai bậc có bồ đoàn và hoa (tuần 4–5) → hoa văn khảm và đèn đá (tuần 6) → hoa văn sen phát sáng (tuần 7); Trà Đạo tương tự từ ngày 15; đá lát lối đi thưa và nhỏ rồi dày và lớn dần; thềm Tịnh Thất hẹp lại vừa hai người, từ đá tảng thô sang bậc đá đẽo rồi có trụ.
- Bản 6: bỏ vòng suối cắt ngang đảo; suối mới chảy từ cuối Hồ Sen ra mép đảo rồi đổ thác xuống biển mây, lượng nước tăng theo tiến trình. Sáu chim nhỏ ngẫu nhiên bay tới đậu rồi bay đi, có tiếng hót. Nhấp đúp để phóng tới một điểm, nhấp đúp lần nữa để trở lại. Sửa lỗi không khôi phục trạng thái ngồi khi mở lại trang.
- Tải cảnh hiện tại: khoảng 1,3 triệu tam giác và 500 lần vẽ mỗi khung hình.
- Đã đo ngoại tuyến 8 đoạn phủ mọi mốc chuyển: 0 gián đoạn (tiếng tạch), đỉnh khoảng −3,3 dBFS.
- Mới thử trên Chrome không giao diện dựng hình bằng phần mềm; chưa đo tốc độ khung hình trên máy và điện thoại thật.
- Chưa có: mô hình 3D do họa sĩ làm (cảnh hiện dựng bằng mã), nhiều người thật, Kinh Đài AI, cảm biến sinh học, đồng bộ giữa thiết bị, WebGPU.

## Việc còn lại (anh Le yêu cầu ghi nhớ, làm khi bản web ổn định)

1. **Mã nguồn hạ tầng Proxmox** để nhiều người cùng tham gia: docker-compose cho các dịch vụ, schema PostgreSQL đã rà lỗi, API và Kusala engine, máy chủ thời gian thực (Colyseus) cho Vân Đảo và Đại Thiền Đường, khung máy chủ MCP, hướng dẫn triển khai.
2. **File âm thanh master**: xuất bản 15 và 45 phút, 3 chế độ, từ script đã chốt; đo tiếng tạch trước khi giao.
3. **Bản thiết kế hợp nhất**: viết lại doc Vân Đạo theo đúng tài liệu 47 trang, kèm kế hoạch thực hiện từng khối. Doc hiện tại (https://claude.ai/artifact/4an1neCtamQ2SsDJJwQRWN) vẫn là bản cũ.

## Quyết định thiết kế đang dùng

- Hành trình: Giai đoạn 0 Sơ nhập Tịnh Cảnh (49 ngày) → Tầng 1 Nhập Lưu Tịnh Cảnh → Tầng 2 Nhất Lai Thanh Lương → Tầng 3 Bất Lai Tịnh Quang → Tầng 4 Vô Học Vô Biên. Tên tầng là biểu trưng, không chứng nhận quả vị.
- Vân Đảo 6 phân khu: Tịnh Thất (có Kinh Đài), Đài Thiền, Vườn Tâm Thức (Bồ-đề và Hồ Sen), Trà Đạo Tỉnh Thức (mở ngày 15), Cổng Vân Môn (mở nửa ngày 29, mở hẳn ngày 43; hai chế độ Độc cư / Nghênh khách), Bia Tích Lũy.
- Tích lũy 3 trụ: Đức (Sīla), Thiện (Dāna, Veyyāvacca), Tuệ (Bhāvanā). E = 10 × (trước + trong + sau)/3 × (1,5 nếu như lý tác ý) × (1,25 nếu tự giác); hệ số 0,5–1,2 do người tu tự khai.
- Thời thiền 15 phút: 00:00 Quy tụ · 02:00 Niệm hơi thở mây · 05:00 Lắng dịu phóng dật · 07:00 Cận định và Thánh im lặng · 09:30 Tưởng ánh sáng · 11:00 Tâm từ toàn cõi · 13:30 Xuất thiền và Hồi hướng.
- Âm thanh: mọi bộ dao động nền chạy liên tục, chỉ điều khiển bằng AudioParam; chuông dùng đường bao về đúng 0; nhịp thở 4 giây hít – 6 giây thở chạy trên luồng âm thanh.

## Ba điểm trong tài liệu cần hạ kỳ vọng

- "Chống ảo giác tuyệt đối 100%" không bảo đảm được: chốt NLI cũng là mô hình. Mục tiêu khả thi: mọi câu hiển thị kèm trích dẫn khớp nguyên văn, và đo tỷ lệ sai trên bộ câu hỏi mẫu.
- Chú giải và Phụ chú giải phần lớn chưa có bản Việt; Kinh Đài bản đầu chỉ nên có Kinh tạng. Cần kiểm tra giấy phép dữ liệu (CST4, DPD, các bản dịch) trước khi nạp.
- Hệ số tác ý là tự khai; các con số "sóng não" chưa có bằng chứng vững (tổng quan PLoS One 2023: 5 ủng hộ, 8 ngược, 1 lẫn lộn trên 14 nghiên cứu). Trình bày như gợi ý quán chiếu và âm nền.

## Bốn điểm bản tóm tắt cũ đã ghi sai

Sơ nhập là Giai đoạn 0 chứ không phải Tầng 1; chuỗi nhiệm vụ 49 ngày chứ không phải 30; tích lũy 3 trụ chứ không phải 2 sổ; Vân Đảo 6 phân khu và có Kinh Đài AI.
