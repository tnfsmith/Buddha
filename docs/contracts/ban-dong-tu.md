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
| `POST /api/v1/meet/:id/respond` | `{ accept: bool }` | Nhận: `dong_y`, `responded_at = now`, `start_at = meetStartAt(kind, now)`. Từ chối: `tu_choi`. Quá `INVITE_TTL_MS` thì 409 `invite_expired`. Nhận lời gặp `place = 'dao'` thì kiểm lại chế độ cổng **hiện hành** của chủ đảo ngay trong lượt ghi: chủ đảo đã chuyển sang Độc cư sau khi mời → 409 `host_doc_cu`, lời mời vẫn `cho` (#138) | 60/giờ |
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

---

# Phần mở rộng v2 (#151): phiên đồng tu, tiến trình, khích lệ, điều kiện nhân vật, trang mời

Thiết kế: `docs/thiet-ke/dong-tu-dai-thien-duong.md`. Các mục dưới **chỉ thêm**, không đổi §1–§7. Hằng số dùng chung thêm vào `packages/shared/src/dong-tu.js` trong cùng PR với phía máy chủ đầu tiên (Codex), có kiểm thử Vitest.

## 9. Phiên đồng tu (mời nhóm, hẹn giờ)

### 9.1 Hằng số (`dong-tu.js`)
| Tên | Giá trị | Ý nghĩa |
|---|---|---|
| `SESSION_MAX` | 6 | Tối đa người trong một phiên, gồm chủ phiên |
| `SESSION_AHEAD_MS` | 7 ngày | Hẹn trước tối đa |
| `SESSION_MIN_LEAD_MS` | `MEET_LEAD_MS` (60 giây) | «Ngay» = sau 60 giây |
| `SESSION_STEP_MS` | 5 phút | Giờ hẹn phải là bội 5 phút. «Ngay» tách khỏi bước này: máy chủ đặt `now + MEET_LEAD_MS`, không làm tròn |
| `SESSION_OPEN_MAX` | 3 | Phiên sắp tới do một người tạo |
| `SESSION_REMIND_MS` | `[600_000, 60_000]` | Mốc nhắc trong ứng dụng: 10 phút và 1 phút; tệp `.ics` báo trước 10 phút. Web Push cho phiên: §9.5 |
| `sessionPhase(s, now)` | hàm | `'hen' \| 'sap' \| 'dang' \| 'xong' \| 'huy'`. `sap` khi còn ≤ `MEET_LEAD_MS`; `dang` trong 15 phút từ `start_at` |

### 9.2 D1 (Codex giữ số migration)
```sql
CREATE TABLE dong_tu_session (                 -- phiên đồng tu; xóa 30 ngày sau start_at
  id         TEXT PRIMARY KEY,
  host_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'thien' CHECK (kind IN ('thien')),
  place      TEXT NOT NULL DEFAULT 'dtd' CHECK (place IN ('dtd')),
  start_at   INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'hen' CHECK (status IN ('hen','huy')),
  created_at INTEGER NOT NULL
);
CREATE INDEX dong_tu_session_host ON dong_tu_session(host_id, status, start_at);
CREATE TABLE dong_tu_seat (                    -- một dòng mỗi người được mời (chủ phiên không có dòng)
  session_id   TEXT NOT NULL REFERENCES dong_tu_session(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'moi' CHECK (status IN ('moi','nhan','tu_choi','roi')),
  responded_at INTEGER,
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX dong_tu_seat_user ON dong_tu_seat(user_id, status);
```

### 9.3 Đường dẫn
| Đường dẫn | Thân | Kết quả | Hạn mức |
|---|---|---|---|
| `POST /api/v1/sessions` | `{ start_at: number \| 'ngay', invitees: [id] }` | 201 `{ session }`. Kiểm: 1–5 người, mỗi người là bạn đã kết nối, không chặn hai chiều. `start_at` trong `[now + 60 s, now + SESSION_AHEAD_MS]` và là bội 5 phút. `'ngay'` → `now + MEET_LEAD_MS`. Chủ có < `SESSION_OPEN_MAX` phiên `hen` chưa qua. Có `need_character` (§11). Không kiểm hiện diện khi hẹn trước; «Ngay» thì bỏ qua người đang `vang` (không lỗi, trả trong `skipped`) | 10/ngày |
| `POST /api/v1/sessions/:id/respond` | `{ accept: bool }` | Người được mời: `moi` → `nhan` / `tu_choi`; đã `nhan` mà gửi `false` → `roi`. Phiên đã `huy` hoặc qua `dang` → 409 `session_closed` | 60/giờ |
| `POST /api/v1/sessions/:id/cancel` | — | Chủ phiên: `status = 'huy'`. 204 | 60/giờ |
| `GET /api/v1/companions` | | Thêm `sessions: [Session]`: phiên mình là chủ hoặc có dòng ghế, `status = 'hen'`, `start_at > now − 15 phút` | |

```ts
Session = {
  id, host: { id, tinh_danh, tag, look }, kind: 'thien', place: 'dtd', start_at, created_at,
  seats: [{ id, tinh_danh, tag, look, status: 'moi'|'nhan'|'tu_choi'|'roi' }]   // người chặn mình hoặc đã xóa tài khoản: không có trong mảng
}
```

- `GET /me` thêm `social.sessions`: số phiên mình có ghế `moi` chưa trả lời và chưa qua giờ.
- **Chặn (§3.4), áp dụng mọi lúc kể cả sau khi mời:**
  - Người xem và **chủ phiên** chặn nhau (một trong hai chiều): cả phiên biến khỏi `sessions` và khỏi `social.sessions` của người xem. `POST /sessions/:id/respond` trả 404 `not_found`, cùng dạng với phiên không có thật.
  - Người xem và **một khách khác** chặn nhau: chỉ ghế của người kia biến khỏi `seats` của người xem, và ngược lại. Phiên vẫn còn.
  - Không báo lý do ở mọi trường hợp.
- **Vòng đời dữ liệu (phiên, ghế, khích lệ, mốc đã xem):**
  - Xóa tài khoản: `ON DELETE CASCADE` xóa phiên do người đó chủ trì (kéo theo ghế), ghế của người đó, khích lệ gửi và nhận, mốc đã xem.
  - Gộp phiên khách vào tài khoản có sẵn (#96): không chuyển các dòng này; xóa cùng tài khoản khách.
  - Xuất dữ liệu (`/export`): phiên mình chủ trì (giờ, trạng thái, số ghế theo trạng thái), ghế của mình, khích lệ mình gửi và nhận (lời mẫu, ngày, Tịnh danh · mã người kia). Không có id người khác.
  - Cron hằng ngày: xóa phiên quá 30 ngày sau `start_at` (kéo theo ghế), khích lệ quá 7 ngày.

### 9.4 Nhắc giờ, bản này: chỉ trong ứng dụng và `.ics`
- **Trong ứng dụng:** máy khách hiện thẻ nhắc lúc còn 10 phút và 1 phút, khi ứng dụng đang mở và không đang thiền. Không cần API ngoài `sessions` trong danh sách.
- **«Thêm vào lịch»:** máy khách tạo tệp `.ics` có `VALARM` trước 10 phút. Không cần API.
- **Không có Web Push cho phiên** trong phần này. Nhận lời sau mốc trước 10 phút, hoặc phiên «Ngay», thì chỉ có nhắc trong ứng dụng.

### 9.5 Web Push cho phiên: để sau, cần hợp đồng DO riêng
ReminderClock (#106) hiện chỉ nhận `reminder_id` của bảng nhắc định kỳ, payload `{ v, kind, at }`. Nhắc phiên một lần cần thêm RPC và nguồn D1 riêng, nên **tắt cho tới khi Claude và Codex chốt một PR hợp đồng riêng**. Điều kiện tối thiểu của hợp đồng đó:
- Khóa theo cặp `(session_id, user_id)`; lên lịch một lần lúc `start_at − 600 000`. Không lên lịch khi lúc nhận lời đã qua mốc này.
- Ngay trước khi gửi, kiểm lại: ghế còn `nhan` (chủ phiên: phiên còn `hen`), không chặn hai chiều với chủ phiên, Tịnh khẩu và giờ yên lặng (`quietAt`). Có lần gửi thì tính vào hạn mức 2 lượt/ngày của nhắc tu tập.
- Nội dung không có tên bạn: tiêu đề «Sắp tới giờ đồng tu», thân «Còn 10 phút: cùng ngồi thiền ở Đại Thiền Đường». `notificationclick` mở `/#dtd=<id>`.

## 10. Tiến trình bạn và khích lệ

### 10.1 Cài đặt
- `profile.settings_json.dong_tu.chia_se_tien_trinh: bool`, mặc định `false`.
- `visibility = 'an'` thì coi như `false`.
- **`PATCH /api/v1/profile` với `settings.dong_tu` đổi sang gộp theo từng khóa:**
  - Chỉ nhận bốn khóa `hien_trang_thai`, `cho_tim`, `hien_ngay`, `chia_se_tien_trinh`, giá trị phải là boolean. Khóa lạ hoặc sai kiểu thì 400 `invalid_payload`.
  - Khóa có trong yêu cầu thì ghi đè; khóa vắng mặt giữ nguyên giá trị cũ.
  - Máy khách v1 (#148) vẫn gửi đủ ba khóa cũ, nên `chia_se_tien_trinh` không bị mất.
- Nghiệm thu: gửi `false`; gửi thiếu khóa (giá trị cũ còn); `visibility = 'an'` (đọc ra `false` dù đã lưu `true`).

### 10.2 `GET /api/v1/companions/:id/progress`
- Chỉ khi hai người đã kết nối, không chặn, và bạn đã bật `chia_se_tien_trinh`. Chưa bật hoặc không đủ điều kiện thì trả 404 `not_found`, cùng một dạng để không lộ lý do.
- 200: `{ cycle, day, completed, sessions_done, sermons_done, last_active: 'hom_nay'|'hom_qua'|'trong_tuan'|'lau_hon'|null }`.
  - Lấy từ `journey`.
  - `last_active` theo ngày địa phương của bạn, tính từ lần ghi việc tu tập gần nhất.
- Không có Kusala, sổ việc, ghi chú hay nhật ký. Phân khu đã mở máy khách tự suy từ `day` (`gateLevel`, Trà Đạo ngày 15).
- Hạn mức: 60/giờ.

### 10.3 Khích lệ
- **Lời mẫu** (`dong-tu.js`): `CHEER_LINES`:

  | Khóa | Lời |
  |---|---|
  | `tuy_hy` | «Tùy hỷ công phu của bạn.» |
  | `cung_giu` | «Mình cùng giữ thời thiền ngày mai nhé.» |
  | `nho_ban` | «Mình nhớ bạn, khi nào rảnh mình cùng ngồi một thời nhé.» |
  | `cam_on` | «Cảm ơn bạn đã cùng tu tập.» |
  | `tien_trinh` | Máy khách dựng câu từ `{ day, completed }` của người gửi, đọc lại từ `journey` lúc ghi, không tin số máy khách gửi |

- **D1:**
  ```sql
  CREATE TABLE cheer (                           -- xóa sau 7 ngày
    from_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    to_id   TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    day     TEXT NOT NULL,                       -- ngày địa phương của người gửi
    line    TEXT NOT NULL CHECK (line IN ('tuy_hy','cung_giu','nho_ban','cam_on','tien_trinh')),
    j_day   INTEGER, j_done INTEGER,             -- chỉ với tien_trinh
    at      INTEGER NOT NULL,
    PRIMARY KEY (from_id, to_id, day)
  );
  ```
- **`POST /api/v1/companions/:id/cheer`** `{ line }`:
  - Phải là bạn đã kết nối, không chặn.
  - Mỗi cặp mỗi ngày một lời; trùng thì 409 `cheer_today`.
  - 201. Hạn mức 30/ngày.
- **`GET /api/v1/companions`** thêm `cheers: [{ from: { id, tinh_danh, tag }, line, day?, completed?, at }]`: lời gửi tới mình với `at > now - 7 ngày`, mới trước, loại lời của tài khoản bị chặn theo bất kỳ chiều nào.
- **`GET /me`** thêm `social.cheers`: đếm trên cùng tập lời còn hạn, không chặn hai chiều, rồi lọc `at > cheer_seen.seen_at` (chưa có mốc thì coi là `0`). Áp dụng ngay cả khi cron chưa dọn.
- **`POST /api/v1/cheers/seen`** `{ until: at }`: đánh dấu đã xem tới `until`. 204.
  - Mốc lưu ở bảng riêng, chỉ tăng: `seen_at = max(seen_at, min(until, now))`. Giới hạn ở giờ máy chủ để máy khách không đặt mốc tương lai.
  ```sql
  CREATE TABLE cheer_seen (
    user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
    seen_at INTEGER NOT NULL
  );
  ```
- Không có push cho khích lệ.

## 11. Điều kiện nhân vật
- «Chưa lưu nhân vật» nghĩa là `profile.tinh_danh` là `NULL` hoặc chuỗi rỗng, **hoặc** `profile.look_json` là `NULL` hay `'{}'` (chưa lưu hình dáng).
- Các đường dẫn sau trả 409 `need_character` khi chưa lưu nhân vật:
  - `POST /companions/link`;
  - `POST /companions/request`;
  - `POST /meet`;
  - `POST /sessions`.
- Nhận lời (`accept` link, `respond`) **không** cần nhân vật, để người mới vẫn kết nối được.
- `REASON_TEXT.need_character` = «Hãy tạo nhân vật và giữ hành trình trước khi mời bạn.»

## 12. Liên kết chia sẻ ra ngoài và thẻ xem trước (#160)

Chủ dự án duyệt thẻ có Tịnh danh và mã bốn số ngày 20/11/2026. Bất kỳ ai có liên kết mới đều có thể xem thẻ. Giao diện chia sẻ báo rõ điều này và để «Kèm tiến trình» tắt mặc định.

### 12.1 Liên kết và đường dẫn

- Liên kết mới: `/moi/CODE`, thêm `?d=1` khi người mời chọn «Kèm tiến trình». Dùng `normInviteCode` cho mã. `/?ban=CODE` và `/#ban=CODE` tiếp tục hoạt động với thẻ chung.
- Máy khách nhận `/moi/CODE` như `?ban=`: chuyển mã vào luồng `#ban=` hiện có, dùng `replaceState` đưa đường dẫn về gốc để nhận lời qua `GET /companions/link/:code` và `accept`.
- `GET /moi/:code` đi qua Worker (`run_worker_first: /moi/*` ở production và staging, gồm preview). Worker đọc tài nguyên `/` của `ASSETS` và dùng `HTMLRewriter` sửa metadata trong chính HTML gốc. Phản hồi giữ nguyên URL, nội dung ứng dụng và luồng nhận lời.
- Tra mã và thông tin công khai chỉ bằng D1 của Worker đang phục vụ yêu cầu, giới hạn tần suất theo IP. Trang không cần phiên, không tạo hoặc nhận kết nối và không trừ lượt mời. Khi chưa tìm được bản ghi đủ điều kiện hoặc D1 tạm lỗi, trả trang với thẻ chung.

### 12.2 Trường được hiển thị

- Thẻ chung: `og:title` «Mời bạn tu cùng trên Vân Đạo», `og:description` «Không gian tu tập 49 ngày: thiền 15 phút, nghe giảng, cùng bạn đồng tu.», `og:url` là URL gốc của môi trường. Dùng cùng thẻ cho mã sai, hết lượt, hết hạn, đã thu hồi hoặc tài khoản Ẩn. HTML trả 200 khi tài nguyên ứng dụng có sẵn.
- Với mã còn hạn, còn lượt và người mời có Tịnh danh, mã bốn số hợp lệ, `visibility != 'an'`: `og:title` «⟨Tịnh danh⟩ · ⟨mã 4 số⟩ mời bạn tu cùng trên Vân Đạo». `og:url` là URL chuẩn `/moi/CODE` trên đúng môi trường, thêm `?d=1` nếu yêu cầu có đúng một tham số `d` với giá trị `1`.
- Khi có đúng `d=1`, người mời hiện bật `chia_se_tien_trinh` theo §10.1 và D1 có chu kỳ hiện hành, thêm «Ngày ⟨day⟩ của hành trình Sơ nhập.» vào `og:description`. Nếu chu kỳ đã hoàn thành, thêm «Đã hoàn thành chương trình Sơ nhập.». Mọi trường hợp khác giữ mô tả chung. Người có liên kết có thể tự thêm `d=1`; quyền hiển thị tiến trình luôn lấy từ cài đặt của người mời trên máy chủ.
- Metadata dùng origin của môi trường phục vụ (bao gồm preview), thoát nội dung thuộc tính HTML. Thẻ chỉ mang tên, mã bốn số và ngày được chia sẻ. Không đưa email, ID nội bộ, thời điểm hoạt động, Kusala, nhật ký hoặc ghi chú vào thẻ.
- `og:image` dùng chung một ảnh PNG 1200×630, khai báo cùng `og:image:width` và `og:image:height`. Đặt ảnh có khóa phiên bản trong cả `vandao-media-staging` và `vandao-media`; Worker phục vụ `GET`/`HEAD` tại `/media/og/` bằng danh sách khóa ảnh cố định. Nhánh ảnh có cache immutable và vẫn giữ yêu cầu kiểm D1 cho mọi tệp bài giảng.

### 12.3 Bộ nhớ đệm, nhật ký và nghiệm thu

- HTML `/moi/*` luôn có `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer` và `robots` `noindex`. Chỉ ảnh chung được lưu cache theo khóa phiên bản. Khi thu hồi/đổi mã hoặc chuyển sang Ẩn, lượt cào mới nhận thẻ chung. Facebook có thể vẫn hiển thị ảnh chụp thẻ đã cào trước đó cho đến khi họ làm mới bộ nhớ đệm.
- Khi vượt hạn mức tra mã theo IP, Worker bỏ truy vấn D1 và trả HTML với thẻ chung, HTTP 200.
- Tắt [`observability.logs.invocation_logs`](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) ở production và staging để tránh lưu URL có mã mời. Giữ log lỗi đã lược thông tin; lỗi route chỉ ghi tên loại lỗi cố định. Không ghi mã mời, URL đầy đủ, Tịnh danh hay ngày chia sẻ vào log hoặc Analytics.
- Nghiệm thu Worker: mã hợp lệ, sai cú pháp, không tồn tại, hết lượt, hết hạn, thu hồi và người mời Ẩn; ma trận `d=1` và quyền chia sẻ; thoát ký tự HTML; không trừ lượt mời; kiểm headers, ảnh và xử lý lỗi D1.
- Nghiệm thu tích hợp: Facebook Sharing Debugger trên preview và staging thấy tên, mã bốn số và ảnh cho mã thử hợp lệ; mã sai hiện thẻ chung. Điện thoại mở cả hai dạng liên kết và nhận lời qua luồng cũ. Hợp đồng merge trước khi Codex làm Worker/ảnh và Claude đổi URL phía khách.

## 13. Nghiệm thu phía máy chủ bổ sung
- **Phiên:**
  - tạo với 5 người → 201;
  - 6 người → 400;
  - hẹn quá 7 ngày hoặc giờ lẻ phút → 400;
  - phiên thứ tư đang mở → 409 `session_limit`;
  - người bị chặn → biến khỏi `seats`;
  - `respond` sau 15 phút từ giờ bắt đầu → 409 `session_closed`.
- **Chặn:** chủ phiên chặn người xem (hoặc ngược lại) → phiên biến khỏi `sessions` và `social.sessions` của người xem; `respond` → 404 như phiên không có thật.
- **Cài đặt:** PATCH `dong_tu` chỉ có ba khóa cũ thì giữ `chia_se_tien_trinh`; khóa lạ hoặc giá trị không phải boolean → 400.
- **Đã xem:** `until` lớn hơn giờ máy chủ thì bị giới hạn về giờ máy chủ; gửi `until` nhỏ hơn mốc cũ thì mốc không lùi.
- **Vòng đời:** xóa tài khoản → không còn phiên, ghế, khích lệ, mốc đã xem; cron xóa đúng hạn.
- **Tiến trình:** bạn chưa bật và người lạ nhận cùng 404; đã bật → không có trường nào ngoài §10.2.
- **Khích lệ:** lời thứ hai trong ngày → 409; người chặn không gửi được; `tien_trinh` lấy ngày từ `journey`, không lấy từ thân yêu cầu.
- **Khích lệ rồi chặn:** cả danh sách và huy hiệu bỏ lời ngay khi chặn theo một trong hai chiều. Lời vừa chạm mốc 7 ngày cũng biến mất trước khi cron chạy.
- **`need_character`:** đủ bốn đường dẫn §11; `accept` vẫn đạt.
- **`need_character`:** `look_json = '{}'` cũng bị chặn.
