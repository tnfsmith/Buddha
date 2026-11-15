// Đọc kiểm R2 của cả hai môi trường; không upload, không sửa nội dung.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { parseContent } from '../content-data.mjs';
import { validateAudioLock, validateCues } from './lock.mjs';
import { listenUrl } from './r2.mjs';
import { audioProfile } from './profile.mjs';
import { addAiMetadata } from './id3.mjs';

try {
  const { values } = parseArgs({ options: { 'content-root': { type: 'string' }, series: { type: 'string' }, batch: { type: 'string' } } });
  const root = fileURLToPath(new URL('../../', import.meta.url)), dir = resolve(values['content-root'] || join(root, 'content/bai-giang'));
  const lock = JSON.parse(readFileSync(join(dir, '_audio.lock.json'), 'utf8')), config = JSON.parse(readFileSync(join(root, 'scripts/tts/giong.json'), 'utf8'));
  const dictFile = join(dir, '../tu-dien-doc.yml'), dictionary = existsSync(dictFile) ? parseDocument(readFileSync(dictFile, 'utf8')).toJS() : {};
  const articles = readdirSync(dir).filter(x => x.endsWith('.md') && x.toLowerCase() !== 'readme.md').map(x => parseContent(readFileSync(join(dir, x), 'utf8')));
  validateAudioLock(articles, lock, config, dictionary);
  const selected = articles.filter(a => a.body_r2_key && (!values.series || a.meta?.loat === values.series) && (!values.batch || a.meta?.dot === values.batch));
  if (!selected.length) throw new Error('Không có bài có âm thanh khớp bộ lọc');
  const results = [];
  for (const article of selected) {
    const row = lock.items.find(x => x.id === article.id && x.version === article.version), targets = {};
    let cueHash;
    for (const target of ['STAGING', 'PROD']) {
      const url = await listenUrl(row.key, target), cueUrl = await listenUrl(row.key.replace('.mp3', '.cues.json'), target);
      const audio = await fetch(url, { signal: AbortSignal.timeout(60000) }), cueResponse = await fetch(cueUrl, { signal: AbortSignal.timeout(30000) });
      if (audio.status !== 200 || !audio.headers.get('content-type')?.startsWith('audio/mpeg') || cueResponse.status !== 200
        || !cueResponse.headers.get('content-type')?.startsWith('application/json')) throw new Error(`R2 thiếu/sai Content-Type: ${article.id} ${target}`);
      const bytes = Buffer.from(await audio.arrayBuffer()), sha = createHash('sha256').update(bytes).digest('hex');
      if (audioProfile(article, config).aiId3 && !addAiMetadata(bytes).equals(bytes)) throw new Error(`R2 thiếu ID3 AI: ${article.id} ${target}`);
      const cueText = await cueResponse.text(), cues = JSON.parse(cueText), actualCueHash = createHash('sha256').update(cueText).digest('hex');
      if (sha !== row.sha256 || (cueHash && cueHash !== actualCueHash) || cues.voice !== row.voice || cues.model !== row.model || cues.provider !== row.provider
        || cues.hash !== row.hash || Math.abs(cues.dur - row.dur) > 0.001) throw new Error(`R2 không khớp sổ/hai bucket: ${article.id}`);
      cueHash = actualCueHash;
      targets[target] = { audio_sha256: sha, cues_sha256: actualCueHash, ideas: validateCues(article, cues, dictionary), url };
    }
    results.push({ ...row, targets }); console.log(`R2 hai bucket khớp: ${article.id}, ${targets.STAGING.ideas} ý, ${row.flags?.length || 0} cờ nghe kiểm`);
  }
  const outDir = join(root, '.wrangler/tts-audit'); mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'latest.json'), JSON.stringify({ checked_at: new Date().toISOString(), results }, null, 2) + '\n');
} catch (error) { console.error(error.message); process.exitCode = 1; }
