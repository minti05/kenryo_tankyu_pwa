import { test, expect } from '@playwright/test';
test('公開設定が揃うと公式SDKを読み込みGoogle専用ボタンが使える', async ({ page }) => {
  // 架空project設定だけ。実Google認証や外部サービスへ接続しない。
  await page.route('https://**/*', (route) => route.abort());
  const sent: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) sent.push(request.url());
  });
  await page.goto('/welcome');
  await expect(page.getByRole('button', { name: '探究アーカイブをはじめる' })).toBeEnabled();
  await page.getByRole('button', { name: '探究アーカイブをはじめる' }).click();
  await expect(page.getByRole('button', { name: 'ブラウザでログイン' })).toBeEnabled();
  expect(sent).toEqual([]);
});
