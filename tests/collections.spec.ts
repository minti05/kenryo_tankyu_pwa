import { test, expect, type Page } from '@playwright/test';
const work = {
  contractVersion: '1',
  documentID: '24000010',
  title: '水の探究',
  author: '探究班',
  enterYear: 2024,
  course: 'tankyu',
  eventName: 'individualTankyu',
  category1: 'society',
  subCategory1: 'traffic',
  category2: 'none',
  subCategory2: 'none',
  existsPoster: false,
  existsReport: false,
  existsSlide: false,
  existsThesis: false,
  revision: 'r1',
  favoriteCount: 1,
  isFavorite: true,
  favoriteRevision: 1,
};
async function fixture(page: Page) {
  const collections = new Map<
    string,
    { id: string; uid: string; name: string; revision: number; ids: string[] }
  >();
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  const receipts = new Map<string, unknown>();
  let failCreate = false;
  const dto = (
    c: typeof collections extends Map<string, infer V> ? V : never,
    documentID?: string | null,
  ) => ({
    id: c.id,
    uid: c.uid,
    name: c.name,
    revision: c.revision,
    count: c.ids.length,
    ...(documentID ? { saved: c.ids.includes(documentID) } : {}),
  });
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      body = req.postDataJSON() ?? {};
    calls.push({ path: url.pathname, method: req.method(), body });
    expect(req.headers().authorization).toBe('Bearer fixture-token');
    let result: unknown = { items: [] };
    if (url.pathname.startsWith('/api/collections')) {
      const parts = url.pathname.split('/'),
        c = collections.get(parts[3] ?? '');
      if (req.method() === 'GET')
        result =
          parts[4] === 'works'
            ? { items: c?.ids.includes(work.documentID) ? [work] : [], nextCursor: null }
            : {
                items: [...collections.values()].map((c) =>
                  dto(c, url.searchParams.get('documentID')),
                ),
              };
      else if (receipts.has(body.operationId)) result = receipts.get(body.operationId);
      else {
        if (req.method() === 'POST') {
          const created = {
            id: body.id,
            uid: 'fixture-alice',
            name: body.name,
            revision: 0,
            ids: body.documentID ? [body.documentID] : [],
          };
          collections.set(body.id, created);
          result = dto(created, body.documentID);
        } else if (c) {
          if (req.method() === 'DELETE') {
            collections.delete(c.id);
            result = { id: c.id, deleted: true };
          } else {
            c.revision++;
            if (parts[4] === 'works')
              c.ids = body.saved
                ? [...new Set([...c.ids, parts[5]!])]
                : c.ids.filter((id) => id !== parts[5]);
            else c.name = body.name;
            result = dto(c, parts[5]);
          }
        }
        receipts.set(body.operationId, result);
        if (failCreate && req.method() === 'POST') {
          failCreate = false;
          return route.fulfill({ status: 503, json: { error: { code: 'library_unavailable' } } });
        }
      }
    } else if (url.pathname === '/api/history' || url.pathname === '/api/favorites')
      result = {
        version: '1',
        items: [{ work, viewedAt: new Date().toISOString(), favorite: true }],
        nextCursor: null,
        stats: { version: '1', today: 1, week: 1, total: 1, serverTime: new Date().toISOString() },
      };
    else if (url.pathname === '/api/works/' + work.documentID)
      result = { version: '1', work, documents: [], authorizedAt: new Date().toISOString() };
    else if (url.pathname === '/api/works')
      result = { version: '1', items: [work], nextCursor: null };
    else if (url.pathname.endsWith('/state'))
      result = { version: '1', favorite: true, count: 1, revision: 1 };
    await route.fulfill({ json: result });
  });
  return {
    collections,
    calls,
    fail: () => {
      failCreate = true;
    },
  };
}
for (const width of [390, 820, 1440])
  test(`作成・複数保存・解除・改名・削除とキャッシュ ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const { collections, calls } = await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=/works/24000010');
    const bookmark = page.getByRole('button', { name: 'コレクションに保存', exact: true });
    await bookmark.click();
    const picker = page.getByRole('dialog', { name: 'コレクションに保存' });
    await picker.getByLabel('新しいコレクション').fill('研究のヒント');
    await picker.getByRole('button', { name: '作成して保存' }).click();
    await expect(picker.getByRole('checkbox', { name: /研究のヒント/ })).toBeChecked();
    await picker.getByLabel('新しいコレクション').fill('あとで読む');
    await picker.getByRole('button', { name: '作成して保存' }).click();
    await expect(picker.getByRole('checkbox', { name: /あとで読む/ })).toBeChecked();
    await page.screenshot({ path: `test-results-collections/picker-${width}.png`, fullPage: true });
    await picker.getByRole('checkbox', { name: /研究のヒント/ }).uncheck();
    await expect(picker.getByRole('checkbox', { name: /研究のヒント/ })).not.toBeChecked();
    expect([...collections.values()].find((c) => c.name === 'あとで読む')?.ids).toEqual([
      work.documentID,
    ]);
    await picker.getByRole('button', { name: '完了' }).click();
    await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
    await bookmark.click();
    await expect(picker.getByRole('checkbox', { name: /あとで読む/ })).toBeChecked();
    await picker.getByRole('button', { name: '完了' }).click();
    expect(calls.filter((c) => c.path === '/api/collections' && c.method === 'GET')).toHaveLength(
      1,
    );
    await page.getByRole('link', { name: '一覧へ戻る', exact: true }).click();
    await page.getByRole('link', { name: 'ライブラリ', exact: true }).click();
    await page.getByRole('button', { name: 'コレクション', exact: true }).click();
    await page.getByRole('button', { name: /あとで読む\s*1作品/ }).click();
    await expect(page.getByRole('heading', { name: '水の探究' })).toBeVisible();
    await page.getByRole('button', { name: 'あとで読むのメニュー' }).click();
    await page.getByLabel('コレクション名', { exact: true }).fill('参考資料');
    await page.getByRole('button', { name: '名前を保存' }).click();
    await expect(page.getByRole('heading', { name: '参考資料', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '参考資料のメニュー' }).click();
    await page.getByRole('button', { name: 'コレクションを削除', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(
      '他のコレクションや作品、お気に入りは残ります',
    );
    await page.getByRole('button', { name: '削除する', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect([...collections.values()].map((c) => c.name)).toEqual(['研究のヒント']);
    expect(
      calls.filter((c) => c.path === '/api/works/' + work.documentID && c.method === 'GET'),
    ).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results-collections/collections-${width}.png`,
      fullPage: true,
    });
  });
test('検索結果ではコレクションを取得しない', async ({ page }) => {
  const { calls } = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/results?q=水');
  await expect(page.getByText(work.title, { exact: true })).toBeVisible();
  expect(calls.filter((c) => c.path.startsWith('/api/collections'))).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'コレクションに保存' })).toHaveCount(0);
});
test('応答が失われても同じ作成を再送して重複を作らない', async ({ page }) => {
  const { calls, collections, fail } = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/works/24000010');
  await page.getByRole('button', { name: 'コレクションに保存', exact: true }).click();
  await page.getByLabel('新しいコレクション').fill('再送');
  fail();
  await page.getByRole('button', { name: '作成して保存' }).click();
  await expect(page.getByRole('alert')).toContainText('通信を確認');
  await page.getByRole('button', { name: '作成して保存' }).click();
  await expect(page.getByRole('checkbox', { name: /再送/ })).toBeChecked();
  expect(collections.size).toBe(1);
  const writes = calls.filter((c) => c.method === 'POST' && c.path === '/api/collections');
  expect(writes).toHaveLength(2);
  expect(writes[0]!.body.operationId).toBe(writes[1]!.body.operationId);
});
