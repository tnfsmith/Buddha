// Cổng chuyển tiếp #35: không gắn mã cần schema mới vào D1 staging qua Version URL.
export function previewMigrationPolicy(paths) {
  const migrations = paths.filter(path => /^db\/migrations\/[^/]+\.sql$/.test(path));
  return { remoteAllowed: migrations.length === 0, migrations };
}
