# HƯỚNG DẪN DỰ ÁN VÂN ĐẠO CHO CLAUDE & AI AGENTS

> **Quan trọng cho Claude Code / Claude Projects / Các AI Agents:**
> File này chứa toàn bộ bối cảnh kiến trúc, quy tắc bất di bất dịch, cấu trúc mã nguồn và lộ trình kỹ thuật của dự án **Vân Đạo**. Mọi agent tiếp nhận công việc **bắt buộc phải đọc kỹ và tuân thủ tuyệt đối**, không làm xáo trộn code, không phá vỡ triết lý và không làm sai lệch định hướng tu tập.

---

## 1. TỔNG QUAN DỰ ÁN & ĐỊNH HƯỚNG CỐT LÕI

* **Tên dự án:** Vân Đạo (Không gian 3D tu tập, thiền tọa và học kinh Phật giáo).
* **Nguồn gốc tài liệu gốc:** File `chuong trinh thien-1.pdf` (47 trang) và `van-dao-tom-tat-thiet-ke.md`.
* **Trạng thái hiện tại:**
  * Client: Single-player 3D WebGL (Three.js) + Âm thanh sinh trực tiếp (Web Audio API) đóng gói trong 1 file HTML độc lập (`dist/van-dao.html` hoặc `van-dao.html` ~983KB).
  * Hosting & Edge: Triển khai trên **Cloudflare Workers** (Custom domain `vandao.ainextbrain.com`).
  * Trạng thái roadmap: **Đang hoàn thiện Bước 1 (CI/CD GitHub -> Cloudflare)**.

### Các nguyên tắc bất di bất dịch (Core Invariants):
1. **Không thương mại hóa Chánh Pháp:** Hệ thống hướng đến doanh nghiệp xã hội hai động cơ, không bán Pháp.
2. **Cấu trúc không gian:**
   * **Giai đoạn 0 (Sơ nhập Tịnh Cảnh - chuỗi 49 ngày)** cùng **4 tầng cõi**:
     * Tầng 1: Nhập Lưu Tịnh Cảnh (độ cao 62–84)
     * Tầng 2: Nhất Lai Thanh Lương (độ cao 140–165)
     * Tầng 3: Bất Lai Tịnh Quang (độ cao 225–252)
     * Tầng 4: Vô Học Vô Biên (độ cao 368–404, chỉ có Vân Tọa sáng không còn đảo đất).
   * **Vân Đảo 6 phân khu:** Tịnh Thất (có Kinh Đài), Đài Thiền, Vườn Tâm Thức (Hồ Sen + Cây Bồ-đề), Trà Đạo Tỉnh Thức (mở ngày 15), Cổng Vân Môn (mở nửa ngày 29, mở hẳn ngày 43), Bia Tích Lũy.
   * **Đại Thiền Đường:** Trung tâm với Tôn tượng, hào quang, các hàng Vân Tọa quây quần.
3. **Thời thiền 15 phút (7 mốc chuẩn hóa):**
   * `00:00` Quy tụ · `02:00` Niệm hơi thở mây · `05:00` Lắng dịu phóng dật · `07:00` Cận định và Thánh im lặng · `09:30` Tưởng ánh sáng · `11:00` Tâm từ toàn cõi · `13:30` Xuất thiền và Hồi hướng.
   * Âm thanh sinh bằng Web Audio dao động liên tục (`AudioParam`), chuông hồi về 0 chuẩn mực, tuyệt đối không dùng file mp3 chắp vá để tránh tiếng gián đoạn (glitch/pop).
4. **4 Quy tắc Tịnh danh:**
   * 2 đến 3 chữ, tối đa 16 ký tự.
   * Chỉ dùng chữ cái tiếng Việt chuẩn (NFC).
   * Có ít nhất một chữ mang nghĩa tu tập thiện lành.
   * Tuyệt đối không tự xưng quả vị (Tu-đà-hoàn, A-la-hán...), giáo phẩm hoặc danh hiệu tôn kính.
