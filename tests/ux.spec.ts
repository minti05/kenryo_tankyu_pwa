import { test, expect, type Page } from '@playwright/test';
import { fixturePdf } from './pdf-fixture.mjs';
import { createHash } from 'node:crypto';
const work = {
  contractVersion: '1',
  documentID: '24000010',
  title: '通信待ちの探究',
  author: '架空班',
  enterYear: 2024,
  course: 'tankyu',
  eventName: 'individualTankyu',
  category1: 'society',
  subCategory1: 'disasterPrevention',
  category2: 'none',
  subCategory2: 'none',
  existsPoster: true,
  existsReport: true,
  existsSlide: false,
  existsThesis: false,
  revision: 'fixture-1',
  favoriteCount: 7,
  isFavorite: false,
  favoriteRevision: 0,
};
async function fixture(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/search-history')
      return route.fulfill({ json: { version: '1', items: [] } });
    if (url.pathname === '/api/works') {
      const second = url.searchParams.has('cursor');
      return route.fulfill({
        json: {
          version: '1',
          items: Array.from({ length: 20 }, (_, i) => ({
            ...work,
            documentID: String(24000010 + ((second ? 20 : 0) + i) * 10),
            title: `${work.title} ${i}`,
          })),
          nextCursor: second ? null : 'next-page',
        },
      });
    }
    if (/\/similar$/.test(url.pathname)) return route.fulfill({ json: { items: [] } });
    if (/^\/api\/works\/\d{8}$/.test(url.pathname))
      return route.fulfill({
        json: {
          version: '1',
          work: { ...work, documentID: url.pathname.split('/').pop() },
          documents: [],
          authorizedAt: new Date().toISOString(),
        },
      });
    if (url.pathname === '/api/reports')
      return route.fulfill({ json: { version: '1', id: 'fixture-report', status: 'received' } });
    return route.fulfill({ json: { version: '1', favorite: true, count: 8, revision: 1 } });
  });
}
test('履歴保存が遅くても検索結果を表示し、保存失敗は結果を消さず知らせる', async ({ page }) => {
  await fixture(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/search-history', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { version: '1', items: [] } });
    await gate;
    return route.fulfill({ status: 503, json: { error: { code: 'library_unavailable' } } });
  });
  await page.goto('/tests/discovery-harness.html?entry=/search');
  await page.getByLabel('作品をキーワードで検索').fill('通信');
  await page.getByRole('button', { name: '検索する', exact: true }).click();
  await expect(page).toHaveURL(/\/results\?q=/);
  await expect(page.locator('article')).toHaveCount(20);
  release();
  await expect(
    page.getByRole('status').filter({ hasText: '履歴を保存できませんでした' }),
  ).toBeVisible();
  await expect(page.locator('article')).toHaveCount(20);
});
test('お気に入りは応答前に反映し、失敗時は元に戻して再試行できる', async ({ page }) => {
  await fixture(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await page.route('**/api/favorites/*', async (route) => {
    attempts++;
    if (attempts === 1) {
      await gate;
      return route.fulfill({ status: 503, json: { error: { code: 'library_unavailable' } } });
    }
    return route.fulfill({ json: { version: '1', favorite: true, count: 8, revision: 1 } });
  });
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=通信'));
  const card = page.locator('article').first();
  await card.getByRole('button', { name: 'お気に入りに追加' }).click();
  await expect(card.getByRole('button', { name: 'お気に入りから外す' })).toBeDisabled();
  await expect(card.locator('.favorite-count')).toHaveText('8');
  release();
  await expect(card.getByRole('button', { name: 'お気に入りに追加' })).toBeEnabled();
  await expect(card.locator('.favorite-count')).toHaveText('7');
  await card.getByRole('button', { name: 'お気に入りに追加' }).click();
  await expect(card.getByRole('button', { name: 'お気に入りから外す' })).toBeEnabled();
  await expect(card.locator('.favorite-count')).toHaveText('8');
});
test('検索の条件・追加ページ・位置を詳細からの復帰と画面再起動で復元する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await fixture(page);
  const entry =
    '/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=通信&sort=newest');
  await page.goto(entry);
  await page.getByRole('button', { name: 'さらに表示' }).click();
  await expect(page.locator('article')).toHaveCount(40);
  await page.locator('article').nth(15).getByRole('link').click();
  await expect(page.getByRole('heading', { name: work.title, exact: true })).toBeVisible();
  const saved = await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((k) => k.startsWith('results-position:'))!;
    return JSON.parse(sessionStorage.getItem(key)!);
  });
  expect(saved.pages).toBe(2);
  expect(saved.top).toBeGreaterThan(100);
  await page.getByRole('link', { name: '一覧へ戻る', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(40);
  await expect
    .poll(() => page.evaluate((top) => Math.abs(scrollY - top), saved.top))
    .toBeLessThan(5);
  await expect(page.getByLabel('並び順')).toHaveValue('newest');
  await page.goto(entry);
  await expect(page.locator('article')).toHaveCount(40);
  await expect
    .poll(() => page.evaluate((top) => Math.abs(scrollY - top), saved.top))
    .toBeLessThan(5);
});
for (const width of [390, 1440])
  test(`PDF取得に失敗しても作品情報・別資料への切替・問題報告を使える: ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page);
    const bytes = fixturePdf(),
      hash = createHash('sha256').update(bytes).digest('hex'),
      revision = 'a'.repeat(64);
    await page.route('**/api/works/24000010', (route) =>
      route.fulfill({
        json: {
          version: '1',
          work,
          authorizedAt: new Date().toISOString(),
          documents: ['poster', 'report'].map((kind) => ({
            kind,
            state: 'available',
            bytes: bytes.length,
            revision,
            sha256: hash,
          })),
        },
      }),
    );
    await page.route('**/api/works/24000010/pdf/**', (route) =>
      new URL(route.request().url()).pathname.endsWith('poster')
        ? route.fulfill({ status: 503, json: { error: { code: 'storage_unavailable' } } })
        : route.fulfill({
            body: bytes,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Length': String(bytes.length),
              'X-Document-Revision': revision,
              'X-Content-SHA256': hash,
              'X-Authorized-At': new Date().toISOString(),
            },
          }),
    );
    await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/works/24000010'));
    await expect(page.getByRole('heading', { name: work.title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'もう一度読み込む', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`pdf-recovery-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'PDFの問題を報告', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'PDFの問題を報告' });
    await expect(dialog.getByLabel('報告の種類')).toHaveValue('pdf');
    await expect(dialog.getByLabel('ポスター', { exact: true })).toBeChecked();
    await dialog.getByLabel('内容', { exact: true }).fill('資料を表示できません。');
    await dialog.getByRole('button', { name: '報告を送信' }).click();
    await expect(dialog.getByText('受付番号：fixture-report')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '別の資料を開く（レポート）' }).click();
    await expect(page).toHaveURL(/kind=report/);
    await expect(page.getByRole('region', { name: 'PDFビューア', exact: true })).toHaveAttribute(
      'data-pdf-ready',
      'true',
      { timeout: 25000 },
    );
  });

