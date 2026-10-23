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
  await page.route('https://lh3.googleusercontent.com/fixture-avatar', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#8f123f"/></svg>',
    }),
  );
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
    } else if (url.pathname === '/api/notifications')
      body = {
        version: '1',
        items: [
          {
            id: 'notice-1',
            title: '探究発表会のお知らせ',
            createdAt: '2026-10-22T00:00:00Z',
            read: false,
          },
        ],
        nextCursor: null,
      };
    else if (url.pathname === '/api/awards/collection') {
      body = {
        version: '1',
        nextCursor: null,
        items: [
          ...Array.from({ length: 33 }, (_, i) => ({
            ...first,
            documentID: String(24000010 + i * 10),
            title: i === 0 ? first.title : `${first.title} ${i + 1}`,
            awardType: i === 32 ? 1 : i < 7 ? 2 : i < 27 ? 3 : 4,
            ...(i < 5 ? { awardName: 'プレゼン賞' } : {}),
            favoriteCount: 55 - i,
            isFavorite: false,
            favoriteRevision: 0,
          })),
          ...Array.from({ length: 22 }, (_, i) => ({
            ...second,
            documentID: String(23000010 + i * 10),
            title: `${second.title} ${i + 1}`,
            awardType: 3,
            favoriteCount: 0,
            isFavorite: false,
            favoriteRevision: 0,
          })),
        ],
      };
    } else if (url.pathname === '/api/discovery')
      body = { version: '1', items: [first], nextCursor: null };
    else if (/^\/api\/works\/\d{8}\/state$/.test(url.pathname))
      body = { version: '1', favorite: false, revision: 0, count: 7 };
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
    await expect(page.getByRole('heading', { name: '「水」の検索結果' })).toHaveClass('sr-only');
    await expect(page.locator('article')).toHaveCount(1);
    await page.getByRole('button', { name: 'さらに表示' }).click();
    await expect(page.locator('article')).toHaveCount(2);
    expect(calls.some((c) => c.path.includes('cursor=fixture-next'))).toBeTruthy();
    await page.getByRole('button', { name: 'フィルター', exact: true }).click();
    await page.getByRole('combobox', { name: '学科', exact: true }).selectOption('general');
    await expect(page).not.toHaveURL(/course=general/);
    await page.getByRole('combobox', { name: '入学年度', exact: true }).selectOption('2023');
    await page.getByRole('button', { name: 'この条件で検索' }).click();
    await expect(page).toHaveURL(/course=general/);
    await expect(page).toHaveURL(/year=2023/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test('検索専用画面で履歴を保存し、再検索・削除できる', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/search');
  await page.getByLabel('作品をキーワードで検索').fill('光');
  expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  await page.getByRole('button', { name: '検索する', exact: true }).click();
  await expect(page).toHaveURL(/results\?q=%E5%85%89/);
  await expect(page.getByRole('heading', { name: '「光」の検索結果' })).toHaveClass('sr-only');
  expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  await page.getByRole('link', { name: '検索に戻る', exact: true }).click();
  await page.getByRole('link', { name: '水', exact: true }).click();
  await expect(page).toHaveURL(/results\?q=%E6%B0%B4/);
  await page.getByRole('link', { name: '検索に戻る', exact: true }).click();
  await page.getByRole('button', { name: '水の検索履歴を削除' }).click();
  await expect(page.getByRole('link', { name: '水', exact: true })).toHaveCount(0);
});
test('KRGP条件と詳細から一覧へ戻る', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/awards?year=2024'));
  await page.getByRole('button', { name: '優秀賞 7', exact: true }).click();
  await page.getByRole('combobox', { name: 'KRGPの賞名', exact: true }).selectOption('プレゼン賞');
  await page.getByRole('button', { name: /フィルター/ }).click();
  await page.getByRole('searchbox', { name: 'キーワード', exact: true }).fill('水');
  await page.getByRole('button', { name: 'この条件で検索' }).click();
  await expect.poll(() => calls.some((c) => c.path === '/api/awards/collection')).toBeTruthy();
  await page.getByRole('link', { name: '架空の水の探究の詳細' }).click();
  await expect(page).toHaveURL(/\/works\/24000010/);
  await expect(page.getByRole('heading', { name: '架空の水の探究', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'フィルター', exact: true }).click();
  await page.getByRole('combobox', { name: '学科', exact: true }).selectOption('general');
  await page.getByRole('button', { name: 'この条件で検索' }).click();
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

for (const [width, height, sidebar] of [
  [390, 844, false],
  [820, 1180, false],
  [1024, 768, true],
  [1440, 1000, true],
] as const) {
  test(`ホーム・検索・カテゴリ・設定の導線: ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const calls = await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=/home');
    const nav = page.getByRole('navigation', { name: 'メインナビゲーション' });
    await expect(nav.locator('a:visible')).toHaveText(
      sidebar ? ['ホーム', '探索', 'ライブラリ'] : ['ホーム', '探索', 'ライブラリ', 'アカウント'],
    );
    const box = await nav.boundingBox();
    expect(sidebar ? box!.width < 200 && box!.height > 500 : box!.y > height - 110).toBe(true);
    await expect(page.getByRole('button', { name: 'お知らせ', exact: true })).toBeVisible();
    await expect(page.locator('.account-avatar img:visible').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
    if (sidebar) {
      await page.getByLabel('ヘッダーで作品を検索').click();
      await expect(page).toHaveURL(/\/home$/);
      await expect(page.locator('.search-dropdown')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.search-dropdown')).toHaveCount(0);
      await page.goto('/tests/discovery-harness.html?entry=/search');
    } else {
      await page.getByRole('link', { name: '検索画面を開く', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByLabel('作品をキーワードで検索')).toBeFocused();
    await expect(page.getByRole('heading', { name: '最近の検索' })).toBeVisible();
    const categoryEntry = page.getByRole('link', { name: 'カテゴリから調べる' });
    const categoryBox = await categoryEntry.boundingBox(),
      historyBox = await page.getByRole('heading', { name: '最近の検索' }).boundingBox();
    expect(categoryBox!.y < historyBox!.y).toBe(true);
    expect(calls.some((c) => c.path.startsWith('/api/works'))).toBe(false);
    await categoryEntry.click();
    await expect(page.locator('main').getByRole('searchbox')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '最近の検索' })).toHaveCount(0);
    await expect(page.locator('main .genre-card')).toHaveCount(14);
    await page.screenshot({ path: testInfo.outputPath(`explore-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: '地域', exact: true }).click();
    await expect(page).toHaveURL(/explore\/society$/);
    expect(calls.some((c) => c.path.startsWith('/api/works'))).toBe(false);
    await page.getByRole('link', { name: '防災', exact: true }).click();
    await expect(page).toHaveURL(/results\?category=society&subcategory=disasterPrevention/);
    await expect(page.getByRole('link', { name: '架空の水の探究の詳細' })).toBeVisible();
    await page.getByRole('link', { name: '架空の水の探究の詳細' }).click();
    await page.getByRole('link', { name: '一覧へ戻る' }).click();
    await expect(page).toHaveURL(/results\?category=society&subcategory=disasterPrevention/);
    await page.getByRole('link', { name: 'サブカテゴリに戻る' }).click();
    await page.getByRole('link', { name: 'すべて', exact: true }).click();
    await expect(page).toHaveURL(/results\?category=society$/);
    expect(new URL(page.url()).searchParams.has('subcategory')).toBe(false);
    if (sidebar)
      await page.getByRole('link', { name: '探究アーカイブのトップ', exact: true }).click();
    await page.getByRole('link', { name: 'アカウント設定', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'ダークモード' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('ログイン済みのWelcomeはホームへ直行し、作品のリンク先も保持する', async ({ page }) => {
  await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/welcome');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'ホーム', exact: true })).toHaveClass('sr-only');
  await page.goto(
    '/tests/discovery-harness.html?entry=' + encodeURIComponent('/welcome?next=/explore?q=水'),
  );
  await expect(page).toHaveURL(/results\?q=/);
});

test('プロフィール画像が読み込めない場合はアカウントアイコンに戻る', async ({ page }) => {
  await fixture(page);
  await page.route('https://lh3.googleusercontent.com/fixture-avatar', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.goto('/tests/discovery-harness.html?entry=/home');
  await expect(page.locator('.account-avatar img')).toHaveCount(0);
  await expect(page.locator('.account-avatar svg:visible').first()).toBeVisible();
});

test('PC検索は背景・スクロール位置を保ち、履歴やキーワードから結果へ移動できる', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  const calls = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/explore');
  const input = page.getByLabel('ヘッダーで作品を検索');
  await expect(page.locator('main .genre-card')).toHaveCount(14);
  await page.evaluate(() => window.scrollTo(0, 200));
  const scroll = await page.evaluate(() => scrollY);
  const inputBox = await input.boundingBox();
  expect(inputBox!.y).toBeGreaterThanOrEqual(0);
  await page.mouse.click(inputBox!.x + 40, inputBox!.y + inputBox!.height / 2);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.locator('main .genre-card')).toHaveCount(14);
  await expect(
    page.locator('.search-dropdown').getByRole('link', { name: '水', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop-search.png'), fullPage: true });
  await page.locator('main .genre-card').first().click();
  await expect(page.locator('.search-dropdown')).toHaveCount(0);
  await input.fill('光');
  await page.getByRole('button', { name: '検索する', exact: true }).click();
  await expect(page).toHaveURL(/results\?q=%E5%85%89/);
  await expect(page.locator('.search-dropdown')).toHaveCount(0);
  expect(calls.filter((c) => c.method === 'POST').length).toBe(1);
  await input.click();
  await page.locator('.search-dropdown').getByRole('link', { name: '水', exact: true }).click();
  await expect(page).toHaveURL(/results\?q=%E6%B0%B4/);
  await expect(page.locator('.search-dropdown')).toHaveCount(0);
});
test('テーマを保存し、OSがダークでもライトを選べる', async ({ page }, testInfo) => {
  await fixture(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/tests/discovery-harness.html?entry=/account');
  const toggle = page.getByRole('switch', { name: 'ダークモード' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/tests/discovery-harness.html?entry=/account');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.screenshot({ path: testInfo.outputPath('settings-light.png'), fullPage: true });
  await toggle.click();
  await page.screenshot({ path: testInfo.outputPath('settings-dark.png'), fullPage: true });
  await page.getByRole('link', { name: 'ホーム', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.locator('main').getByRole('heading', { name: 'お知らせ', exact: true }).count(),
  ).toBe(0);
});

for (const width of [390, 1440])
  test(`お知らせは背景を保つパネルで表示・既読・次へ移動: ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    let read = false;
    const notices = [
      {
        id: 'notice-1',
        title: '探究発表会のお知らせ',
        body: '発表会の内容です',
        createdAt: '2026-10-22T00:00:00Z',
        read: false,
        workId: null,
      },
      {
        id: 'notice-2',
        title: '次の通知',
        body: '次の内容です',
        createdAt: '2026-10-21T00:00:00Z',
        read: false,
        workId: null,
      },
    ];
    await page.route('**/api/notifications*', (route) =>
      route.fulfill({
        json: {
          version: '1',
          items: notices.map((n, i) => ({ ...n, read: i === 0 && read })),
          nextCursor: null,
        },
      }),
    );
    await page.route('**/api/notifications/notice-*', (route) =>
      route.fulfill({
        json: notices.find((n) => new URL(route.request().url()).pathname.endsWith(n.id)),
      }),
    );
    await page.route('**/api/notification-reads/*', (route) => {
      read = true;
      return route.fulfill({ json: { version: '1', recorded: true } });
    });
    await page.goto('/tests/discovery-harness.html?entry=/home');
    await page.getByRole('button', { name: 'お知らせ', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'お知らせ', exact: true });
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('main .krgp-card')).toBeVisible();
    await expect(panel.getByRole('switch', { name: 'この端末への通知' })).toBeVisible();
    await panel.getByRole('button', { name: /探究発表会のお知らせ/ }).click();
    await expect(panel.getByLabel('お知らせの内容')).toContainText('発表会の内容です');
    await panel.getByRole('button', { name: '次のお知らせ', exact: true }).click();
    await expect(panel.getByLabel('お知らせの内容')).toContainText('次の内容です');
    await page.screenshot({ path: testInfo.outputPath(`notices-${width}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'お知らせ', exact: true })).toBeFocused();
    await page.goto(
      '/tests/discovery-harness.html?entry=' + encodeURIComponent('/notifications?open=notice-1'),
    );
    await expect(panel.getByLabel('お知らせの内容')).toContainText('発表会の内容です');
    await panel.getByRole('button', { name: 'お知らせを閉じる' }).click();
    await expect(page).toHaveURL(/\/home$/);
  });

for (const [width, height] of [
  [320, 740],
  [390, 844],
  [1024, 768],
  [1440, 900],
] as const) {
  test(`フィルターの下書き・固定条件・並び替え: ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await fixture(page);
    const requests: URL[] = [];
    await page.route('**/api/works?**', (route) => {
      requests.push(new URL(route.request().url()));
      return route.fulfill({
        json: {
          version: '1',
          items: Array.from({ length: 30 }, (_, i) => ({
            ...first,
            documentID: String(24000010 + i * 10),
          })),
          nextCursor: null,
        },
      });
    });
    await page.goto(
      '/tests/discovery-harness.html?entry=' +
        encodeURIComponent(
          '/results?category=society&subcategory=disasterPrevention&year=2024&course=tankyu&cursor=old',
        ),
    );
    await expect(page.locator('article')).toHaveCount(30);
    await expect(page.getByRole('combobox', { name: '学科', exact: true })).not.toBeVisible();
    const trigger = page.getByRole('button', { name: /フィルター/ });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'フィルター', exact: true });
    await expect(dialog).toBeVisible();
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return width < 900
          ? Math.abs(box!.x + box!.width - width) < 2 && box!.height === height
          : Math.abs(box!.x + box!.width / 2 - width / 2) < 2;
      })
      .toBe(true);
    const before = requests.length;
    await page.getByRole('combobox', { name: '学科', exact: true }).selectOption('general');
    expect(requests).toHaveLength(before);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(page.getByRole('combobox', { name: '学科', exact: true })).toHaveValue('tankyu');
    await page.getByRole('combobox', { name: 'カテゴリ', exact: true }).selectOption('health');
    await expect(page.getByRole('combobox', { name: 'サブカテゴリ', exact: true })).toHaveValue('');
    await page.screenshot({
      path: testInfo.outputPath(`filter-${width}.png`),
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'この条件で検索' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/category=health/);
    expect(new URL(page.url()).searchParams.has('subcategory')).toBe(false);
    expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
    await page.getByRole('button', { name: '2024年度入学の条件を解除' }).click();
    await expect.poll(() => requests.at(-1)?.searchParams.has('year')).toBe(false);
    for (const sort of ['oldest', 'likes', 'newest']) {
      await page.getByRole('combobox', { name: '並び順' }).selectOption(sort);
      await expect.poll(() => requests.at(-1)?.searchParams.get('sort')).toBe(sort);
    }
    await page.evaluate(() => window.scrollTo(0, 700));
    const sticky = await page.locator('.results-controls').boundingBox();
    const header = await page.locator('.site-header').boundingBox();
    expect(Math.abs(sticky!.y - header!.height)).toBeLessThan(2);
    await page.screenshot({ path: testInfo.outputPath(`results-sticky-${width}.png`) });
    await trigger.click();
    await page.getByRole('button', { name: '条件をクリア', exact: true }).click();
    await page.getByRole('button', { name: 'この条件で検索' }).click();
    await expect(page.getByLabel('適用中の検索条件')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: '並び順' })).toHaveValue('newest');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
    await trigger.click();
    await page.screenshot({
      path: testInfo.outputPath(`filter-dark-${width}.png`),
      animations: 'disabled',
    });
  });
}

for (const [width, height] of [
  [390, 844],
  [1024, 768],
  [1440, 900],
] as const) {
  test(`検索・作品ヘッダーと2カテゴリ表示: ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await fixture(page);
    await page.route('**/api/works?**', (route) =>
      route.fulfill({
        json: {
          version: '1',
          items: [{ ...first, category2: 'health', subCategory2: 'sleep' }],
          nextCursor: null,
        },
      }),
    );
    const title = '架空の長い作品タイトルで省略表示を確認します'.repeat(5);
    await page.route('**/api/works/24000010', (route) =>
      route.fulfill({
        json: {
          version: '1',
          work: { ...first, title },
          documents: [],
          authorizedAt: new Date().toISOString(),
        },
      }),
    );
    await page.goto(
      '/tests/discovery-harness.html?entry=' +
        encodeURIComponent('/results?category=society&subcategory=disasterPrevention'),
    );
    await expect(page.locator('.result-category-title')).toContainText('地域');
    await expect(page.locator('.result-category-title img')).toHaveAttribute(
      'src',
      '/images/categories/society.png',
    );
    await expect(page.locator('main h1')).toHaveClass('sr-only');
    await expect(page.locator('article .category-art-pair img')).toHaveCount(2);
    await page.getByRole('button', { name: /フィルター/ }).click();
    await expect(
      page.getByRole('combobox', { name: '活動', exact: true }).locator('option'),
    ).toHaveText(['すべての活動', '個人探究']);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'この条件にキーワードを追加' }).click();
    const search = page.getByRole('searchbox', { name: 'ヘッダーで作品を検索' });
    await expect(search).toBeFocused();
    await search.fill('SNS');
    await page.getByRole('button', { name: '検索する', exact: true }).click();
    await expect(page).toHaveURL(/q=SNS/);
    expect(new URL(page.url()).searchParams.get('category')).toBe('society');
    await expect(search).toHaveValue('SNS');
    await expect(page.getByText('検索結果', { exact: true })).toHaveCount(0);
    if (width >= 900)
      await expect(page.getByRole('link', { name: '探究アーカイブのトップ' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`result-header-${width}.png`) });
    await page.getByRole('link', { name: '架空の水の探究の詳細' }).click();
    await expect(page.locator('main h1')).toHaveText(title);
    await expect(page.locator('.work-toolbar-title')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'メインナビゲーション' })).toHaveCount(0);
    const actions = width >= 900 ? page.locator('main') : page.locator('.site-header');
    await expect(actions.locator('.favorite-count')).toHaveText('7');
    await expect(actions.getByRole('button', { name: 'その他', exact: true })).toBeVisible();
    expect(await page.locator('main').evaluate((el) => getComputedStyle(el).marginLeft)).toBe(
      '0px',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`work-header-${width}.png`) });
    await page.getByRole('link', { name: '一覧へ戻る', exact: true }).click();
    await expect(search).toHaveValue('SNS');
    if (width >= 900) {
      await page.getByRole('link', { name: '探究アーカイブのトップ' }).click();
      await expect(page).toHaveURL(/\/home$/);
    }
  });
}
test('更新案内は中央のモーダルで、更新ボタン以外では閉じない', async ({ page }, testInfo) => {
  await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/test-update');
  const modal = page.getByRole('dialog', { name: '新しいバージョンがあります' });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button')).toHaveCount(1);
  const button = modal.getByRole('button', { name: '更新する', exact: true });
  await expect(button).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(modal).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  const box = await modal.boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath('version-dialog.png') });
  await button.click();
  await expect(page.locator('body')).toHaveAttribute('data-update-requested', 'true');
  await expect(modal.getByRole('button')).toBeDisabled();
});

