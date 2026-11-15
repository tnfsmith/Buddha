# Vân Đạo — phối hợp Codex và Claude

Ngày cập nhật: 15/11/2026. Người tổng hợp duy nhất: **Codex**. Quyết định chủ dự án: Codex nhận việc Antigravity + Hermes; Claude tiếp tục độc lập phần của Claude.

**Quyết định nội dung mới của chủ dự án (#55):** bỏ điều kiện Hội đồng bắt buộc. Nội dung tham khảo có nguồn, phát hành theo quy trình biên tập/PR; Hội đồng/chuyên gia chỉ tư vấn tùy chọn. ADR 0003 thay các yêu cầu cũ còn xuất hiện trong bằng chứng lịch sử dưới đây. Quyết định đã ghi không có nghĩa mã UI đang chạy đã thay đổi.

**Hiện hành Sơ nhập A/B (15/11):** thiết kế #85/#86 đã được duyệt và merge vào main `a45dceb`. Đợt A #89 đã merge vào main `6cfb8dd`; Codex giữ đợt B #87/PR #90 đã rebase lên main mới: 73 mục `nhiem_vu` còn `cho_duyet` và bộ nạp. Xem mục 16; các mục trước là snapshot lịch sử v0.15/v0.16, trạng thái release/tag hiện hành xem #33.

Đọc tệp này khi bắt đầu phiên; sau đó kiểm Issue/PR và `origin/main` hiện tại. Tệp là bản bàn giao có thời điểm, không thay bảng việc GitHub. Claude gửi cập nhật trong Issue/PR; Codex tổng hợp để tránh hai agent cùng sửa tệp này.

## 1. Mốc đã xác minh

- Repo: `tnfsmith/Buddha`. Snapshot main ngày 15/11: `12747a4` sau chủ dự án merge #71 (0008/meta), #82 (client đã sửa đảnh lễ), #69 (guard preview), #73 (TTS), #81 (P1 Puck/không Pāli TTS). [CI43679954388](https://github.com/tnfsmith/Buddha/actions/runs/43679954388) và staging deploy đạt. Tag production hiện hành `v0.15.0` tại `8769cb1`; API production 7 mục. Staging 9 mục gồm 7 bài và 2 nghi thức. Đường Xưa chưa vào main; chưa có tag v0.16.0. Không dùng SHA 12747 để tuyên bố đủ 33 bài.
- Lịch sử: production đã phát hành `v0.14.0`; [deploy 43536527634](https://github.com/tnfsmith/Buddha/actions/runs/43536527634) thành công. 100 kiểm thử logic đạt; Playwright 12 đạt, 2 bỏ qua. Hai ca Worker thật trong `account.spec.js` chưa chạy ở CI này.
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
- Snapshot 15/11/2026, cây kiểm riêng `4273282`: ghép #72 (`75a3dad`) → #75 (`b1e398b`) → #69 (`4a7469c`) → #71 (`84f4377`) → #73 (`72cd3fb`) → #76/B (`27717b7`) → #77/C (`8770382`) sạch, không conflict. 159 unit/API + 21 ops đạt; lint 0 lỗi/2 cảnh báo cũ; 8 migration; build/size khoảng 1042 KB dưới trần 1074 KB. Phần `apps/web` giống hệt main `3a260f6`; vượt mốc lịch sử 967 KB là từ baseline, không nâng trần. Smoke 29 đạt/4 ca tách theo môi trường; chạy riêng sau đó account Worker/D1 thật 2/2 đạt, không skip, QR 1,9 giây. Hai ca live-sermon còn cần staging đúng khóa 96k; không dùng kiểm cục bộ làm bằng chứng phát hành. Đợt D chưa thuộc cây kiểm này.
- Cổng hiện tại: chỉ #72 được báo đủ điều kiện merge trước; #75 vẫn Draft đến khi cập nhật/kiểm lại sau #72. Chủ dự án merge #75 → staging nạp đúng bảy khóa 96k → Claude kiểm #63 → chủ dự án quyết định tag v0.15.0. #69/#71/#73/#76/#77/#78 là nháp cho bước tiếp sau; 0008/meta phải trước bài Đường Xưa đầu tiên. Sau v0.15.0, cập nhật/kiểm và báo lần lượt #69 → #71 → #73 → #76/B → #77/C → #78/D; không đưa cả danh sách thành lệnh merge ngay.
- TTS Đường Xưa đã đủ **33/33 bài 96 kbps**, Sadaltager 0,85: #76/B10, #77/C11, #78/D12, mỗi PR chứa cả chữ và tiếng. ffprobe 33/33 đúng mp3/24000/mono/96000; audit tổng 132 tệp hai bucket/498 cues khớp. Báo cáo từng đợt giữ 237 cờ nhịp + 10 cờ lời/đuôi, không diễn giải thành nghe duyệt hoặc không lỗi phát âm. D có một lần mạng quá hạn đã phục hồi bằng cache; không ghi đè R2. Cả 33 bài còn `cho_duyet`; kiểm công cụ nạp từ chối đủ 33 nháp, chỉ chọn bảy bài đang công khai. Mô phỏng chọn 40 bài chỉ trong RAM qua đủ 8 migration: upsert hai lần không trùng, meta/chữ/khóa giữ nguyên. **Chưa đủ tag v0.16.0:** còn lựa chọn phát hành của chủ dự án, chuỗi merge/meta và Claude kiểm staging. Không tự merge/tag hoặc sửa `apps/web`.
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


## 11. Lệnh cập nhật lần 2 — A/B và giọng Google (#60)

- Nguồn quyết định: hai bình luận cập nhật lần 2 ở #33/#49, thay các mốc cũ; chủ dự án sau đó chỉ định Google Chirp 3: HD vi-VN nam, ưu tiên gần miền Nam. Một giọng cho toàn kho. Không chờ chủ dự án chọn giọng; chỉ ghi điểm/mô tả đã đo thật.
- #52/#54/#56/#57 đã merge; #58 cũng đã merge vào 4697c6e, bảy bài v2 ở da_duyet. Trạng thái cũ trong các mục lịch sử không phải PR đang mở.
- A: #59 ag/46-nap-noi-dung, fa0d64c (nạp/deploy; 119 kiểm thử tại máy); #61 ag/50-media, 3fcdb3d (API/media; 129 kiểm thử, hai môi trường D1/R2). Cả hai đã mở, chưa tự merge; theo dõi CI đúng SHA trên PR.
- B: ag/49-tts-cong-cu nối sau #59 cho công cụ; hermes/49-tts-loi-phat-day chỉ nội dung/body_r2_key/audio lock sau khi sinh và tải thật. Google TTS/Service Account và hai bucket đã kết nối; không lưu khóa hoặc tệp âm thanh vào Git. Chưa có điểm giọng/sản phẩm âm thanh thì không ghi hoàn tất.
- Codex giữ AGENTS §6, năm dòng T3.5–T3.9, mục 5 dàn bài và tệp này trong #60; Claude giữ apps/web. Đã báo #51 đổi nhãn giọng AI cho đúng Google, không sửa đè client.
- Mốc: A 14/11; B 15/11 → chủ dự án merge → Claude kiểm staging → chủ dự án tag v0.15.0 (15/11). Ngay sau đó #35 tuần tự hóa migration và 0008/meta trước bài Đường Xưa đầu tiên; B=10 → C=11 → D=12, mỗi đợt một PR văn bản+giọng đọc nối tiếp 15/11. Xong việc nào chuyển việc kế ngay.
- Mỗi PR mới báo ở #33; báo khi staging phát tiếng thật. Không tự merge/tag, không sửa apps/web; upload hai bucket không tự công khai vì /media kiểm D1 của chính môi trường. Tài khoản/khóa giữ cục bộ hoặc GitHub Secrets, đặc biệt khi repo tạm public.

## 12. Bàn giao 15/11 — ưu tiên MP3 96 kbps

- Snapshot cập nhật: `main` `644a97c` đã có #72/ADR 96k, cùng #59, #61, #62, #64, #65, #66, #67 và **#68 ở bản 64 kbps**. #68 merge lúc 18:38 UTC 14/11, trong lúc Codex chuẩn bị bản nâng 96k; không sửa lịch sử hoặc giả ghi nhận commit đã merge chứa 96k.
- Chủ dự án ưu tiên 96k tại #49 `issuecomment-6882177478` và chat 15/11: dừng Đường Xưa, nâng bảy bài trước, rồi quay lại. PR #74 giữ diff công cụ nhỏ (audio/core + kiểm băm). Vì #68 đã merge 64k, **không merge riêng thay băm vào main còn sổ 64k**; gói bổ sung `owner/49-audio-96k-release` đưa công cụ và dữ liệu 96k vào cùng kết quả tích hợp. Link PR hiện hành xem #33/#49.
- Bảy bài giữ lời/version 2/status và đúng một giọng `vi-VN-Chirp3-HD-Sadaltager`, tốc độ 0,85. Mã hóa lại từ 93 WAV LINEAR16 đã dùng, không gọi lại TTS/STT, không lấy MP3 Google hay thêm `compression_level`. Băm có `mono24k-96k-…`, khóa mới lên cả hai bucket.
- ffprobe 9.0.2 trên **7/7 MP3**: `mp3`, `24000`, `mono`, `96000`; loudness sau mã hóa −16,09 đến −16,16 LUFS, đỉnh −2,06 đến −1,86 dBTP. Audit tải lại **28 tệp**, so SHA-256/Content-Type/cues/voice/model/hash; **93 cues** khớp. Bằng chứng: `docs/reports/2026-11-15-loi-phat-day-96k.json`. Sổ thật và công cụ trên cây 96k đã qua 155/155 unit/API; CI của PR bổ sung vẫn phải được xem theo head hiện hành.
- Sáu cờ nghe kiểm của nguồn giọng giữ nguyên trong sổ/PR, không đổi thành đạt chỉ vì tăng bitrate. Ba cờ nhịp hơi nhanh, ba cờ WER/đuôi; đây có thể gồm lỗi nhận dạng, cần nghe phân biệt. Chưa dùng ffprobe/audit R2 thay nghiệm thu tiếng thật trên staging của Claude (#63).
- **Giữ khóa cũ:** `_audio.retired.json` ghi 14 cặp MP3/cues 64k từ hai lượt mã hóa cũ, cả hai bucket, không xóa trước 15/12/2026 giờ Việt Nam. Chưa xóa tệp nào. Đã đọc lifecycle: hai bucket chỉ dọn multipart chưa hoàn tất sau bảy ngày, không có quy tắc hết hạn object. Trước khi dọn phải kiểm không còn D1 tham chiếu; không xóa theo tên thư mục rộng.
- Kiểm tích hợp v0.15.0 trước đổi bitrate: `6842f32` ghép các PR không conflict, 155 unit/API + 21 ops đạt, lint 0 lỗi/2 cảnh báo cũ, 7 migration, HTML khoảng 1042 KB dưới trần 1074 KB. Lượt chạy smoke/account đồng thời bị timeout và đụng thư mục trace; đã chạy riêng trên cùng mã: account 2/2 đạt, QR 1,8 giây; ca đủ 13 khúc nhạc đạt trong 3,6 phút. Giữ bằng chứng lượt lỗi, không diễn giải thành một suite xanh. Không sửa app/test hoặc nới ngưỡng.
- #72 đã merge ngày 15/11; #75 được rebase lên `644a97c`, giữ nguyên bảy khóa/MP3/cues và sổ 96k. Chỉ chuyển #75 khỏi Draft và báo merge sau CI/preview đúng head mới xanh. Sau chủ dự án merge #75: staging nạp khóa mới → Claude kiểm live sermon/nhãn Google/Range/cues và phát thật trên điện thoại (#63) → chủ dự án quyết định tag v0.15.0. Agent không merge/tag; Codex không sửa `apps/web` hoặc ADR Claude giữ. Theo dõi SHA/kết quả mới nhất ở #33/#63; CI trước rebase không thay kết quả head mới.
- **Đường Xưa:** đã đủ 33 bản chữ/giọng 96k, cùng Sadaltager 0,85: B10/#76, C11/#77, D12/#78; mỗi PR chứa cả chữ và tiếng. ffprobe 33/33 đúng; audit 132 tệp hai bucket/498 cues khớp. Giữ 237 cờ nhịp + 10 cờ lời/đuôi trong báo cáo, không gọi là đã nghe duyệt. Cả 33 bài vẫn `cho_duyet`, chưa public. Khi đổi nhánh gốc #75, cập nhật lần lượt B → C → D để diff mỗi PR vẫn chỉ đúng đợt của mình. Sau v0.15.0 mới xét #69 → #71/0008 → #73 → #76 → #77 → #78, cập nhật/kiểm và báo từng PR; chủ dự án chọn phát hành, Claude kiểm staging trước v0.16.0. #35 DB/KV riêng mỗi PR chưa hoàn thành; không lấy TTS trên R2 làm bằng chứng đủ tag.
- Chủ dự án đã chọn **cảnh hòa giải tranh nước chương 52** cho “Bóng mát của họ hàng”, thay cảnh cây khô không xác nhận được trong bản sách. Khi quay lại nội dung, sửa dàn bài/chương/thứ tự theo bản Làng Mai: Ương Quật Ma La chương 53 (phần 2), voi Nalagiri chương 74, chim cút chương 69; chương 42 là đối thoại hiểu/thương với vua Ba Tư Nặc. Giữ số lượng sản xuất B10/C11/D12; đợt sản xuất có thể khác phần sách.

## 13. Nghi thức #80 và thứ tự v0.16.0 — lệnh chủ dự án 15/11

- **Thứ tự hiện hành thay thứ tự cũ ở mục 12:** #71 → #69 → #73 trước → #80 cùng #79 → Đường Xưa #76–#78 sau chủ dự án nghe chọn → Claude kiểm staging → chủ dự án tag v0.16.0. Không báo đủ điều kiện tag chỉ dựa vào TTS/R2. Agent không merge/tag.
- #80 `lane:hermes`, `gd3`, `status:claimed`: Codex giữ hai mục `nghi-thuc-mo-dau`/`nghi-thuc-ket-thuc`, sổ âm thanh và báo cáo trong [PR #81](https://github.com/tnfsmith/Buddha/pull/81), xếp trên #73. **Chủ dự án đã nghe duyệt 0,85 cho cả mở/kết và xác nhận Namo/Sādhu đúng qua chat ngày 15/11/2026.** Hai bài đổi `da_duyet` trong PR, chưa merge/deploy. Kind `bai_giang`, `meta.loat: nghi-thuc`, `meta.vai: mo-dau|ket-thuc`; `meta.audio.speed: 0.85`. Ghi `reviewed_by`, `reviewed_at`, `listening_approval`; manifest vẫn giữ bản 0,80 không được chọn.
- Bốn bản nghe: mở đầu 0,80 = 48,12s; 0,85 = 45,03s; kết 0,80 = 52,66s; 0,85 = 51,70s. Cùng Sadaltager, MP3 96k/mono/24k, −16 LUFS/−1,5 dBTP; khoảng cách cues 1,2s, provider `google`; ID3 ghi “Giọng đọc tạo bằng AI — Google Chirp 3 HD”. Lời Việt tự biên soạn, Pāli có nguồn; không hứa quả vị/công đức hay kêu gọi tiền.
- Đã thử ba cách phiên âm Namo ở cả hai tốc độ, chủ dự án nghe duyệt B/0,85. ASR tiếng Việt không chứng nhận Pāli; giữ nguyên tám cờ cue/tốc độ Pāli và ba cờ câu Việt để truy vết, không sửa điểm sau khi nghe duyệt. Chi tiết 28 cues, transcript và xác nhận nghe ở `docs/reports/2026-11-15-nghi-thuc.json`. Bốn bản đầy đủ + sáu mẫu đã tải/đọc lại hai bucket (40 object), SHA-256/Content-Type/cues/ID3 khớp. Link ký 7 ngày ở PR/#33, không commit URL tạm.
- **Ranh giới:** Claude giữ #79, ADR 0002 và toàn bộ `apps/web`; Codex không sửa. Mỗi dòng không `>` một cue, dịch `>` không đọc, cue đầu kết có `Sādhu`; pause chỉ nằm trong vế cách đọc `[[hiển thị|cách đọc]]`. **Trong cặp #80 + #79, merge client #79 trước PR #81**: client có phương án dự phòng khi nghi thức chưa nạp và loại `meta.vai` khỏi danh sách bài giảng. Chưa merge #81 nên D1 thật vẫn chỉ có bảy bài cũ.
- Công cụ nghi thức/ID3 nằm ngay trong #73, không mở PR AG mới; #73 được đặt trên #71 để CI/preview có đủ migration/meta và chặn preview chưa có 0008. Đã ghép thử toàn bộ chuỗi cục bộ không conflict: 165 unit/API, lint 0 lỗi/2 cảnh báo cũ, tám migrations và build/size đạt; HTML không tăng so main (1042KB). Bảy khóa/bytes Lời Phật dạy giữ nguyên. Kiểm CI GitHub theo head mới sau mỗi rebase, không dùng lượt xanh cũ thay lượt mới.
- **Đường Xưa:** đủ 33/33 ID3 AI, ffprobe 96k/mono/24k; payload MPEG/LAME giữ nguyên tuyệt đối, 498 cues không đổi. Audit 132 object hai bucket khớp. Cập nhật ngay #76–#78 với báo cáo `*-id3.json`; khóa 96k cũ giữ thêm ≥30 ngày, chưa xóa. Xếp base #76 trên `hermes/80-nghi-thuc`, rồi #77 trên B, #78 trên C, để sổ âm thanh không conflict. Sau PR trước merge, chuyển base về main và kiểm lại. **33 bài vẫn `cho_duyet`, chủ dự án chưa chọn phát hành.**
- #71 đã bao gồm cùng thay đổi migration-preview của #69; sau #71 merge cần đối chiếu #69 còn diff thực tế trước khi báo thao tác tiếp, tránh merge gói rỗng. Không tự đóng/merge thay chủ dự án.
- **Quyền tệp dùng chung:** Codex là người ghi `docs/COORDINATION.md` trong #81 (`shared-ok`); Claude gửi cập nhật qua #79/#33, không đồng thời sửa tệp này. Trả quyền khi PR merge/đóng hoặc bàn giao rõ. Đã duyệt nghe nghi thức; vẫn chờ các PR tiền đề, client #79, staging và quyết định tag của chủ dự án.

### 13.1. Bổ sung hồi hướng sau duyệt nghe — 15/11

Chủ dự án yêu cầu đọc trọn câu “Nguyện công đức nghe Pháp này lan đến mọi loài: cho ai khổ được hết khổ, ai sợ được hết sợ, ai sầu được hết sầu.” Đã thêm vào cue 3 của bản kết, chia nhịp câu ngắn để dứt khoát. Bản mở đầu vẫn da_duyet; **bản kết mới trở lại cho_duyet** chờ nghe xác nhận, 0,85 vẫn là tốc độ đã chọn. Cả hai mẫu 0,80/0,85 đã sinh/upload/audit lại; câu hồi hướng WER 0% ở cả hai, sáu cue còn lại giữ WAV cũ. Không áp dụng duyệt bản kết cũ cho nội dung mới. Hai khóa kết cũ giữ ≥30 ngày, chưa xóa. PR81 tiếp tục Draft; không sửa apps/web. Mục 13.1 này thay trạng thái “hai bài đã duyệt” phía trên cho riêng bản kết sửa mới.

### 13.2. Bản ngắn v0.14.0, ba giọng mới, không TTS Pāli — quyết định mới nhất 15/11

- Thay toàn bộ gợi ý bản kết 50–60s: chỉ một câu DEDICATE đúng tag v0.14.0; không lời cảm ơn/tiễn. Bản kết vẫn cho_duyet, chưa gắn body_r2_key khi chưa chọn voice. Mẫu A Orus 10,44s, B Fenrir 8,16s, C Alnilam 8,16s; cùng 0,85, WER0%, 96k/mono/24k/ID3, cả hai bucket khớp. Link 7 ngày ở PR81/#33. Chờ chủ dự án nghe ít nhất ba giọng trước final verdict, không tự chọn thay.
- Không có tiếng Pāli trong TTS. Mở đầu còn bốn cue Việt (0,85:22,95s), giữ WAV Việt/giọng đã nghe; bản kết một cue hồi hướng. Câu Pāli > chỉ hiển thị. Claude cập nhật #82/#79 và ADR: máy quay hướng chúng sanh đảnh lễ Đức Phật ba lần, hoàn tất đoạn đảnh lễ rồi mới phát hồi hướng; không chờ cue Sādhu từ audio. Codex không sửa apps/web/ADR.
- Công cụ hỗ trợ meta.audio.voice riêng cho nghi thức trong #73, đã 166 unit/API đạt; giong.json và bảy bài/33 Đường Xưa giữ nguyên. Ba mẫu nằm `_mau-giong`, không nạp D1; sổ chính chỉ giữ mở đầu và bảy bài cũ. Sau verdict mới đặt khóa/giọng cho bản kết, dùng đúng bytes đã nghe. Mọi khóa cũ giữ≥30 ngày, chưa xóa. Báo cáo hiện hành: docs/reports/2026-11-15-hoi-huong-chon-giong.{md,json}; báo cáo nghi thức cũ là lịch sử.
- PR81 tiếp tục Draft, một PR Hermes duy nhất; 33 Đường Xưa vẫn cho_duyet. #71 là lượt merge được báo trước; sau đó đối chiếu #69 → #73 → #82 đã cập nhật hợp đồng mới → #81 sau chọn/duyệt → #76–#78 sau chủ dự án duyệt → Claude staging → chủ dự án tag. Không dùng CI/duyệt của bản dài cũ để khẳng định bản mới đã xong.

### 13.3. Puck nhanh gọn — yêu cầu mới nhất sau từ chối ba giọng

Chủ dự án từ chối Orus/Fenrir/Alnilam 0,85 vì chậm, rề rà và thiếu năng lượng; yêu cầu Puck/nhấn âm mạnh, truyền cảm hơn. Đã thử P1 Puck1,00=7,01s và P2 Puck1,10=6,34s, WER0%/đúng đuôi; không pause dài, giữ một câu hồi hướng v0.14.0. 1,20/nhấn chữ/SSML còn cờ sai hoặc thiếu từ nên không đưa vào lựa chọn đã kiểm đủ lời. Chờ chủ dự án nghe P1/P2 trước final verdict, không tự lấy điểm ASR làm duyệt năng lượng.

Giữ raw pace flags theo ngưỡng cũ, không đổi transcript/điểm. Main lock chỉ có 7 bài cũ + mở đầu Việt; bản kết cho_duyet chưa có khóa/giọng/tốc độ phát hành. Cấu hình giọng chung và 33 bài Đường Xưa không đổi. Công cụ #73 cho phép tốc độ nghi thức riêng 0,80–1,20; không áp cho loạt khác. Hồ sơ hiện hành: docs/reports/2026-11-15-hoi-huong-puck.{md,json}, content/bai-giang/_hoi-huong.puck-options.json; mẫu trước là lịch sử bị từ chối. PR81 Draft, client #82 phải cập nhật đảnh lễ/máy quay trước merge. Không sửa apps/web/ADR, không merge/tag.

### 13.4. Final verdict: duyệt P1 — Puck tốc độ 1,00

Chủ dự án xác nhận hai lần trong chat: Duyệt P1, Puck1,00. Bản kết đã da_duyet, meta.audio.voice=vi-VN-Chirp3-HD-Puck, speed=1; một cue Việt/7,01s, không Pāli TTS hoặc lời cảm ơn. Dùng đúng MP3/cues đã nghe, SHA-256 không đổi; copy sang khóa nghi thức chính thức, hai bucket khớp, không sinh/mã hóa lại. Giữ raw pace flag và phê duyệt nghe; WER0%/đuôi đúng. Main lock nay 9 mục (7 cũ + mở đầu Việt4cue/Sadaltager0,85 + kết Puck1,00); 33 Đường Xưa vẫn nháp, giọng chung không đổi.

PR81 chưa merge/deploy; #82 phải cập nhật máy quay hướng chúng sanh đảnh lễ ba lần trước hồi hướng, không tìm cue Sādhu trong MP3. Theo dõi CI đúng head mới; #71 vẫn là lượt merge đã báo trước. Không tự merge/tag.

## 14. Đường Xưa đã được chủ dự án chọn phát hành — 15/11/2026

- **Verdict mới nhất:** chủ dự án xác nhận trong chat “Duyệt phát hành cả 33 bài” cho B10/C11/D12. Ghi nhận ở [Issue #48](https://github.com/tnfsmith/Buddha/issues/48#issuecomment-6890917861) và từng PR. Đây là duyệt chọn phát hành, không tự nhận đã nghe toàn bộ 33 bản hoặc đã xóa cờ ASR. Đổi da_duyet trong chính #76/#77/#78, giữ nguyên MP3/cues/khóa và sáu cờ đối chiếu.
- Đủ 33 bản chữ/tiếng, 498 cue; giọng Sadaltager 0,85, MP3 96 kbps mono 24 kHz, −16 LUFS/−1,5 dBTP, cues provider google, ID3 AI. ffprobe 33/33 và audit 132 object hai bucket khớp SHA/cues/voice/hash. Bảy cue thuộc sáu bài được cải thiện; giữ WAV còn lại. Khóa cũ lưu ít nhất 30 ngày, chưa xóa. Chín mục main, bảy bài Lời Phật dạy và Puck P1 đã duyệt không đổi bytes.
- Đã ghép B→C→D và giải quyết xung đột danh sách khóa lưu, giữ đủ khóa của từng nhánh. Sau verdict tiếp tục ghép trạng thái phát hành và CI mới. **Chỉ báo merge PR kế sau PR trước đã merge, base được chuyển về main/rebase, CI/deploy và kiểm tích hợp đạt:** #76 → #77 → #78; API tương ứng 19 → 30 → 42 mục. Cuối cùng UI có 40 bài và hai nghi thức ẩn; Đường Xưa chia phần sách 10/13/10 (khác đợt sản xuất 10/11/12).
- Kiểm cục bộ: 166 unit/API đạt, lint không lỗi/hai cảnh báo cũ, tám migrations, build/size đạt. HTML 1049 KB, dưới trần 1074 KB; mã client không đổi so main. Thử nạp sau duyệt trong SQLite bộ nhớ đạt 19/30/42, nạp lại không trùng. Parser client hiện hành nhận đúng 40 bài/hai nghi thức/thứ tự; browser staging với API mô phỏng 42 mục phát MP3 thật từ R2 ở ba bài B/C/D, chữ/cue/provider đúng, không lỗi JavaScript. Các kiểm mô phỏng này không thay nghiệm thu live sau merge.
- **Claude giữ #83 và tests/e2e:** kiểm live staging chính thức hiện 1/2 do assertion nhãn AI cũ, sau khi chủ dự án đã yêu cầu bỏ nhãn trong #82. Đã ghi Issue #83 và bàn giao #33/#79/#63; Codex không sửa apps/web hoặc tests/e2e. Lỗi đảnh lễ cũ đã sửa trong #82/8dc6152; kiểm logic actual main đạt ba đỉnh bow/cam wide trước Puck, Puck phát một lần. Chờ Claude sửa test và kiểm staging cuối có đủ Đường Xưa, menu/hàng đợi/chữ/mở-kết/máy quay/mobile.
- **Quyền tệp:** Codex là người cập nhật COORDINATION/tiến độ ROADMAP/ghi chú release trong #76/shared-ok, trả quyền khi PR merge/đóng; Claude gửi bàn giao trong #33. Không mở PR nội dung khác hoặc sửa checkout của Claude. Bản nghe hiện hành hạn bảy ngày và cờ ASR ở [#33](https://github.com/tnfsmith/Buddha/issues/33#issuecomment-6890835536); bằng chứng mô phỏng ở [bình luận tiếp](https://github.com/tnfsmith/Buddha/issues/33#issuecomment-6890899881).
- **Chưa tag v0.16.0:** mới duyệt nội dung, chưa merge ba PR; staging hiện chín mục, production bảy mục/v0.15.0. Sau #76/#77/#78 và bản vá #83, phải CI/staging/live xanh cùng SHA cuối, Claude nghiệm thu và chủ dự án kiểm điện thoại thật. Không tag main 12747a4 vì thiếu 33 bài. Ghi chú thay đổi và điều kiện tag: docs/reports/2026-11-15-v0.16.0-release-notes.md. Agent không merge/tag.

## 15. Sau merge #76 — kiểm thật và bàn giao Claude ngay

- Main 57f947641b4cf58b3c856547eeade33f83c8cf1b: #76 đã merge, [CI 43690489428](https://github.com/tnfsmith/Buddha/actions/runs/43690489428) và [deploy staging 43691581757](https://github.com/tnfsmith/Buddha/actions/runs/43691581757) xanh. API thật có 19 mục: 7 Lời Phật dạy, 10 Đường Xưa B và 2 nghi thức. Kiểm live API/HEAD/Range/cues cả 19 mục đạt (48,6 giây); đây là kiểm trên D1 và /media thật.
- #77 đã rebase lên main sau #76 không conflict, đủ 30 mục trong nhánh sau nạp, giữ nguyên toàn bộ 19 mục cha, audio/khóa/ID3 và Puck P1. Chạy CI mới; chỉ Ready #77 sau kết quả đúng head đạt. #78 vẫn Draft, ghép tiếp trên C, chỉ xét merge sau #77 main/deploy/staging đạt 30 mục. Cuối D phải 42 mục/40 bài, ba phần Đường Xưa 10/13/10.
- **Đã gửi Claude yêu cầu nghiệm thu ngay:** [#83](https://github.com/tnfsmith/Buddha/issues/83#issuecomment-6891540663), [#33](https://github.com/tnfsmith/Buddha/issues/33#issuecomment-6891540856), #79 và #63. Claude kiểm B đang live, sửa assertion nhãn AI trong #83, rồi kiểm tiếp C/D theo SHA từng lần deploy. Giữ kiểm phát tiếng/currentTime/cues/provider, không skip hoặc nới timeout. Kiểm menu, nghe lần lượt, mở đầu một lần, ba lần lạy/máy quay trước Puck, console và điện thoại. Đã gửi yêu cầu không đồng nghĩa Claude đã phản hồi hoặc nghiệm thu xong.
- **Quyền tệp:** Codex giữ COORDINATION, T3.6–T3.9 ROADMAP và ghi chú release trong #77/shared-ok theo [claim #48](https://github.com/tnfsmith/Buddha/issues/48#issuecomment-6891541499), trả khi PR merge/đóng hoặc bàn giao rõ. Claude gửi kết quả trong Issue; không đồng thời sửa các tệp này. Codex không sửa apps/web/tests/e2e, không mở PR nội dung mới.
- **Chưa tag v0.16.0:** còn #77 → #78, #83 và nghiệm thu live/điện thoại thật trên SHA cuối. Main hiện tại mới có 10/33 Đường Xưa, không gắn tag ở SHA này. Báo cáo sau B: docs/reports/2026-11-15-duong-xua-after-B.json; ghi chú release hiện hành vẫn là dự thảo.

## 16. Đợt B #87 — danh mục Sơ nhập, phối hợp A/C của Claude

- **Lệnh hiện hành:** chỉ thị trực tiếp mới nhất của chủ dự án chốt 73 mục: 25 Ngũ giới, 40 Hạnh, 7 Nguyện tuần, một thẻ Bát quan trai. Bốn nhóm `gioi/hanh/nguyen/trai`; biến thể T3.1 không thuộc lần giao này. Thay dự kiến 143 mục ban đầu; đã báo lại ở [#87](https://github.com/tnfsmith/Buddha/issues/87#issuecomment-6895808930), #85 và #88.
- **Codex nhận #87/status:claimed**, nhánh `hermes/87-nhiem-vu-so-nhap`, worktree riêng. Giữ `content/nhiem-vu/so-nhap/`, `scripts/content-data.mjs`, `scripts/import-content.mjs`, `scripts/test/content-data.test.js`, `workers/api/test/content-import.test.js`, `docs/COORDINATION.md`. Điều chỉnh đúng năm đường dẫn tệp trong vùng shared của `.github/lanes.yml` để một PR Hermes có thể sửa bộ nạp/kiểm thử theo #87; cần `shared-ok`, không mở cả thư mục scripts/API. Trả quyền khi PR merge/đóng hoặc bàn giao rõ.
- **Claude giữ #88/#89:** toàn bộ `apps/web`, `packages/shared/src/missions.js` và các tệp dùng chung đã claim. Codex không sửa các tệp đó, không đổi Kusala và không triển khai sync đợt D. Danh mục dùng mã parami/punna có sẵn trong Phụ lục H; Nguyện tuần khớp hai trọng tâm §5.1. Đã ghép thử với #89/7be7f6d: không conflict, 207 kiểm thử đạt, build/size 1057 KB và kiểm trình duyệt Tích lũy 1/1 đạt với API/media giả lập. Sau #89 merge, #90 đã rebase main 6cfb8dd; mã JS/MJS khớp bản tích hợp đã kiểm. CI/preview chạy mới trên head rebase.
- **Danh mục:** 73 câu tự biên soạn có nguồn, dài nhất 76 ký tự, `tier:0`, `lang:vi`, `version:1`, toàn bộ `cho_duyet`, `money:false`, `scope:doi_thuc`. Tên tích cực Ngũ giới đúng mục 4; mỗi giới có ít nhất hai việc ở nhà không tốn tiền. Thẻ trai duy nhất chứa tám giới tĩnh trong `meta.gioi_trai`, giới 5 và thẻ trai có `meta.safety_note`. Không phóng sinh mua bán, gợi ý số tiền hoặc nói chứng đắc; không chép văn bản Làng Mai.
- **Hợp đồng cho C:** [README và bảng đọc duyệt 73 mục](../content/nhiem-vu/so-nhap/README.md) có ID ổn định, cờ kiểu boolean, `gioi`/`tuan` nullable, mã Ba-la-mật/Phước nghiệp và ý nghĩa `minutes`. API hiện có trả `meta` là JSON string. Claude C hiển thị ghi chú an toàn và tám giới trước chọn thẻ trai; không lấy việc nhỏ làm xác nhận đã giữ trọn giới/ngày trai. Ba phút ở thẻ trai là thời gian đọc/chọn nguyện, không chứng nhận một ngày thọ trì. Không chứa dữ liệu người dùng.
- **Bộ nạp:** đọc thư mục con dưới `content/`; kiểm cả nháp nhiệm vụ, chỉ chọn `da_duyet`. Với đợt B còn nháp, vẫn nạp đúng 42 bài giảng và **0 nhiệm vụ**. Đã đối chiếu từng hàng bài giảng với bộ nạp trước; không đổi MP3/cues/khóa. Không cần migration hoặc thay API. Kiểm D1/workerd dùng fixture cục bộ, không nạp nháp vào môi trường thật.
- **Bàn giao/merge:** một PR cho #87, báo tại #85 khi mở; đợi CI/preview đúng head. Chủ dự án đọc chọn phát hành trước đổi trạng thái, không tự gán duyệt. Đợt C cần danh mục đã chọn hoặc fixture kiểm thử; không công bố tính năng C chỉ vì đợt B có bản nháp. Agent không tự merge/tag.
