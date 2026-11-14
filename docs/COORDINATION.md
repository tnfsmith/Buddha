# Vân Đạo — phối hợp Codex và Claude

Ngày cập nhật: 14/11/2026. Người tổng hợp duy nhất: **Codex**. Quyết định chủ dự án: Codex nhận việc Antigravity + Hermes; Claude tiếp tục độc lập phần của Claude.

Đọc tệp này khi bắt đầu phiên; sau đó kiểm Issue/PR và `origin/main` hiện tại. Tệp là bản bàn giao có thời điểm, không thay bảng việc GitHub. Claude gửi cập nhật trong Issue/PR; Codex tổng hợp để tránh hai agent cùng sửa tệp này.

## 1. Mốc đã xác minh

- Repo: `tnfsmith/Buddha`. `main` sau đợt Claude merge ngày 14/11: `9b7264e` (PR #30, #31, #32, #41 đã vào main). Không dùng lại kết quả trên `20d73dc` để kết luận cây mã hiện tại đã đạt.
- Production đã phát hành `v0.14.0`; [deploy 43536527634](https://github.com/tnfsmith/Buddha/actions/runs/43536527634) thành công. 100 kiểm thử logic đạt; Playwright 12 đạt, 2 bỏ qua. Hai ca Worker thật trong `account.spec.js` chưa chạy ở CI này.
- Phần lớn mã GĐ0–2 đã có; chưa đánh dấu mọi tiêu chí nghiệm thu đã đạt. GĐ3–9 còn nhiều việc và điều kiện của chủ dự án.
- [PR #24](https://github.com/tnfsmith/Buddha/pull/24) + [#25](https://github.com/tnfsmith/Buddha/pull/25) đã merge: mạng/API và UI giữ/khôi phục hành trình. Một số phần làn Antigravity do Claude làm thay trước quyết định phân công mới; xem bàn giao [#11](https://github.com/tnfsmith/Buddha/issues/11) và [#12](https://github.com/tnfsmith/Buddha/issues/12).

## 2. Phân công hiện hành

| Phần | Người thực hiện | Phạm vi |
|---|---|---|
| Antigravity [AG] | Codex | `workers/api/`, migration D1 mới, `apps/web/src/net/`, `.github/`, `scripts/`, `apps/android/` |
| Hermes [H] | Codex | `ops/`, `docs/reports/`, nội dung nháp `content/` chỉ `cho_duyet`; giám sát, kiểm tải staging, báo cáo |
| Claude [C] | Claude | 3D/âm thanh/trải nghiệm; `workers/realtime/`, client realtime; UI và phần dùng chung khi Issue giao; `tests/e2e/` |
| Nội dung duyệt, pháp nhân, tài khoản dịch vụ, ký/phát hành | Chủ dự án + Hội đồng | Agent không tự duyệt Pháp học, merge hoặc tạo tag production |
| Vùng dùng chung | Một người được Issue giao | `packages/shared/`, main/state/data/boot, UI, build/deps/lockfile, tài liệu chung; cần PR `shared-ok` |

Tên làn CI không đổi. Codex dùng `ag/<issue>-...` hoặc `hermes/<issue>-...`; tác vụ điều phối do chủ dự án giao dùng `owner/<issue>-...`. Không dùng quyền của một làn để sửa chéo PR khác.

## 3. Việc đang giữ và ranh giới

| Người | Issue | Phạm vi nhận | Trạng thái tại lần cập nhật |
|---|---|---|---|
| Codex | [#33](https://github.com/tnfsmith/Buddha/issues/33) | `AGENTS.md`, `CLAUDE.md`, `PROJECT_ROADMAP.md`, tệp này | Đang cập nhật phân công và bàn giao; chỉ Codex sửa các tệp này trong tác vụ |
| Codex [AG] | [#34](https://github.com/tnfsmith/Buddha/issues/34), [PR #37](https://github.com/tnfsmith/Buddha/pull/37) | `ci.yml`, `deploy.yml`, runner trong `scripts/` | Mã `ce9b18f`, base nhánh #44; diff riêng vẫn chỉ CI/scripts. Xem CI của đúng SHA ở PR |
| Codex [H] | [#13](https://github.com/tnfsmith/Buddha/issues/13), [PR #38](https://github.com/tnfsmith/Buddha/pull/38) | `ops/hermes/` | Mã `9ac3cd4`, base nhánh #37 để CI tự chạy cả kiểm thử Hermes. T2.4 còn thiếu nguồn và nghiệm thu chạy thật |
| Codex, ngoại lệ chủ dự án giao | [#43](https://github.com/tnfsmith/Buddha/issues/43), [PR #44](https://github.com/tnfsmith/Buddha/pull/44) | Một assertion ở `tests/e2e/vandu.spec.js` | Mã `4c726a6`; chủ dự án giao Codex sửa riêng test này ngày 14/11. Không đổi app/timeout; Claude giữ các phần test còn lại |
| Claude | [#26](https://github.com/tnfsmith/Buddha/issues/26), [PR #30](https://github.com/tnfsmith/Buddha/pull/30) | `ui/account.js`, `tests/e2e/account.spec.js` | Đã merge 15:03 ngày 14/11; test account dùng câu trạng thái mới của Claude |
| Claude | [#27](https://github.com/tnfsmith/Buddha/issues/27), [PR #31](https://github.com/tnfsmith/Buddha/pull/31) | `main.js`, `world.js`, template, kiểm di chuyển | Đã merge 15:04 ngày 14/11 |
| Claude | [#28](https://github.com/tnfsmith/Buddha/issues/28), [PR #32](https://github.com/tnfsmith/Buddha/pull/32) | `main.js`, `state.js`, `music.js`, template, kiểm âm nhạc | Đã merge 15:22 ngày 14/11 |
| Claude | [#29](https://github.com/tnfsmith/Buddha/issues/29), [PR #41](https://github.com/tnfsmith/Buddha/pull/41) | Vân Du; `main.js`, `state.js`, `world.js`, template, test | Đã merge 15:51 ngày 14/11; Codex nhận ghi chú kiểm cảnh vào `CLAUDE.md` theo bàn giao #33 |
| Claude | [#40](https://github.com/tnfsmith/Buddha/issues/40), [PR #42](https://github.com/tnfsmith/Buddha/pull/42) | `tests/e2e/serve.mjs` | Đang mở; Codex chỉ gộp thử để kiểm Windows, không sửa hoặc đẩy vào nhánh Claude |

Quyền sửa chỉ trả khi người đang giữ ghi bàn giao trong Issue/PR. Không tự hết hạn, không suy ra rảnh vì agent không phản hồi. Bảng này có thể cũ: kiểm GitHub trước khi sửa. Mỗi tác vụ dùng checkout/worktree riêng, không thay nhánh hay rebase thư mục của nhau. Riêng assertion đồng hồ Vân Du được chủ dự án giao Codex ở #43; không tự mở rộng ngoại lệ sang mã ứng dụng hoặc các file test khác.

## 4. Trình tự tiếp theo theo lộ trình

1. Khép GĐ2: chạy đầy đủ account E2E với Worker/D1 cục bộ; kiểm khôi phục, QR, passkey và cả hai lựa chọn xung đột. CI phải ghi rõ số ca chạy/bỏ qua. Claude giữ test/UI; Codex giữ runner/hạ tầng và API.
2. [#35](https://github.com/tnfsmith/Buddha/issues/35): tách dữ liệu preview khỏi staging trước PR có migration mới. Hiện preview upload bằng `--env staging`, binding D1 vẫn là staging; không thử ghi schema mới vào staging để chữa preview. Việc này chưa nhận sửa ở snapshot đầu.
3. T0.7/T1.4/T2.4: hoàn thiện công cụ, cấu hình token chỉ đọc trên homelab, đối chiếu dashboard, đủ 3 báo cáo sáng liên tiếp và đo 3 máy thật. Kiểm fixture không thay các tiêu chí chạy thật; không tạo số liệu giả.
4. Trước GĐ3: Issue riêng chốt hợp đồng API/fixture/selector biến thể với `shared-ok`. Merge hợp đồng trước, rồi Codex làm API/net, Claude làm UI và `ReminderClock`. Không tự tạo nội dung `da_duyet`.
5. Sau điều kiện phụ thuộc: GĐ3 ∥ GĐ4 ∥ GĐ8; GĐ5 ∥ GĐ7; GĐ6 khi có hồ sơ pháp lý; GĐ9 nghiệm thu ra mắt. Không tính toàn bộ giai đoạn xong từ sự tồn tại của bảng DB.

| Mốc | Codex | Claude | Phụ thuộc/bàn giao |
|---|---|---|---|
| T3.1–4 | Nháp `cho_duyet`, API practice/deeds/attest/reminders/push, migration, điều kiện tầng | Biến thể/UI, Bia Tích Lũy, chứng thực tuần, ReminderClock DO | Hợp đồng và selector tất định trước; Hội đồng duyệt câu chữ |
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
- Chủ dự án merge sau CI/preview và kiểm điện thoại. Thứ tự hiện tại: **#44 (sửa test) → #36 (điều phối) → #37 (CI) → #38 (Hermes)**. #36/#37 base nhánh #44; #38 base nhánh #37 để CI mới chạy 21 kiểm thử Hermes. Sau khi parent merge, chuyển base về main, cập nhật/kiểm lại nếu cây mã thay đổi. #42 của Claude độc lập về file, đã được kiểm chung. Merge từng PR, chờ staging của đúng SHA đạt trước PR phụ thuộc; giữ deploy tuần tự. Agent không tự merge/tag.
- Production chỉ khi chủ dự án tạo tag; chạy lại toàn bộ CI trên đúng SHA rồi mới migration/deploy. Kiểm khói sau deploy; lỗi thì thực hiện runbook, không sửa/xóa migration đã merge.

## 6. Ghi nhận bằng chứng và điều kiện ngoài mã

Mỗi bàn giao ghi: Issue/PR, SHA/base, tệp đã đổi, hợp đồng ảnh hưởng, kiểm tra đã chạy/kết quả, điều kiện chưa đạt và người nhận. Phân biệt **đã có mã / kiểm cục bộ đạt / CI đạt / staging đạt / production đã phát hành**.

- Hermes: chủ dự án đã chọn **Telegram** trong phiên 14/11; đích chat, máy homelab và chứng thực hoàn chỉnh sau. Còn cần token Cloudflare/GitHub chỉ đọc; không dùng token deploy làm token giám sát, không ghi bí mật hay dữ liệu cá nhân vào báo cáo. Chưa tạo lịch hay gửi tin thật.
- Pháp học: UI thuyết giảng hiện lấy `SUTTAS` trực tiếp, chưa chặn theo `da_duyet`; đã bàn giao Claude ở [#39](https://github.com/tnfsmith/Buddha/issues/39). Codex không sửa UI đang được Claude giữ.
- Kiểm thử Windows: Claude đã mở [PR #42](https://github.com/tnfsmith/Buddha/pull/42) cho lỗi đường dẫn ở [#40](https://github.com/tnfsmith/Buddha/issues/40). Cây kiểm mới dùng đúng bản vá này; server tạm chỉ thuộc bằng chứng phiên cũ, không đưa vào mã dự án.
- Quyền riêng tư: bảng consent đã có nhưng chưa thấy luồng đồng ý có phiên bản; cần tác vụ API/UI phối hợp và chính sách do chủ dự án duyệt trước mở rộng đăng ký.
- Chưa có nghiệm thu máy thật, hồ sơ pháp nhân/affiliate/Play, nội dung Hội đồng duyệt thì ghi **chờ điều kiện**, không tự đánh dấu hoàn thành.

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