test('検索応答の人数と本人状態でハートを表示し、作品ごとの追加GETや更新後GETを送らない', async ({
  page,
}) => {
  const f = await fixture(page);
  let searches = 0,
    mutations = 0;
  await page.route('**/api/works?**', async (route) => {
    searches++;
    await route.fulfill({
      json: {
        version: '1',
        items: [
          { ...first, favoriteCount: 7, isFavorite: true, favoriteRevision: 2 },
          { ...second, favoriteCount: 0, isFavorite: false, favoriteRevision: 0 },
        ],
        nextCursor: null,
      },
    });
  });
  await page.route('**/api/favorites/24000010', async (route) => {
    mutations++;
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataJSON()).toMatchObject({ favorite: false, expectedRevision: 2 });
    await route.fulfill({ json: { version: '1', favorite: false, revision: 3, count: 6 } });
  });
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水'));
  await expect(page.locator('article')).toHaveCount(2);
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: first.title, exact: true }) });
  await expect(
    card.getByRole('button', { name: 'お気に入りから外す', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByLabel('7件のいいね', { exact: true })).toBeVisible();
  expect(searches).toBe(1);
  expect(f.filter((c) => c.path.endsWith('/state'))).toHaveLength(0);
  await card.getByRole('button', { name: 'お気に入りから外す', exact: true }).click();
  await expect(card.getByRole('button', { name: 'お気に入りに追加', exact: true })).toBeEnabled();
  await expect(card.getByLabel('6件のいいね', { exact: true })).toBeVisible();
  expect(mutations).toBe(1);
  expect(searches).toBe(1);
  expect(f.filter((c) => c.path.endsWith('/state'))).toHaveLength(0);
});

