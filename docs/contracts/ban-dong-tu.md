# Hợp đồng Bạn đồng tu · #121 (máy chủ T5.5, mạng T5.6, giao diện T5.7, 3D T5.8)

Phiên bản `DONG_TU_V = 1`. Luật dùng chung ở `packages/shared/src/dong-tu.js`:
- Máy chủ dùng: `canMeet`, `canVisitAway`, `checkMeetPayload`, `normInviteCode`, `makeInviteCode`, `parseFriendQuery`, `presenceOf`, `seenBucket`, `meetStartAt`, các hằng số.
- Máy khách dùng thêm lời mẫu và câu lý do.

Thiết kế trải nghiệm ở [docs/thiet-ke/ban-dong-tu.md](../thiet-ke/ban-dong-tu.md). Muốn đổi hợp đồng thì mở PR riêng sửa tệp này cùng `dong-tu.js`, Claude và Codex cùng duyệt.

## 1. Báo hỗ trợ

`GET /api/v1/me` thêm `dong_tu: 1` khi máy chủ có các đường dẫn dưới đây. Kèm `social: { requests: <số lời kết nối gửi đến đang chờ>, invites: <số lời mời gặp gửi đến còn hạn> }` cho mọi phiên, kể cả phiên khách (xem §3.1).

Máy khách chỉ hiện nút Bạn đồng tu khi thấy `dong_tu: 1`, nên gộp máy khách trước máy chủ vẫn an toàn.

## 2. D1 — migration kế tiếp (đề xuất `0011_ban_dong_tu.sql`; Codex giữ số thứ tự)

Dùng lại bảng của 0004: `companion` (`a < b`, `status cho|dong_y`, `requested_by`), `invite`, `guidance`, `user_block`, `report`.
- `companion` chỉ giữ cặp **đã đồng ý** (`status = 'dong_y'`).
- Lời kết nối theo tên nằm ở bảng mới `companion_request`, để người gửi không phân biệt được tài khoản có thật hay không.
- Giá trị `cho` của `companion` để tương thích, không dùng.

Chỉ thêm:

