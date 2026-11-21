// Không cho một lần Playwright thoát 0 nhưng bỏ qua/không tìm thấy đủ ba ca trở thành CI xanh.
export function checkAccountReport(report) {
  const stats = report?.stats;
  if (!stats || stats.expected !== 3 || stats.unexpected !== 0 || stats.skipped !== 0 || stats.flaky !== 0) {
    throw new Error(`Phải chạy thành công đủ 3 ca tài khoản và Bạn đồng tu, không skip/retry: ${JSON.stringify(stats || null)}`);
  }
  if (report.errors?.length) throw new Error('Playwright có lỗi ngoài ca kiểm thử');
}
