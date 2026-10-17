import { test, expect, type Page } from '@playwright/test';
const first = {
  contractVersion: '1',
  documentID: '24000010',
  title: '架空の水の探究',
  author: '架空班',
  enterYear: 2024,
  course: 'tankyu',
  eventName: 'individualTankyu',
  category1: 'society',
  subCategory1: 'disasterPrevention',
  category2: 'none',
  subCategory2: 'none',
  existsPoster: true,
  existsReport: false,
  existsSlide: false,
  existsThesis: false,
  revision: 'fixture-r1',
};
const second = { ...first, documentID: '23000010', title: '架空の光の探究', enterYear: 2023 };
async function fixture(page: Page) {
  const calls: { path: string; method: string; body: string | null }[] = [];
  let history = [
    { id: 'v2:' + 'a'.repeat(32), parameters: 'q=水', searchedAt: '2026-10-18T00:00:00Z' },
  ];
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    calls.push({ path: url.pathname + url.search, method: req.method(), body: req.postData() });
    expect(req.headers().authorization).toBe('Bearer fixture-token');
    let body: unknown;
    if (url.pathname === '/api/search-history') {
      if (req.method() === 'DELETE') history = [];
      body = { version: '1', items: history };
    } else if (url.pathname === '/api/discovery')
      body = { version: '1', items: [first], nextCursor: null };
    else if (/^\/api\/works\/\d{8}$/.test(url.pathname))
      body = { version: '1', work: first, documents: [], authorizedAt: new Date().toISOString() };
    else
      body = {
        version: '1',
        items: url.searchParams.has('cursor') ? [second] : [first],
        nextCursor: url.searchParams.has('cursor') ? null : 'fixture-next',
      };
    await route.fulfill({ json: body });
  });
  return calls;
}
for (const [name, width, height] of [
  ['スマホ', 390, 844],
  ['iPad', 820, 1180],
  ['PC', 1440, 1000],
] as const)
  test(`${name}: 幅・絞込URL・ページ送り`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const calls = await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/explore?q=水'));
    await expect(page.getByRole('heading', { name: '「水」の検索結果' })).toBeVisible();
    await expect(page.locator('article')).toHaveCount(1);
    await page.getByRole('button', { name: '続きを見る' }).click();
    await expect(page.locator('article')).toHaveCount(2);
    expect(calls.some((c) => c.path.includes('cursor=fixture-next'))).toBeTruthy();
    await page.getByRole('combobox', { name: '学科', exact: true }).selectOption('general');
    await expect(page).toHaveURL(/course=general/);
    await page.getByRole('combobox', { name: '入学年度', exact: true }).selectOption('2023');
    await expect(page).toHaveURL(/year=2023/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test('送信した時だけ履歴保存、既存履歴から再検索・削除', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/explore?q=水'));
  await page.getByLabel('作品をキーワードで検索').fill('光');
  expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  await page.getByRole('button', { name: '探す', exact: true }).click();
  await expect(page).toHaveURL(/q=%E5%85%89/);
  await expect.poll(() => calls.filter((c) => c.method === 'POST').length).toBe(1);
  await page.getByRole('link', { name: '水', exact: true }).click();
  await expect(page).toHaveURL(/q=%E6%B0%B4/);
  await page.getByRole('button', { name: '水の検索履歴を削除' }).click();
  await expect(page.getByRole('link', { name: '水', exact: true })).toHaveCount(0);
});
test('KRGP条件と詳細から一覧へ戻る', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/awards?year=2024'));
  await page.getByRole('combobox', { name: '賞', exact: true }).selectOption('2');
  await page.getByRole('textbox', { name: '賞名', exact: true }).fill('プレゼン');
  await page.getByRole('textbox', { name: '賞名', exact: true }).blur();
  await expect
    .poll(() =>
      calls.some((c) => c.path.startsWith('/api/awards?') && c.path.includes('awardName=')),
    )
    .toBeTruthy();
  await page.getByLabel('作品をキーワードで検索').fill('水');
  await page.getByRole('button', { name: '探す', exact: true }).click();
  await expect
    .poll(() =>
      calls.some(
        (c) =>
          c.method === 'POST' &&
          new URLSearchParams(JSON.parse(c.body ?? '{}').parameters).get('awardsOnly') === '1',
      ),
    )
    .toBeTruthy();
  await page.getByRole('link', { name: '架空の水の探究の詳細' }).click();
  await expect(page.getByRole('heading', { name: '架空の水の探究' })).toBeVisible();
  await page.getByRole('link', { name: '一覧へ戻る' }).click();
  await expect(page).toHaveURL(/award=2/);
});
test('通信失敗時に前の条件の作品を混ぜない', async ({ page }) => {
  await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/explore?q=水'));
  await expect(page.locator('article')).toHaveCount(1);
  await page.route('**/api/works?**', (route) =>
    route.fulfill({ status: 503, json: { error: { code: 'firestore_unavailable' } } }),
  );
  await page.getByRole('combobox', { name: '学科', exact: true }).selectOption('general');
  await expect(page.getByRole('alert')).toContainText('読み込めませんでした');
  await expect(page.locator('article')).toHaveCount(0);
});
test('未ログインの検索・KRGPはAPIを呼ばない', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: '学校のアカウントでログイン' })).toBeVisible();
  await page.goto('/awards');
  await expect(page.getByRole('heading', { name: '学校のアカウントでログイン' })).toBeVisible();
  expect(calls).toHaveLength(0);
});
