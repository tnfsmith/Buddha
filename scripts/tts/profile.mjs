// Chỉ các thẻ pause của Chirp 3 HD được phép nằm trong vế cách đọc.
export const readingMarkup = /\[\[([^|[\]\n]+)\|((?:[^|[\]\n]|\[pause(?: (?:short|long))?\])+)\]\]/g;
export const BASE_FORMAT = 'mono24k-96k-lufs16-tp1.5-gap0.9-last1.5-verified-v2';
export const AI_DISCLOSURE = 'Giọng đọc tạo bằng AI — Google Chirp 3 HD';

export function audioProfile(article, config) {
  const ritual = article.meta?.loat === 'nghi-thuc';
  if (ritual && !['mo-dau', 'ket-thuc'].includes(article.meta?.vai)) throw new Error('Nghi thức thiếu vai hợp lệ');
  const speed = ritual ? (article.meta?.audio?.speed ?? config.speed) : config.speed;
  if (ritual && ![0.8, 0.85].includes(speed)) throw new Error('Nghi thức chỉ có bản 0,80 hoặc 0,85');
  const voice = ritual ? (article.meta?.audio?.voice ?? config.voice) : config.voice;
  if (ritual && !/^vi-VN-Chirp3-HD-[A-Za-z]+$/.test(voice)) throw new Error('Giọng nghi thức phải là Chirp3-HD vi-VN');
  const aiId3 = ritual || article.meta?.loat === 'duong-xua';
  return { ...config, voice, speed, gap: ritual ? 1.2 : 0.9, lastGap: ritual ? 1.2 : 1.5, aiId3, markup: ritual,
    formatLabel: ritual ? 'mono24k-96k-lufs16-tp1.5-gap1.2-last1.2-markup-ai-id3-v1' : BASE_FORMAT + (aiId3 ? '-ai-id3-v1' : '') };
}

export function asrText(text) {
  return text.replace(/\[pause(?: (?:short|long))?\]/g, ' ').replace(/\s+/g, ' ').trim();
}
