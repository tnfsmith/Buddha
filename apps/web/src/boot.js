// Khởi động phần nền của ứng dụng web: PWA (service worker) và xin lưu trữ bền (PROJECT_ROADMAP.md §19 T1.1).
// Bản HTML đơn mở bằng file:// bỏ qua cả hai, vẫn chạy offline như cũ.

export function registerPWA() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const go = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* lần sau thử lại */ });
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
}

// Xin trình duyệt không tự xóa dữ liệu hành trình khi thiếu dung lượng. Chỉ gọi khi đã có hành trình để tránh hỏi quyền vô cớ.
export async function persistStorage() {
  try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) return await navigator.storage.persist(); } catch (e) { /* trình duyệt không hỗ trợ */ }
  return false;
}
