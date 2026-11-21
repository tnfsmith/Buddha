// Giao diện mạng Bạn đồng tu theo hợp đồng #126 §5.
import { HEARTBEAT_MS, PRESENCE, inviteFromHash, normInviteCode } from '@vandao/shared/dong-tu.js';
import { api, updateProfile } from './api.js';
import { idbGet, idbSet } from './idb.js';

const INVITE_KEY = 'dongTuInvite';
const invalidLink = new Set(['link_invalid', 'link_expired', 'link_used_up', 'already_companion', 'self']);
const base = '/api/v1';
const linkUrl = (code) => '/companions/link/' + code;
const idPath = (id) => encodeURIComponent(id);
const visible = () => typeof document !== 'undefined' && document.visibilityState === 'visible';

const EMPTY_SOCIAL = Object.freeze({ requests: 0, invites: 0, sessions: 0, cheers: 0 });
const SOCIAL_KEYS = Object.keys(EMPTY_SOCIAL);

export const dongTu = { on: false, list: null, social: EMPTY_SOCIAL, at: 0 };
const listeners = new Set();
export function onDongTu(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const notify = () => { for (const fn of listeners) fn(dongTu); };
let account = null, epoch = 0, listRequest = null, readingInvite = null, sendingInvite = null;
let presence = 'online', heartbeat = null, hasListeners = false;

function sendPresence() {
  if (dongTu.on && visible()) void request('/presence', 'POST', { state: presence }).catch(() => {});
}

function adjustHeartbeat() {
  if (heartbeat !== null) clearInterval(heartbeat);
  heartbeat = null;
  if (!dongTu.on || !visible()) return;
  sendPresence();
  heartbeat = setInterval(sendPresence, HEARTBEAT_MS);
}

function bindBrowser() {
  if (hasListeners || typeof window === 'undefined') return;
  hasListeners = true;
  document.addEventListener('visibilitychange', adjustHeartbeat);
  window.addEventListener('hashchange', () => { void captureLink().then(flushInvite).catch(() => {}); });
}

function captureLink() {
  const code = typeof location === 'undefined' ? null : inviteFromHash(location.hash);
  if (!code) return Promise.resolve();
  return idbSet('meta', INVITE_KEY, code);
}

/** Móc của account.js. Phiên mới phải tự nhận cờ dong_tu từ /me. */
export function setDongTuAccount(uid) {
  bindBrowser();
  if (account !== uid) {
    account = uid;
    epoch++;
    presence = 'online';
    Object.assign(dongTu, { on: false, list: null, social: EMPTY_SOCIAL, at: 0 });
    adjustHeartbeat();
    notify();
  }
  readingInvite = captureLink().catch(() => {});
}

/** Kết quả GET /me của đúng phiên. Không phát lại phản hồi chậm từ tài khoản trước. */
export function observeDongTuMe(uid, me) {
  if (!account || account !== uid || me?.user?.id !== uid) return;
  const enabled = me.dong_tu === 1;
  const social = enabled
    ? Object.fromEntries(SOCIAL_KEYS.map((key) => [key, Number(me.social?.[key]) || 0]))
    : EMPTY_SOCIAL;
  const changed = enabled !== dongTu.on;
  const refresh = changed || SOCIAL_KEYS.some((key) => social[key] !== dongTu.social[key]);
  dongTu.on = enabled;
  dongTu.social = social;
  if (changed) {
    epoch++;
    if (!enabled) { dongTu.list = null; dongTu.at = 0; }
    adjustHeartbeat();
  }
  if (refresh) {
    notify();
    if (enabled) refreshCompanions();
  }
  if (enabled) void flushInvite();
}

function refreshCompanions() {
  const generation = epoch;
  if (listRequest?.epoch !== generation) {
    void loadCompanions().catch(() => {});
    return;
  }
  // Số mới có thể đến khi yêu cầu cũ đang chạy. Tải lại sau khi yêu cầu đó kết thúc.
  void listRequest.promise.catch(() => {}).then(() => {
    if (generation === epoch) return loadCompanions();
  }).catch(() => {});
}

async function request(path, method = 'GET', body) {
  if (!dongTu.on) return null;
  const generation = epoch;
  const result = await api(base + path, { method, body });
  return generation === epoch ? result : null;
}

export function loadCompanions() {
  if (!dongTu.on) return Promise.resolve(null);
  const generation = epoch;
  if (listRequest?.epoch === generation) return listRequest.promise;
  const promise = request('/companions').then((list) => {
    if (!list || generation !== epoch) return null;
    dongTu.list = list;
    dongTu.at = list.server_now ?? Date.now();
    notify();
    return list;
  }).finally(() => { if (listRequest?.promise === promise) listRequest = null; });
  listRequest = { epoch: generation, promise };
  return promise;
}

async function change(path, method, body) {
  const generation = epoch;
  const result = await request(path, method, body);
  if (generation === epoch && dongTu.on) void loadCompanions().catch(() => {});
  return result;
}

export const createLink = (renew = false) => request('/companions/link', 'POST', { renew });
/** Xem tên người mời là ngoại lệ công khai duy nhất được hợp đồng cho phép. */
export async function linkInfo(input) {
  const code = normInviteCode(input);
  if (!code) return null;
  try { return await api(base + linkUrl(code)); } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function clearInvite(code, generation) {
  const saved = await idbGet('meta', INVITE_KEY).catch(() => null);
  if (epoch !== generation || saved !== code) return;
  await idbSet('meta', INVITE_KEY, null);
  if (typeof location === 'undefined' || inviteFromHash(location.hash) !== code) return;
  const hash = location.hash.slice(1).split('&').filter((part) => !part.startsWith('ban=')).join('&');
  history.replaceState(history.state, '', location.pathname + location.search + (hash ? '#' + hash : ''));
}

async function sendInvite(code) {
  const generation = epoch;
  if (sendingInvite?.epoch === generation && sendingInvite.code === code) return sendingInvite.promise;
  const promise = change(linkUrl(code) + '/accept', 'POST').then(async (result) => {
    if (result) await clearInvite(code, generation).catch(() => {});
    return result;
  }).catch(async (error) => {
    if (invalidLink.has(error.code)) await clearInvite(code, generation).catch(() => {});
    throw error;
  }).finally(() => { if (sendingInvite?.promise === promise) sendingInvite = null; });
  sendingInvite = { epoch: generation, code, promise };
  return promise;
}

export async function acceptLink(input) {
  const code = normInviteCode(input);
  if (!code) return null;
  const generation = epoch;
  await idbSet('meta', INVITE_KEY, code).catch(() => {});
  return generation === epoch && dongTu.on ? sendInvite(code) : null;
}

async function flushInvite() {
  const generation = epoch;
  try {
    await readingInvite;
    const code = normInviteCode(await idbGet('meta', INVITE_KEY));
    if (code && dongTu.on && generation === epoch) await sendInvite(code);
  } catch { /* Giữ mã nếu lần gửi có lỗi tạm thời. */ }
}

export const requestByName = (query) => change('/companions/request', 'POST', { query });
export const withdrawRequest = (id) => change('/companions/requests/' + idPath(id), 'DELETE');
export const respondRequest = (id, accept) => change('/companions/requests/' + idPath(id) + '/respond', 'POST', { accept });
export const setCompanion = (id, prefs) => change('/companions/' + idPath(id), 'PATCH', prefs);
export const removeCompanion = (id) => change('/companions/' + idPath(id), 'DELETE');
export const listBlocks = () => request('/blocks');
export const block = (user) => change('/blocks', 'POST', { user });
export const unblock = (id) => change('/blocks/' + idPath(id), 'DELETE');
export const report = (target, reason) => request('/reports', 'POST', { target, context: 'island', reason });
export const meet = (to, kind, place) => change('/meet', 'POST', { to, kind, place });
export const respondMeet = (id, accept) => change('/meet/' + idPath(id) + '/respond', 'POST', { accept });
export const cancelMeet = (id) => change('/meet/' + idPath(id) + '/cancel', 'POST');

export async function visitAway(host) {
  if (!dongTu.on) return { code: 'not_available' };
  try { return await request('/visits/away', 'POST', { host }) || { code: 'not_available' }; }
  catch (error) { return { code: error.code || 'offline' }; }
}

export function setPresence(state) {
  if (!PRESENCE.includes(state) || state === presence) return;
  presence = state;
  adjustHeartbeat();
}

export async function pushSocialPrefs({ hien_trang_thai, cho_tim, hien_ngay, open }) {
  if (!dongTu.on) return null;
  const generation = epoch;
  const me = await request('/me');
  if (!me || me.user?.id !== account || generation !== epoch) return null;
  const result = await updateProfile({
    settings: { dong_tu: { hien_trang_thai, cho_tim, hien_ngay } },
    island: { ...me.profile?.island, open },
  });
  return generation === epoch ? result : null;
}
