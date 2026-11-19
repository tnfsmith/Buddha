import { applyD1Migrations, env } from 'cloudflare:test';
import { expect, it } from 'vitest';

const migrationName = '0011_ban_dong_tu.sql';
const insertUser = (db, id) => db.prepare(
  'INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt,isAnonymous) VALUES (?,?,?,0,1,1,1)',
).bind(id, 'Khách', `${id}@example.invalid`);
const insertRequest = (db, id, from, to, tag = '0001') => db.prepare(
  'INSERT INTO companion_request (id,from_id,tinh_danh,tag,to_id,created_at,expires_at) VALUES (?,?,?,?,?,1,100)',
).bind(id, from, 'An Hòa', tag, to);

it('0011 giữ cặp và mã mời cũ, thêm mặc định an toàn khi nâng D1 từ 0010', async () => {
  const db = env.OTHER_DB;
  const before = env.TEST_MIGRATIONS.filter(({ name }) => name < migrationName);
  const migration = env.TEST_MIGRATIONS.filter(({ name }) => name === migrationName);
  expect(migration).toHaveLength(1);
  await applyD1Migrations(db, before);
  await db.batch([
    insertUser(db, 'a'), insertUser(db, 'b'), insertUser(db, 'c'),
    db.prepare("INSERT INTO companion (a,b,status,requested_by,created_at) VALUES ('a','b','dong_y','b',4), ('a','c','cho','a',5)"),
    db.prepare("INSERT INTO invite (code,owner_id,uses_left,expires_at,created_at) VALUES ('CODE1234','a',3,20,1)"),
  ]);
  await applyD1Migrations(db, migration);

  const { results } = await db.prepare(
    'SELECT b,status,requested_by,created_at,accepted_at,source,than_a,than_b,away_a,away_b FROM companion ORDER BY b',
  ).all();
  const defaults = { accepted_at: null, source: 'tim', than_a: 0, than_b: 0, away_a: 0, away_b: 0 };
  expect(results).toEqual([
    { b: 'b', status: 'dong_y', requested_by: 'b', created_at: 4, ...defaults },
    { b: 'c', status: 'cho', requested_by: 'a', created_at: 5, ...defaults },
  ]);
  expect(await db.prepare("SELECT uses_left FROM invite WHERE code='CODE1234'").first()).toEqual({ uses_left: 3 });
});

it('lời kết nối không phụ thuộc việc có người nhận, khóa trùng theo người gửi và danh tính đã gõ', async () => {
  const db = env.DB;
  await db.batch([
    insertUser(db, 'sender'), insertUser(db, 'recipient'),
    insertRequest(db, 'with-recipient', 'sender', 'recipient'),
    insertRequest(db, 'without-recipient', 'sender', null, '0002'),
  ]);
  await expect(insertRequest(db, 'duplicate', 'sender', null).run()).rejects.toThrow();
  expect(await db.prepare("SELECT to_id FROM companion_request WHERE id='without-recipient'").first()).toEqual({ to_id: null });
  await expect(insertRequest(db, 'bad-sender', 'missing-user', null).run()).rejects.toThrow();
});

it('cách ly ghé đảo theo ngày và giữ ràng buộc loại gặp, hiện diện', async () => {
  const db = env.DB;
  await db.batch([
    insertUser(db, 'host'), insertUser(db, 'visitor'),
    db.prepare("INSERT INTO presence (user_id,state,updated_at) VALUES ('host','thien',1)"),
    db.prepare("INSERT INTO meet_invite (id,from_id,to_id,kind,place,created_at) VALUES ('invite','host','visitor','thien','dtd',1)"),
    db.prepare("INSERT INTO island_visit (host_id,guest_id,day,at) VALUES ('host','visitor','2026-11-19',1)"),
  ]);
  expect(await db.prepare("SELECT status,start_at FROM meet_invite WHERE id='invite'").first()).toEqual({ status: 'cho', start_at: null });
  await expect(db.prepare("UPDATE presence SET state='vang' WHERE user_id='host'").run()).rejects.toThrow();
  await expect(db.prepare("UPDATE meet_invite SET kind='khac' WHERE id='invite'").run()).rejects.toThrow();
  await expect(db.prepare("UPDATE meet_invite SET to_id=from_id WHERE id='invite'").run()).rejects.toThrow();
  await expect(db.prepare("INSERT INTO island_visit (host_id,guest_id,day,at) VALUES ('host','visitor','2026-11-19',2)").run()).rejects.toThrow();
  await db.prepare("INSERT INTO island_visit (host_id,guest_id,day,at) VALUES ('host','visitor','2026-11-20',2)").run();
});

it('xóa người nhận giữ lời kết nối của người gửi và xóa liên kết còn lại', async () => {
  const db = env.DB;
  await db.batch([
    insertUser(db, 'a'), insertUser(db, 'b'),
    insertRequest(db, 'ab', 'a', 'b'),
    insertRequest(db, 'ba', 'b', 'a'),
    db.prepare("INSERT INTO companion (a,b,status,requested_by,created_at) VALUES ('a','b','dong_y','a',1)"),
    db.prepare("INSERT INTO presence (user_id,state,updated_at) VALUES ('b','online',1)"),
    db.prepare("INSERT INTO meet_invite (id,from_id,to_id,kind,place,created_at) VALUES ('delete-invite','a','b','thien','dtd',1)"),
    db.prepare("INSERT INTO island_visit (host_id,guest_id,day,at) VALUES ('b','a','2026-11-19',1)"),
  ]);
  await db.prepare("DELETE FROM user WHERE id='b'").run();
  const { results } = await db.prepare("SELECT id,from_id,to_id,tinh_danh,tag FROM companion_request WHERE id IN ('ab','ba')").all();
  expect(results).toEqual([{ id: 'ab', from_id: 'a', to_id: null, tinh_danh: 'An Hòa', tag: '0001' }]);
  expect(await db.prepare("SELECT a FROM companion WHERE a='a' AND b='b'").first()).toBeNull();
  expect(await db.prepare("SELECT user_id FROM presence WHERE user_id='b'").first()).toBeNull();
  expect(await db.prepare("SELECT id FROM meet_invite WHERE id='delete-invite'").first()).toBeNull();
  expect(await db.prepare("SELECT host_id FROM island_visit WHERE host_id='b'").first()).toBeNull();
  await db.prepare("DELETE FROM user WHERE id='a'").run();
  expect(await db.prepare("SELECT id FROM companion_request WHERE id='ab'").first()).toBeNull();
});
