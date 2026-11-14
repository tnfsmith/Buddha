# Vân Đạo — phối hợp Codex và Claude

Ngày cập nhật: 14/11/2026. Người tổng hợp duy nhất: **Codex**. Quyết định chủ dự án: Codex nhận việc Antigravity + Hermes; Claude tiếp tục độc lập phần của Claude.

**Quyết định nội dung mới của chủ dự án (#55):** bỏ điều kiện Hội đồng bắt buộc. Nội dung tham khảo có nguồn, phát hành theo quy trình biên tập/PR; Hội đồng/chuyên gia chỉ tư vấn tùy chọn. ADR 0003 thay các yêu cầu cũ còn xuất hiện trong bằng chứng lịch sử dưới đây. Quyết định đã ghi không có nghĩa mã UI đang chạy đã thay đổi.

Đọc tệp này khi bắt đầu phiên; sau đó kiểm Issue/PR và `origin/main` hiện tại. Tệp là bản bàn giao có thời điểm, không thay bảng việc GitHub. Claude gửi cập nhật trong Issue/PR; Codex tổng hợp để tránh hai agent cùng sửa tệp này.

## 1. Mốc đã xác minh

- Repo: `tnfsmith/Buddha`. Baseline của #55 là `main` `c8edea4` (PR #30, #31, #32, #41, #44, #36–38, #42, #45 đã merge). Không dùng kết quả trên `20d73dc` hoặc `9b7264e` để kết luận cây mới đã đạt.
- Production đã phát hành `v0.14.0`; [deploy 43536527634](https://github.com/tnfsmith/Buddha/actions/runs/43536527634) thành công. 100 kiểm thử logic đạt; Playwright 12 đạt, 2 bỏ qua. Hai ca Worker thật trong `account.spec.js` chưa chạy ở CI này.
- Phần lớn mã GĐ0–2 đã có; chưa đánh dấu mọi tiêu chí nghiệm thu đã đạt. GĐ3–9 còn nhiều việc và điều kiện của chủ dự án.
- [CI main `c8edea4`](https://github.com/tnfsmith/Buddha/actions/runs/43596092074) đạt 107 unit/API, 21 ops, 26 smoke và 2 account thật; [staging](https://github.com/tnfsmith/Buddha/actions/runs/43597451413) migration/deploy/25 smoke đạt. Đây là mã trước quyết định bỏ Hội đồng; không dùng để nói UI của #55 đã triển khai.
- [PR #24](https://github.com/tnfsmith/Buddha/pull/24) + [#25](https://github.com/tnfsmith/Buddha/pull/25) đã merge: mạng/API và UI giữ/khôi phục hành trình. Một số phần làn Antigravity do Claude làm thay trước quyết định phân công mới; xem bàn giao [#11](https://github.com/tnfsmith/Buddha/issues/11) và [#12](https://github.com/tnfsmith/Buddha/issues/12).

## 2. Phân công hiện hành

| Phần | Người thực hiện | Phạm vi |
|---|---|---|
| Antigravity [AG] | Codex | `workers/api/`, migration D1 mới, `apps/web/src/net/`, `.github/`, `scripts/`, `apps/android/` |
| Hermes [H] | Codex | `ops/`, `docs/reports/`, nội dung có nguồn trong `content/`, trạng thái phát hành theo Issue/PR; giám sát, kiểm tải staging, báo cáo |
| Claude [C] | Claude | 3D/âm thanh/trải nghiệm; `workers/realtime/`, client realtime; UI và phần dùng chung khi Issue giao; `tests/e2e/` |
| Chọn phát hành nội dung, pháp nhân, tài khoản dịch vụ, ký/phát hành | Chủ dự án; nhóm biên tập hỗ trợ, cố vấn tùy chọn | Không mạo nhận dấu duyệt Hội đồng; agent không tự merge/tag production |
| Vùng dùng chung | Một người được Issue giao | `packages/shared/`, main/state/data/boot, UI, build/deps/lockfile, tài liệu chung; cần PR `shared-ok` |

Tên làn CI không đổi. Codex dùng `ag/<issue>-...` hoặc `hermes/<issue>-...`; tác vụ điều phối do chủ dự án giao dùng `owner/<issue>-...`. Không dùng quyền của một làn để sửa chéo PR khác.

## 3. Việc đang giữ và ranh giới

| Người | Issue | Phạm vi nhận | Trạng thái tại lần cập nhật |
|---|---|---|---|
| Codex | [#55](https://github.com/tnfsmith/Buddha/issues/55) | `AGENTS.md`, `CLAUDE.md`, `PROJECT_ROADMAP.md`, bản tóm tắt thiết kế, tệp này, ADR 0003 | Quyết định nội dung mới; Codex là người ghi duy nhất. #33/PR #36 đã merge; lần này không sửa ADR 0002/dàn bài của Claude |
| Codex [AG] | [#34](https://github.com/tnfsmith/Buddha/issues/34), [PR #37](https://github.com/tnfsmith/Buddha/pull/37) | `ci.yml`, `deploy.yml`, runner trong `scripts/` | Đã merge ngày 14/11; main mới có job account thật và cổng staging theo SHA đã kiểm |
| Codex [H] | [#13](https://github.com/tnfsmith/Buddha/issues/13), [PR #38](https://github.com/tnfsmith/Buddha/pull/38) | `ops/hermes/` | Đã merge; T2.4 còn thiếu nguồn và nghiệm thu chạy thật |
| Codex, ngoại lệ chủ dự án giao | [#43](https://github.com/tnfsmith/Buddha/issues/43), [PR #44](https://github.com/tnfsmith/Buddha/pull/44) | Một assertion ở `tests/e2e/vandu.spec.js` | Đã merge; chỉ sửa test đồng hồ, không đổi app/timeout. Claude giữ các phần test còn lại |
| Claude | [#26](https://github.com/tnfsmith/Buddha/issues/26), [PR #30](https://github.com/tnfsmith/Buddha/pull/30) | `ui/account.js`, `tests/e2e/account.spec.js` | Đã merge 15:03 ngày 14/11; test account dùng câu trạng thái mới của Claude |
| Claude | [#27](https://github.com/tnfsmith/Buddha/issues/27), [PR #31](https://github.com/tnfsmith/Buddha/pull/31) | `main.js`, `world.js`, template, kiểm di chuyển | Đã merge 15:04 ngày 14/11 |
| Claude | [#28](https://github.com/tnfsmith/Buddha/issues/28), [PR #32](https://github.com/tnfsmith/Buddha/pull/32) | `main.js`, `state.js`, `music.js`, template, kiểm âm nhạc | Đã merge 15:22 ngày 14/11 |
| Claude | [#29](https://github.com/tnfsmith/Buddha/issues/29), [PR #41](https://github.com/tnfsmith/Buddha/pull/41) | Vân Du; `main.js`, `state.js`, `world.js`, template, test | Đã merge 15:51 ngày 14/11; Codex nhận ghi chú kiểm cảnh vào `CLAUDE.md` theo bàn giao #33 |
| Claude | [#40](https://github.com/tnfsmith/Buddha/issues/40), [PR #42](https://github.com/tnfsmith/Buddha/pull/42) | `tests/e2e/serve.mjs` | Đã merge; Codex đã kiểm server khởi động/đóng được trên Windows |
| Claude | [#39](https://github.com/tnfsmith/Buddha/issues/39), [PR #45](https://github.com/tnfsmith/Buddha/pull/45) | `main.js`, `sermon.js`, template, test | Đã merge vào `c8edea4` theo chính sách cũ; cần sửa cổng/câu chữ theo quyết định mới #55 trong phần Claude giữ |
| Claude | [#47](https://github.com/tnfsmith/Buddha/issues/47), [PR #52](https://github.com/tnfsmith/Buddha/pull/52) | Chỉ `docs/adr/0002-bai-giang-giong-doc-r2.md`, `docs/noi-dung/duong-xua-may-trang.md` | Claude giữ đến khi PR merge/đóng; Codex đã gửi chính sách mới qua bình luận, chưa coi là đã cập nhật thiết kế |
| Claude | [#51](https://github.com/tnfsmith/Buddha/issues/51) | Client giọng đọc, `main.js`, template, `build.mjs`, test | Đã nhận việc; giữ theo phạm vi Issue/shared-ok. Codex chỉ bàn giao thay đổi chính sách, không sửa đè mã |
| Claude → Codex | [#53](https://github.com/tnfsmith/Buddha/issues/53), [PR #54](https://github.com/tnfsmith/Buddha/pull/54) | Loạt «Lời Phật dạy» trong `content/bai-giang/` | PR nháp nội dung riêng cho v0.15.0; triển khai nạp/phát hành theo #46 và chính sách mới, không đòi Hội đồng |

Quyền sửa chỉ trả khi người đang giữ ghi bàn giao trong Issue/PR. Không tự hết hạn, không suy ra rảnh vì agent không phản hồi. Bảng này có thể cũ: kiểm GitHub trước khi sửa. Mỗi tác vụ dùng checkout/worktree riêng, không thay nhánh hay rebase thư mục của nhau. Riêng assertion đồng hồ Vân Du được chủ dự án giao Codex ở #43; không tự mở rộng ngoại lệ sang mã ứng dụng hoặc các file test khác.

## 4. Trình tự tiếp theo theo lộ trình

1. Cửa kiểm GĐ2 đã bổ sung qua #37: CI main chạy đủ hai account E2E với Worker/D1 cục bộ, không skip/retry; giữ CI này khi ghép các phần GĐ3. Không tính toàn bộ GĐ2 xong nếu giám sát/máy thật còn thiếu.
2. [#35](https://github.com/tnfsmith/Buddha/issues/35): tách dữ liệu preview khỏi staging trước PR có migration mới. Hiện preview upload bằng `--env staging`, binding D1 vẫn là staging; không thử ghi schema mới vào staging để chữa preview. Việc này chưa nhận sửa ở snapshot đầu.
3. T0.7/T1.4/T2.4: hoàn thiện công cụ, cấu hình token chỉ đọc trên homelab, đối chiếu dashboard, đủ 3 báo cáo sáng liên tiếp và đo 3 máy thật. Kiểm fixture không thay các tiêu chí chạy thật; không tạo số liệu giả.
4. GĐ3: chốt hợp đồng API/fixture/selector với `shared-ok`; Codex làm API/net/công cụ nội dung, Claude làm UI và `ReminderClock`. Theo #55, `da_duyet` là trạng thái chọn phát hành, không chứng nhận Hội đồng; không tạo dấu duyệt giả hoặc tự mở nháp. #46/#48–51/#53 là các đầu việc nội dung/giọng đọc đã bàn giao, không mặc định đã triển khai.
5. Sau điều kiện phụ thuộc: GĐ3 ∥ GĐ4 ∥ GĐ8; GĐ5 ∥ GĐ7; GĐ6 khi có hồ sơ pháp lý; GĐ9 nghiệm thu ra mắt. Không tính toàn bộ giai đoạn xong từ sự tồn tại của bảng DB.

| Mốc | Codex | Claude | Phụ thuộc/bàn giao |
|---|---|---|---|
| T3.1–4 | Nội dung có nguồn, API practice/deeds/attest/reminders/push, migration, điều kiện tầng | Biến thể/UI, Bia Tích Lũy, chứng thực tuần, ReminderClock DO | Hợp đồng và selector tất định trước; biên tập/PR thông thường, tư vấn tùy chọn |
| T4.1–4 | Ticket/block/report, số liệu, k6 staging | Lobby/HallRoom, giao thức, client/đám đông thật | Chốt vé/TTL/shard/block/rejoin; realtime triển khai trước phía phụ thuộc |
| T5 | API help/events/moderation; báo cáo đề xuất kiểm duyệt | Bảng Hộ Trì, thăm đảo/nhóm/phòng | Người trực kiểm duyệt và policy trước mở cộng đồng |
| T6 | API/connector/đối soát/ledger và pipeline ứng viên | Không gian Đại Công Đức và UI | Chủ dự án hoàn tất pháp lý/tài khoản; tách khỏi không gian tu tập |
| T7 | Hỗ trợ số đo và báo cáo | WebGPU/TSL | Dự phòng WebGL2; ma trận thiết bị đạt |
| T8 | Android, bearer, CI ký, App Links | Tương thích UI/âm thanh/WebView, capability bản Play | Khóa shared khi sửa build/deps; chủ dự án quản lý khóa ký |
| T9 | Gia cố API/hạ tầng, backup/restore, tải, vận hành | Hiệu năng/tiếp cận/trải nghiệm | Bằng chứng máy thật, bảo mật, pháp lý và diễn tập khôi phục |

## 5. Kiểm tra trước và sau khi gộp

- Trước nhận việc: fetch, đọc Issue/PR đang mở, ghi phạm vi + phụ thuộc + người giữ shared, gắn `status:claimed`. Chỉ tạo nhánh từ baseline đã ghi hoặc base xếp chồng rõ ràng.
- Trước mở PR: cập nhật/rebase `origin/main`, kiểm diff đúng làn và hợp đồng tương thích; không force-push nhánh của agent khác. Lockfile conflict giải bằng cài lại sau rebase, không sửa tay.
- Trước đề nghị merge: kiểm kết quả tích hợp của các PR liên quan. Kiểm cả conflict văn bản lẫn API/lược đồ/khả năng chạy; chạy lint → unit/API → build → size → migrations → smoke 3D/PWA → account Worker thật. Khi SHA/base thay đổi, chạy lại kiểm liên quan; CI cũ không chứng minh cây mã mới đạt.
- Migration chỉ thêm, Codex [AG] giữ số thứ tự. `0006`/`0007` đã dùng; tệp tiếp theo `0008_...`, kiểm lại main trước tạo. Thay đổi schema phải tương thích client và API v0.14 trong giai đoạn chuyển tiếp.
- Đợt Claude #30/#31/#32/#41 đã merge đúng thứ tự. Với mọi PR xếp chồng mới, vẫn phải ghi base/thứ tự, cập nhật sau mỗi merge và kiểm lại cả cây tích hợp. PR #42 thay đường dẫn server kiểm thử, cần xác minh cùng runner #37 trên Windows.
- Chủ dự án merge sau CI/preview và kiểm điện thoại. Đợt #44 → #36 → #37 → #38 và #42/#45 đã merge; không dùng thứ tự cũ làm danh sách PR còn mở. Hiện #55 chốt chính sách; Claude cập nhật thiết kế #52 và mã #51 theo quyết định này, Codex làm công cụ nạp/API ở tác vụ riêng. Sau mỗi merge, cập nhật base/diff và kiểm lại cây tích hợp nếu mã đổi; chờ staging đúng SHA trước phát hành phụ thuộc. Agent không tự merge/tag.
- Production chỉ khi chủ dự án tạo tag; chạy lại toàn bộ CI trên đúng SHA rồi mới migration/deploy. Kiểm khói sau deploy; lỗi thì thực hiện runbook, không sửa/xóa migration đã merge.

## 6. Ghi nhận bằng chứng và điều kiện ngoài mã

Mỗi bàn giao ghi: Issue/PR, SHA/base, tệp đã đổi, hợp đồng ảnh hưởng, kiểm tra đã chạy/kết quả, điều kiện chưa đạt và người nhận. Phân biệt **đã có mã / kiểm cục bộ đạt / CI đạt / staging đạt / production đã phát hành**.

- Hermes: chủ dự án đã chọn **Telegram** trong phiên 14/11; đích chat, máy homelab và chứng thực hoàn chỉnh sau. Còn cần token Cloudflare/GitHub chỉ đọc; không dùng token deploy làm token giám sát, không ghi bí mật hay dữ liệu cá nhân vào báo cáo. Chưa tạo lịch hay gửi tin thật.
- Nội dung: PR #45 đã bỏ bảy bài viết cứng và dùng API, nhưng UI tại `c8edea4` vẫn đòi `reviewed_at` và nói thiếu Hội đồng. Quyết định mới #55 bỏ điều kiện đó; đã bàn giao Claude tại [#51](https://github.com/tnfsmith/Buddha/issues/51#issuecomment-6878514111) và [#52](https://github.com/tnfsmith/Buddha/pull/52#issuecomment-6878514332). Cần PR mã và dữ liệu công khai phù hợp để bài xuất hiện; đổi docs không tự nạp D1.
- Kiểm thử Windows: PR #42 đã merge, đã xác nhận server kiểm thử chạy được. Không sửa hoặc đẩy vào nhánh Claude.
- Quyền riêng tư: bảng consent đã có nhưng chưa thấy luồng đồng ý có phiên bản; cần tác vụ API/UI phối hợp và chính sách do chủ dự án duyệt trước mở rộng đăng ký.
- Chưa có nghiệm thu máy thật, hồ sơ pháp nhân/affiliate/Play hoặc dữ liệu nội dung đã chọn phát hành thì ghi **chờ điều kiện tương ứng**, không tự đánh dấu hoàn thành. Hội đồng không còn là điều kiện chặn nội dung/phát hành.

## 7. Bằng chứng lịch sử của phiên tiếp quản (trước Vân Du)

- Cây kiểm cục bộ `69c5211` gộp thử `d8cee01` (tài liệu), `88c5619` (CI), `dd13643` (Hermes), `39ae189` (Claude #30), `43fa607` (Claude #32, đã chứa #31). Không đẩy cây kiểm lên main; không đổi nhánh Claude. Git gộp sạch, không conflict.
- Trên cây này: lint không lỗi (2 cảnh báo cũ), 107/107 unit/API, 21/21 kiểm thử Hermes, 7 migration hợp lệ; build và ngân sách kích thước đạt trần.
- Kiểm khói gồm 3D, offline/IndexedDB và di chuyển/âm nhạc mới của Claude: 17 ca đạt. Runner account trên cùng cây tích hợp: 2/2 ca đạt trong 3,2 phút, không skip/retry; QR khôi phục 3,6 giây (<10 giây).
- HTML tích hợp khoảng 1040 KB, +7,5% so mốc lịch sử 967 KB, vẫn dưới trần 1074 KB; phần Codex không sửa HTML/app, baseline main dựng mới đã khoảng 1022 KB. Không tự nâng ngưỡng hoặc cập nhật mốc để bỏ cảnh báo.
- CI nguồn: [điều phối](https://github.com/tnfsmith/Buddha/actions/runs/43555583854), [Antigravity, gồm job account thật](https://github.com/tnfsmith/Buddha/actions/runs/43556284233), [Hermes](https://github.com/tnfsmith/Buddha/actions/runs/43556287684). Kiểm trạng thái mới trên PR nếu SHA thay đổi; kết quả trên không thay nghiệm thu điện thoại vật lý hay staging sau merge.

## 8. Tiếp tục sau khi Claude gộp Vân Du

- Đã đọc [bàn giao của Claude tại #33](https://github.com/tnfsmith/Buddha/issues/33#issuecomment-6873827254). Claude đã trả `CLAUDE.md` về nguyên trạng để Codex là người ghi duy nhất. Đã thêm đúng ghi chú kiểm cảnh Vân Du vào `CLAUDE.md`.
- Ba nhánh Codex được cập nhật từ `origin/main` `9b7264e`, tách khỏi nhánh Claude. PR #42 chỉ được đưa vào cây kiểm riêng để kiểm khả năng tích hợp; không tự merge PR hoặc sửa test của Claude.
- Mốc size 967 KB vẫn giữ nguyên. Claude báo main sau bốn PR khoảng 1041 KB; cần chủ dự án chốt mốc mới, không tự sửa ngân sách để bỏ cảnh báo.
- Cây kiểm mới `90de83f`: main `9b7264e` + điều phối `f6c62cc` + CI `0bcee01` + Hermes `a413ae1` + Claude #42 `ba86f3c`. Git gộp sạch; không thay đổi nhánh Claude. Lint không lỗi (2 cảnh báo cũ), 107/107 unit/API, 21/21 ops, 7 migration và build đạt. HTML khoảng 1043 KB, dưới trần 1074 KB; giữ cảnh báo so mốc cũ.
- Lượt E2E mới phải gồm Vân Du và server Windows của #42, cùng hai ca account Worker thật. Bằng chứng cuối và trạng thái CI hiện hành ghi vào [bàn giao #33](https://github.com/tnfsmith/Buddha/issues/33) và PR #36–38 để không nhân bản bảng việc. Kết quả mục 7 chưa bao gồm Vân Du và không thay lần kiểm này. Nếu main/SHA thay đổi, cập nhật rồi chạy lại kiểm liên quan.

## 9. Cửa kiểm phát hiện assertion đồng hồ và ngoại lệ #43

- Trên CI của #37 (`0bcee01`), 19 smoke và job account thật đạt, nhưng test Vân Du yêu cầu caption `00:00`–`00:09` trong khi UI đọc được `00:11`; cả retry cũng cùng lỗi. [Log đã xác minh](https://github.com/tnfsmith/Buddha/actions/runs/43579057571/job/132399646698). Không bỏ qua CI đỏ hoặc chạy lại mù để lấy màu xanh.
- Chủ dự án đã chọn “Codex sửa riêng test này (đề xuất)”. #44 chỉ đổi assertion ban đầu thành giây `00`–`59`, vẫn kiểm tên cảnh/chặng và phút đầu; không tăng timeout, không bỏ test hay sửa app. Ba ca Vân Du đạt (41 giây); tái hiện trực tiếp `00:11` cho thấy assertion cũ false, mới true.
- Các head trước khi thêm #44 không được dùng làm bằng chứng đã sửa lỗi này. Chờ CI/preview của các head mới ở bảng trên; ghi kết quả cuối qua #33 và PR tương ứng. Bằng chứng app của cây `90de83f` vẫn gồm 107 unit/API, 21 ops, 20 smoke và 2 account thật (QR 1,6 giây), có thêm kiểm riêng đóng server Windows đạt với quyền chạy thử phù hợp.

## 10. Quyết định mới về nội dung — #55

- Nguồn là chỉ đạo trực tiếp của chủ dự án trong chat Codex ngày 14/11/2026, không phải agent tự nới luật. Không bắt buộc Hội đồng hay một vòng duyệt chuyên môn thay thế để hiện/phát nội dung tham khảo có nguồn. Nháp/ngừng và bản chọn phát hành vẫn tách theo trạng thái thông thường.
- `da_duyet` là tên kỹ thuật của trạng thái phát hành; `reviewed_by`/`reviewed_at` tùy chọn và không được bịa dấu duyệt. Các Issue #3/#39/#46/#48/#50 và thiết kế PR #52/#54 phải đọc theo quyết định mới khi có yêu cầu cũ mâu thuẫn.
- Codex giữ sáu tệp ở #55; không sửa hai tệp Claude giữ tại #47 hoặc mã UI/test/build của #51. Claude bỏ câu thông báo thiếu Hội đồng và yêu cầu `reviewed_at`, cập nhật thiết kế và kiểm thử; Codex làm công cụ nạp/API ở tác vụ riêng #46/#50. Không tự coi PR tài liệu là mã đã deploy.
- Trạng thái trống mới: "Chưa có bài chia sẻ. Nội dung đang được cập nhật." Bài cần tên, nguồn và nội dung hợp lệ; không chặn chỉ vì không có Hội đồng. Bài được chọn phát hành qua PR nội dung không cần thêm một biên bản duyệt riêng.
- Bàn giao qua bình luận #51/#52 và các Issue nội dung liên quan; kết quả CI/SHA và phản hồi mới nhất ghi tại [#55](https://github.com/tnfsmith/Buddha/issues/55) và [bàn giao chung #33](https://github.com/tnfsmith/Buddha/issues/33#issuecomment-6875028304).
