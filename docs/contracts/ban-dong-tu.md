# Hợp đồng Bạn đồng tu · #121 (máy chủ T5.5, mạng T5.6, giao diện T5.7, 3D T5.8)

Phiên bản `DONG_TU_V = 1`. Luật dùng chung ở `packages/shared/src/dong-tu.js`:
- Máy chủ dùng: `canMeet`, `canVisitAway`, `checkMeetPayload`, `normInviteCode`, `makeInviteCode`, `parseFriendQuery`, `presenceOf`, `seenBucket`, `meetStartAt`, các hằng số.
- Máy khách dùng thêm lời mẫu và câu lý do.

Thiết kế trải nghiệm ở [docs/thiet-ke/ban-dong-tu.md](../thiet-ke/ban-dong-tu.md). Muốn đổi hợp đồng thì mở PR riêng sửa tệp này cùng `dong-tu.js`, Claude và Codex cùng duyệt.

## 1. Báo hỗ trợ

`GET /api/v1/me` thêm `dong_tu: 1` khi máy chủ có các đường dẫn dưới đây. Kèm `social: { requests: <số lời kết nối gửi đến đang chờ>, invites: <số lời mời gặp gửi đến còn hạn> }`, chỉ khi phiên là tài khoản.

Máy khách chỉ hiện nút Bạn đồng tu khi thấy `dong_tu: 1`, nên gộp máy khách trước máy chủ vẫn an toàn.

## 2. D1 — migration kế tiếp (đề xuất `0011_ban_dong_tu.sql`; Codex giữ số thứ tự)

Dùng lại bảng của 0004: `companion` (`a < b`, `status cho|dong_y`, `requested_by`), `invite`, `guidance`, `user_block`, `report`. Chỉ thêm:

```sql
-- Bạn đồng tu (#121): thân thiết hai chiều, cho ghé khi vắng, hiện diện, lời mời gặp, lượt ghé khi vắng
ALTER TABLE companion ADD COLUMN accepted_at INTEGER;
ALTER TABLE companion ADD COLUMN source TEXT NOT NULL DEFAULT 'tim' CHECK (source IN ('ma_moi','tim'));
ALTER TABLE companion ADD COLUMN than_a INTEGER NOT NULL DEFAULT 0 CHECK (than_a IN (0,1));   -- a muốn thân thiết
ALTER TABLE companion ADD COLUMN than_b INTEGER NOT NULL DEFAULT 0 CHECK (than_b IN (0,1));
ALTER TABLE companion ADD COLUMN away_a INTEGER NOT NULL DEFAULT 0 CHECK (away_a IN (0,1));   -- a cho b ghé khi a vắng
ALTER TABLE companion ADD COLUMN away_b INTEGER NOT NULL DEFAULT 0 CHECK (away_b IN (0,1));

CREATE TABLE presence (                         -- một dòng mỗi người, ghi đè; không lưu vị trí
  user_id    TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  state      TEXT NOT NULL CHECK (state IN ('online','thien','tham','tra')),
  updated_at INTEGER NOT NULL
);

CREATE TABLE meet_invite (                      -- lời mời gặp; xóa sau 7 ngày
  id           TEXT PRIMARY KEY,
  from_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  to_id        TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('tham','xin_tham','thien','tra','tham_quan')),
  place        TEXT NOT NULL CHECK (place IN ('dao','dtd')),
  status       TEXT NOT NULL DEFAULT 'cho' CHECK (status IN ('cho','dong_y','tu_choi','huy')),
  created_at   INTEGER NOT NULL,
  responded_at INTEGER,
  start_at     INTEGER,
  CHECK (from_id <> to_id)
);
CREATE INDEX meet_invite_to ON meet_invite(to_id, status, created_at);
CREATE INDEX meet_invite_from ON meet_invite(from_id, status, created_at);

CREATE TABLE island_visit (                     -- ghé khi chủ vắng; xóa sau 30 ngày
  host_id  TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  day      TEXT NOT NULL,                       -- ngày địa phương của chủ đảo
  at       INTEGER NOT NULL,
  PRIMARY KEY (host_id, guest_id, day)
);
```