test('検索履歴は開き直しても5分再利用し、削除応答を使って追加GETしない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/search');
  await expect(page.getByRole('link', { name: '水', exact: true })).toBeVisible();
  const gets = () =>
    calls.filter((c) => c.path === '/api/search-history' && c.method === 'GET').length;
  expect(gets()).toBe(1);
  await page.getByRole('link', { name: 'ホーム', exact: true }).click();
  await page.getByRole('link', { name: '検索画面を開く' }).click();
  await expect(page.getByRole('link', { name: '水', exact: true })).toBeVisible();
  expect(gets()).toBe(1);
  await page.getByRole('button', { name: '水の検索履歴を削除', exact: true }).click();
  await expect(page.getByText('検索すると、ここからもう一度たどれます。')).toBeVisible();
  expect(gets()).toBe(1);
  await page.getByRole('link', { name: 'ホーム', exact: true }).click();
  await page.getByRole('link', { name: '検索画面を開く' }).click();
  await expect(page.getByText('検索すると、ここからもう一度たどれます。')).toBeVisible();
  expect(gets()).toBe(1);
});

for (const [device, width, height, entry] of [
  ['スマホ', 390, 844, '/search'],
  ['PC', 1440, 1000, '/home'],
] as const)
  test(`${device}: 条件候補は部分一致し、入力中は追加APIを呼ばず選択時だけ絞り込む`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const calls = await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent(entry));
    const input = page.getByRole('searchbox');
    await input.fill('環境');
    const suggestions = page.getByRole('region', { name: '条件から探す候補' });
    await expect(
      suggestions.getByRole('link', { name: 'カテゴリ「環境問題」で探す', exact: true }),
    ).toBeVisible();
    const initial = calls.length;
    await input.fill('2024');
    await expect(
      suggestions.getByRole('link', { name: '2024年度入学で探す', exact: true }),
    ).toBeVisible();
    await input.fill('普通');
    await expect(
      suggestions.getByRole('link', { name: '普通科で探す', exact: true }),
    ).toBeVisible();
    expect(calls.filter((c) => c.path.startsWith('/api/search-suggestions'))).toHaveLength(0);
    expect(calls.length).toBe(initial);
    await input.fill('環境 プラスチック');
    await suggestions
      .getByRole('link', { name: 'カテゴリ「環境問題」で「プラスチック」を検索', exact: true })
      .click();
    await expect(page).toHaveURL(/\/results\?/);
    const params = new URL(page.url()).searchParams;
    expect(params.get('category')).toBe('environment');
    expect(params.get('q')).toBe('プラスチック');
    await expect(page.getByRole('combobox', { name: '並び順' })).toHaveValue('likes');
  });

