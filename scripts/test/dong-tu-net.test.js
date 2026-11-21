import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEARTBEAT_MS } from '@vandao/shared/dong-tu.js';

const storage = vi.hoisted(() => new Map());
vi.mock('../../apps/web/src/net/idb.js', () => ({
  idbGet: async (store, key) => storage.get(store + ':' + key),
  idbSet: async (store, key, value) => storage.set(store + ':' + key, value),
}));

const uid = 'guest-00001';
const enabled = (userId = uid, requests = 0) => ({ user: { id: userId, isAnonymous: true }, dong_tu: 1, social: { requests, invites: 0 } });
let net, seen, tab;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  storage.clear();
  tab = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', tab);
  vi.stubGlobal('location', { hash: '', pathname: '/', search: '' });
  vi.stubGlobal('history', { replaceState: vi.fn() });
  seen = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    seen.push([url, options.method, options.body ? JSON.parse(options.body) : null]);
    if (url === '/api/v1/presence') return new Response(null, { status: 204 });
    return Response.json({ server_now: 100 });
  }));
  net = await import('../../apps/web/src/net/dong-tu.js');
  net.setDongTuAccount(null);
});
afterEach(() => {
  net.setDongTuAccount(null);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('mạng Bạn đồng tu #123', () => {
  it('khóa đường dẫn riêng khi thiếu phiên hoặc cờ tính năng, kể cả khi có trạng thái mới', async () => {
    net.setPresence('thien');
    expect(await net.loadCompanions()).toBeNull();
    net.setDongTuAccount(uid);
    net.observeDongTuMe(uid, { user: { id: uid } });
    expect(await net.createLink()).toBeNull();
    expect(await net.visitAway(uid)).toEqual({ code: 'not_available' });
    expect(await net.linkInfo('bad')).toBeNull();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
    expect(seen).toEqual([]);
  });

  it('nhận mã lúc chưa có phiên rồi dùng một lần khi phiên khách được bật', async () => {
    globalThis.location.hash = '#q=2&ban=ABCD-EF12';
    net.setDongTuAccount(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(storage.get('meta:dongTuInvite')).toBe('ABCDEF12');
    expect(seen).toEqual([]);
    net.setDongTuAccount(uid);
    net.observeDongTuMe(uid, enabled());
    net.observeDongTuMe(uid, enabled());
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.filter(([path]) => path.endsWith('/accept'))).toEqual([
      ['/api/v1/companions/link/ABCDEF12/accept', 'POST', null],
    ]);
    expect(storage.get('meta:dongTuInvite')).toBeNull();
    expect(globalThis.history.replaceState).toHaveBeenCalledWith(undefined, '', '/#q=2');
    expect(net.dongTu.on).toBe(true);
  });

  it('gửi nhịp khi đang xem, dừng khi ẩn hoặc đăng xuất, đổi trạng thái gửi ngay', async () => {
    const heartbeats = () => seen.filter(([path]) => path.endsWith('/presence')).map(([, , body]) => body.state);
    net.setDongTuAccount(uid);
    net.observeDongTuMe(uid, enabled());
    expect(heartbeats()).toEqual(['online']);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    net.setPresence('thien');
    expect(heartbeats()).toEqual(['online', 'online', 'thien']);
    tab.visibilityState = 'hidden';
    tab.dispatchEvent(new Event('visibilitychange'));
    net.setPresence('tra');
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
    expect(heartbeats()).toEqual(['online', 'online', 'thien']);
    tab.visibilityState = 'visible';
    tab.dispatchEvent(new Event('visibilitychange'));
    expect(heartbeats()).toEqual(['online', 'online', 'thien', 'tra']);
    net.setDongTuAccount(null);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(heartbeats()).toHaveLength(4);
  });

  it('đổi số lời mời tải lại và không đưa phản hồi chậm sang tài khoản khác', async () => {
    net.setDongTuAccount(uid);
    net.observeDongTuMe(uid, enabled());
    await net.loadCompanions();
    net.observeDongTuMe(uid, enabled(uid, 1));
    await net.loadCompanions();
    expect(seen.filter(([path]) => path.endsWith('/companions'))).toHaveLength(2);
    const other = 'guest-00002';
    let release;
    fetch.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const pending = net.loadCompanions();
    net.setDongTuAccount(other);
    net.observeDongTuMe(uid, enabled(uid, 2));
    release(Response.json({ companions: [{ id: 'old' }] }));
    expect(await pending).toBeNull();
    expect(net.dongTu.on).toBe(false);
    expect(net.dongTu.list).toBeNull();
  });
  it('giữ phiên hẹn và khích lệ, tải lại sau phản hồi cũ, đặt về 0 khi đổi tài khoản', async () => {
    net.setDongTuAccount(uid);
    net.observeDongTuMe(uid, enabled());
    await net.loadCompanions();
    expect(net.dongTu.social).toEqual({ requests: 0, invites: 0, sessions: 0, cheers: 0 });

    let release;
    fetch.mockImplementationOnce((url, options) => {
      seen.push([url, options.method, null]);
      return new Promise((resolve) => { release = resolve; });
    });
    const old = net.loadCompanions();
    const current = enabled();
    Object.assign(current.social, { sessions: 2, cheers: 1 });
    net.observeDongTuMe(uid, current);
    expect(net.dongTu.social).toMatchObject({ sessions: 2, cheers: 1 });
    release(Response.json({ server_now: 101 }));
    await old;
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.filter(([path]) => path.endsWith('/companions'))).toHaveLength(3);

    net.observeDongTuMe(uid, current);
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.filter(([path]) => path.endsWith('/companions'))).toHaveLength(3);

    current.social.cheers = 3;
    net.observeDongTuMe(uid, current);
    await net.loadCompanions();
    expect(seen.filter(([path]) => path.endsWith('/companions'))).toHaveLength(4);

    net.setDongTuAccount('guest-00002');
    net.observeDongTuMe(uid, current);
    expect(net.dongTu.social).toMatchObject({ sessions: 0, cheers: 0 });
    expect(net.dongTu.list).toBeNull();
  });
});
