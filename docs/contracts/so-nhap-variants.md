# Hợp đồng biến thể Sơ nhập 49 ngày · #103 / #104

Bản đề nghị Codex–Claude duyệt trước khi triển khai T3.1/T3.2 theo [roadmap §8.2–8.3](../../PROJECT_ROADMAP.md). Codex/Hermes biên soạn danh mục, Codex/Antigravity nạp và phục vụ danh mục, Claude làm bộ chọn dùng chung và giao diện. Luồng `today/swap` thuộc #105. Gói này là hợp đồng, chưa thêm nội dung hay mở API.

## Tệp và phạm vi danh mục

- Một biến thể là một Markdown trong `content/program/so-nhap-49/`, với `id` slug riêng bắt đầu `sn49-`, `version` nguyên dương, `kind: chuong_trinh`, `tier: 0`, `lang: vi`, `title`, `source_ref`, `status` và `meta` như bên dưới. Thân là một câu hành động do Vân Đạo biên soạn, tối đa 90 ký tự NFC. Mỗi mục có nguồn rõ ràng.
- Soạn với `cho_duyet`. Chủ dự án chọn mục phát hành bằng `da_duyet`. Bộ nạp ghi bản `ngung` để rút như #46. Tăng `version` khi thay nội dung hoặc dữ liệu ảnh hưởng lựa chọn; giữ `id` nếu vẫn là cùng một việc.
- Danh mục đọc qua `GET /api/v1/content?kind=chuong_trinh&tier=0` sau khi bộ nạp hỗ trợ nhận tệp này. Dùng `meta.program` và `meta.schema` để nhận bản phù hợp. `meta` theo định dạng JSON hiện hành của API. Với mỗi id lấy phiên bản cao nhất trong các hàng công khai. `kind=nhiem_vu`, bốn nhóm Giới/Hạnh/Nguyện/Trai và `dayPlan` hiện hành tiếp tục phục vụ 73 mục riêng.

| `meta` | Giá trị |
|---|---|
| `program`, `schema` | `so-nhap-49`, số nguyên `1` |
| `week`, `pillar` | Tuần 1–7 và một trong `duc`, `thien`, `tue` |
| `level`, `minutes` | `nhe`, `vua`, `sau`; phút nguyên 1–120 |
| `money` | Boolean `false` hoặc chuỗi `optional` |
| `at_home`, `outdoors`, `needs_others` | Boolean. `at_home` nghĩa là có thể hoàn thành ở nhà, `outdoors` nghĩa là cần ra ngoài |
| `punna`, `parami` | Một mã Phước nghiệp sự và mảng không rỗng các mã Ba-la-mật khác nhau theo `packages/shared/src/parami.js` |
| `scope` | `doi_thuc` hoặc `dong_tu`. Không phụ thuộc vào tính năng đồng tu chưa phát hành |

Mỗi ô tuần × trục có 3–6 lựa chọn khác nhau, tối thiểu 63 mục. Trong mỗi ô cần một phương án nhẹ, tối đa 5 phút, miễn phí và thực hiện một mình tại nhà. Đối chiếu chủ đề và mã với roadmap §8.2. Việc tùy chọn chi tiền vẫn phải có lựa chọn miễn phí riêng; câu gợi ý không nêu số tiền, không hướng người dùng mua sinh vật để phóng sinh và không gắn lời chứng đắc.

## Bộ chọn chung

1. Worker và client dùng chung đầu vào `{ userId, cycle, day, pillar }`, hồ sơ đã lưu và cùng ảnh chụp danh mục. `day` là ngày 1–49 của hành trình, `week = Math.floor((day - 1) / 7) + 1`. Worker lấy định danh, chu kỳ và ngày từ phiên/hành trình. Khi offline, client dùng dữ liệu đã lưu của đúng tài khoản và chu kỳ.
2. Lấy đúng ô tuần/trục. Giữ mục trong giới hạn phút và mức của hồ sơ, theo thứ tự mức `nhe < vua < sau`. `no_money=true` yêu cầu `money=false`, `at_home=true` yêu cầu `at_home=true`. Hoàn cảnh riêng tư không tham gia đầu vào của máy chủ. Khi chưa có hồ sơ hoặc không còn mục hợp lệ, app giữ gợi ý tuần đang có và cho phép bỏ qua.
3. Tái dùng `pickN` của `missions.js` với seed `JSON.stringify([userId, cycle, day, pillar])`. Xếp theo `hash32(seed + "|" + id)` tăng dần rồi theo id ASCII khi hash trùng. Mục đầu là gợi ý. Kết quả không phụ thuộc thứ tự tệp hay thứ tự hàng trả về.
4. Client giữ ảnh chụp danh mục dưới dạng tập `id@version` sắp theo id và hồ sơ theo rev. Hai thiết bị chỉ có cùng kết quả tất định khi khớp cả danh mục, hồ sơ, chu kỳ và ngày. Khi online, hiện lựa chọn đã lưu từ Worker, không lặng lẽ thay việc đã ghi nhận khi danh mục cập nhật.
5. Đổi tối đa một lần mỗi trục mỗi ngày địa phương, theo [roadmap §8.3](../../PROJECT_ROADMAP.md). Chọn mục hợp lệ kế tiếp khác mục hiện tại. Khi hết lựa chọn thì giữ gợi ý hiện tại. Gói `today/swap` chốt mã lỗi và cách lưu chống trùng trước khi tích hợp. Đổi gợi ý không tự hoàn tất trục hay cộng Kusala.