5. **Công thức tích lũy Kusala (3 trục Đức - Thiện - Tuệ):**
   * $E = 10 \times \frac{\text{trước} + \text{trong} + \text{sau}}{3} \times (1{,}5 \text{ nếu như lý tác ý}) \times (1{,}25 \text{ nếu tự giác})$.
   * Khóa 1 nấc tiến trình mỗi ngày (ngăn chặn gian lận nhảy ngày).

---

## 2. CẤU TRÚC THƯ MỤC & PHÂN VAI CÁC FILE

Mã nguồn chính nằm trong thư mục `van-dao-src/`:

```
Buddha/ (Root Workspace & Git Repo)
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD tự động build & deploy lên Cloudflare
├── .gitignore                      # Loại trừ node_modules, dist, logs, env
├── CLAUDE.md                       # File chỉ dẫn này (Dành cho Claude & AI Agents)
├── PROJECT_ROADMAP.md              # Kế hoạch chi tiết 3 bước và kiến trúc kỹ thuật
├── van-dao-tom-tat-thiet-ke.md     # Bản tóm tắt thiết kế 6 khối (cập nhật bản 6)
├── van-dao.html                    # Bản build phân phối độc lập offline
├── package.json                    # Workspace root scripts chuyển tiếp
└── van-dao-src/                    # Mã nguồn lõi ứng dụng
    ├── package.json                # Dependencies: three, esbuild, @fontsource/...
    ├── build.mjs                   # Trình đóng gói esbuild + nhúng font WOFF2 NFC
    ├── shot.mjs                    # Kiểm thử Chrome headless (âm thanh & render)
    ├── DEPLOY.md                   # Hướng dẫn deploy Cloudflare Workers
    ├── README.md                   # Hướng dẫn phát triển
    ├── wrangler.jsonc              # Cấu hình Cloudflare Workers Static Assets
    ├── worker.js                   # Worker fetch handler chuyển tiếp ASSETS
    └── src/
        ├── index.template.html     # Khung HTML gốc, CSS bố cục và nhúng font
        ├── main.js                 # UI, tạo nhân vật, bảng 49 ngày, vòng lặp game, state
        ├── data.js                 # Dữ liệu kịch bản 15p, 49 ngày, 6 phân khu, Kusala
        ├── world.js                # Cảnh 3D tổng, trời, biển mây, Tôn tượng, camera
        ├── island.js               # Địa hình đảo, Tịnh Thất, hồ sen, thác nước, cây lá
        ├── people.js               # Dựng nhân vật người tu, cử động, InstancedMesh đám đông
        ├── audio.js                # Bộ tổng hợp Web Audio thời thiền, HRTF 3D, chuông
        ├── music.js                # 7 khúc Vân Nhạc nền procedural (sinh theo thuật toán)
        ├── realm.js                # Cõi mở rộng: 300 đảo xa, 15 bảo tháp, 4 đàn hạc
        ├── sermon.js               # 7 bài thuyết giảng tóm lược kinh Nikāya
        ├── birds.js                # Đàn chim nhỏ bay lượn, đậu và hót
        └── gfx.js                  # Họa tiết vẽ bằng mã (mây, lá, cỏ, hoa văn)
```

---

## 3. CÁC LỆNH CHUẨN (STANDARD COMMANDS)

Thao tác tại thư mục gốc workspace hoặc trong `van-dao-src/`:

```bash
# 1. Cài đặt dependencies (yêu cầu Node.js >= 20):
cd van-dao-src && npm install

# 2. Dựng bản web đơn (tạo ra dist/van-dao.html):
npm run build
# hoặc: cd van-dao-src && node build.mjs

# 3. Kiểm thử tự động (âm thanh không tạch, không lỗi render):
npm run test:shot
# hoặc: cd van-dao-src && node shot.mjs live

# 4. Triển khai cục bộ lên Cloudflare Workers (yêu cầu đăng nhập wrangler):
npm run deploy
# hoặc: cd van-dao-src && npx wrangler deploy
```