test('管理者は年度別の表示を確認して通常表示へ戻れる', async ({ page }) => {
  await fixture(page);
  await page.goto('/tests/discovery-harness.html?role=admin&entry=/account');
  await page.getByLabel('表示する権限', { exact: true }).selectOption('student');
  await page.getByLabel('表示する入学年度', { exact: true }).selectOption('2025');
  await expect(
    page.getByRole('status').filter({ hasText: '生徒 · 2025年度入学として表示を確認中' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'ホーム', exact: true }).click();
  await expect(page.getByText('生徒 · 2025年度入学として表示を確認中')).toBeVisible();
  await page.getByRole('button', { name: '確認を終了' }).click();
  await expect(page.getByText('として表示を確認中')).toHaveCount(0);
  await page.goto('/tests/discovery-harness.html?role=admin&entry=/account');
  await page.getByLabel('表示する権限', { exact: true }).selectOption('teacher');
  await expect(page.getByText('教員として表示を確認中')).toBeVisible();
  await expect(page.getByLabel('表示する入学年度', { exact: true })).toHaveCount(0);
});
test('生徒の設定には管理者の表示切替を出さない', async ({ page }) => {
  await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/account');
  await expect(page.getByText('生徒 · 入学年度未登録')).toBeVisible();
  await expect(page.getByLabel('表示する権限', { exact: true })).toHaveCount(0);
});

for (const [name, width, height] of [
  ['スマホ', 390, 844],
  ['PC', 1440, 1000],
] as const)
  test(`${name}: KRGP開催年は入学年度の翌年、賞名と賞で絞り込める`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const calls = await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=/awards');
    await expect(page.getByRole('button', { name: 'KRGP 2025 33' })).toBeVisible();
    await page.getByRole('button', { name: 'KRGP 2025 33' }).click();
    await expect(page).toHaveURL(/year=2024/);
    await expect(page.locator('.result-category-title')).toHaveText('KRGP 2025');
    await expect(page.locator('.awards-edition-summary')).toContainText('2024年度入学');
    await page.getByLabel('KRGPの賞名', { exact: true }).selectOption('プレゼン賞');
    await expect(page).toHaveURL(/awardName=/);
    await expect(
      page.locator('article').first().getByText('優秀賞', { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('article').first().getByText('プレゼン賞', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '大賞 1', exact: true }).click();
    await expect(page).toHaveURL(/award=1/);
    await expect(page.getByText('この条件の受賞作品はありません。')).toBeVisible();
    expect(calls.filter((c) => c.path === '/api/awards/collection').length === 1).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: '条件をリセット', exact: true }).click();
    await expect(page.locator('article')).toHaveCount(20);
  });