**Cài đặt riêng tư không cần cột mới.** Nằm trong `profile.settings_json.dong_tu = { hien_trang_thai: bool, cho_tim: bool, hien_ngay: bool }` (mặc định cả ba `true`). Chế độ Nghênh khách nằm trong `profile.island_json.open: bool` (mặc định `false` = Độc cư).

Máy khách gửi cả hai qua `PATCH /api/v1/profile` sẵn có. `settings` gộp ở mức trên cùng, nên luôn gửi đủ đối tượng `dong_tu`. `profile.visibility = 'an'` nghĩa là `cho_tim = false` và `hien_trang_thai = false`, dù cài đặt ghi gì.

## 3. Đường dẫn (phiên tài khoản hoặc khách; JSON `snake_case`; `Cache-Control: no-store`)

`id` của bạn đồng tu là `user.id`, chỉ trả cho người trong cặp (đã kết nối hoặc đang chờ).

| Đường dẫn | Gửi | Trả | Giới hạn |
|---|---|---|---|
| `POST /api/v1/companions/link` | `{ renew?: bool }` | `{ code, uses_left, expires_at }`. Mỗi người một mã còn hạn; `renew` xóa mã cũ, tạo mã mới (`makeInviteCode` + `crypto.getRandomValues`) | 10/ngày |
| `GET /api/v1/companions/link/:code` | — (không cần phiên) | `{ owner: { tinh_danh, tag }, valid: true }` hoặc 404 `link_invalid` | `byIp` 30/giờ |
| `POST /api/v1/companions/link/:code/accept` | — | 201 `{ companion }`. Tạo `companion` `dong_y`, `source = 'ma_moi'`, `accepted_at`; giảm `uses_left`. Ghi `guidance` nếu người nhận chưa có người dẫn dắt và tài khoản tạo chưa quá 7 ngày | 20/ngày |
| `POST /api/v1/companions/request` | `{ query: "Tuệ Thái · 5696" }` (đọc bằng `parseFriendQuery`) | **Luôn** 202 `{ sent: true }` khi cú pháp đúng, dù người ấy có tồn tại, có nhận yêu cầu hay đã chặn (chống dò tên). Chỉ tạo dòng `cho` khi người ấy tồn tại, `cho_tim = true`, không chặn nhau | `REQUESTS_PER_DAY` = 5/ngày |
| `POST /api/v1/companions/:id/respond` | `{ accept: bool }` | Đồng ý: `dong_y` + `accepted_at`. Từ chối: xóa dòng. 404 nếu không có yêu cầu gửi đến | 60/giờ |
| `PATCH /api/v1/companions/:id` | `{ than?: bool, away?: bool }` | Đổi cột phía mình (`than_a` hoặc `than_b`…). `away` chỉ có tác dụng khi `closenessOf` = `than` | 60/giờ |
| `DELETE /api/v1/companions/:id` | — | Hủy kết nối hoặc rút yêu cầu; hủy các lời mời gặp đang chờ của cặp | 60/giờ |
| `GET /api/v1/companions` | — | Xem §4 | `RL_API` |
| `POST /api/v1/presence` | `{ state: 'online'\|'thien'\|'tham'\|'tra' }` | 204. Chỉ ghi khi trạng thái đổi hoặc lần ghi trước đã quá 60 giây | 90/giờ |
| `POST /api/v1/meet` | `{ to, kind, place? }` (`checkMeetPayload`) | 201 `{ invite }`, hoặc 409 `{ error: { code } }` theo `canMeet` chạy bằng dữ liệu máy chủ. Mỗi cặp một lời mời `cho`: lời mời mới thay lời cũ cùng chiều | 20/giờ |
| `POST /api/v1/meet/:id/respond` | `{ accept: bool }` | Nhận: `dong_y`, `responded_at = now`, `start_at = meetStartAt(kind, now)`. Từ chối: `tu_choi`. Quá `INVITE_TTL_MS` thì 409 `invite_expired` | 60/giờ |
| `POST /api/v1/meet/:id/cancel` | — | `huy` (hai bên đều được; cũng dùng để kết thúc ghé thăm) | 60/giờ |
| `POST /api/v1/visits/away` | `{ host }` | 200 khi `canVisitAway`; ghi `island_visit` (một dòng/ngày). 409 nếu không đủ điều kiện | 20/ngày |
| `GET/POST /api/v1/blocks`, `DELETE /api/v1/blocks/:id` | `{ user }` | Chặn: xóa `companion`, hủy lời mời, sau đó mọi yêu cầu/lời mời của người bị chặn đều im lặng bỏ qua | 20/ngày |
| `POST /api/v1/reports` | `{ target, context: 'island', reason? }` | 201. `reason` ≤ 500 ký tự, chỉ người kiểm duyệt thấy | 10/ngày |

