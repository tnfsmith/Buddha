// apps/web/src/net/legacy.js
// Chuyển dữ liệu cũ từ localStorage['vandao.v1'] sang IndexedDB (PROJECT_ROADMAP.md Phụ lục A)
import { idbSet, idbGet } from './idb.js';

const LEGACY_KEY = 'vandao.v1';
const MIGRATED_FLAG = 'vandao.v1.migrated_at';

export async function migrateLegacyStorage() {
  if (typeof localStorage === 'undefined') return;

  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;

  const alreadyMigrated = await idbGet('meta', 'legacy_migrated');
  if (alreadyMigrated) return;

  try {
    const data = JSON.parse(raw);
    const now = Date.now();

    // Ánh xạ theo bảng Phụ lục A
    const profile = {
      tinh_danh: data.name || 'An Tịnh',
      look: data.look || { v: 1, robe: 0, hair: 0, tone: 0 },
      settings: {
        music: data.music,
        birds: data.birds,
        tts: data.tts,
        radar: data.radar
      },
      island: {
        pos: data.pos,
        open: data.open
      }
    };

    const journey = {
      program: 'so-nhap-49',
      cycle: 1,
      day: data.day || 1,
      last_done_on: data.lastDate || null,
      completed_at: data.completed ? now : null,
      sacca_count: data.sacca || 0,
      sessions_done: data.sessions || 0,
      sermons_done: data.sermons || 0
    };

    // Lưu vào IndexedDB
    await idbSet('state', 'current', { profile, journey });

    // Đánh dấu đã chuyển đổi
    await idbSet('meta', 'legacy_migrated', now);
    localStorage.setItem(MIGRATED_FLAG, String(now));

    console.log('[Migration] Đã chuyển đổi thành công localStorage cũ sang IndexedDB');
  } catch (err) {
    console.error('[Migration] Lỗi khi chuyển đổi dữ liệu cũ:', err);
  }
}
