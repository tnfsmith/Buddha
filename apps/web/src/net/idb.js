// apps/web/src/net/idb.js
// Lưu trữ phía client bằng IndexedDB thay cho localStorage (PROJECT_ROADMAP.md §4.5)

const DB_NAME = 'vandao';
const DB_VERSION = 2;

let dbPromise = null;

export function openIdb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB không được hỗ trợ trong môi trường này'));
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state');
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('kusala')) {
        const store = db.createObjectStore('kusala', { keyPath: 'id' });
        store.createIndex('by_date', 'local_date', { unique: false });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // tab khác (bản mới hơn) cần nâng lược đồ: đóng kết nối này để không chặn nâng cấp, lần gọi sau mở lại
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => { dbPromise = null; reject(new Error('IndexedDB đang bị tab cũ giữ, chưa nâng cấp được')); };
  });

  return dbPromise;
}

export async function idbGet(storeName, key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(storeName, key, value) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = key !== undefined ? store.put(value, key) : store.put(value);
    // chỉ báo xong khi giao dịch đã ghi (complete), không phải khi yêu cầu put vừa được nhận
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB: giao dịch bị hủy'));
  });
}

export async function idbGetAll(storeName) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(storeName, key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB: giao dịch bị hủy'));
  });
}