**Dữ liệu máy chủ dùng cho `canMeet`:**
- `day`: ngày hành trình hiện tại theo `currentJourney`.
- `completed`: `completed_at != null`.
- `open`: `island_json.open`.
- `presence`: `presenceOf(presence, now)` của người nhận. Người nhận tắt `hien_trang_thai` thì máy chủ coi như `online` khi kiểm, để lời mời không làm lộ trạng thái; lời mời chờ tới hết hạn.

**Mã lỗi:** `link_invalid`, `link_expired`, `link_used_up`, `self`, `already_companion`, `limit_companions` (`MAX_COMPANIONS`), `not_found`, `rate_limited`, các mã của `canMeet` (`blocked`, `not_companion`, `friend_away`, `guest_gate_closed`, `host_doc_cu`, `tea_closed`, `invalid_place`, `invalid_kind`), `invite_expired`, `invite_not_pending`.

## 4. `GET /api/v1/companions`

```json
{
  "companions": [{
    "id": "01M7BT…", "tinh_danh": "Tuệ Thái", "tag": "5696", "look": { … },
    "closeness": "than", "me": { "than": true, "away": false }, "them": { "than": true, "away": true },
    "presence": "thien", "seen": "vua_xong",
    "day": 31, "completed": false, "open": true,
    "accepted_at": 1763300000000
  }],
  "incoming": [{ "id": "…", "tinh_danh": "Minh An", "tag": "2210", "at": 1763300000000 }],
  "outgoing": [{ "id": "…", "tinh_danh": "An Hòa", "tag": "3304", "at": 1763300000000 }],
  "invites": [{ "id": "01…", "from": "…", "to": "…", "kind": "thien", "place": "dao", "status": "cho", "created_at": 0, "responded_at": null, "start_at": null }],
  "visits": [{ "guest": "…", "day": "2026-11-18" }],
  "server_now": 1763300000000
}
```
- `presence`: `presenceOf`. Bạn tắt hiện trạng thái thì `presence: null`, `seen: null`.
- `day`, `completed`: `null` nếu bạn tắt `hien_ngay`.
- `invites`: lời mời của mình còn hiệu lực (gửi đi và gửi đến, `cho` hoặc `dong_y` chưa xong).
- `visits`: ai đã ghé khi mình vắng trong 7 ngày.
- Sắp xếp: thân thiết → quen biết, rồi theo `accepted_at`.

## 5. Mô-đun mạng `apps/web/src/net/dong-tu.js` (Codex, T5.6) — giao diện cho Claude dùng