```sql
-- Bạn đồng tu (#121): thân thiết hai chiều, cho ghé khi vắng, hiện diện, lời mời gặp, lượt ghé khi vắng
ALTER TABLE companion ADD COLUMN accepted_at INTEGER;
ALTER TABLE companion ADD COLUMN source TEXT NOT NULL DEFAULT 'tim' CHECK (source IN ('ma_moi','tim'));
ALTER TABLE companion ADD COLUMN than_a INTEGER NOT NULL DEFAULT 0 CHECK (than_a IN (0,1));   -- a muốn thân thiết
ALTER TABLE companion ADD COLUMN than_b INTEGER NOT NULL DEFAULT 0 CHECK (than_b IN (0,1));
ALTER TABLE companion ADD COLUMN away_a INTEGER NOT NULL DEFAULT 0 CHECK (away_a IN (0,1));   -- a cho b ghé khi a vắng
ALTER TABLE companion ADD COLUMN away_b INTEGER NOT NULL DEFAULT 0 CHECK (away_b IN (0,1));

CREATE TABLE companion_request (                -- lời kết nối theo «Tịnh danh · mã»; người gửi chỉ thấy đúng điều mình đã gõ
  id          TEXT PRIMARY KEY,
  from_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  tinh_danh   TEXT NOT NULL,                      -- như parseFriendQuery trả về
  tag         TEXT NOT NULL,
  to_id       TEXT REFERENCES user(id) ON DELETE SET NULL,   -- NULL khi không có người đủ điều kiện hoặc hai người chặn nhau sau khi gửi (§3.4); KHÔNG BAO GIỜ trả cho người gửi
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,                   -- created_at + REQUEST_TTL_MS (14 ngày)
  declined_at INTEGER                             -- người nhận từ chối: ẩn với người nhận; người gửi vẫn thấy «đã gửi» tới hết hạn
);
CREATE UNIQUE INDEX companion_request_once ON companion_request(from_id, tinh_danh, tag);
CREATE INDEX companion_request_to ON companion_request(to_id, declined_at, expires_at);

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

## 3. Đường dẫn (JSON `snake_case`; `Cache-Control: no-store`)

### 3.1 Phiên và danh tính
- **Mọi đường dẫn dưới đây cần một phiên.** Đó là phiên tài khoản, hoặc phiên khách (tài khoản ẩn danh tạo khi bấm «Giữ hành trình»). Danh tính luôn lấy từ phiên, không nhận `user_id` trong thân yêu cầu để đóng vai người khác.
- **Ngoại lệ duy nhất:** `GET /api/v1/companions/link/:code` công khai, chỉ trả Tịnh danh · mã của người tạo mã, giới hạn `byIp`. Người mới mở liên kết thấy ai mời trước khi có phiên.
- **Khách làm được mọi thao tác xã hội.** Người mới vào qua liên kết thường là khách. Khi tài khoản khách bị dọn (`guest_purge_after`), các kết nối, lời mời, hiện diện của khách bị xóa theo `ON DELETE CASCADE`. Giao diện nhắc khách lưu mã khôi phục để giữ bạn đồng tu.
- `id` của bạn đồng tu là `user.id`. Chỉ trả cho hai người đã kết nối, và trả danh tính người gửi cho người nhận một lời kết nối. Không bao giờ trả `to_id` của lời kết nối cho người gửi.

### 3.2 Người giới thiệu (`guidance`) — chỉ ghi dữ kiện
`link/:code/accept` ghi một dòng `guidance` (người tạo mã giới thiệu người nhận) khi người nhận chưa có dòng nào và tài khoản tạo chưa quá 7 ngày. Hợp đồng này **chỉ ghi dữ kiện giới thiệu**. Có dùng dòng đó làm tiêu chí mở tầng hay không, và với điều kiện gì (ví dụ người được giới thiệu hoàn tất ít nhất tuần đầu, §16), do §8.6/§16 và #107 quyết định riêng. Đường dẫn ở đây không mở tầng, không cộng gì.

### 3.3 Bảng đường dẫn

| Đường dẫn | Gửi | Trả | Giới hạn |
|---|---|---|---|
| `POST /api/v1/companions/link` | `{ renew?: bool }` | `{ code, uses_left, expires_at }`. Mỗi người một mã còn hạn; `renew` xóa mã cũ, tạo mã mới (`makeInviteCode` + `crypto.getRandomValues`) | 10/ngày |
| `GET /api/v1/companions/link/:code` | — (không cần phiên) | `{ owner: { tinh_danh, tag }, valid: true }` hoặc 404 `link_invalid` | `byIp` 30/giờ |
| `POST /api/v1/companions/link/:code/accept` | — | 201 `{ companion }`. Tạo `companion` `dong_y`, `source = 'ma_moi'`, `accepted_at`; giảm `uses_left`. Ghi `guidance` nếu người nhận chưa có người dẫn dắt và tài khoản tạo chưa quá 7 ngày | 20/ngày |
| `POST /api/v1/companions/request` | `{ query: "Tuệ Thái · 5696" }` (đọc bằng `parseFriendQuery`) | **Luôn** 202 `{ request: { id, tinh_danh, tag, at, expires_at } }` khi cú pháp đúng. Luôn tạo một dòng `companion_request` với đúng điều người gửi gõ. `to_id` chỉ điền khi người ấy tồn tại, `cho_tim = true`, không ẩn, không chặn nhau, chưa là bạn. Gửi lại cùng tên khi dòng cũ còn hạn thì trả dòng cũ; dòng đã hết hạn thì thay bằng dòng mới và xét lại `to_id` | `REQUESTS_PER_DAY` = 5/ngày, đếm cả lần không tìm thấy |
| `DELETE /api/v1/companions/requests/:id` | — | Người gửi rút lời kết nối | 60/giờ |
| `POST /api/v1/companions/requests/:id/respond` | `{ accept: bool }` | Chỉ người nhận: `to_id` = mình, chưa từ chối, còn hạn, không chặn nhau; khác đi thì 404 `not_found`. Đồng ý: tạo `companion` `dong_y`, `source = 'tim'`, `accepted_at`, xóa dòng lời kết nối. Từ chối: đặt `declined_at`, **người gửi không được báo** | 60/giờ |
| `PATCH /api/v1/companions/:id` | `{ than?: bool, away?: bool }` | Đổi cột phía mình (`than_a` hoặc `than_b`…). `away` chỉ có tác dụng khi `closenessOf` = `than` | 60/giờ |
| `DELETE /api/v1/companions/:id` | — | Hủy kết nối (rút lời kết nối dùng `DELETE /companions/requests/:id`); hủy các lời mời gặp đang chờ của cặp | 60/giờ |
| `GET /api/v1/companions` | — | Xem §4 | `RL_API` |
| `POST /api/v1/presence` | `{ state: 'online'\|'thien'\|'tham'\|'tra' }` | 204. Chỉ ghi khi trạng thái đổi hoặc lần ghi trước đã quá 60 giây | 90/giờ |
| `POST /api/v1/meet` | `{ to, kind, place? }` (`checkMeetPayload`) | 201 `{ invite }`, hoặc 409 `{ error: { code } }` theo `canMeet` chạy bằng dữ liệu máy chủ. Mỗi cặp một lời mời `cho`: lời mời mới thay lời cũ cùng chiều | 20/giờ |
| `POST /api/v1/meet/:id/respond` | `{ accept: bool }` | Nhận: `dong_y`, `responded_at = now`, `start_at = meetStartAt(kind, now)`. Từ chối: `tu_choi`. Quá `INVITE_TTL_MS` thì 409 `invite_expired` | 60/giờ |
| `POST /api/v1/meet/:id/cancel` | — | `huy` (hai bên đều được; cũng dùng để kết thúc ghé thăm) | 60/giờ |
| `POST /api/v1/visits/away` | `{ host }` | 200 khi `canVisitAway(me, host, rel)`; ghi `island_visit` (một dòng/ngày). Kiểm bằng `island_json.open` **hiện hành** của chủ đảo lúc ghé, không bằng quyền đã cấp từ trước. 409 với mã của `canVisitAway` | 20/ngày |
| `GET/POST /api/v1/blocks`, `DELETE /api/v1/blocks/:id` | `{ user }` | Chặn và bỏ chặn theo §3.4 | 20/ngày |
| `POST /api/v1/reports` | `{ target, context: 'island', reason? }` | 201. `reason` ≤ 500 ký tự, chỉ người kiểm duyệt thấy | 10/ngày |

**Dữ liệu máy chủ dùng cho `canMeet`:**
- `day`: ngày hành trình hiện tại theo `currentJourney`.
- `completed`: `completed_at != null`.
- `open`: `island_json.open`.
- `presence`: `presenceOf(presence, now)` của người nhận. Người nhận tắt `hien_trang_thai` thì máy chủ coi như `online` khi kiểm, để lời mời không làm lộ trạng thái; lời mời chờ tới hết hạn.

**Mã lỗi:** `link_invalid`, `link_expired`, `link_used_up`, `self`, `already_companion`, `limit_companions` (`MAX_COMPANIONS`), `not_found`, `rate_limited`, các mã của `canMeet` (`blocked`, `not_companion`, `friend_away`, `guest_gate_closed`, `host_doc_cu`, `tea_closed`, `invalid_place`, `invalid_kind`), của `canVisitAway` (`not_than`, `away_not_allowed`, `host_doc_cu`, `guest_gate_closed`), `invite_expired`, `invite_not_pending`.

**Đầu vào hỏng:** máy chủ trả `400` với mã có kiểm soát, không để lỗi lọt ra `500`.
- Mã mời đọc bằng `normInviteCode` (không hợp lệ → `link_invalid`).
- Loại gặp kiểm bằng `isMeetKind` (chỉ khóa định nghĩa; `toString`, `__proto__`… → `invalid_kind`).
- Thân JSON hỏng → `invalid_payload`.

### 3.4 Chặn — chỉ vô hiệu phía nhận

Khi A chặn B (`POST /blocks { user: B }`), máy chủ làm ba việc trong một lượt ghi:
- xóa `companion` của cặp;
- hủy (`huy`) mọi `meet_invite` chưa xong của cặp;
- đặt `to_id = NULL` cho mọi `companion_request` đang chờ giữa hai người, **cả hai chiều**.

Kết quả với từng phía:
- **Người gửi một lời kết nối không thấy gì đổi.** Dòng vẫn nằm trong `outgoing` với cùng dạng tới khi người gửi rút hoặc hết hạn 14 ngày. Lời kết nối mới giữa hai người vẫn 202 và tạo dòng như §3.3, với `to_id = NULL`.
- **Người nhận không thấy và không đồng ý được.** Dòng vô hiệu không còn trong `incoming`; `respond` trả 404 `not_found`; không có `companion` nào được tạo.
- **B thấy như kết nối đã bị hủy, không biết mình bị chặn.**
  - A biến khỏi `companions` của B.
  - `POST /meet` và `visits/away` tới A → 409 `not_companion`.
  - Liên kết của A → 404 `link_invalid`, như mã không tồn tại. Chặn theo chiều nào cũng vậy.
  - Máy chủ chỉ truyền `rel.blocked = true` vào `canMeet`/`canVisitAway` khi **chính người gọi** đã chặn người kia. Vì vậy chỉ A nhận mã `blocked`.

Bỏ chặn (`DELETE /blocks/:id`) không khôi phục dòng đã vô hiệu. Muốn kết nối lại thì người gửi rút rồi gửi lại, hoặc gửi lại sau khi dòng hết hạn.

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
  "incoming": [{ "id": "<id lời kết nối>", "from": { "tinh_danh": "Minh An", "tag": "2210" }, "at": 1763300000000 }],
  "outgoing": [{ "id": "<id lời kết nối>", "tinh_danh": "An Hòa", "tag": "3304", "at": 1763300000000, "expires_at": 1764509600000 }],
  "invites": [{ "id": "01…", "from": "…", "to": "…", "kind": "thien", "place": "dao", "status": "cho", "created_at": 0, "responded_at": null, "start_at": null }],
  "visits": [{ "guest": "…", "day": "2026-11-18" }],
  "server_now": 1763300000000
}
```
- `presence`: `presenceOf`. Bạn tắt hiện trạng thái thì `presence: null`, `seen: null`.
- `day`, `completed`: `null` nếu bạn tắt `hien_ngay`.
- `outgoing`: **đúng điều người gửi đã gõ**, cùng một dạng cho mọi trường hợp: có người thật, không có ai, người ẩn/tắt tìm kiếm, đã chặn (trước hay sau khi gửi), đã từ chối.
  - Lời kết nối chỉ rời danh sách khi người gửi rút, khi hết hạn 14 ngày, hoặc khi bên kia đồng ý (lúc đó người ấy hiện trong `companions`). Đồng ý là tín hiệu duy nhất, và chỉ có khi người ấy muốn.
  - Không có trường `id` người dùng, `look`, `presence` trong `outgoing`.
