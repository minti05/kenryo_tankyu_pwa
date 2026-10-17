import { test, expect } from '@playwright/test';
test('通常buildにサンプル入口・作品を出さずmanifestを配信する', async ({ page }) => {
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('先輩の問いから');
  await expect(page.getByRole('link', { name: 'サンプル作品で画面を試す' })).toHaveCount(0);
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.start_url).toBe('/welcome');
  expect(manifest.display).toBe('standalone');
  await page.goto('/preview/explore');
  await expect(
    page.getByRole('heading', { name: 'お探しのページが見つかりません。' }),
  ).toBeVisible();
  await expect(page.locator('article')).toHaveCount(0);
});
test('外枠はオフラインで開き、API/PDFをキャッシュに混ぜない', async ({ page, context }) => {
  await page.goto('/welcome');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('先輩の問いから');
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const state = await page.evaluate(async () => {
    const entries: string[] = [];
    for (const key of await caches.keys()) {
      for (const request of await (await caches.open(key)).keys())
        entries.push(new URL(request.url).pathname);
    }
    let apiFailed = false;
    try {
      await fetch('/api/private');
    } catch {
      apiFailed = true;
    }
    return { entries, apiFailed };
  });
  expect(state.entries.length).toBeGreaterThan(0);
  expect(state.entries.some((path) => path.startsWith('/api/') || /\.pdf$/i.test(path))).toBe(
    false,
  );
  expect(state.entries.some((path) => /pdf-runtime|pdf\.worker|\/pdfjs\//.test(path))).toBe(false);
  expect(state.apiFailed).toBe(true);
});
