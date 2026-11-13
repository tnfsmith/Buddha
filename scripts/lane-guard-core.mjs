// Lõi thuần của lane-guard (không đụng git/process) để kiểm thử được.
import picomatch from 'picomatch';

export const PREFIX = { 'claude/': 'claude', 'ag/': 'antigravity', 'hermes/': 'hermes', 'owner/': 'owner', 'hotfix/': 'hotfix', 'renovate/': 'deps', 'dependabot/': 'deps' };

export function laneOf(branch) {
  for (const [p, lane] of Object.entries(PREFIX)) if (branch.startsWith(p)) return lane;
  return null;
}

const matcher = (globs = []) => { const ms = globs.map((g) => picomatch(g, { dot: true })); return (f) => ms.some((m) => m(f)); };

/**
 * files: [{ status: 'A'|'M'|'D'|'R', path, from? }]
 * Trả { lane, violations: [{ path, reason }] }
 */
export function check({ branch, files, labels = [], cfg }) {
  const lane = laneOf(branch);
  const v = [];
  if (!lane) return { lane, violations: [{ path: '(nhánh)', reason: `Tên nhánh "${branch}" không có tiền tố hợp lệ: ${Object.keys(PREFIX).join(', ')}` }] };
  const rules = cfg.rules || {};
  const sharedOk = labels.includes('shared-ok');
  const isShared = matcher(cfg.shared);
  const allowedLanes = lane === 'hotfix' ? (rules.hotfix_allows || []) : [lane];
  const own = matcher(allowedLanes.filter((l) => l !== 'shared').flatMap((l) => cfg[l] || []));
  const hotfixShared = lane === 'hotfix' && allowedLanes.includes('shared');
  const isMig = (p) => p.startsWith('db/migrations/');

  for (const f of files) {
    const paths = f.status === 'R' && f.from ? [f.from, f.path] : [f.path];
    // Migration: chỉ thêm mới, và chỉ từ làn được phép
    if (paths.some(isMig) && rules.migrations_append_only && f.status !== 'A') { v.push({ path: f.path, reason: 'Migration đã merge không được sửa, xóa hay đổi tên (chỉ thêm tệp mới)' }); continue; }
    if (isMig(f.path) && f.status === 'A' && !(rules.migrations_only_from || []).includes(lane)) { v.push({ path: f.path, reason: `Migration mới chỉ được tạo từ làn ${(rules.migrations_only_from || []).join('/')}` }); continue; }
    for (const p of paths) {
      if (lane === 'owner') continue;
      if (own(p)) continue;
      if (isShared(p) && (sharedOk || hotfixShared)) continue;
      v.push({ path: p, reason: isShared(p) ? 'Vùng dùng chung: cần nhãn PR `shared-ok`' : `Ngoài làn ${lane}` });
    }
  }
  return { lane, violations: v };
}

export function parseNameStatus(text) {
  return text.split('\n').filter(Boolean).map((line) => {
    const [st, a, b] = line.split('\t');
    const status = st[0];
    return status === 'R' || status === 'C' ? { status: 'R', from: a, path: b } : { status, path: a };
  });
}
