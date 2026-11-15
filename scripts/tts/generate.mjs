// Chỉ ghi đầu ra vào worktree hermes/. Khóa R2/lock chỉ ghi sau khi hai bucket khớp SHA-256.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { parseContent } from '../content-data.mjs';
import { spokenLines, fingerprint, audioKey, gradeClip, clipRank } from './core.mjs';
import { synthesize, recognize, maleVoices } from './google.mjs';
import { seconds, joinSpeech } from './audio.mjs';
import { uploadAudio } from './r2.mjs';
import { validateAudioLock, validateCues } from './lock.mjs';
import { audioProfile, asrText, AI_DISCLOSURE } from './profile.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const names = ['Đức Phật', 'Tất Đạt Đa', 'Đề Bà Đạt Đa', 'Ca Tỳ La Vệ', 'Kiều Trần Như', 'La Hầu La'];
const readJson = file => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
const saveJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
try {
  const { values } = parseArgs({ options: { series: { type: 'string' }, batch: { type: 'string' }, 'content-root': { type: 'string' }, upload: { type: 'boolean' }, 'allow-drafts': { type: 'boolean' } } });
  const contentDir = resolve(values['content-root'] || join(root, 'content/bai-giang'));
  const config = readJson(join(root, 'scripts/tts/giong.json'));
  if (!config?.voice || config.provider !== 'google') throw new Error('Chưa có giọng Google được chọn bằng bảng điểm/QA');
  const dictFile = join(contentDir, '../tu-dien-doc.yml');
  const dictionary = existsSync(dictFile) ? parseDocument(readFileSync(dictFile, 'utf8')).toJS() : {};
  const files = readdirSync(contentDir).filter(file => file.endsWith('.md') && file.toLowerCase() !== 'readme.md');
  const articles = files.map(file => ({ ...parseContent(readFileSync(join(contentDir, file), 'utf8'), file), file }))
    .filter(a => (a.meta?.loat || 'loi-phat-day') === values.series && (!values.batch || a.meta?.dot === values.batch))
    .filter(a => a.status === 'da_duyet' || (values['allow-drafts'] && a.status === 'cho_duyet'));
  if (!articles.length) throw new Error('Không có bài khớp loạt/đợt/trạng thái');
  const lockFile = join(contentDir, '_audio.lock.json'), lock = readJson(lockFile) || { v: 1, items: [] };
  if (!Array.isArray(lock.items) || lock.items.some(x => x.model !== config.model || x.provider !== config.provider)) throw new Error('Sổ âm thanh đang có nhà cung cấp/mô hình khác');
  if (!values.upload) { console.log(JSON.stringify({ mode: 'check-only', voice: config.voice, articles: articles.map(a => ({ id: a.id, version: a.version, ideas: spokenLines(a.body, dictionary).length })) })); process.exit(0); }
  const gitRoot = execFileSync('git', ['-C', contentDir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['-C', contentDir, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
  if (!branch.startsWith('hermes/') || contentDir !== resolve(gitRoot, 'content/bai-giang')) throw new Error('Đầu ra phải là content/bai-giang trong worktree hermes/');
  const catalog = await maleVoices();
  if (articles.some(a => !catalog.some(v => v.name === audioProfile(a, config).voice))) throw new Error('Giọng đã chọn không có trong danh sách giọng nam Google vi-VN');
  const queue = [...articles];
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
    try { while (queue.length && !failed) {
      const article = queue.shift(), lines = spokenLines(article.body, dictionary), profile = audioProfile(article, config);
      const hash = fingerprint(lines, profile), key = audioKey(article, hash, profile.voice);
      if (!article.title || !article.source_ref || !lines.length) throw new Error('Bài thiếu tên/nguồn/nội dung');
      const dir = join(root, '.wrangler/tts-generated', article.id, hash.slice(0, 8));
      mkdirSync(dir, { recursive: true });
      const wavs = [], scores = [], flags = [];
      const previous = readJson(join(dir, 'result.json'));
      const mp3 = join(dir, 'vi.mp3'), cueFile = join(dir, 'vi.cues.json');
      const reusable = previous?.key === key && existsSync(mp3) && existsSync(cueFile)
        && createHash('sha256').update(readFileSync(mp3)).digest('hex') === previous.sha256;
      if (!reusable) {
      for (let i = 0; i < lines.length; i++) {
        let chosen;
        for (let attempt = 1; attempt <= 4; attempt++) {
          const base = join(dir, `${i}-${attempt}`), cached = readJson(base + '.json');
          let wav, score;
          if (cached && cached.hash === hash && existsSync(base + '.wav')) { wav = readFileSync(base + '.wav'); score = cached; }
          else {
            wav = !cached && existsSync(base + '.wav') ? readFileSync(base + '.wav')
              : await synthesize(lines[i], profile.voice, profile.speed, { markup: profile.markup });
            writeFileSync(base + '.wav', wav);
            const transcript = await recognize(wav);
            score = { hash, transcript, attempt, i, ...gradeClip(asrText(lines[i]), transcript, seconds(wav), names) };
            saveJson(base + '.json', score);
          }
          if (!chosen || clipRank(score) < clipRank(chosen.score)) chosen = { wav, score };
          if (score.pass) { chosen = { wav, score }; break; }
        }
        wavs.push(chosen.wav); scores.push(chosen.score);
        if (!chosen.score.pass) flags.push({ i, wer: chosen.score.wer, tail_ok: chosen.score.tailOk, names_ok: chosen.score.namesOk, seconds_per_word: chosen.score.secondsPerWord });
        console.log(`tts: ${article.id} ý ${i + 1}/${lines.length}, WER ${(100 * chosen.score.wer).toFixed(2)}%${chosen.score.pass ? '' : ' [cần nghe kiểm]'} `);
      }
      const audio = joinSpeech(wavs, mp3, profile);
      saveJson(cueFile, { v: 1, id: article.id, version: article.version, lang: 'vi', voice: profile.voice, provider: config.provider, model: config.model,
        hash: hash.slice(0, 8), dur: audio.dur, speed: profile.speed, cues: audio.cues });
      // Lưu kết quả trước upload để lần chạy lại không mã hóa/sinh lại khóa bất biến.
      saveJson(join(dir, 'result.json'), { id: article.id, version: article.version, key, hash: hash.slice(0, 8), fingerprint: hash, dur: audio.dur,
        voice: profile.voice, model: config.model, provider: config.provider, generated_at: new Date().toISOString(),
        speed: profile.speed, format: audio.format, ...(profile.aiId3 ? { ai_disclosure: AI_DISCLOSURE } : {}),
        wer: scores.reduce((sum, x) => sum + x.wer, 0) / scores.length,
        sha256: createHash('sha256').update(readFileSync(mp3)).digest('hex'), loudness: audio.loudness,
        selected_attempts: scores.map(x => x.attempt), flags });
      }
      const row = readJson(join(dir, 'result.json'));
      validateCues(article, readJson(cueFile), dictionary);
      validateAudioLock([{ ...article, body_r2_key: key }], { v: 1, items: [row] }, config, dictionary);
      let digest;
      for (const target of ['STAGING', 'PROD']) {
        const uploaded = await uploadAudio(mp3, key, target);
        digest = uploaded.sha256;
        await uploadAudio(cueFile, key.replace('.mp3', '.cues.json'), target);
      }
      if (digest !== row.sha256) throw new Error('SHA-256 sau upload không khớp sổ âm thanh');
      const index = lock.items.findIndex(x => x.id === row.id && x.version === row.version);
      if (index < 0) lock.items.push(row); else lock.items[index] = row;
      lock.items.sort((a, b) => a.id.localeCompare(b.id) || a.version - b.version);
      const file = join(contentDir, article.file), original = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      const match = original.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      const doc = parseDocument(match[1]); doc.set('body_r2_key', key);
      writeFileSync(file, '---\n' + doc.toString() + '---\n' + match[2]);
      saveJson(lockFile, lock);
      saveJson(join(dir, 'result.json'), row);
      console.log(JSON.stringify({ uploaded_both: true, id: row.id, key, duration: row.dur, wer: row.wer, flagged_ideas: row.flags.length, reused: reusable }));
    } } catch (error) { failed = true; throw error; }
  }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
