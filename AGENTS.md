# Vân Đạo — luật chung cho mọi agent (Claude · Antigravity · Hermes)

Đọc tệp này trước khi nhận việc. Lộ trình, lược đồ dữ liệu và kế hoạch theo giai đoạn ở `PROJECT_ROADMAP.md` (bản 3); hạ tầng và môi trường ở `docs/infra.md`. Khi mâu thuẫn: mục 1 dưới đây > `PROJECT_ROADMAP.md` > `van-dao-tom-tat-thiet-ke.md`.

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
6. **Không bao giờ nói người dùng đã chứng đắc.** Chỉ nói "đã hoàn thành chương trình". Nội dung giáo lý chỉ hiển thị khi đã được Hội đồng cố vấn Pháp học duyệt (`da_duyet`); AI không tự trả lời giáo lý ngoài nội dung đã duyệt.

Mục 3–5 nằm trong mã dùng chung `packages/shared` (`schedule.js`, `tinh-danh.js`, `kusala.js`) và có kiểm thử: muốn đổi phải có quyết định của chủ dự án.

## 2. Repo và lệnh chuẩn (Node.js 26 LTS, npm workspaces)

```
apps/web/            client 3D (Three.js + Web Audio), build.mjs → dist/van-dao.html, public/index.html
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
| API, auth, dữ liệu, hạ tầng, Android | Antigravity | `ag/` | `workers/api/`, `db/`, `apps/web/src/net/`, `apps/android/`, `.github/`, `scripts/`, `apps/web/{wrangler.jsonc,worker.js}` |
| Vận hành, danh mục, giám sát, nháp nội dung | Hermes | `hermes/` | `content/` (chỉ nháp `cho_duyet`), `ops/`, `docs/reports/` |
| Việc chủ dự án giao | chủ dự án | `owner/` | mọi nơi (vẫn qua PR) |
| Vá khẩn | bất kỳ | `hotfix/` | làn Claude + Antigravity + dùng chung |

- Danh sách đầy đủ ở `.github/lanes.yml`; CI `lane-guard` đánh đỏ PR sửa tệp ngoài làn.
- **Vùng dùng chung** (`packages/shared/`, `apps/web/src/{main,state,data}.js`, `ui/`, `package.json`, `AGENTS.md`, `CLAUDE.md`, `PROJECT_ROADMAP.md`, `docs/`…) chỉ sửa khi PR có nhãn `shared-ok`, và mỗi lúc chỉ một agent.
- **Migration D1:** chỉ Antigravity tạo tệp mới `db/migrations/NNNN_ten.sql`; không ai sửa, xóa, đổi tên migration đã merge.
- Mỗi việc = một Issue có nhãn `lane:*` + `gdN`; nhận việc bằng `status:claimed`. Nhánh `<tiền tố><số-issue>-<mô-tả>`.

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
- Nhúng tệp âm thanh lớn; mọi âm thanh sinh bằng `audio.js`, `music.js`.
- Đổi tỉ lệ 7 mốc thời thiền, công thức Kusala, 4 quy tắc Tịnh danh.
- Đặt quảng cáo hay sản phẩm vào Kinh Đài, Tịnh Thất, Đài Thiền, Đại Thiền Đường hay thời thiền.
- Trộn logic máy chủ vào vòng lặp render Three.js.
