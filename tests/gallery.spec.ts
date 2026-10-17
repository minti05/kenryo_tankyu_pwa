import { test, expect } from '@playwright/test';
for (const width of [360, 820, 1280])
  test(`Welcomeとギャラリーを${width}pxで表示し横にはみ出さない`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const protectedRequests: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/')) protectedRequests.push(r.url());
    });
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('先輩の問いから');
    await expect(
      page.getByRole('button', { name: '学校のGoogleアカウントでログイン' }),
    ).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`welcome-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: 'サンプル作品で画面を試す' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('好奇心の、その先へ。');
    await expect(page.locator('article')).toHaveCount(9);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const columns = await page
      .locator('article')
      .first()
      .evaluate((el) => getComputedStyle(el.parentElement!).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width < 768 ? 1 : width < 1200 ? 2 : 3);
    await page.screenshot({ path: testInfo.outputPath(`gallery-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
    expect(protectedRequests).toEqual([]);
  });
test('検索・分類・種類をURLに保持し、戻る・再読込・条件クリアが使える', async ({ page }) => {
  await page.goto('/preview/explore');
  await page.getByRole('searchbox', { name: '作品をキーワードで検索' }).fill('植物');
  await page.getByRole('button', { name: '探す', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page).toHaveURL(/q=/);
  await page.getByRole('link', { name: '植物は光の色で育ち方が変わる？の詳細' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '植物は光の色で育ち方が変わる？',
  );
  await page.getByRole('link', { name: '一覧へ戻る' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('植物');
  await page.reload();
  await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('button', { name: '条件をクリア' }).click();
  await expect(page.locator('article')).toHaveCount(9);
  await page.getByRole('button', { name: '地域', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page).toHaveURL(/category=society/);
  await page.getByRole('combobox', { name: '資料の種類' }).selectOption('thesis');
  await expect(page.getByRole('heading', { name: '別の問いから、探してみよう。' })).toBeVisible();
  await page.getByRole('button', { name: 'すべての作品を見る' }).click();
  await expect(page.locator('article')).toHaveCount(9);
});
test('保存はプレビュー内で機能し、ライブラリと作品詳細を往復できる', async ({ page }) => {
  await page.goto('/preview/explore');
  await page
    .getByRole('button', { name: '雨の日の通学路を、もっと歩きやすくをライブラリに保存' })
    .click();
  await page.getByRole('link', { name: 'ライブラリ', exact: true }).first().click();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('1作品');
  await page
    .getByRole('button', { name: '雨の日の通学路を、もっと歩きやすくをライブラリから外す' })
    .click();
  await expect(page.getByRole('heading', { name: 'まだ、まっさらなライブラリ。' })).toBeVisible();
});
test('キーボードでskip・検索・分類へ移動できる', async ({ page, browserName }) => {
  await page.goto('/preview/explore');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('好奇心の、その先へ。');
  // macOS Safari既定のリンク巡回はOption+Tab。リンクを通常のTab対象にする設定もある。
  await page.keyboard.press(
    browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab',
  );
  await expect(page.getByRole('link', { name: '本文へ移動' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.keyboard.type('存在しないテーマ');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '別の問いから、探してみよう。' })).toBeVisible();
});
test('iPadの分割表示・向き変更と200%文字でも検索条件を失わない', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/preview/explore?category=science');
  await expect(page.locator('article')).toHaveCount(1);
  await page.setViewportSize({ width: 500, height: 820 });
  await expect(page.getByRole('button', { name: '数学・理科', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('searchbox')).toBeVisible();
  expect(
    await page.getByRole('searchbox').evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(24);
});
test('ダークモード・動きを減らす設定と未定義URLを扱える', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/preview/explore');
  await expect(page.locator('article')).toHaveCount(9);
  expect(await page.locator('html').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    'rgb(25, 26, 25)',
  );
  await page.goto('/missing-page');
  await expect(
    page.getByRole('heading', { name: 'お探しのページが見つかりません。' }),
  ).toBeVisible();
});

test('通信入口はトークンなしや外部URLを送信前に拒否する', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) sent.push(r.url());
  });
  await page.goto('/welcome');
  const result = await page.evaluate(async () => {
    const path = '/src/lib/api-client.ts';
    const { createApiClient } = await import(/* @vite-ignore */ path);
    const request = createApiClient(async () => null);
    const codes: string[] = [];
    for (const path of ['/api/works', 'https://invalid.example/api/works']) {
      try {
        await request(path);
      } catch (e) {
        codes.push((e as Error).message);
      }
    }
    return codes;
  });
  expect(result).toEqual(['authentication_required', 'invalid_api_path']);
  expect(sent).toEqual([]);
});

test('全テーマを展開して横スクロールなしで選べる', async ({ page }) => {
  await page.goto('/preview/explore');
  await page.getByRole('button', { name: 'すべてのテーマ' }).click();
  await expect(page.getByRole('button', { name: '閉じる', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: 'その他', exact: true }).click();
  await expect(page).toHaveURL(/category=other/);
});
