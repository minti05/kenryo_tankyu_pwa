import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/tests/loading-bootstrap.html', async (route) => {
    const response = await route.fetch({ url: new URL('/', route.request().url()).href });
    await route.fulfill({
      response,
      body: (await response.text()).replace('/src/app/main.tsx', '/tests/loading-harness.tsx'),
    });
  });
});

test('HTML初期表示と認証待ちで同じSVGを保ち、1秒未満でも準備ができ次第進む', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/tests/loading-harness.tsx', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/tests/loading-bootstrap.html', { waitUntil: 'commit' });
  const screen = page.locator('#app-startup');
  await expect(screen).toBeVisible();
  await screen.locator('svg').evaluate((el) => {
    el.setAttribute('data-original-node', 'yes');
  });
  release();
  await page.waitForFunction(() => 'finishStartup' in window);
  await expect(screen).toBeVisible();
  await expect(screen.locator('svg')).toHaveAttribute('data-original-node', 'yes');
  await page.evaluate(() => (window as unknown as { finishStartup(): void }).finishStartup());
  await expect(screen).toBeHidden({ timeout: 800 });
  await page.getByRole('button', { name: '起動表示を再表示' }).click();
  await expect(screen).toBeVisible();
  await page.evaluate(() => (window as unknown as { finishStartup(): void }).finishStartup());
  await expect(screen).toBeHidden({ timeout: 800 });
});

test('ヒントは保存済みを即表示し、PDFを開き直しても通信せず、同期は最大1日1回', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/reading-tips', async (route) => {
    requests++;
    await route.fulfill({
      json: { version: '1', revision: 2, tips: ['管理室で変更したヒント。'] },
    });
  });
  await page.goto('/tests/loading-bootstrap.html');
  await page.waitForFunction(() => 'finishStartup' in window);
  await page.evaluate(() => (window as unknown as { finishStartup(): void }).finishStartup());
  await page.getByRole('button', { name: 'PDF待機を表示' }).click();
  const loader = page.locator('[data-pdf-loading]');
  await expect(loader).toContainText('探究のヒント');
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'ヒントを同期' }).click();
  await expect.poll(() => requests).toBe(1);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('archive-reading-tips-v1')))
    .toContain('管理室で変更したヒント。');
  await page.getByRole('button', { name: 'PDF待機を表示' }).click();
  await expect(loader).toContainText('管理室で変更したヒント。');
  await page.getByRole('button', { name: 'ヒントを同期' }).click();
  await page.getByRole('button', { name: 'PDF待機を表示' }).click();
  expect(requests).toBe(1);
  await page.reload();
  await page.waitForFunction(() => 'finishStartup' in window);
  await page.evaluate(() => (window as unknown as { finishStartup(): void }).finishStartup());
  await page.getByRole('button', { name: 'ヒントを同期' }).click();
  await page.getByRole('button', { name: 'PDF待機を表示' }).click();
  await expect(loader).toContainText('管理室で変更したヒント。');
  expect(requests).toBe(1);
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'PDF待機を表示' }).click();
  await expect(loader).toContainText('管理室で変更したヒント。');
});

test('通信失敗時は初期ヒントで継続し、動きを減らす設定では静止する', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/reading-tips', async (route) => {
    requests++;
    await route.abort();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tests/loading-bootstrap.html');
  await page.waitForFunction(() => 'finishStartup' in window);
  expect(
    await page
      .locator('#app-startup svg .step-lower')
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  await page.evaluate(() => (window as unknown as { finishStartup(): void }).finishStartup());
  await page.getByRole('button', { name: 'ヒントを同期' }).click();
  await expect.poll(() => requests).toBe(1);
  await page.getByRole('button', { name: 'ヒントを同期' }).click();
  await page.getByRole('button', { name: 'PDF待機を表示' }).click();
  await expect(page.locator('[data-pdf-loading]')).toContainText('探究のヒント');
  expect(requests).toBe(1);
});
