// Chỉ tải mẫu đã sinh lên staging; không phát mẫu qua /media.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { uploadAudio } from './r2.mjs';

try {
  const { values } = parseArgs({ options: { 'bench-dir': { type: 'string' }, date: { type: 'string' }, upload: { type: 'boolean' } } });
  if (!values['bench-dir'] || !/^\d{8}$/.test(values.date || '')) throw new Error('Cần --bench-dir và --date YYYYMMDD');
  const bench = resolve(values['bench-dir']), report = JSON.parse(readFileSync(join(bench, 'scores.json'), 'utf8'));
  if (!values.upload) { console.log(JSON.stringify({ mode: 'check-only', samples: report.scores.length * 3 })); process.exit(0); }
  const links = [];
  for (const row of report.scores) for (let repeat = 1; repeat <= 3; repeat++) {
    const voice = row.voice.split('-').at(-1), key = `bai-giang/_mau-giong/${values.date}/${voice.toLowerCase()}-${repeat}.mp3`;
    const result = await uploadAudio(join(bench, voice, String(repeat), 'con-thien-nga/sample.mp3'), key);
    links.push({ voice, repeat, key, url: result.url });
    console.log(`Mẫu ${voice} lần ${repeat} đã kiểm SHA-256 trên staging`);
  }
  writeFileSync(join(bench, 'listening-links.json'), JSON.stringify({ expires_after_days: 7, links }, null, 2) + '\n');
} catch (error) { console.error(error.message); process.exitCode = 1; }