test('KRGPは条件変更・追加表示・詳細からの復帰で作品を再取得しない', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/awards');
  await expect(page.locator('article')).toHaveCount(20);
  await page.getByRole('button', { name: 'さらに表示', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(40);
  await page.getByRole('button', { name: 'KRGP 2024 22', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(20);
  await page.getByLabel('並び順', { exact: true }).selectOption('oldest');
  await page.getByRole('button', { name: 'KRGP 2025 33', exact: true }).click();
  await page.getByLabel('並び順', { exact: true }).selectOption('likes');
  await page.getByRole('link', { name: '架空の水の探究の詳細', exact: true }).click();
  await page.getByRole('link', { name: '一覧へ戻る', exact: true }).click();
  await expect(page.getByRole('button', { name: 'KRGP 2025 33', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(calls.filter((c) => c.path === '/api/awards/collection')).toHaveLength(1);
  expect(calls.some((c) => c.path.startsWith('/api/awards?'))).toBe(false);
  await page.getByRole('button', { name: '作品情報を更新', exact: true }).click();
  await expect.poll(() => calls.filter((c) => c.path === '/api/awards/collection').length).toBe(2);
});
test('KRGPのお気に入り操作はキャッシュに残り、条件を変えても戻らない', async ({ page }) => {
  const calls = await fixture(page);
  await page.route('**/api/favorites/24000010', (route) =>
    route.fulfill({ json: { version: '1', favorite: true, count: 56, revision: 1 } }),
  );
  await page.goto('/tests/discovery-harness.html?entry=/awards');
  await page
    .locator('article')
    .first()
    .getByRole('button', { name: 'お気に入りに追加', exact: true })
    .click();
  await expect(
    page
      .locator('article')
      .first()
      .getByRole('button', { name: 'お気に入りから外す', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'KRGP 2024 22', exact: true }).click();
  await page.getByRole('button', { name: 'KRGP 2025 33', exact: true }).click();
  await expect(
    page
      .locator('article')
      .first()
      .getByRole('button', { name: 'お気に入りから外す', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('article').first().getByLabel('56件のいいね')).toBeVisible();
  expect(calls.filter((c) => c.path === '/api/awards/collection')).toHaveLength(1);
  expect(calls.filter((c) => /\/state$/.test(c.path))).toHaveLength(0);
});
