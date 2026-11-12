# KẾ HOẠCH KỸ THUẬT VÂN ĐẠO (ROADMAP CHO AGENTS TIẾP THEO)

Tài liệu này chi tiết hóa cách thức hiện thực từng bước từ đơn lẻ sang hệ thống phục vụ nhiều người tham gia, đảm bảo các AI Agent làm việc kế tiếp có bản thiết kế kỹ thuật chính xác để thi hành.

---

## BƯỚC 1: QUẢN LÝ CODE VÀ CI/CD (ĐANG THỰC HIỆN)

### 1. Mục tiêu
* Toàn bộ mã nguồn được version control bằng Git và lưu trữ trên GitHub.
* Tự động hóa hoàn toàn quy trình đóng gói và triển khai qua GitHub Actions:
  * Khi lập trình viên hoặc Claude tạo commit vào nhánh `main`, hệ thống tự build file `dist/van-dao.html` và deploy lên Cloudflare Worker `vandao` gắn domain `vandao.ainextbrain.com`.

### 2. Yêu cầu thiết lập GitHub Secrets
Để GitHub Actions có thể deploy lên Cloudflare, anh Le cần cấu hình 2 biến bảo mật trong GitHub Repo:
* Vào **GitHub Repo** > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**:
  1. `CLOUDFLARE_API_TOKEN`: Token có quyền `Edit Cloudflare Workers` và `Workers Scripts: Edit`.
  2. `CLOUDFLARE_ACCOUNT_ID`: ID tài khoản Cloudflare (lấy từ thanh bên phải trang chủ dashboard Cloudflare).

### 3. File cấu hình liên quan:
* `.github/workflows/deploy.yml`: Kịch bản GitHub Actions.
* `van-dao-src/wrangler.jsonc`: File cấu hình Cloudflare Worker Static Assets.
* `van-dao-src/worker.js`: Mã worker tiếp nhận và trả về static assets.

---

## BƯỚC 2: QUẢN LÝ NGƯỜI DÙNG (AUTH) & DATABASE CLOUDFLARE D1

### 1. Mục tiêu
* Chuyển đổi từ lưu trữ cục bộ (`localStorage`) sang lưu trữ đám mây phân tán trên **Cloudflare D1** (Serverless SQLite).
* Người dùng có thể đăng nhập trên nhiều thiết bị (điện thoại, máy tính) mà không bị mất tiến trình 49 ngày hay ngoại hình nhân vật.

### 2. Thiết kế Database Schema (D1 SQL)

```sql
-- 1. Bảng hành giả
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,               -- UUID hoặc Auth ID
    email TEXT UNIQUE NOT NULL,
    tinh_danh TEXT NOT NULL,           -- Tịnh danh hợp lệ theo 4 quy tắc
    look_data TEXT NOT NULL,           -- JSON: da, toc, voc_dang, mau_ao, vien...
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tiến trình 49 ngày (Kusala Engine)
CREATE TABLE IF NOT EXISTS journey_progress (
    user_id TEXT PRIMARY KEY,
    current_day INTEGER DEFAULT 1,     -- Ngày hiện tại (1 - 49)
    current_tier INTEGER DEFAULT 0,    -- Giai đoạn 0 hoặc Tầng 1 - 4
    unlocked_zones TEXT DEFAULT '["tinh_that","dai_thien","vuon_tam_thuc","bia_tich_luy"]',
    last_completed_date TEXT,          -- Khóa 1 nấc/ngày (YYYY-MM-DD)
    total_kusala_score REAL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Nhật ký tọa thiền và tích lũy 3 trụ
CREATE TABLE IF NOT EXISTS practice_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    day INTEGER NOT NULL,
    duc_score REAL NOT NULL,           -- Sīla
    thien_score REAL NOT NULL,         -- Dāna / Veyyāvacca
    tue_score REAL NOT NULL,           -- Bhāvanā
    e_total REAL NOT NULL,             -- Điểm công thức E
    session_minutes INTEGER DEFAULT 15,
    tinh_than TEXT,                    -- Trạng thái tâm (ghi nhận)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Bảng phân bổ Vân Tọa trong Đại Thiền Đường
CREATE TABLE IF NOT EXISTS hall_seats (
    seat_index INTEGER PRIMARY KEY,    -- 0 đến 550
    user_id TEXT UNIQUE,               -- Vân Tọa chỉ định của hành giả
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### 3. Nguyên tắc đồng bộ (Offline-First Sync)
* Khi không có kết nối internet: Trình duyệt tiếp tục lưu vào `localStorage`/`IndexedDB` để người tu không bao giờ bị gián đoạn thời thiền.
* Khi có mạng trở lại: Worker API endpoint `POST /api/sync` đối chiếu `last_completed_date` và đồng bộ lên D1.

---

## BƯỚC 3: ĐỒNG BỘ MULTIPLAYER REAL-TIME (DURABLE OBJECTS / PARTYKIT)

### 1. Mục tiêu
* Khi bước vào Đại Thiền Đường hoặc các phân khu trên Vân Đảo, hành giả sẽ nhìn thấy các đồng tu khác đang cùng hiện diện theo thời gian thực (co-presence).
* Nhìn thấy động thái: Toạ thiền, chắp tay chào, tùy hỷ công đức, đảnh lễ.

### 2. Thiết kế giao thức nhị phân siêu nhẹ (Khung 16 byte)
Để hàng trăm người cùng kết nối trên mạng di động 4G/5G mà không bị giật lag, **tuyệt đối không truyền chuỗi JSON** qua WebSocket. Sử dụng đúng khung 16 byte nhị phân (`ArrayBuffer`):

| Byte Offset | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `0 - 1` | `Uint16` | User Seat Index / Session ID |
| `2 - 5` | `Float32` | Tọa độ X trong không gian 3D |
| `6 - 9` | `Float32` | Tọa độ Y trong không gian 3D |
| `10 - 13`| `Float32` | Tọa độ Z trong không gian 3D |
| `14` | `Uint8` | Trạng thái: `0` (Đứng), `1` (Tọa thiền), `2` (Chắp tay), `3` (Đảnh lễ), `4` (Đi kinh hành) |
| `15` | `Uint8` | Hướng xoay góc (Rotation Yaw chia 256 nấc) |

### 3. Phân chia phòng (Room Isolation)
* Dùng **Cloudflare Durable Objects** tạo các phòng độc lập:
  * `room:hall`: Phòng Đại Thiền Đường (đồng bộ theo giờ tọa thiền chung).
  * `room:island:{user_id}`: Phòng Vân Đảo riêng khi có bạn đồng tu bấm "Du vân sang thăm".
* Nhờ vậy, tải xử lý được phân tán đều, không bao giờ xảy ra nghẽn mạng tập trung.
