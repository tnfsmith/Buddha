# Vân Đạo — luật chung cho mọi agent (Claude · Codex · Antigravity · Hermes)

Đọc tệp này trước khi nhận việc. Lộ trình, lược đồ dữ liệu và kế hoạch theo giai đoạn ở `PROJECT_ROADMAP.md` (bản 3); hạ tầng và môi trường ở `docs/infra.md`. Khi mâu thuẫn: mục 1 dưới đây > `PROJECT_ROADMAP.md` > `van-dao-tom-tat-thiet-ke.md`.

**Bắt đầu mỗi phiên:** đọc `docs/COORDINATION.md`, rồi mục lộ trình liên quan và Issue/PR hiện tại trên GitHub; cập nhật `origin/main` trước khi nhận việc. Quyết định chủ dự án ngày 14/11/2026: **Codex đảm nhiệm làn Antigravity và Hermes; Claude tiếp tục làn riêng**. Phạm vi và tiền tố `ag/`, `hermes/`, `claude/` giữ nguyên để CI kiểm đúng làn.

## 1. Nguyên tắc bất di bất dịch

1. **Không thương mại hóa Chánh Pháp.** Doanh nghiệp xã hội hai động cơ, không bán Pháp. Mọi giao dịch (affiliate, Gieo Duyên, chiến dịch) chỉ ở khu Đại Công Đức, tách hẳn khỏi không gian tu tập; mua hàng hay gieo tiền không cộng Kusala, không huy hiệu, không xếp hạng.
2. **Không gian:**
   - Giai đoạn 0 (Sơ nhập Tịnh Cảnh, 49 ngày) và 4 tầng: Tầng 1 Nhập Lưu Tịnh Cảnh (độ cao 62–84) · Tầng 2 Nhất Lai Thanh Lương (140–165) · Tầng 3 Bất Lai Tịnh Quang (225–252) · Tầng 4 Vô Học Vô Biên (355–372, ngang tầm mắt và tai Tôn tượng; bốn cụm Vân Tọa: hai bên vai, trước mặt, sau lưng; chỉ Vân Tọa sáng, không đảo đất).
   - **Tôn tượng luôn cao hơn mọi tầng:** phóng 1,5 lần (`BS`), đài mây cao 75 (`BL`) trong `world.js` — vai ≈ 305, mắt ≈ 370, đỉnh đầu ≈ 460. Không đặt tầng nào cao hơn tầm mắt Ngài.
   - Góc nhìn Vân Đảo thấy trọn Tôn tượng (cả đầu) trên máy tính và điện thoại; nhãn tầng ở Toàn cảnh xếp bậc thang đều, không đè thân tượng.
   - Giao diện trong suốt, cảnh nền là chính.
   - Vân Đảo 6 phân khu: Tịnh Thất (Kinh Đài), Đài Thiền, Vườn Tâm Thức, Trà Đạo Tỉnh Thức (mở ngày 15), Cổng Vân Môn (nửa mở ngày 29, mở hẳn ngày 43), Bia Tích Lũy.
3. **Thời thiền 15 phút, 7 mốc:** `00:00` Quy tụ · `02:00` Niệm hơi thở mây · `05:00` Lắng dịu phóng dật · `07:00` Cận định và Thánh im lặng · `09:30` Tưởng ánh sáng · `11:00` Tâm từ toàn cõi · `13:30` Xuất thiền và Hồi hướng. Âm thanh sinh bằng Web Audio dao động liên tục, chuông về 0; không dùng tệp mp3.
4. **Tịnh danh:** 2–3 chữ, tối đa 16 ký tự; chữ cái tiếng Việt NFC; có ít nhất một chữ mang nghĩa tu tập; không tự xưng quả vị, giáo phẩm, danh hiệu tôn kính.
5. **Kusala:** `E = 10 × (trước + trong + sau)/3 × (1,5 nếu như lý tác ý) × (1,25 nếu tự giác)`, thanh trượt 0,5–1,2; khóa 1 nấc tiến trình mỗi ngày.
6. **Không bao giờ nói người dùng đã chứng đắc.** Chỉ nói "đã hoàn thành chương trình". **Nội dung có nguồn, không bắt buộc Hội đồng phê duyệt:** Vân Đạo hỗ trợ thực hành và chia sẻ tham khảo, không tổ chức thuyết pháp chính thức thay chùa hoặc tu viện. Bài giảng, tóm lược và gợi ý của AI cần nguồn rõ ràng, phân biệt lời trích với lời biên soạn; không tự nhận là lời dạy chính thức hoặc đã được Hội đồng duyệt. Hội đồng/chuyên gia là tư vấn tùy chọn, không là điều kiện hiển thị hoặc phát hành. `da_duyet` là tên trạng thái kỹ thuật cho nội dung được chọn phát hành; không bắt buộc `reviewed_by`/`reviewed_at` hay biên bản Hội đồng. Giữ bản nháp/ẩn/ngừng riêng và quy trình PR thông thường. Quyết định trực tiếp của chủ dự án ngày 14/11/2026 thay yêu cầu cũ: xem `docs/adr/0003-noi-dung-tham-khao-khong-bat-buoc-hoi-dong.md`.

