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
    if (url.pathname === '/api/discovery') value = { version: '1', items: [], nextCursor: null };
    else if (url.pathname === '/api/stats')
      value = { version: '1', today: 1, week: 2, total: 3, serverTime: new Date().toISOString() };
    else if (url.pathname === '/api/reports')
      value = { version: '1', id: body.operationId, status: 'received' };
    else if (url.pathname.endsWith('/state') || req.method() === 'PUT')
      value = { version: '1', favorite, revision, count: favorite ? 1 : 0 };
    else if (req.method() === 'DELETE')
      value = {
        version: '1',
        deleted: true,
        stats: { version: '1', today: 0, week: 0, total: 0, serverTime: new Date().toISOString() },
      };
    else if (url.pathname === '/api/history' || url.pathname === '/api/favorites')
      value = {
        version: '1',
        items:
          url.pathname.endsWith('favorites') && !favorite
            ? []
            : [{ work, viewedAt: '2026-10-18T00:00:00Z', favorite }],
        nextCursor: null,
        stats: { version: '1', today: 1, week: 2, total: 3, serverTime: new Date().toISOString() },
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
    await expect(page.getByRole('heading', { name: 'ライブラリ', exact: true })).toHaveClass(
      'sr-only',
    );
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.getByLabel('閲覧の記録')).toContainText('3');
    await page.getByRole('button', { name: 'お気に入り', exact: true }).click();
    await expect(page.getByText('まだお気に入りはありません。', { exact: false })).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: /端末に保存/ })).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: 'お気に入りから外す' })).toBeEnabled();
  await page.getByRole('button', { name: 'お気に入りから外す' }).click();
  await expect(page.getByRole('button', { name: 'お気に入りに追加', exact: true })).toBeEnabled();
  const puts = calls.filter((c) => c.method === 'PUT');
  expect(puts.map((c) => c.body.favorite)).toEqual([true, false]);
  expect(puts.map((c) => c.body.expectedRevision)).toEqual([0, 1]);
});
test('4種類の報告・通信失敗の再試行は同じ受付ID', async ({ page }) => {
  const f = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/works/24000010');
  await page.getByRole('button', { name: 'その他', exact: true }).click();
  await page.getByRole('menuitem', { name: '作品情報を報告', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '作品情報を報告', exact: true })).toBeVisible();
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

for (const width of [390, 1440])
  test(`作品は端末幅に応じた一覧とタイトル横のハート・共有を表示: ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=/library');
    await expect(page.getByLabel('閲覧の記録')).toContainText('今日1件');
    const card = page.locator('article').first();
    expect(await card.evaluate((el) => getComputedStyle(el).display)).toBe(
      width < 768 ? 'grid' : 'block',
    );
    const box = await card.boundingBox();
    expect(width < 768 ? box!.height < 180 : box!.height > 230).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`library-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: '架空の水の探究の詳細' }).click();
    const heart = page.getByRole('button', { name: 'お気に入りに追加', exact: true });
    await expect(heart.locator('.favorite-count')).toHaveText('0');
    await expect(heart.locator('svg')).toBeVisible();
    await expect(page.getByText('人がお気に入り', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'その他', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`work-${width}.png`), fullPage: true });
    await heart.click();
    await expect(page.getByRole('button', { name: 'お気に入りから外す' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('link', { name: '一覧へ戻る', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'メインナビゲーション' })
      .getByRole('link', { name: 'ホーム', exact: true })
      .click();
    await page.getByRole('link', { name: 'アカウント設定', exact: true }).click();
    await page.getByRole('link', { name: '端末に保存した資料', exact: true }).click();
    await expect(page).toHaveURL(/\/saved$/);
  });

test('ライブラリ初回は統計込み1 GET、30秒以内はキャッシュを使い、削除後の再GETをしない', async ({
  page,
}) => {
  await page.clock.install();
  const { calls } = await fixture(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/tests/discovery-harness.html?entry=/library');
  await expect(page.locator('article')).toHaveCount(1);
  const gets = () => calls.filter((c) => c.path === '/api/history' && c.method === 'GET').length;
  expect(gets()).toBe(1);
  expect(calls.filter((c) => c.path === '/api/stats')).toHaveLength(0);
  await page.getByRole('link', { name: 'ホーム', exact: true }).click();
  await page.getByRole('link', { name: 'ライブラリ', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(1);
  expect(gets()).toBe(1);
  await page.getByRole('button', { name: work.title + 'の履歴を削除' }).click();
  await expect(page.locator('article')).toHaveCount(0);
  expect(gets()).toBe(1);
  await expect(page.getByLabel('閲覧の記録')).toContainText('0');
  await page.getByRole('link', { name: 'ホーム', exact: true }).click();
  await page.clock.fastForward(31_000);
  await page.getByRole('link', { name: 'ライブラリ', exact: true }).click();
  await expect.poll(gets).toBe(2);
});

test('閲覧・いいね・削除のキャッシュを本人の全ページに反映し、別UIDと取得時刻を保つ', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  const { cacheView, cacheFavorite, cacheHistoryDelete } =
    await import('../src/features/library/cache');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const stats = {
    version: '1' as const,
    today: 1,
    week: 2,
    total: 2,
    serverTime: '2026-10-23T00:00:00Z',
  };
  const first = { work, viewedAt: '2026-10-21T00:00:00Z', favorite: false };
  const second = {
    work: { ...work, documentID: '24000020' },
    viewedAt: '2026-10-20T00:00:00Z',
    favorite: false,
  };
  const pages = {
    pages: [
      { version: '1' as const, items: [first], nextCursor: 'page-2', stats },
      { version: '1' as const, items: [second], nextCursor: null },
    ],
    pageParams: ['', 'page-2'],
  };
  const key = ['library', 'fixture-alice', 'history'];
  try {
    client.setQueryData(key, pages, { updatedAt: 100 });
    client.setQueryData(['library', 'fixture-bob', 'history'], pages);
    const fresh = {
      ...second,
      viewedAt: '2026-10-23T00:00:00Z',
      work: { ...second.work, title: '更新したタイトル' },
    };
    await cacheView(client, 'fixture-alice', { version: '1', recorded: true, item: fresh, stats });
    const moved = client.getQueryData<typeof pages>(key)!;
    expect(moved.pages[0]!.items[0]?.work.title).toBe('更新したタイトル');
    expect(moved.pages[1]!.items).toHaveLength(0);
    expect(client.getQueryState(key)?.dataUpdatedAt).toBe(100);
    expect(client.getQueryData(['library', 'fixture-bob', 'history'])).toEqual(pages);
    client.setQueryData(['library', 'fixture-alice', 'favorites'], {
      pages: [{ version: '1', items: [fresh], nextCursor: null, stats }],
      pageParams: [''],
    });
    await cacheFavorite(client, 'fixture-alice', fresh.work, {
      version: '1',
      favorite: false,
      revision: 3,
      count: 0,
    });
    expect(
      client.getQueryData<typeof pages>(['library', 'fixture-alice', 'favorites'])?.pages[0]?.items,
    ).toHaveLength(0);
    await cacheHistoryDelete(
      client,
      'fixture-alice',
      undefined,
      { scope: 'period', from: '2026-10-22T00:00:00Z', to: '2026-10-24T00:00:00Z' },
      stats,
    );
    expect(
      client
        .getQueryData<typeof pages>(key)
        ?.pages.flatMap((p) => p.items)
        .map((i) => i.work.documentID),
    ).toEqual([work.documentID]);
    client.clear();
    await cacheView(client, 'fixture-alice', { version: '1', recorded: true, item: fresh, stats });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  } finally {
    client.clear();
  }
});
