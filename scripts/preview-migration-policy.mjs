// Cổng chuyển tiếp #35: không gắn mã cần schema mới vào D1 staging qua Version URL.
export function previewMigrationPolicy(paths, { isolated = false, required = false } = {}) {
  const migrations = paths.filter(path => /^db\/migrations\/[^/]+\.sql$/.test(path));
  return { remoteAllowed: isolated || (!required && migrations.length === 0), migrations };
}
