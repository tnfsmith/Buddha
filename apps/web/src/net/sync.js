// apps/web/src/net/sync.js
// Quản lý hàng đợi thao tác ngoại tuyến và tự động đồng bộ (PROJECT_ROADMAP.md §5.1, §12.6)
import { idbGetAll, idbSet, idbDelete, idbGet } from './idb.js';
import { postSync, getAuthToken } from './api.js';

let isSyncing = false;
const listeners = new Set();

/**
 * Sinh chuỗi ID 26 ký tự (ULID) phía client
 */
export function generateClientUlid() {
  const time = Date.now();
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let str = '';
  let t = time;
  for (let i = 9; i >= 0; i--) {
    str = chars[t % 32] + str;
    t = Math.floor(t / 32);
  }
  const randomBytes = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  }
  for (let i = 0; i < 10; i++) {
    str += chars[randomBytes[i] % 32];
  }
  return str;
}

/**
 * Lấy hoặc khởi tạo device_id duy nhất cho thiết bị
 */
export async function getDeviceId() {
  let id = await idbGet('meta', 'device_id');
  if (!id) {
    id = generateClientUlid();
    await idbSet('meta', 'device_id', id);
  }
  return id;
}

/**
 * Đưa một thao tác mới vào hàng đợi outbox
 */
export async function enqueueOp(type, payload) {
  const op = {
    id: generateClientUlid(),
    type,
    at: Date.now(),
    payload
  };

  await idbSet('outbox', undefined, op);

  // Nếu đang online, kích hoạt đồng bộ ngay
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    triggerSync().catch(() => {});
  }

  return op;
}

/**
 * Đăng ký lắng nghe sự kiện đồng bộ hoàn tất
 */
export function onSyncComplete(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Đồng bộ outbox lên máy chủ. Chỉ chạy khi người dùng đã bật "Giữ hành trình" (đã có phiên đăng nhập, xem T2.3 #12):
 * không tự tạo tài khoản khách cho mọi người mở trang.
 */
export async function triggerSync() {
  if (isSyncing || !getAuthToken()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  isSyncing = true;
  try {
    const deviceId = await getDeviceId();
    const ops = await idbGetAll('outbox');
    const res = await postSync({ device_id: deviceId, client_now: Date.now(), ops });

    // Đã áp dụng (kể cả gửi lại trùng) và bị từ chối vĩnh viễn (retry: false) thì rời outbox; lỗi tạm thời giữ lại
    const drop = [...(res.applied || []), ...(res.rejected || []).filter((r) => !r.retry).map((r) => r.id)];
    for (const opId of drop) await idbDelete('outbox', opId);

    // Bản trạng thái máy chủ để giao diện đối chiếu; không ghi vào store `state` (khóa 'vandao.v1' do state.js giữ)
    if (res.state) {
      await idbSet('meta', 'serverState', res.state);
      for (const fn of listeners) {
        try { fn(res.state, res); } catch { /* bỏ qua lỗi của bộ lắng nghe */ }
      }
    }
    return res;
  } catch (err) {
    console.warn('[Sync] Chưa đồng bộ được, giữ thao tác trong outbox:', err.message);
  } finally {
    isSyncing = false;
  }
}

let autoOn = false;
/** Bật tự đồng bộ khi có mạng trở lại hoặc khi quay lại tab (gọi sau khi người dùng bật "Giữ hành trình") */
export function startAutoSync() {
  if (autoOn || typeof window === 'undefined') return;
  autoOn = true;
  window.addEventListener('online', () => triggerSync());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') triggerSync(); });
  triggerSync();
}
