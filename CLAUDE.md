# Vân Đạo — chỉ dẫn cho Claude

@AGENTS.md

Đọc `docs/COORDINATION.md` trước khi sửa. Codex nhận phần Antigravity + Hermes từ 14/11/2026; Claude giữ phần trải nghiệm và realtime. Bàn giao qua Issue/PR, để Codex tổng hợp tệp phối hợp; không sửa tệp đang được tác vụ khác giữ.

## Phần riêng cho Claude

- **Nội dung — quyết định chủ dự án 14/11/2026 (#55):** bỏ yêu cầu Hội đồng cố vấn Pháp học phê duyệt trước khi hiển thị/phát. Hội đồng là tư vấn tùy chọn. Theo `AGENTS.md` mục 1.6 và ADR 0003; quy định này thay câu chữ cũ trong #39/#45 và phần duyệt đang đề xuất ở ADR 0002.
  - Giữ tab Thuyết giảng. Không dùng câu "Chưa có bài giảng nào được Hội đồng cố vấn Pháp học duyệt." hoặc khẳng định mọi bài đã được Hội đồng duyệt. Trạng thái trống: "Chưa có bài chia sẻ. Nội dung đang được cập nhật."; lỗi tải có nút thử lại riêng.
  - `toSermon` và kiểm thử không đòi `reviewed_at`/`reviewed_by`; vẫn kiểm tên, nguồn, nội dung và trạng thái công khai do API cung cấp. `da_duyet` là tên kỹ thuật của trạng thái phát hành, không chứng nhận Hội đồng. Không mở công khai nháp/ẩn/ngừng để chữa danh sách trống.
  - Nội dung tham khảo ghi nguồn và người biên soạn khi có; AI không tự nhận là thầy hay xác nhận chứng đắc. Quy trình biên tập/PR thông thường đủ để phát hành; không thêm một vòng duyệt chuyên môn bắt buộc thay Hội đồng.
- **Làn của Claude:** 3D, âm thanh, trải nghiệm, client và máy chủ thời gian thực (xem bảng làn trong `AGENTS.md`). Nhánh `claude/<issue>-<mô-tả>`. Sửa vùng dùng chung chỉ khi Issue ghi rõ và PR có nhãn `shared-ok`.
- **Kiểm cảnh 3D trước khi mở PR:**
  - **Mốc main hiện hành 19/11/2026 (`c7da7d0`, sau #116).** Ở mức 2, Vân Đảo đạt 87 geometry / 24 texture / 57 shader và 117 lệnh vẽ. Đại Thiền Đường đạt 71 / 20 / 57 và 53 lệnh vẽ. Xem [CI main](https://github.com/tnfsmith/Buddha/actions/runs/44458559530) và [kết quả nghiệm thu #116](https://github.com/tnfsmith/Buddha/pull/116#issuecomment-6998118374). Mốc 13/11 bên dưới dùng để đối chiếu lịch sử.
  - `npm run build && npm run e2e:smoke` — số hình khối/texture/shader in ra phải ổn định (mốc 13/11/2026 sau T1.2: Vân Đảo 126/30/47, Đại Thiền Đường 106/25/42; trước khi gộp hình là 448/32/52 và 269/26/44).
  - `tests/e2e/perf.spec.js` (chạy cùng `e2e:smoke`) in bảng lệnh vẽ/tam giác của 5 cảnh chính và đánh đỏ khi vượt ngân sách §12.2 (điện thoại mức 0: ≤ 120 / ≤ 400.000; máy tính mức 2: ≤ 250 / ≤ 1 triệu). Đo nhanh một cảnh: `cd apps/web && node shot.mjs "m_eval|q=0&snap=1|window.__app.world.perf()"`.
  - Ảnh chụp và âm thanh chi tiết: `cd apps/web && node shot.mjs live` hoặc `node shot.mjs "ten_anh|q=2|5000"` (ảnh ở `apps/web/dist/`).
  - Thay đổi cảnh phải giữ: Tôn tượng cao hơn mọi tầng, thấy trọn tượng ở góc Vân Đảo trên máy tính và điện thoại, nhãn tầng xếp bậc thang.
  - Vân Du (`world.setVandu`, xem thử bằng `#vandu=0…6`): không điểm nhìn nào cao hơn mắt Tôn tượng; chặng cuối thấy trọn đầu tượng. Chặng tính theo số phút ngồi yên và chỉ gọi tên cảnh; không gọi là tầng thiền, không dùng tên quả vị (`AGENTS.md` mục 1.6).
- **Bố cục lớp phủ trên bảng (#139):**
  - Phần tử nằm trên `#panel` đặt theo mép trên **đo được** của bảng: biến `--subb` do `fitSub()` trong `main.js` cập nhật. Hiện có phụ đề `#sub`; lớp phủ mới sau này cũng vậy. Không giả định `vh` hay `bottom` cố định, vì thanh địa chỉ của Chrome điện thoại làm `vh` lớn hơn vùng nhìn thấy.
  - Thêm hoặc sửa luật `bottom` của `#panel` theo lớp `barmin`, `pmin`, `stab`, `sermon` thì kiểm lại ở thẻ Thuyết giảng. Thẻ này ẩn thanh nhạc nên không chừa chỗ cho nút nhạc.
  - Lớp phủ chỉ có chữ thì đặt `pointer-events:none`. Nút «Thu gọn» (`.pm`) có cả trên máy tính và điện thoại.
  - `tests/e2e/sermon-layout.spec.js` (412×860, 360×700 có `barmin`, 1280×800) chạy trong CI mọi PR. Không xóa hay nới ca này; PR đổi bố cục bảng phải để ca này đạt.
- **Hiệu năng:** theo `PROJECT_ROADMAP.md` §12 — tối ưu WebGL trước (GĐ1), WebGPURenderer + TSL sau (GĐ7, sau cờ `?r=webgpu`).
- Lộ trình 3 bước cũ của tệp này đã thay bằng `PROJECT_ROADMAP.md` bản 3 (GĐ0–GĐ10).