## Nghiệm thu và bàn giao

- Bộ nạp kiểm đủ 21 ô và ít nhất ba biến thể mỗi ô trong danh mục biên tập, kiểu/meta, nguồn, id/version, cờ hoàn cảnh và đường lui miễn phí. PR phát hành kiểm độ phủ của tập `da_duyet` trước khi bật bộ chọn. `cho_duyet` và bản đã rút không xuất hiện trong danh mục công khai.
- Kiểm bộ chọn với cùng dữ liệu đảo thứ tự, biên ngày 7/8 và 49, bộ lọc tại nhà/miễn phí/mức/phút, một ô chỉ có một lựa chọn hợp lệ, không có hồ sơ, và khác phiên bản danh mục. Cho các ca cùng dữ liệu chạy trên cả Worker và client. Kiểm danh mục nhiệm vụ cũ giữ 73 mục.
- Sau merge hợp đồng: Codex/Hermes giữ nội dung, Codex/Antigravity giữ bộ nạp và API, Claude giữ tệp bộ chọn/UI theo claim #104. Claude có thể làm bộ chọn với fixture, Codex có thể soạn các mục song song. Chủ dự án duyệt nội dung trước khi nạp tập phát hành lên staging.

## Bộ chọn đã triển khai: `@vandao/shared/variant.js` (#104)

Worker #105 và client import cùng một mô-đun. Mô-đun không đọc giờ, mạng hay bộ nhớ và không ném lỗi với dữ liệu hỏng.

| Hàm | Đầu vào → đầu ra |
|---|---|
| `variantCatalog(rows)` | Các hàng `GET /api/v1/content?kind=chuong_trinh&tier=0`, `meta` là chuỗi hoặc đối tượng. Trả `{ cells: { '1-duc': [...] … 21 ô }, snap, n }`. Mỗi id lấy phiên bản cao nhất; hàng sai hợp đồng bị bỏ. `snap` = `id@version` sắp theo id, nối bằng dấu phẩy |
| `rankVariants(cat, profile, { userId, cycle, day, pillar })` | Danh sách hợp lệ theo thứ tự tất định; mục đầu là gợi ý. Rỗng khi chưa có hồ sơ, đầu vào sai hoặc không còn mục hợp |
| `pickVariant(…)` | Mục đầu của `rankVariants`, hoặc `null` (app giữ gợi ý tuần và cho bỏ qua) |
| `swapVariant(cat, profile, input, currentId)` | `{ variant, same }`: mục kế tiếp khác `currentId`, vòng lại đầu. Chỉ một lựa chọn thì `same: true`. `currentId` không còn trong danh sách thì trả mục đầu. Không kiểm giới hạn một lần/ngày, không lưu |
| `fitsProfile(v, profile)`, `variantCoverage(cat)`, `variantSeed(input)`, `weekOfDay(day)`, `snapHash(cat)` | Bộ lọc hồ sơ #111; độ phủ 21 ô (≥ 3, có phương án nhẹ); seed; tuần 1–7; dấu ngắn của `snap` |

- `userId` là `user.id` của phiên. `cycle` là số nguyên ≥ 1 của `journey`. `day` là ngày 1–49. `pillar` thuộc `duc | thien | tue`.
- Worker nên lưu `{ id, version }` của mục đã chọn kèm `snapHash` lúc chọn. Danh mục cập nhật thì không thay lặng lẽ việc đã ghi (mục 4 ở trên).
- Nghiệm thu chéo:
  - `packages/shared/test/variant.test.js` chạy trên đúng các hàng mà `readContentRows` của bộ nạp tạo ra từ 63 tệp `da_duyet`. Đạt 21 ô và hồ sơ chặt nhất (nhẹ, 5 phút, miễn phí, tại nhà) vẫn có gợi ý cho mọi ngày, mọi trục.
  - Ca Worker #105 so `rankVariants` trên hàng D1 trả về với kết quả trên `readContentRows`; hai kết quả phải trùng.