- `incoming`: lời kết nối có `to_id` = mình, chưa từ chối, còn hạn. Dòng đã vô hiệu do chặn (§3.4) không có ở đây.
- `invites`: lời mời của mình còn hiệu lực (gửi đi và gửi đến, `cho` hoặc `dong_y` chưa xong).
- `visits`: ai đã ghé khi mình vắng trong 7 ngày.
- Sắp xếp: thân thiết → quen biết, rồi theo `accepted_at`.

## 5. Mô-đun mạng `apps/web/src/net/dong-tu.js` (Codex, T5.6) — giao diện cho Claude dùng

```js
export const dongTu;                          // { on, list, social, at } — on: có dong_tu:1 và có phiên (tài khoản hoặc khách)
export function onDongTu(fn);                 // đăng ký vẽ lại khi list/social đổi
export async function loadCompanions();       // GET /companions → dongTu.list
export async function createLink(renew);      // → { code, uses_left, expires_at }
export async function linkInfo(code);         // → { owner } | null
export async function acceptLink(code);       // mã từ #ban= được giữ trong IndexedDB tới khi có tài khoản
export async function requestByName(query);   // → { request } (luôn cùng dạng)
export async function withdrawRequest(id); export async function respondRequest(id, accept);
export async function setCompanion(id, { than, away });
export async function removeCompanion(id);
export async function block(id); export async function unblock(id); export async function listBlocks();
export async function meet(to, kind, place); export async function respondMeet(id, accept); export async function cancelMeet(id);
export async function visitAway(host);        // → { ok } | { code } theo canVisitAway
export function setPresence(state);           // gửi ngay khi đổi; trang đang hiện thì HEARTBEAT_MS gửi lại; ẩn trang thì thôi
export function pushSocialPrefs({ hien_trang_thai, cho_tim, hien_ngay, open });   // qua PATCH /profile sẵn có
```
- **Nhịp hỏi:** lượt hỏi nhẹ 30 giây đã có (`net/account.js`, #96) đọc `me.social`; số đổi thì gọi `loadCompanions()`. Màn Bạn đồng tu đang mở thì 30 giây tải lại danh sách.
- **Không gửi gì khi chưa có phiên hoặc khi `dong_tu` chưa bật.** Mã từ `#ban=` được giữ trong IndexedDB cho tới khi có phiên.

## 6. Nghiệm thu phía máy chủ (`workers/api/test/companions.test.js`)

1. **Liên kết:** tạo → người khác nhận → hai bên thành bạn `dong_y`. `uses_left` giảm. Hết lượt, hết hạn, tự nhận mã mình thì có mã lỗi đúng. Chặn theo chiều nào cũng trả 404 `link_invalid` (§3.4). `renew` làm mã cũ hỏng.
2. **Tìm theo tên không làm lộ tài khoản, ở cả POST lẫn GET.**
   - Với năm người nhận: có thật và đủ điều kiện; không tồn tại; `cho_tim = false`; `visibility = 'an'`; đã chặn người gửi.
   - Phản hồi `POST /companions/request` và mục tương ứng trong `GET /companions.outgoing` phải **giống hệt nhau về dạng và trường** (chỉ khác `id`, giờ).
   - Người nhận từ chối thì `outgoing` không đổi cho tới hết hạn.
   - Chỉ người có thật và đủ điều kiện thấy lời kết nối trong `incoming`.
   - Quá 5/ngày thì 429, đếm cả lần không tìm thấy.
3. **Thân thiết và ghé khi vắng:**
   - Thân thiết chỉ khi hai bên cùng chọn; `away` chỉ có tác dụng khi thân thiết.
   - `visits/away` ghi một dòng/ngày.
   - **Ca Độc cư:** cấp quyền ghé, sau đó chủ chuyển `island.open = false` thì `visits/away` trả 409 `host_doc_cu`.
4. **`canMeet` phía máy chủ:**
   - ngày 10 ghé thăm → `guest_gate_closed`;
   - chủ Độc cư → `host_doc_cu`;
   - Trà Đạo chủ ngày 12 → `tea_closed`;
   - thiền ngày 3 → `place = 'dtd'`;
   - bạn vắng → `friend_away`;
   - bạn ẩn trạng thái → nhận lời mời.
5. **Lời mời gặp:** nhận lời thì `start_at = responded_at + 60 000` cho thiền/trà, `= responded_at` cho ghé thăm. Quá 10 phút thì `invite_expired`. Lời mời mới thay lời cũ cùng chiều.
6. **Hiện diện:** ghi tối đa 1 lần/60 giây nếu không đổi trạng thái. Quá 3 phút thì danh sách trả `vang`. Tắt hiện trạng thái thì `presence: null`.
7. **Chặn chỉ vô hiệu phía nhận (§3.4):**
   - Chặn xóa kết nối và hủy lời mời gặp của cặp.
   - **Ca chặn khi đã có lời kết nối đang chờ**, thử cả hai chiều:
     - mục `outgoing` của người gửi giống hệt trước khi chặn, tới khi rút hoặc hết hạn;
     - người nhận không còn thấy trong `incoming`;
     - `respond` → 404 `not_found`, không tạo `companion`.
   - Sau khi chặn, người bị chặn gửi lời kết nối mới: vẫn 202 cùng dạng và có mục `outgoing`, người chặn không thấy.
   - Phía bị chặn gửi `meet` hoặc `visits/away` → 409 `not_companion`; mở liên kết của người chặn → 404 `link_invalid`. Không phản hồi nào trả `blocked` cho phía bị chặn.
   - Bỏ chặn không làm dòng đã vô hiệu hiện lại trong `incoming`.
8. **Dữ liệu:** `/export` có `companions`, `companion_requests`, `meet_invites`, `presence`, `island_visits`, `blocks`.
   - `companion_requests.outgoing` giống hệt `GET /companions.outgoing`: đúng điều người gửi gõ. Không có `to_id` hay dấu hiệu nào về người nhận, kể cả dòng đã bị từ chối hoặc vô hiệu do chặn.
   - `companion_requests.incoming`: chỉ dòng có `to_id` = mình, dạng `{ id, from: { tinh_danh, tag }, at, declined_at }`.
   - Xóa tài khoản xóa sạch theo `ON DELETE CASCADE`.
   - Lời kết nối người khác gửi tới tài khoản đã xóa vẫn còn phía người gửi, với `to_id = NULL` (`ON DELETE SET NULL`) và không đổi dạng.
9. **Không ghi PII vào log/Analytics.**
10. **Phiên và đầu vào hỏng:**
    - Không phiên → 401 ở mọi đường dẫn trừ `GET link/:code`; phiên khách làm được mọi thao tác.
    - `link/%E0%A4%A`, `kind: "toString"`, thân JSON hỏng → 400 với mã có kiểm soát.

## 7. Chi phí trên gói Free (ước lượng)

Một người đang mở app:
- 30 nhịp hiện diện/giờ (ghi D1 tối đa 1 lần/phút khi đổi, 1 lần/2 phút khi không đổi);
- 120 lượt hỏi nhẹ `/me` (đã có);
- tải danh sách khi số đổi hoặc khi mở màn.

Hạn mức ghi D1 Free 100.000 dòng/ngày đủ cho khoảng 3.000 giờ-người mở app/ngày. Khi GĐ4 có `workers/realtime`, hiện diện chuyển sang Durable Object và D1 chỉ ghi lần cuối.