test('PDFエンジンの表示失敗も、本文を再取得せずにやり直せる', async ({ page }) => {
  await fixture(page);
  const bytes = Buffer.from('%PDF-1.7\ninvalid fixture only');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const revision = 'a'.repeat(64);
  let downloads = 0;
  await page.route('**/api/works/24000010', (route) =>
    route.fulfill({
      json: {
        version: '1',
        work: { ...work, existsReport: false },
        authorizedAt: new Date().toISOString(),
        documents: [
          { kind: 'poster', state: 'available', bytes: bytes.length, revision, sha256: hash },
        ],
      },
    }),
  );
  await page.route('**/api/works/24000010/pdf/**', (route) => {
    downloads++;
    return route.fulfill({
      body: bytes,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(bytes.length),
        'X-Document-Revision': revision,
        'X-Content-SHA256': hash,
        'X-Authorized-At': new Date().toISOString(),
      },
    });
  });
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/works/24000010'));
  await expect(page.getByRole('button', { name: '表示をやり直す', exact: true })).toBeVisible({
    timeout: 25000,
  });
  await page.getByRole('button', { name: '表示をやり直す', exact: true }).click();
  await expect(page.getByRole('button', { name: '表示をやり直す', exact: true })).toBeVisible({
    timeout: 25000,
  });
  expect(downloads).toBe(1);
  await expect(page.getByRole('heading', { name: work.title, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDFの問題を報告', exact: true })).toBeVisible();
});
