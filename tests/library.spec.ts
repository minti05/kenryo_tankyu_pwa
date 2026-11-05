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
async function fixture(page: Page, initiallyFavorite = false) {
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  let favorite = initiallyFavorite,
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
    if (/^\/api\/works\/\d{8}\/similar$/.test(url.pathname)) value = { items: [] };
    else if (url.pathname === '/api/discovery')
      value = { version: '1', items: [], nextCursor: null };
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
            : [
                {
                  work: {
                    ...work,
                    isFavorite: favorite,
                    favoriteCount: favorite ? 1 : 0,
                    favoriteRevision: revision,
                  },
                  viewedAt: '2026-10-18T00:00:00Z',
                  favorite,
                },
              ],
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
test('個別削除の確認と、一括削除をアカウント内で管理する', async ({ page }) => {
  const { calls } = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/library');
  await expect(page.getByText('閲覧履歴を整理する', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: work.title + 'の履歴を削除' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('閲覧履歴とお気に入りを削除');
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
  expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  await page.getByRole('button', { name: work.title + 'の履歴を削除' }).click();
  await dialog.getByRole('button', { name: '削除する', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('作品をライブラリから削除しました。');
  expect(calls.find((c) => c.method === 'DELETE')?.path).toBe('/api/history/' + work.documentID);
  await page.getByRole('link', { name: 'アカウント設定', exact: true }).click();
  await page.getByRole('link', { name: '履歴の管理', exact: true }).click();
  await expect(page.getByText('2週間', { exact: true })).toBeVisible();
  await expect(page.getByLabel('閲覧履歴の件数')).toContainText('0 件');
  await expect(page.getByRole('button', { name: 'PDFキャッシュをまとめて削除' })).toBeVisible();
  await page.getByRole('button', { name: '閲覧履歴をまとめて削除', exact: true }).click();
  await expect(dialog).toContainText('お気に入りとPDFのキャッシュは残ります。');
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
  expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '閲覧履歴をまとめて削除', exact: true }).click();
    await dialog.getByRole('button', { name: '削除する', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  const deletes = calls.filter((c) => c.path === '/api/history' && c.method === 'DELETE');
  expect(deletes).toHaveLength(2);
  expect(deletes[0]!.body.scope).toBe('all');
  expect(deletes[0]!.body.operationId).not.toBe(deletes[1]!.body.operationId);
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
    await expect(card.getByText(work.title, { exact: true })).toHaveCount(1);
    const box = await card.boundingBox();
    expect(box!.height).toBeLessThan(width < 768 ? 110 : 200);
    if (width >= 768) expect(box!.width).toBeGreaterThan(box!.height * 2);
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
    await page.getByRole('link', { name: '履歴の管理', exact: true }).click();
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
  await page.getByRole('dialog').getByRole('button', { name: '削除する', exact: true }).click();
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
    expect(client.getQueryData(['library-stats', 'fixture-alice'])).toEqual(stats);
    expect(client.getQueryData(key)).toBeUndefined();
  } finally {
    client.clear();
  }
});

for (const width of [390, 1440]) {
  test(`タブ切替中と取得失敗時も閲覧集計を保持: ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const { calls } = await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=/library');
    await expect(page.locator('article')).toHaveCount(1);
    const stats = page.getByLabel('閲覧の記録');
    const before = await stats.innerText();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/favorites', async (route) => {
      await blocked;
      await route.fulfill({ status: 503, json: { error: { code: 'library_unavailable' } } });
    });
    await page.getByRole('button', { name: 'お気に入り', exact: true }).click();
    await expect(page.getByRole('status', { name: 'ライブラリを読み込み中' })).toBeVisible();
    await expect(stats).toHaveText(before, { useInnerText: true });
    release();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(stats).toHaveText(before, { useInnerText: true });
    await expect(page.getByText('閲覧数を取得できませんでした。')).toHaveCount(0);
    await page.getByRole('button', { name: '閲覧履歴', exact: true }).click();
    await expect(page.locator('article')).toHaveCount(1);
    await expect(stats).toHaveText(before, { useInnerText: true });
    expect(calls.filter((c) => c.path === '/api/history' && c.method === 'GET')).toHaveLength(1);
    expect(calls.filter((c) => c.path === '/api/stats')).toHaveLength(0);
  });
}

test('共通集計は古い応答で巻き戻さず、別アカウントに共有しない', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  const { cacheLibraryStats, libraryStatsKey } = await import('../src/features/library/cache');
  const query = new QueryClient();
  try {
    const recent = {
      version: '1' as const,
      today: 4,
      week: 18,
      total: 18,
      serverTime: '2026-10-24T01:00:00Z',
    };
    cacheLibraryStats(query, 'alice', recent);
    cacheLibraryStats(query, 'alice', { ...recent, total: 17, serverTime: '2026-10-24T00:00:00Z' });
    expect(query.getQueryData(libraryStatsKey('alice'))).toEqual(recent);
    expect(query.getQueryData(libraryStatsKey('bob'))).toBeUndefined();
  } finally {
    query.clear();
  }
});

test.describe('スマホの長押し削除', () => {
  test.use({ hasTouch: true });
  test('スクロール・指の移動・中断では開かず、長押しは確認後だけ削除する', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    const { calls } = await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=/library');
    const cover = page.getByRole('link', { name: work.title + 'の詳細', exact: true });
    await expect(cover).toBeVisible();
    const down = { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 30, clientY: 400 };
    await cover.dispatchEvent('pointerdown', down);
    await cover.dispatchEvent('pointermove', { ...down, clientY: 425 });
    await page.clock.fastForward(700);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await cover.dispatchEvent('pointerdown', down);
    await cover.dispatchEvent('pointercancel', down);
    await page.clock.fastForward(700);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await cover.dispatchEvent('pointerdown', down);
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await page.clock.fastForward(700);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await cover.dispatchEvent('pointerdown', down);
    await page.clock.fastForward(600);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await cover.dispatchEvent('pointerup', down);
    await cover.dispatchEvent('click', { detail: 1 });
    await expect(page).toHaveURL(/library$/);
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await page.screenshot({ path: testInfo.outputPath('long-press-delete.png') });
    await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await expect(page.locator('article')).toHaveCount(1);
    await cover.dispatchEvent('pointerdown', down);
    await page.clock.fastForward(600);
    await cover.dispatchEvent('pointerup', down);
    await dialog.getByRole('button', { name: '削除する', exact: true }).click();
    await expect(page.locator('article')).toHaveCount(0);
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    await expect(page.getByLabel('閲覧の記録')).toContainText('これまで0件');
  });
  test('通常のタップは作品を開き、ボタンの長押しでは削除画面を開かない', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=/library');
    const heart = page.getByRole('button', { name: 'お気に入りに追加', exact: true });
    await expect(heart).toBeEnabled();
    const down = {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 300,
      clientY: 400,
    };
    await heart.dispatchEvent('pointerdown', down);
    await page.clock.fastForward(700);
    await heart.dispatchEvent('pointerup', down);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('link', { name: work.title + 'の詳細', exact: true }).tap();
    await expect(page).toHaveURL(/works\/24000010/);
    await page.goto('/tests/discovery-harness.html?entry=/library');
    await expect(page.getByRole('heading', { name: '10/18', exact: true })).toBeVisible();
    const card = (await page.locator('article').boundingBox())!;
    await page.touchscreen.tap(card.x + 24, card.y + card.height / 2);
    await expect(page).toHaveURL(/works\/24000010/);
  });
});

test('履歴の一括削除はお気に入りを残し、ライブラリの集計と履歴を更新する', async ({ page }) => {
  const { calls } = await fixture(page, true);
  await page.goto('/tests/discovery-harness.html?entry=/library');
  await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'お気に入り', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('link', { name: 'アカウント設定', exact: true }).click();
  await page.getByRole('link', { name: '履歴の管理', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('saved-management.png'), fullPage: true });
  await page.getByRole('button', { name: '閲覧履歴をまとめて削除', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '削除する', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'ライブラリ', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(0);
  await expect(page.getByLabel('閲覧の記録')).toContainText('これまで0件');
  await page.getByRole('button', { name: 'お気に入り', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('time')).toHaveCount(0);
  expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
});

test('一括削除の通信失敗は同じ操作IDで再試行できる', async ({ page }) => {
  await fixture(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/history', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1)
      await route.fulfill({ status: 503, json: { error: { code: 'library_unavailable' } } });
    else await route.fallback();
  });
  await page.goto('/tests/discovery-harness.html?entry=/saved');
  await page.getByRole('button', { name: '閲覧履歴をまとめて削除', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '削除する', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('通信を確認');
  await dialog.getByRole('button', { name: '削除する', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(bodies).toHaveLength(2);
  expect(bodies[0]!.operationId).toBe(bodies[1]!.operationId);
});

for (const width of [390, 1440]) {
  test(`閲覧履歴は日本時間の日付ごとにまとめ、削除ボタンはカード内に表示: ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, true);
    await page.route('**/api/history', (route) =>
      route.fulfill({
        json: {
          version: '1',
          nextCursor: null,
          items: [
            {
              work: {
                ...work,
                category1: 'community',
                subCategory1: 'community-01',
                isFavorite: true,
              },
              viewedAt: '2026-10-24T01:00:00Z',
              favorite: true,
            },
            {
              work: {
                ...work,
                category1: 'community',
                subCategory1: 'community-01',
                documentID: '24000020',
                title: 'もう一つの作品',
                isFavorite: true,
              },
              viewedAt: '2026-10-23T16:00:00Z',
              favorite: true,
            },
            {
              work: {
                ...work,
                category1: 'community',
                subCategory1: 'community-01',
                documentID: '24000030',
                title: '前日の作品',
                isFavorite: true,
              },
              viewedAt: '2026-10-23T00:00:00Z',
              favorite: true,
            },
          ],
        },
      }),
    );
    await page.goto('/tests/discovery-harness.html?entry=/library');
    const today = page.getByRole('heading', { name: '10/24', exact: true });
    await expect(today).toHaveCount(1);
    await expect(today.locator('..').locator('article')).toHaveCount(2);
    await expect(page.getByRole('heading', { name: '10/23', exact: true })).toHaveCount(1);
    await expect(page.locator('article time')).toHaveCount(0);
    const card = page.locator('article').first();
    await expect(card.getByText('交通・移動', { exact: true })).toHaveCount(1);
    if (width >= 768) {
      const remove = card.getByRole('button', { name: work.title + 'の履歴を削除', exact: true });
      const cardBox = (await card.boundingBox())!;
      const buttonBox = (await remove.boundingBox())!;
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
      await remove.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page).toHaveURL(/library/);
      await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    }
    await page.screenshot({
      path: testInfo.outputPath(`grouped-history-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'お気に入り', exact: true }).click();
    await expect(page.locator('time')).toHaveCount(0);
  });
}

for (const width of [390, 820, 1440]) {
  test(`追加表示は中央のアイコンから次ページを取得: ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page);
    await page.route(/\/api\/history(?:\?|$)/, (route) => {
      const more = new URL(route.request().url()).searchParams.has('cursor');
      return route.fulfill({
        json: {
          version: '1',
          items: [
            {
              work: {
                ...work,
                documentID: more ? '24000020' : work.documentID,
                title: more ? '次の作品' : work.title,
              },
              viewedAt: '2026-10-18T00:00:00Z',
            },
          ],
          nextCursor: more ? null : 'next',
          stats: {
            version: '1',
            today: 1,
            week: 2,
            total: 3,
            serverTime: new Date().toISOString(),
          },
        },
      });
    });
    await page.goto('/tests/discovery-harness.html?entry=/library');
    const more = page.getByRole('button', { name: 'さらに表示', exact: true });
    await expect(more).toBeVisible();
    expect(await more.textContent()).toBe('');
    const button = (await more.boundingBox())!,
      main = (await page.locator('.page-container').boundingBox())!;
    expect(Math.abs(button.x + button.width / 2 - main.x - main.width / 2)).toBeLessThan(2);
    await more.click();
    await expect(page.locator('article')).toHaveCount(2);
    await expect(more).toHaveCount(0);
  });
}