Mục 3–5 nằm trong mã dùng chung `packages/shared` (`schedule.js`, `tinh-danh.js`, `kusala.js`) và có kiểm thử: muốn đổi phải có quyết định của chủ dự án.

## 2. Repo và lệnh chuẩn (Node.js 26 LTS, npm workspaces)

```
apps/web/            client 3D (Three.js + Web Audio), build.mjs → dist/van-dao.html, public/index.html
workers/api/         Worker duy nhất: API Hono + D1, phục vụ apps/web/public (ADR docs/adr/0001)
db/migrations/       migration D1 (chỉ thêm, đánh số NNNN_)
packages/shared/     luật dùng chung client/máy chủ + kiểm thử Vitest
scripts/             lane-guard, size-budget, check-migrations, hooks/pre-push
tests/e2e/           kiểm khói Playwright (WebGL SwiftShader)
.github/             lanes.yml, workflows ci · preview · deploy
docs/                infra.md, ADR, runbook; docs/reports/ của Hermes
```

| Việc | Lệnh (ở thư mục gốc) |
|---|---|
| Cài | `npm ci` |
| Dựng | `npm run build` |
| Lint · kiểm thử | `npm run lint` · `npm test` |
| Ngân sách kích thước | `npm run size` |
| Kiểm khói | `npm run e2e:smoke` (đặt `E2E_BASE_URL` để kiểm bản đã deploy) |
| Âm thanh/ảnh chụp chi tiết | `cd apps/web && node shot.mjs live` |

Mỗi bản clone cài hook một lần: `git config core.hooksPath scripts/hooks` (chặn đẩy thẳng `main`).

## 3. Làn, nhánh, nhãn

| Làn | Agent | Tiền tố nhánh | Sở hữu chính |
|---|---|---|---|
| 3D, trải nghiệm, realtime | Claude | `claude/` | `apps/web/src/{world,island,people,realm,birds,gfx,audio,music,sermon}.js`, `apps/web/src/rt/`, `cong-duc/`, `workers/realtime/`, `tests/e2e/` |
| API, auth, dữ liệu, hạ tầng, Android | Antigravity | `ag/` | `workers/api/`, `db/`, `apps/web/src/net/`, `apps/android/`, `.github/`, `scripts/` |
| Vận hành, danh mục, giám sát, nội dung | Hermes | `hermes/` | `content/` (biên soạn có nguồn, trạng thái phát hành theo Issue/PR), `ops/`, `docs/reports/` |
| Việc chủ dự án giao | chủ dự án | `owner/` | mọi nơi (vẫn qua PR) |
| Vá khẩn | bất kỳ | `hotfix/` | làn Claude + Antigravity + dùng chung |

