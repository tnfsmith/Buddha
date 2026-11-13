// apps/web/src/net/api.js
// Client API gọi máy chủ Vân Đạo (PROJECT_ROADMAP.md §5, §6)
import { idbGet, idbSet } from './idb.js';

let authToken = null;
let lastBookmark = null;

export function setAuthToken(token) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export async function initAuth() {
  try {
    const saved = await idbGet('meta', 'token');
    if (saved) authToken = saved;
  } catch {
    // Không thể đọc idb
  }
}

/**
 * Thực hiện gọi API với tự động gán Bearer Token và theo dõi bookmark D1
 */
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  if (lastBookmark) {
    headers.set('x-d1-bookmark', lastBookmark);
  }

  const res = await fetch(path, {
    ...options,
    headers
  });

  const bm = res.headers.get('x-d1-bookmark');
  if (bm) lastBookmark = bm;

  return res;
}

/**
 * Đăng nhập ẩn danh tạo khách
 */
export async function signInAnonymous(initialName) {
  const res = await apiFetch('/api/auth/sign-in/anonymous', {
    method: 'POST',
    body: JSON.stringify({ tinh_danh: initialName })
  });

  if (!res.ok) {
    throw new Error(`Đăng nhập ẩn danh thất bại: ${res.status}`);
  }

  const data = await res.json();
  if (data?.session?.token) {
    authToken = data.session.token;
    await idbSet('meta', 'token', authToken);
  }
  return data;
}

/**
 * Lấy trạng thái hiện tại từ máy chủ
 */
export async function getMe() {
  const res = await apiFetch('/api/v1/me');
  if (!res.ok) {
    throw new Error(`Lấy trạng thái thất bại: ${res.status}`);
  }
  return res.json();
}

/**
 * Cập nhật hồ sơ
 */
export async function updateProfile(fields) {
  const res = await apiFetch('/api/v1/profile', {
    method: 'PATCH',
    body: JSON.stringify(fields)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Cập nhật hồ sơ thất bại: ${res.status}`);
  }
  return res.json();
}

/**
 * Gửi các thao tác offline lên máy chủ qua /sync
 */
export async function postSync(payload) {
  const res = await apiFetch('/api/v1/sync', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Đồng bộ thất bại: ${res.status}`);
  }
  return res.json();
}

/**
 * Lấy vé vào phòng thời gian thực
 */
export async function getRtTicket(room) {
  const res = await apiFetch('/api/v1/rt/ticket', {
    method: 'POST',
    body: JSON.stringify({ room })
  });
  if (!res.ok) {
    throw new Error(`Lấy vé phòng thất bại: ${res.status}`);
  }
  return res.json();
}
