// Dọn context sau mỗi ca (#156, #173). Context mở bằng browser.newContext() không tự đóng: với một worker, nó sống sang
// các ca sau và trang trong đó vẫn chạy (vẽ cảnh, hẹn giờ), làm SwiftShader chậm dần và nhóm CI chạm trần 40 phút.
import { test } from '@playwright/test';

export function closeContextsAfterEach() {
  let before = new Set();
  test.beforeEach(({ browser }) => { before = new Set(browser.contexts()); });
  test.afterEach(async ({ browser }) => {
    await Promise.all(browser.contexts().filter((c) => !before.has(c)).map((c) => c.close().catch(() => {})));
  });
}