- Danh sách đầy đủ ở `.github/lanes.yml`; CI `lane-guard` đánh đỏ PR sửa tệp ngoài làn.
- **Vùng dùng chung** (`packages/shared/`, `apps/web/src/{main,state,data}.js`, `ui/`, `package.json`, `AGENTS.md`, `CLAUDE.md`, `PROJECT_ROADMAP.md`, `docs/`…) chỉ sửa khi PR có nhãn `shared-ok`, và mỗi lúc chỉ một agent.
- **Migration D1:** chỉ Antigravity tạo tệp mới `db/migrations/NNNN_ten.sql`; không ai sửa, xóa, đổi tên migration đã merge.
- Mỗi việc = một Issue có nhãn `lane:*` + `gdN`; nhận việc bằng `status:claimed`. Nhánh `<tiền tố><số-issue>-<mô-tả>`.
- **Phối hợp Codex–Claude:** `docs/COORDINATION.md` là bản bàn giao chung, **Codex là người cập nhật duy nhất**; Claude ghi bàn giao/đề nghị khóa tệp trong Issue/PR, Codex tổng hợp. GitHub Issues/PR vẫn là nguồn nhận việc và trạng thái hiện hành. Đây là ngoại lệ chủ dự án yêu cầu cho quy định không dùng bảng việc trong repo (§14.1).
- Trước khi sửa vùng dùng chung, Issue phải ghi **một người giữ, danh sách tệp, phạm vi và điều kiện trả quyền sửa**; PR có `shared-ok`. Không tự hết quyền theo thời gian; phải có bàn giao rõ trong Issue. Không sửa tệp đang do agent khác giữ.
- Mỗi tác vụ có worktree/checkout riêng; không đổi nhánh, rebase hay ghi đè thư mục làm việc của agent khác. Hợp đồng API/codec dùng chung được duyệt và merge trước khi hai phía triển khai.
- Trước khi đề nghị merge: fetch/rebase `main` mới nhất, kiểm xung đột với PR phụ thuộc, chạy lại lint/test/build/size/migrations/e2e trên kết quả tích hợp. Khi `main` hoặc hợp đồng đổi, kết quả cũ không thay cho kiểm tra lại. Không cam kết hết lỗi chỉ vì Git không báo conflict.

## 4. Từ nhánh đến production

1. Không ai đẩy thẳng lên `main`. Mở PR; PR < ~400 dòng (không tính tệp sinh); rebase lên `main` trước khi mở.
2. CI (`ci.yml`) phải xanh: lane-guard → lint → Vitest → build → size → migrations → Playwright.
3. `preview.yml` tạo link preview `pr-N` trên tài khoản Cloudflare staging và bình luận vào PR.
4. Chủ dự án merge → `deploy.yml` tự deploy **staging** (`vandao-staging.vandao-staging.workers.dev`) và kiểm khói.
5. **Production chỉ khi chủ dự án gắn tag `vX.Y.Z`** → chạy lại toàn bộ CI → deploy `vandao.ainextbrain.com` → kiểm khói → GitHub Release kèm bản HTML đơn. Agent không tự tạo tag, không tự merge.

**Định nghĩa Xong (DoD):** CI xanh · có kiểm thử cho logic mới · bản HTML đơn không tăng quá 3 % nếu không giải thích · không phá mục 1 · đã mở thử preview trên điện thoại · cập nhật tài liệu liên quan · commit có dòng ghi công của agent.

## 5. Bí mật và dữ liệu

- Không commit token, khóa, `.env`, `.dev.vars`. Secrets GitHub: `CF_STAGING_API_TOKEN/ACCOUNT_ID`, `CF_PROD_API_TOKEN/ACCOUNT_ID` (repo private gói Free không có GitHub Environments). Chỉ job production dùng `CF_PROD_*`.
- Token mỗi agent quyền tối thiểu; Hermes chỉ đọc số liệu.
- Không ghi email, nhật ký quán chiếu hay dữ liệu cá nhân vào log/Analytics. Luật BVDLCN 91/2025 áp dụng.

## 6. Đừng làm

- Đổi sang framework nặng (React, Vue, Next.js…) khi chưa có yêu cầu rõ.
- Không nhúng tệp âm thanh lớn vào bản HTML/client. **Ngoại lệ chủ dự án giao (#33/#49, cập nhật lần 2 ngày 14/11/2026): giọng đọc bài giảng sinh trước bằng TTS, lưu trên R2, tải theo yêu cầu; thời thiền vẫn chỉ dùng Web Audio** (`audio.js`, `music.js`). Một giọng chung cho mọi loạt; nhà cung cấp hiện hành là Google Chirp 3: HD vi-VN nam theo điều chỉnh trực tiếp của chủ dự án.
- Đổi tỉ lệ 7 mốc thời thiền, công thức Kusala, 4 quy tắc Tịnh danh.
- Đặt quảng cáo hay sản phẩm vào Kinh Đài, Tịnh Thất, Đài Thiền, Đại Thiền Đường hay thời thiền.
- Trộn logic máy chủ vào vòng lặp render Three.js.
