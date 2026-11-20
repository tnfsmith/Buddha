// Durable Object ReminderClock (#106): giữ lịch nhắc theo shard và gửi Web Push đúng giờ.
// Hợp đồng: docs/contracts/reminder-clock.md (§3 RPC, §4 khi alarm chạy). Luật thuần ở @vandao/shared/reminder.js.
// D1 là nguồn chính; DO chỉ giữ chỉ mục lịch (idx), lượt đã mở (occ) và khóa gửi từng đăng ký (sent).
// Ưu tiên không gửi trùng hơn chắc chắn tới. Log chỉ có số đếm, không user_id, endpoint hay khóa.
import { DurableObject } from 'cloudflare:workers';
import {
  LATE_MS, MAX_ACTIVE, PUSH_CHANNEL, canSend, classifyPush, isTz, localParts, nextReminderAt, occKey,
  occurrenceValid, pushPayload, quietAt, sendKey,
} from '@vandao/shared/reminder.js';
import { sendPush } from './webpush.js';

const AHEAD = 30_000;              // lấy việc tới hạn trong 30 giây tới
const BATCH = 50;                  // tối đa 50 dòng mỗi loại mỗi lần alarm
const RETRY_MS = 5 * 60_000;       // 429/503 → thử lại sau 5 phút
const MAX_ATTEMPT = 3;             // tối đa 3 lần gửi một lượt
const PAR = 6;                     // giới hạn kết nối đồng thời của Workers
const KEEP_MS = 3 * 86_400_000;    // dọn occ/sent cũ hơn 3 ngày
const FAIL_MAX = 5;                // fail_count ≥ 5 thì xóa đăng ký
const TZ0 = 'Asia/Ho_Chi_Minh';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS idx (reminder_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, next_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_next ON idx(next_at);
CREATE TABLE IF NOT EXISTS occ (occ_key TEXT PRIMARY KEY, reminder_id TEXT NOT NULL, user_id TEXT NOT NULL, local_date TEXT NOT NULL,
  due_at INTEGER NOT NULL, kind TEXT NOT NULL, local_hm TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 1, retry_at INTEGER, done INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS occ_user_date ON occ(user_id, local_date);
CREATE INDEX IF NOT EXISTS occ_retry ON occ(retry_at) WHERE done = 0;
CREATE TABLE IF NOT EXISTS sent (key TEXT PRIMARY KEY, occ_key TEXT NOT NULL, sub_id TEXT NOT NULL, status TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sent_occ ON sent(occ_key);`;

const str = (s) => typeof s === 'string' && s.length > 0 && s.length <= 200;

export class ReminderClock extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(SCHEMA);
    /** Kiểm thử thay đồng hồ và hàm gọi dịch vụ push */
    this.now = () => Date.now();
    this.pushFetch = undefined;
  }

  // ───────── RPC cho API (§3) ─────────
  async schedule(x) {
    const { user_id: uid, reminder_id: rid, next_at: at } = x || {};
    if (!str(uid) || !str(rid) || !(at === null || Number.isFinite(at))) return { ok: false, code: 'invalid' };
    if (at === null) this.sql.exec('DELETE FROM idx WHERE reminder_id = ?', rid);
    else this.sql.exec('INSERT INTO idx (reminder_id, user_id, next_at) VALUES (?, ?, ?) ON CONFLICT(reminder_id) DO UPDATE SET user_id = excluded.user_id, next_at = excluded.next_at', rid, uid, at);
    await this.rearm();
    return { ok: true };
  }
  async cancel(x) {
    const rid = x && x.reminder_id;
    if (!str(rid)) return { ok: false, code: 'invalid' };
    this.sql.exec('DELETE FROM idx WHERE reminder_id = ?', rid);
    this.closeOcc('reminder_id = ?', rid);
    await this.rearm();
    return { ok: true };
  }
  async cancelUser(x) {
    const uid = x && x.user_id;
    if (!str(uid)) return { ok: false, code: 'invalid' };
    this.sql.exec('DELETE FROM idx WHERE user_id = ?', uid);
    this.closeOcc('user_id = ?', uid);
    await this.rearm();
    return { ok: true };
  }
  async stats() {
    const now = this.now(), one = (q, ...a) => this.sql.exec(q, ...a).one().n;
    return { rows: one('SELECT count(*) AS n FROM idx'), due_1h: one('SELECT count(*) AS n FROM idx WHERE next_at <= ?', now + 3_600_000), next_alarm: await this.ctx.storage.getAlarm() };
  }

  /** Đóng các lượt chưa xong theo điều kiện; đăng ký còn chờ ghi `cancel` (§4 bước 8) */
  closeOcc(where, arg) {
    this.sql.exec(`UPDATE sent SET status = 'cancel', at = ? WHERE status = 'retry' AND occ_key IN (SELECT occ_key FROM occ WHERE done = 0 AND ${where})`, this.now(), arg);
    this.sql.exec(`UPDATE occ SET done = 1, retry_at = NULL WHERE done = 0 AND ${where}`, arg);
  }

  /** §4 bước 7: alarm về mốc sớm nhất của shard, không còn gì thì xóa */
  async rearm() {
    const a = this.sql.exec('SELECT min(next_at) AS t FROM idx').one().t;
    const b = this.sql.exec('SELECT min(retry_at) AS t FROM occ WHERE done = 0 AND retry_at IS NOT NULL').one().t;
    const t = [a, b].filter((v) => v !== null && v !== undefined);
    if (!t.length) { await this.ctx.storage.deleteAlarm(); return; }
    const at = Math.min(...t);
    if ((await this.ctx.storage.getAlarm()) !== at) await this.ctx.storage.setAlarm(at);
  }

  get enabled() {
    const e = this.env;
    return e.REMINDERS_ENABLED === '1' && !!e.VAPID_PUBLIC_KEY && !!e.VAPID_PRIVATE_KEY && !!e.VAPID_SUBJECT;
  }

  /** §4 bước 2: cấu hình mới nhất của một người trong một lượt gọi D1 */
  async load(uid) {
    const db = this.env.DB;
    const [rem, prof, pp, subs] = await db.batch([
      db.prepare('SELECT id, kind, local_hm, days_mask, channel, next_at, active, paused_until FROM reminder WHERE user_id = ?').bind(uid),
      db.prepare('SELECT tz FROM profile WHERE user_id = ?').bind(uid),
      db.prepare('SELECT uposatha FROM practice_profile WHERE user_id = ?').bind(uid),
      db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscription WHERE user_id = ?').bind(uid),
    ]);
    const tz = prof.results[0]?.tz;
    return {
      rems: new Map(rem.results.map((r) => [r.id, r])),
      tz: isTz(tz) ? tz : TZ0,
      uposatha: pp.results[0]?.uposatha || 'vn_4',
      subs: subs.results,
    };
  }

  // ───────── Khi alarm chạy (§4) ─────────
  async alarm() {
    const now = this.now(), n = {};
    const count = (k, v = 1) => { n[k] = (n[k] || 0) + v; };

    // 0. Khóa `sending` còn lại của lần trước → `unknown`, không gửi lại. Lượt không còn đăng ký `retry` → xong.
    count('unknown', this.sql.exec("UPDATE sent SET status = 'unknown', at = ? WHERE status = 'sending'", now).rowsWritten);
    // (lượt mới chưa gửi xong mà bị dừng vẫn còn ở idx nên lần này gửi tiếp cho đăng ký chưa có khóa)
    this.sql.exec("UPDATE occ SET done = 1, retry_at = NULL WHERE done = 0 AND NOT EXISTS (SELECT 1 FROM sent s WHERE s.occ_key = occ.occ_key AND s.status = 'retry')");
    this.sql.exec('DELETE FROM sent WHERE occ_key IN (SELECT occ_key FROM occ WHERE due_at < ?)', now - KEEP_MS);
    this.sql.exec('DELETE FROM occ WHERE due_at < ?', now - KEEP_MS);

    // 1. Việc đến hạn
    const fresh = this.sql.exec('SELECT reminder_id, user_id, next_at FROM idx WHERE next_at <= ? ORDER BY next_at LIMIT ?', now + AHEAD, BATCH).toArray();
    const retry = this.sql.exec('SELECT * FROM occ WHERE done = 0 AND retry_at IS NOT NULL AND retry_at <= ? ORDER BY retry_at LIMIT ?', now + AHEAD, BATCH).toArray();
    const users = new Map();
    for (const uid of new Set([...fresh, ...retry].map((r) => r.user_id))) users.set(uid, await this.load(uid));   // 2.

    // 3. Lượt mới
    for (const row of fresh) {
      const d = users.get(row.user_id), rem = d.rems.get(row.reminder_id);
      if (!rem || rem.active !== 1 || rem.channel !== PUSH_CHANNEL) { this.sql.exec('DELETE FROM idx WHERE reminder_id = ?', row.reminder_id); count('skip_gone'); continue; }
      if (rem.next_at !== row.next_at) {   // API vừa đổi giờ: theo D1, không gửi theo giờ cũ
        if (rem.next_at === null) this.sql.exec('DELETE FROM idx WHERE reminder_id = ?', row.reminder_id);
        else this.sql.exec('UPDATE idx SET next_at = ? WHERE reminder_id = ?', rem.next_at, row.reminder_id);
        count('skip_moved'); continue;
      }
      const due = row.next_at, lp = localParts(due, d.tz), key = occKey(row.reminder_id, lp.date);
      const others = this.sql.exec('SELECT count(*) AS n FROM occ WHERE user_id = ? AND local_date = ? AND occ_key <> ?', row.user_id, lp.date, key).one().n;
      const skip = !this.enabled ? 'skip_off' : (Number(rem.paused_until) || 0) > due ? 'skip_paused' : quietAt(now, d.tz) ? 'skip_quiet'
        : now > due + LATE_MS ? 'skip_late' : others >= MAX_ACTIVE ? 'skip_limit' : null;
      if (skip) count(skip);
      else {
        this.sql.exec('INSERT OR IGNORE INTO occ (occ_key, reminder_id, user_id, local_date, due_at, kind, local_hm) VALUES (?, ?, ?, ?, ?, ?, ?)',
          key, row.reminder_id, row.user_id, lp.date, due, rem.kind, rem.local_hm);
        const occ = this.sql.exec('SELECT * FROM occ WHERE occ_key = ?', key).one();
        // Lượt đã hẹn thử lại (vd. 429 rồi bước 6 lỗi nên idx còn giờ cũ): để nhánh thử lại gửi đúng retry_at, không gửi sớm
        if (occ.retry_at === null) await this.deliver(occ, d, false, now, count);
      }
      await this.advance(row, rem, d, now);   // 6.
    }

    // 4. Lượt đang thử lại: kiểm hiệu lực theo cấu hình mới nhất, chỉ gửi lại cho đăng ký `retry`
    for (const occ of retry) {
      const d = users.get(occ.user_id), rem = d.rems.get(occ.reminder_id);
      if (!this.enabled || !occurrenceValid(rem, occ, { tz: d.tz, uposatha: d.uposatha, now })) { this.closeOcc('occ_key = ?', occ.occ_key); count('cancel'); continue; }
      await this.deliver(occ, d, true, now, count);
    }

    await this.rearm();   // 7.
    if (Object.keys(n).length) console.log(JSON.stringify({ reminder_clock: n }));   // 9. chỉ số đếm
  }

  /** §4 bước 6: hẹn lần sau cho lượt mới, kể cả khi đã bỏ lượt. D1 chỉ đổi khi API chưa sửa giờ. */
  async advance(row, rem, d, now) {
    const next = nextReminderAt(rem, { tz: d.tz, now: Math.max(now, row.next_at), uposatha: d.uposatha });
    const r = await this.env.DB.prepare('UPDATE reminder SET next_at = ? WHERE id = ? AND active = 1 AND next_at IS ?').bind(next, row.reminder_id, row.next_at).run();
    let at = next;
    if (!r.meta.changes) at = (await this.env.DB.prepare('SELECT next_at FROM reminder WHERE id = ? AND active = 1').bind(row.reminder_id).first())?.next_at ?? null;
    if (at === null) this.sql.exec('DELETE FROM idx WHERE reminder_id = ?', row.reminder_id);
    else this.sql.exec('UPDATE idx SET next_at = ? WHERE reminder_id = ?', at, row.reminder_id);
  }

  /** §4 bước 5: gửi một lượt tới các đăng ký được phép, ghi khóa trước khi gửi và kết quả ngay sau đó */
  async deliver(occ, d, retryOnly, now, count) {
    const st = new Map(this.sql.exec('SELECT sub_id, status FROM sent WHERE occ_key = ?', occ.occ_key).toArray().map((r) => [r.sub_id, r.status]));
    const subs = d.subs.filter((s) => (retryOnly ? st.get(s.id) === 'retry' : canSend(st.get(s.id))));
    const key = (s) => sendKey(occ.reminder_id, occ.local_date, s.id), db = this.env.DB;
    const vapid = { publicKey: this.env.VAPID_PUBLIC_KEY, privateKey: this.env.VAPID_PRIVATE_KEY, subject: this.env.VAPID_SUBJECT };
    for (const s of subs) this.sql.exec("INSERT INTO sent (key, occ_key, sub_id, status, at) VALUES (?, ?, ?, 'sending', ?) ON CONFLICT(key) DO UPDATE SET status = 'sending', at = excluded.at", key(s), occ.occ_key, s.id, now);
    const payload = pushPayload(occ.kind, occ.due_at);
    for (let i = 0; i < subs.length; i += PAR) {
      await Promise.all(subs.slice(i, i + PAR).map(async (s) => {
        const res = await sendPush(s, payload, { vapid, now, topic: occ.kind, fetch: this.pushFetch });
        const r = classifyPush(res);
        this.sql.exec('UPDATE sent SET status = ?, at = ? WHERE key = ?', r, now, key(s));
        count(r);
        if (r === 'ok') await db.prepare('UPDATE push_subscription SET fail_count = 0, last_ok_at = ? WHERE id = ?').bind(now, s.id).run();
        else if (r === 'gone') await db.prepare('DELETE FROM push_subscription WHERE id = ?').bind(s.id).run();
        else if (r === 'fail') await this.failSub(s.id);
      }));
    }
    const left = this.sql.exec("SELECT sub_id FROM sent WHERE occ_key = ? AND status = 'retry'", occ.occ_key).toArray();
    if (left.length && occ.attempt < MAX_ATTEMPT && now + RETRY_MS <= occ.due_at + LATE_MS) {
      this.sql.exec('UPDATE occ SET attempt = attempt + 1, retry_at = ? WHERE occ_key = ?', now + RETRY_MS, occ.occ_key);
      return;
    }
    for (const { sub_id: id } of left) { await this.failSub(id); count('fail'); }   // hết lượt thử
    this.sql.exec("UPDATE sent SET status = 'fail', at = ? WHERE occ_key = ? AND status = 'retry'", now, occ.occ_key);
    this.sql.exec('UPDATE occ SET done = 1, retry_at = NULL WHERE occ_key = ?', occ.occ_key);
  }

  async failSub(id) {
    const db = this.env.DB;
    await db.batch([
      db.prepare('UPDATE push_subscription SET fail_count = fail_count + 1 WHERE id = ?').bind(id),
      db.prepare('DELETE FROM push_subscription WHERE id = ? AND fail_count >= ?').bind(id, FAIL_MAX),
    ]);
  }
}
