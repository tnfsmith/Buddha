// apps/web/src/net/sync.js
// Quản lý hàng đợi thao tác ngoại tuyến và tự động đồng bộ (PROJECT_ROADMAP.md §5.1, §12.6)
import { idbGetAll, idbSet, idbDelete, idbGet } from './idb.js';
import { postSync, getAuthToken, signInAnonymous } from './api.js';

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
 * Kích hoạt đồng bộ hàng đợi outbox lên máy chủ
 */
export async function triggerSync() {
  if (isSyncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  isSyncing = true;
  try {
    // Đảm bảo đã có phiên đăng nhập
    if (!getAuthToken()) {
      await signInAnonymous();
    }

    const deviceId = await getDeviceId();
    const ops = await idbGetAll('outbox');

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
    const payload = {
      device_id: deviceId,
      client_now: Date.now(),
      tz,
      ops
    };

    const res = await postSync(payload);

    // Xóa các thao tác đã áp dụng thành công khỏi outbox
    if (Array.isArray(res.applied)) {
      for (const opId of res.applied) {
        await idbDelete('outbox', opId);
      }
    }

    // Cập nhật state mới nhất vào IndexedDB
    if (res.state) {
      await idbSet('state', 'current', res.state);
      for (const fn of listeners) {
        try { fn(res.state); } catch {}
      }
    }

    return res;
  } catch (err) {
    console.warn('[Sync] Không thể kết nối máy chủ, giữ dữ liệu trong outbox:', err.message);
  } finally {
    isSyncing = false;
  }
}

// Tự động đồng bộ khi có mạng trở lại hoặc khi chuyển tab
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => triggerSync());
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        triggerSync();
      }
    });
  }
}
