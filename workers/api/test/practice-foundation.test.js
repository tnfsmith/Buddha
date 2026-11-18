// #102: nền D1 thật; chưa có endpoint ghi hoặc gửi thông báo.
import { describe, it, expect } from 'vitest';
import { applyD1Migrations } from 'cloudflare:test';
import { env, guest, call } from './helpers.js';
const tables = ['practice_profile', 'deed_log', 'reminder', 'push_subscription', 'attestation'];
const count = async (table, uid) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).bind(uid).first()).n;
const profile = (uid, col = 'minutes', value = 15) => env.DB.prepare(`INSERT INTO practice_profile (user_id, updated_at, ${col}) VALUES (?, 1, ?)`).bind(uid, value);

describe('0010 practice foundation', () => {
  it('nâng DB chín migration giữ nguyên hành trình và sự kiện đã có', async () => {
    const db = env.OTHER_DB;
    await applyD1Migrations(db, env.TEST_MIGRATIONS.slice(0, -1));
    await db.batch([
      db.prepare("INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt,isAnonymous) VALUES ('legacy','Khách','legacy@example.invalid',0,1,1,1)"),
      db.prepare("INSERT INTO journey (user_id,started_on,updated_at) VALUES ('legacy','2026-11-18',1)"),
      db.prepare("INSERT INTO practice_event (user_id,id,program,cycle,local_date,kind,slot,value_json,at,server_at) VALUES ('legacy','old','so-nhap-49',1,'2026-11-18','viec','hanh',NULL,1,1)"),
    ]);
    await applyD1Migrations(db, env.TEST_MIGRATIONS);
    expect(await db.prepare("SELECT day,rev FROM journey WHERE user_id='legacy'").first()).toEqual({ day: 1, rev: 1 });
    expect(await db.prepare("SELECT id,value_json FROM practice_event WHERE user_id='legacy'").first()).toEqual({ id: 'old', value_json: null });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM reminder').first()).toEqual({ n: 0 });
  });
  it('khách mới không tự có lịch nhắc hoặc dữ liệu mới; cấu hình không cộng Kusala/tăng ngày', async () => {
    const { token, user } = await guest();
    for (const table of tables) expect(await count(table, user.id)).toBe(0);
    const before = await (await call('/api/v1/me', {}, token)).json();
    await env.DB.prepare('INSERT INTO practice_profile (user_id, updated_at) VALUES (?, 1)').bind(user.id).run();
    const p = await env.DB.prepare('SELECT * FROM practice_profile WHERE user_id = ?').bind(user.id).first();
    expect(p).toMatchObject({ level: 'vua', minutes: 15, time_window: 'linh_hoat', precepts_json: '[1,2,3,4,5]', uposatha: 'vn_4', no_money: 0, at_home: 0 });
    const after = await (await call('/api/v1/me', {}, token)).json();
    expect(after.totals).toEqual(before.totals); expect(after.journey).toEqual(before.journey);
  });
  it.each([['minutes', 4], ['minutes', 121], ['minutes', 15.5], ['level', 'khac'], ['uposatha', 'tuy_y'], ['no_money', 2], ['precepts_json', '{}']])('từ chối cấu hình sai %s=%s', async (col, value) => {
    const { user } = await guest(); await expect(profile(user.id, col, value).run()).rejects.toThrow();
    expect(await count('practice_profile', user.id)).toBe(0);
  });
  it.each(['24:00', '29:59', '06:60', '6:30'])('từ chối giờ sai %s', async (time) => {
    const { user } = await guest();
    await expect(env.DB.prepare("INSERT INTO reminder (id,user_id,kind,local_hm,channel,created_at) VALUES ('bad',?,'thien',?,'push',1)").bind(user.id, time).run()).rejects.toThrow();
  });
  it('lịch mặc định tắt, chỉ nhận mask 7 ngày và batch lỗi thì rollback', async () => {
    const { user } = await guest();
    await env.DB.prepare("INSERT INTO reminder (id,user_id,kind,local_hm,channel,created_at) VALUES ('valid',?,'thien','06:30','local',1)").bind(user.id).run();
    expect(await env.DB.prepare("SELECT active,days_mask FROM reminder WHERE id='valid'").first()).toEqual({ active: 0, days_mask: 127 });
    await expect(env.DB.batch([profile(user.id), env.DB.prepare("INSERT INTO reminder (id,user_id,kind,local_hm,days_mask,channel,created_at) VALUES ('mask',?,'thien','06:30',128,'local',1)").bind(user.id)])).rejects.toThrow();
    expect(await count('practice_profile', user.id)).toBe(0);
  });
  it('ràng buộc mã thiện hạnh, phạm vi và endpoint/token duy nhất giữa tài khoản', async () => {
    const A = await guest(), B = await guest();
    await expect(env.DB.prepare("INSERT INTO deed_log (id,user_id,local_date,punna,scope,at) VALUES ('bad',?,'2026-11-18','tien','doi_thuc',1)").bind(A.user.id).run()).rejects.toThrow();
    await expect(env.DB.prepare("INSERT INTO deed_log (id,user_id,local_date,punna,scope,at) VALUES ('scope',?,'2026-11-18','sila','khac',1)").bind(A.user.id).run()).rejects.toThrow();
    await env.DB.prepare("INSERT INTO push_subscription (id,user_id,endpoint,p256dh,auth,created_at) VALUES ('p1',?,'https://push.example.invalid/1','key','auth',1)").bind(A.user.id).run();
    await expect(env.DB.prepare("INSERT INTO push_subscription (id,user_id,endpoint,p256dh,auth,created_at) VALUES ('p2',?,'https://push.example.invalid/1','key','auth',1)").bind(B.user.id).run()).rejects.toThrow();
    await env.DB.prepare("INSERT INTO attestation (id,user_id,cycle,week,token_hash,created_at) VALUES ('a1',?,1,1,'hash',1)").bind(A.user.id).run();
    await expect(env.DB.prepare("INSERT INTO attestation (id,user_id,cycle,week,token_hash,created_at) VALUES ('a2',?,1,1,'hash',1)").bind(B.user.id).run()).rejects.toThrow();
  });
  it('xóa người chứng thực giữ bản ghi, xóa chủ nhân cascade cả năm bảng', async () => {
    const A = await guest(), B = await guest();
    await env.DB.batch([
      profile(A.user.id),
      env.DB.prepare("INSERT INTO deed_log (id,user_id,local_date,punna,scope,at) VALUES ('d',?,'2026-11-18','sila','doi_thuc',1)").bind(A.user.id),
      env.DB.prepare("INSERT INTO reminder (id,user_id,kind,local_hm,channel,created_at) VALUES ('r',?,'thien','05:00','local',1)").bind(A.user.id),
      env.DB.prepare("INSERT INTO push_subscription (id,user_id,endpoint,p256dh,auth,created_at) VALUES ('p',?,'https://push.example.invalid/cascade','key','auth',1)").bind(A.user.id),
      env.DB.prepare("INSERT INTO attestation (id,user_id,cycle,week,attester_id,created_at) VALUES ('a',?,1,1,?,1)").bind(A.user.id, B.user.id),
    ]);
    await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(B.user.id).run();
    expect(await env.DB.prepare("SELECT attester_id FROM attestation WHERE id='a'").first()).toEqual({ attester_id: null });
    await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(A.user.id).run();
    for (const table of tables) expect(await count(table, A.user.id)).toBe(0);
    await expect(profile('khong-co-user').run()).rejects.toThrow();
  });
});