```js
export const dongTu;                          // { on, list, social, at } — on: có dong_tu:1 và đã có tài khoản
export function onDongTu(fn);                 // đăng ký vẽ lại khi list/social đổi
export async function loadCompanions();       // GET /companions → dongTu.list
export async function createLink(renew);      // → { code, uses_left, expires_at }
export async function linkInfo(code);         // → { owner } | null
export async function acceptLink(code);       // mã từ #ban= được giữ trong IndexedDB tới khi có tài khoản
export async function requestByName(query);
export async function respond(id, accept);
export async function setCompanion(id, { than, away });
export async function removeCompanion(id);
export async function block(id); export async function unblock(id); export async function listBlocks();
export async function meet(to, kind, place); export async function respondMeet(id, accept); export async function cancelMeet(id);
export async function visitAway(host);
export function setPresence(state);           // gửi ngay khi đổi; trang đang hiện thì HEARTBEAT_MS gửi lại; ẩn trang thì thôi
export function pushSocialPrefs({ hien_trang_thai, cho_tim, hien_ngay, open });   // qua PATCH /profile sẵn có
```
- **Nhịp hỏi:** lượt hỏi nhẹ 30 giây đã có (`net/account.js`, #96) đọc `me.social`; số đổi thì gọi `loadCompanions()`. Màn Bạn đồng tu đang mở thì 30 giây tải lại danh sách.
- **Không gửi gì khi chưa có tài khoản hoặc khi `dong_tu` chưa bật.**

## 6. Nghiệm thu phía máy chủ (`workers/api/test/companions.test.js`)

1. **Liên kết:** tạo → người khác nhận → hai bên thành bạn `dong_y`. `uses_left` giảm. Hết lượt, hết hạn, tự nhận mã mình, người đã chặn thì có mã lỗi đúng. `renew` làm mã cũ hỏng.
2. **Tìm theo tên:** `request` trả 202 giống hệt cho người có thật, người không có và người đã chặn. Chỉ tạo dòng khi đủ điều kiện. Quá 5/ngày thì 429.
3. **Thân thiết và ghé khi vắng:** thân thiết chỉ khi hai bên cùng chọn. `away` chỉ có tác dụng khi thân thiết. `visits/away` ghi một dòng/ngày.
4. **`canMeet` phía máy chủ:**
   - ngày 10 ghé thăm → `guest_gate_closed`;
   - chủ Độc cư → `host_doc_cu`;
   - Trà Đạo chủ ngày 12 → `tea_closed`;
   - thiền ngày 3 → `place = 'dtd'`;
   - bạn vắng → `friend_away`;
   - bạn ẩn trạng thái → nhận lời mời.
5. **Lời mời gặp:** nhận lời thì `start_at = responded_at + 60 000` cho thiền/trà, `= responded_at` cho ghé thăm. Quá 10 phút thì `invite_expired`. Lời mời mới thay lời cũ cùng chiều.
6. **Hiện diện:** ghi tối đa 1 lần/60 giây nếu không đổi trạng thái. Quá 3 phút thì danh sách trả `vang`. Tắt hiện trạng thái thì `presence: null`.
7. **Chặn:** xóa kết nối và lời mời; sau đó người bị chặn gửi gì cũng không tạo dòng.
8. **Dữ liệu:** `/export` có `companions`, `meet_invites`, `presence`, `island_visits`, `blocks`. Xóa tài khoản xóa sạch theo `ON DELETE CASCADE`.
9. **Không ghi PII vào log/Analytics.**

## 7. Chi phí trên gói Free (ước lượng)

Một người đang mở app:
- 30 nhịp hiện diện/giờ (ghi D1 tối đa 1 lần/phút khi đổi, 1 lần/2 phút khi không đổi);
- 120 lượt hỏi nhẹ `/me` (đã có);
- tải danh sách khi số đổi hoặc khi mở màn.

Hạn mức ghi D1 Free 100.000 dòng/ngày đủ cho khoảng 3.000 giờ-người mở app/ngày. Khi GĐ4 có `workers/realtime`, hiện diện chuyển sang Durable Object và D1 chỉ ghi lần cuối.
