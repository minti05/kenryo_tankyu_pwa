import { test, expect, type Page } from '@playwright/test';
const work = {
  contractVersion: '1',
  documentID: '24000010',
  title: '架空の水の探究',
  author: '架空班',
  enterYear: 2024,
  course: 'tankyu',
  eventName: 'individualTankyu',
  category1: 'society',
  subCategory1: 'traffic',
  category2: 'none',
  subCategory2: 'none',
  existsPoster: true,
  existsReport: false,
  existsSlide: false,
  existsThesis: false,
  revision: 'r1',
};
async function fixture(page: Page) {
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  let favorite = false,
    revision = 0;
  let failNext = false;
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const body = req.postDataJSON() ?? {};
    calls.push({ path: url.pathname, method: req.method(), body });
    expect(req.headers().authorization).toBe('Bearer fixture-token');
    if (failNext && req.method() === 'POST') {
      failNext = false;
      return route.fulfill({ status: 503, json: { error: { code: 'library_unavailable' } } });
    }
    if (req.method() === 'PUT') {
      favorite = body.favorite;
      revision++;
    }
    let value: unknown = { version: '1', recorded: true };
    if (url.pathname === '/api/stats')
      value = { version: '1', today: 1, week: 2, total: 3, serverTime: new Date().toISOString() };
    else if (url.pathname === '/api/reports')
      value = { version: '1', id: body.operationId, status: 'received' };
    else if (url.pathname.endsWith('/state') || req.method() === 'PUT')
      value = { version: '1', favorite, revision, count: favorite ? 1 : 0 };
    else if (url.pathname === '/api/history' || url.pathname === '/api/favorites')
      value = {
        version: '1',
        items:
          url.pathname.endsWith('favorites') && !favorite
            ? []
            : [{ work, viewedAt: '2026-10-18T00:00:00Z', favorite }],
        nextCursor: null,
      };
    else if (url.pathname === '/api/works/' + work.documentID)
      value = { version: '1', work, documents: [], authorizedAt: new Date().toISOString() };
    await route.fulfill({ json: value });
  });
  return {
    calls,
    fail: () => {
      failNext = true;
    },
  };
}
for (const width of [390, 820, 1440])
  test(`ライブラリの幅 ${width}・統計・お気に入り切替`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=/library');
    await expect(page.getByRole('heading', { name: '問いの足あと' })).toBeVisible();
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.getByLabel('閲覧の記録')).toContainText('3');
    await page.getByRole('button', { name: 'お気に入り', exact: true }).click();
    await expect(page.getByText('まだお気に入りはありません。', { exact: false })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  });
test('個別削除の確認・全件と期間の意味・同じ画面で再度削除は別操作ID', async ({ page }) => {
  const { calls } = await fixture(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/tests/discovery-harness.html?entry=/library');
  await page.getByRole('button', { name: work.title + 'の履歴を削除' }).click();
  await expect(page.getByRole('status')).toContainText('閲覧履歴を削除しました。');
  expect(calls.find((c) => c.method === 'DELETE')?.path).toBe('/api/history/' + work.documentID);
  await page.getByText('閲覧履歴を整理する', { exact: true }).click();
  await page.getByRole('button', { name: '閲覧履歴をまとめて削除' }).click();
  await expect.poll(() => calls.filter((c) => c.method === 'DELETE').length).toBe(2);
  await page.getByLabel('削除範囲').selectOption('period');
  await page.getByLabel('開始日').fill('2026-10-01');
  await page.getByLabel('終了日').fill('2026-10-03');
  await page.getByRole('button', { name: '閲覧履歴をまとめて削除' }).click();
  await expect.poll(() => calls.filter((c) => c.method === 'DELETE').length).toBe(3);
  const body = calls.filter((c) => c.method === 'DELETE').at(-1)!.body;
  expect(body.from).toBe('2026-09-30T15:00:00.000Z');
  expect(body.to).toBe('2026-10-03T15:00:00.000Z');
});
test('お気に入りは明示状態と比較版で送る・追加→解除', async ({ page }) => {
  const { calls } = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/works/24000010');
  await page.getByRole('button', { name: 'お気に入りに追加', exact: true }).click();
  await expect(page.getByRole('button', { name: 'お気に入りに追加済み' })).toBeEnabled();
  await page.getByRole('button', { name: 'お気に入りに追加済み' }).click();
  await expect(page.getByRole('button', { name: 'お気に入りに追加', exact: true })).toBeEnabled();
  const puts = calls.filter((c) => c.method === 'PUT');
  expect(puts.map((c) => c.body.favorite)).toEqual([true, false]);
  expect(puts.map((c) => c.body.expectedRevision)).toEqual([0, 1]);
});
test('4種類の報告・通信失敗の再試行は同じ受付ID', async ({ page }) => {
  const f = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/works/24000010');
  await page.getByText('作品情報やPDFについて報告する', { exact: true }).click();
  await page.getByLabel('内容', { exact: true }).fill('架空の報告です');
  f.fail();
  await page.getByRole('button', { name: '報告を送信' }).click();
  await expect(page.getByRole('status')).toContainText('通信を確認');
  await page.getByRole('button', { name: '報告を送信' }).click();
  await expect(page.getByText('受付番号：', { exact: false })).toBeVisible();
  const attempts = f.calls.filter((c) => c.path === '/api/reports');
  expect(attempts[0]!.body.operationId).toBe(attempts[1]!.body.operationId);
  for (const kind of ['info', 'category', 'pdf']) {
    await page.getByLabel('報告の種類').selectOption(kind);
    if (kind === 'pdf') {
      await page.getByLabel('ポスター', { exact: true }).check();
      await page.getByLabel('内容', { exact: true }).fill('架空のPDFの報告');
    }
    await page.getByRole('button', { name: '報告を送信' }).click();
    await expect(page.getByText('受付番号：', { exact: false })).toBeVisible();
  }
  expect(new Set(f.calls.filter((c) => c.path === '/api/reports').map((c) => c.body.kind))).toEqual(
    new Set(['other', 'info', 'category', 'pdf']),
  );
});

test('お気に入りの競合では現在値を読み直し、確認して再操作する', async ({ page }) => {
  await fixture(page);
  let stateReads = 0;
  await page.route('**/api/works/24000010/state', async (route) => {
    stateReads++;
    await route.fulfill({ json: { version: '1', favorite: false, revision: 7, count: 0 } });
  });
  await page.route('**/api/favorites/24000010', (route) =>
    route.fulfill({ status: 409, json: { error: { code: 'favorite_conflict' } } }),
  );
  await page.goto('/tests/discovery-harness.html?entry=/works/24000010');
  await page.getByRole('button', { name: 'お気に入りに追加', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('別の画面で変更されました');
  expect(stateReads).toBe(2);
  await expect(page.getByRole('button', { name: 'お気に入りに追加', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
