# Vân Đạo — phối hợp Codex và Claude

Ngày cập nhật: 14/11/2026. Người tổng hợp duy nhất: **Codex**. Quyết định chủ dự án: Codex nhận việc Antigravity + Hermes; Claude tiếp tục độc lập phần của Claude.

Đọc tệp này khi bắt đầu phiên; sau đó kiểm Issue/PR và `origin/main` hiện tại. Tệp là bản bàn giao có thời điểm, không thay bảng việc GitHub. Claude gửi cập nhật trong Issue/PR; Codex tổng hợp để tránh hai agent cùng sửa tệp này.

## 1. Mốc đã xác minh

- Repo: `tnfsmith/Buddha`. `main` tại lần kiểm: `20d73dcecd3c0100ae73a39c8b4f47b666a213dc`.
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
| Codex [AG] | [#34](https://github.com/tnfsmith/Buddha/issues/34) | `ci.yml`, `deploy.yml`, runner trong `scripts/` | Nhận gia cố kiểm tài khoản Worker thật và cửa kiểm staging; không sửa test/UI của Claude |
| Codex [H] | [#13](https://github.com/tnfsmith/Buddha/issues/13) | `ops/hermes/` | Nhận hoàn thiện báo cáo hạn mức, lỗi thu thập và kiểm thử; chưa nghiệm thu chạy thật |
| Claude | [#26](https://github.com/tnfsmith/Buddha/issues/26), [PR #30](https://github.com/tnfsmith/Buddha/pull/30) | `ui/account.js`, `tests/e2e/account.spec.js` | Đang mở; Codex không sửa các tệp này |
| Claude | [#27](https://github.com/tnfsmith/Buddha/issues/27), [PR #31](https://github.com/tnfsmith/Buddha/pull/31) | `main.js`, `world.js`, template, kiểm di chuyển | Đang mở; base `main` |
| Claude | [#28](https://github.com/tnfsmith/Buddha/issues/28), [PR #32](https://github.com/tnfsmith/Buddha/pull/32) | `main.js`, `state.js`, `music.js`, template, kiểm âm nhạc | Đang mở; base nhánh PR #31, merge #31 trước rồi cập nhật base #32 |
| Claude | [#29](https://github.com/tnfsmith/Buddha/issues/29) | Vân Du khi tọa thiền | Đã có `status:claimed`; Codex không nhận thay |

Quyền sửa chỉ trả khi người đang giữ ghi bàn giao trong Issue/PR. Không tự hết hạn, không suy ra rảnh vì agent không phản hồi. Bảng này có thể cũ: kiểm GitHub trước khi sửa. Mỗi tác vụ dùng checkout/worktree riêng, không thay nhánh hay rebase thư mục của nhau.

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
- PR Claude #32 đang xếp sau #31: không merge #32 trước #31 hoặc coi CI chỉ trên #32 là kiểm độc lập với main. #30 độc lập về file nhưng phải chạy cùng account Worker thật.
- Chủ dự án merge sau CI/preview và kiểm điện thoại. Merge từng PR, chờ staging của đúng SHA đạt trước PR phụ thuộc; giữ deploy tuần tự. Agent không tự merge/tag.
- Production chỉ khi chủ dự án tạo tag; chạy lại toàn bộ CI trên đúng SHA rồi mới migration/deploy. Kiểm khói sau deploy; lỗi thì thực hiện runbook, không sửa/xóa migration đã merge.

## 6. Ghi nhận bằng chứng và điều kiện ngoài mã

Mỗi bàn giao ghi: Issue/PR, SHA/base, tệp đã đổi, hợp đồng ảnh hưởng, kiểm tra đã chạy/kết quả, điều kiện chưa đạt và người nhận. Phân biệt **đã có mã / kiểm cục bộ đạt / CI đạt / staging đạt / production đã phát hành**.

- Hermes: còn cần token Cloudflare chỉ đọc, GitHub chỉ đọc, máy homelab/kênh nhận được xác nhận. Không dùng token deploy làm token giám sát. Không ghi bí mật hay dữ liệu cá nhân vào báo cáo.
- Pháp học: UI thuyết giảng hiện lấy `SUTTAS` trực tiếp, chưa chặn theo `da_duyet`; giao Claude xử lý trong Issue riêng sau khi chốt nguồn nội dung duyệt. Codex không sửa UI đang được Claude giữ.
- Quyền riêng tư: bảng consent đã có nhưng chưa thấy luồng đồng ý có phiên bản; cần tác vụ API/UI phối hợp và chính sách do chủ dự án duyệt trước mở rộng đăng ký.
- Chưa có nghiệm thu máy thật, hồ sơ pháp nhân/affiliate/Play, nội dung Hội đồng duyệt thì ghi **chờ điều kiện**, không tự đánh dấu hoàn thành.
