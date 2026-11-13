// apps/web/src/net/sync.js
// Quản lý hàng đợi thao tác ngoại tuyến và tự động đồng bộ (PROJECT_ROADMAP.md §5.1, §12.6)
import { idbGetAll, idbSet, idbDelete, idbGet } from './idb.js';
import { postSync } from './api.js';

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
export async function enqueueOp(type, payload, at = Date.now()) {
  const op = {
    id: generateClientUlid(),
    type,
    at,
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

let enabled = false;
/** Bật/tắt đồng bộ: chỉ bật khi người dùng đã chọn "Giữ hành trình" (net/account.js). Không tự tạo tài khoản cho người chỉ mở trang. */
export function setSyncEnabled(on) { enabled = Boolean(on); }

// Máy chủ nhận tối đa 8 thao tác mỗi lần (hạn mức truy vấn D1 gói Free) → gửi theo lô, tối đa 25 lô mỗi lượt
const CHUNK = 8;
let running = null, queued = null;
/**
 * Đồng bộ outbox lên máy chủ; trả kết quả lô cuối (có `state`) hoặc undefined nếu chưa gửi được.
 * Gọi trong lúc một lượt đang chạy thì xếp đúng một lượt nữa ngay sau đó: thao tác vừa vào outbox
 * có thể không nằm trong lô đang gửi, nếu bỏ qua nó sẽ nằm lại tới lần có mạng/quay lại tab kế tiếp.
 */
export function triggerSync() {
  if (!enabled) return Promise.resolve();
  if (!running) { running = runSync().finally(() => { running = null; }); return running; }
  if (!queued) queued = running.then(() => { queued = null; return triggerSync(); });
  return queued;
}
async function runSync() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  let last;
  try {
    const deviceId = await getDeviceId(), rejected = [];
    for (let round = 0; round < 25; round++) {
      const ops = (await idbGetAll('outbox')).sort((a, b) => a.at - b.at).slice(0, CHUNK);
      if (!ops.length && round > 0) break;
      const res = await postSync({ device_id: deviceId, client_now: Date.now(), ops });
      // Đã áp dụng (kể cả gửi lại trùng) và bị từ chối vĩnh viễn (retry: false) thì rời outbox; lỗi tạm thời giữ lại
      const drop = [...(res.applied || []), ...(res.rejected || []).filter((r) => !r.retry).map((r) => r.id)];
      for (const opId of drop) await idbDelete('outbox', opId);
      rejected.push(...(res.rejected || []));
      last = res;
      if (ops.length < CHUNK || !drop.length) break;
    }
    // Bản trạng thái máy chủ để giao diện đối chiếu; không ghi vào store `state` (khóa 'vandao.v1' do state.js giữ)
    if (last && last.state) {
      await idbSet('meta', 'serverState', last.state);
      for (const fn of listeners) {
        try { fn(last.state, { ...last, rejected }); } catch { /* bỏ qua lỗi của bộ lắng nghe */ }
      }
    }
    return last;
  } catch (err) {
    console.warn('[Sync] Chưa đồng bộ được, giữ thao tác trong outbox:', err.message);
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