---

## 4. LỘ TRÌNH 3 BƯỚC CHO CÁC BƯỚC TIẾP THEO

### Bước 1 (HIỆN TẠI): Chuẩn hóa Repo, GitHub & Cloudflare CI/CD
* Quản lý toàn bộ source code trên GitHub.
* Thiết lập GitHub Actions (`.github/workflows/deploy.yml`): Khi push vào `main`, tự động build và deploy lên `vandao.ainextbrain.com`.
* Không làm thay đổi code logic bên trong `src/`.

### Bước 2: Quản lý Người dùng (Auth) & Cơ sở dữ liệu Cloudflare D1
* **Mục tiêu:** Không còn lưu đơn độc trong `localStorage`. Cho phép hành giả đồng bộ tiến trình 49 ngày, diện mạo và Tịnh danh giữa điện thoại và máy tính.
* **Cơ sở dữ liệu:** Dùng **Cloudflare D1** (Serverless SQLite at edge).
  * Bảng `users`: id, email, tinh_danh, look_config, created_at.
  * Bảng `journey_progress`: user_id, current_day, unlocked_zones, last_completed_at.
  * Bảng `kusala_records`: user_id, day, duc, thien, thue, score, note.
* **Xác thực:** Dùng Email OTP hoặc Better-Auth / Supabase Auth không cần mật khẩu.
* **Quy tắc:** Vẫn giữ cơ chế Offline-First (nếu mất mạng vẫn thiền và ghi nhận cục bộ, có mạng sẽ tự sync lên D1).

### Bước 3: Nhiều người cùng tham gia thời gian thực (Multiplayer Real-time)
* **Mục tiêu:** Đồng tu thấy nhau trong Đại Thiền Đường và trên Vân Đảo.
* **Công nghệ:** Dùng **Cloudflare Durable Objects** hoặc **PartyKit** (WebSockets phân tán toàn cầu theo từng phòng).
* **Tối ưu mạng (Khung 16 byte):**
  * Không truyền chuỗi JSON to kềnh. Sử dụng `ArrayBuffer` đúng 16 byte:
    * ID người (2 byte) + Tọa độ X, Y, Z (3 x 4 byte float hoặc 2 byte int) + Trạng thái: ngồi, chắp tay, đảnh lễ (2 byte).
* **Tối ưu render client:** Tận dụng `InstancedMesh` trong `people.js` để render hàng trăm người mà không tụt FPS trên điện thoại.

---

## 5. ĐIỀU RĂN DÀNH CHO CÁC AGENTS (DO'S & DON'TS)

* ⛔ **KHÔNG ĐƯỢC:**
  * Tự ý chuyển đổi dự án sang các framework nặng nề (Next.js, React, Angular, Vue) nếu không có yêu cầu rõ ràng. Sức mạnh hiện tại của Vân Đạo là **tốc độ tải tức thì, zero-bundle bloat, chạy trơn tru trên mọi trình duyệt**.
  * Chèn các file âm thanh mp3 nặng hàng chục MB vào source code hoặc nhúng trực tiếp làm phình to file HTML. Mọi âm thanh hiện tại là sinh trực tiếp bằng thuật toán (`audio.js`, `music.js`).
  * Làm sai lệch tỷ lệ các mốc thời thiền 15 phút và công thức tính điểm Kusala.
*  **NÊN:**
  * Giữ nguyên cấu trúc module hóa gọn gàng trong `van-dao-src/src/`.
  * Chạy `node build.mjs` kiểm tra độ lớn file và syntax sau mỗi lần sửa đổi code.
  * Khi mở rộng tính năng mới ở Bước 2 & Bước 3, viết các module API tách biệt trong thư mục worker/backend, không chèn lẫn logic server vào render loop của Three.js.
