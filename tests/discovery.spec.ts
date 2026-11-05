import { test, expect, type Page } from '@playwright/test';
const first = {
  contractVersion: '1',
  documentID: '24000010',
  title: '架空の水の探究',
  author: '架空班',
  enterYear: 2024,
  course: 'tankyu',
  eventName: 'individualTankyu',
  category1: 'community',
  subCategory1: 'community-02',
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
    else if (/^\/api\/works\/\d{8}\/similar$/.test(url.pathname))
      body = { version: '1', items: [], nextCursor: null };
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
test('検索結果に戻っても取得済みページを再検索せず、お気に入り変更を反映する', async ({ page }) => {
  const calls = await fixture(page);
  const snapshot = { favoriteCount: 7, isFavorite: false, favoriteRevision: 0 };
  let searches = 0;
  await page.route('**/api/works?*', async (route) => {
    searches++;
    const cursor = new URL(route.request().url()).searchParams.has('cursor');
    await route.fulfill({
      json: {
        version: '1',
        items: [{ ...(cursor ? second : first), ...snapshot }],
        nextCursor: cursor ? null : 'fixture-next',
      },
    });
  });
  await page.route('**/api/works/24000010', (route) =>
    route.fulfill({
      json: {
        version: '1',
        work: { ...first, ...snapshot },
        documents: [],
        authorizedAt: new Date().toISOString(),
      },
    }),
  );
  await page.route('**/api/favorites/24000010', (route) =>
    route.fulfill({
      json: {
        version: '1',
        favorite: true,
        count: 8,
        revision: 1,
      },
    }),
  );
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水'));
  await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'さらに表示' }).click();
  await expect(page.locator('article')).toHaveCount(2);
  expect(searches).toBe(2);
  await page.getByRole('link', { name: first.title + 'の詳細' }).click();
  await expect(page.getByRole('link', { name: '一覧へ戻る', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'お気に入りに追加', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'お気に入りに追加', exact: true }).click();
  await expect(page.getByRole('button', { name: 'お気に入りから外す' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('link', { name: '一覧へ戻る', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(2);
  await expect(
    page
      .locator('article')
      .filter({ hasText: first.title })
      .getByRole('button', { name: 'お気に入りから外す' }),
  ).toContainText('8');
  expect(searches).toBe(2);
  expect(calls.filter((c) => c.path.endsWith('/state'))).toHaveLength(0);
});
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
    await page.locator('.filter-trigger').click();
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
  await page.locator('.filter-trigger').click();
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
    await page.getByRole('link', { name: '地域・まち', exact: true }).click();
    await expect(page).toHaveURL(/explore\/community$/);
    expect(calls.some((c) => c.path.startsWith('/api/works'))).toBe(false);
    await page.getByRole('link', { name: '防災・減災', exact: true }).click();
    await expect(page).toHaveURL(/results\?category=community&subcategory=community-02/);
    await expect(page.getByRole('link', { name: '架空の水の探究の詳細' })).toBeVisible();
    await page.getByRole('link', { name: '架空の水の探究の詳細' }).click();
    await page.getByRole('link', { name: '一覧へ戻る' }).click();
    await expect(page).toHaveURL(/results\?category=community&subcategory=community-02/);
    await page.getByRole('link', { name: 'サブカテゴリに戻る' }).click();
    await page.getByRole('link', { name: 'すべて', exact: true }).click();
    await expect(page).toHaveURL(/results\?category=community$/);
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
    let readRequests = 0;
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
          items: notices,
          nextCursor: null,
        },
      }),
    );
    await page.route('**/api/notifications/notice-*', (route) =>
      route.fulfill({
        json: notices.find((n) => new URL(route.request().url()).pathname.endsWith(n.id)),
      }),
    );
    await page.route('**/api/notifications/inbox*', (route) => {
      const since = new URL(route.request().url()).searchParams.get('since');
      return route.fulfill({
        json: {
          version: '1',
          asOf: since ? '2026-10-23T00:00:00Z' : '2026-10-20T00:00:00Z',
          items: since ? notices.map(({ id, createdAt }) => ({ id, createdAt })) : [],
        },
      });
    });
    await page.route('**/api/notification-reads/*', (route) => {
      readRequests++;
      return route.fulfill({ json: { version: '1', ok: true } });
    });
    await page.goto('/tests/discovery-harness.html?entry=/home');
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const modulePath = '/src/features/notifications/local-state.ts';
          return (await (await import(modulePath)).readNoticeState('fixture-alice')).baseline;
        }),
      )
      .toBe('2026-10-20T00:00:00Z');
    await page.getByRole('button', { name: 'お知らせ', exact: true }).click();
    await page.getByRole('button', { name: 'お知らせを閉じる' }).click();
    const badge = page.getByLabel('未読のお知らせがあります');
    await expect(badge).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`unread-badge-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'お知らせ', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'お知らせ', exact: true });
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('main .krgp-card')).toBeVisible();
    await expect(panel.getByRole('switch', { name: 'この端末への通知' })).toBeVisible();
    await panel.getByRole('button', { name: /探究発表会のお知らせ/ }).click();
    await expect(panel.getByLabel('お知らせの内容')).toContainText('発表会の内容です');
    await expect(badge).toBeVisible();
    await panel.getByRole('button', { name: '次のお知らせ', exact: true }).click();
    await expect(panel.getByLabel('お知らせの内容')).toContainText('次の内容です');
    await expect(badge).toHaveCount(0);
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
    expect(readRequests).toBe(0);
  });

test('通知の初回既読・新着・再起動と通信回数', async ({ page }) => {
  await fixture(page);
  let asOf = '2026-10-23T00:00:00Z';
  let inboxRequests = 0,
    readRequests = 0;
  const old = {
    id: 'old',
    title: '以前のお知らせ',
    body: '以前の本文',
    createdAt: '2026-10-22T00:00:00Z',
    read: false,
    workId: null,
  };
  const recent = {
    ...old,
    id: 'recent',
    title: '初回利用後のお知らせ',
    body: '新着の本文',
    createdAt: '2026-10-24T00:00:00Z',
  };
  let notices = [old];
  await page.route('**/api/notifications', (route) =>
    route.fulfill({ json: { version: '1', items: notices, nextCursor: null } }),
  );
  await page.route('**/api/notifications/recent', (route) => route.fulfill({ json: recent }));
  await page.route('**/api/notifications/inbox*', (route) => {
    inboxRequests++;
    const since = new URL(route.request().url()).searchParams.get('since');
    return route.fulfill({
      json: {
        version: '1',
        asOf,
        items: since
          ? notices
              .filter((n) => Date.parse(n.createdAt) > Date.parse(since))
              .map(({ id, createdAt }) => ({ id, createdAt }))
          : [],
      },
    });
  });
  await page.route('**/api/notification-reads/*', (route) => {
    readRequests++;
    return route.fulfill({ json: {} });
  });
  await page.goto('/tests/discovery-harness.html?entry=/home');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const modulePath = '/src/features/notifications/local-state.ts';
        return (await (await import(modulePath)).readNoticeState('fixture-alice')).baseline;
      }),
    )
    .toBe(asOf);
  const bell = page.getByRole('button', { name: 'お知らせ', exact: true });
  const badge = page.getByLabel('未読のお知らせがあります');
  await expect(badge).toHaveCount(0);
  await bell.click();
  await expect(page.getByLabel('既読', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'お知らせを閉じる' }).click();
  notices = [recent, old];
  asOf = '2026-10-25T00:00:00Z';
  await bell.click();
  await expect(badge).toBeVisible();
  await expect(page.getByLabel('未読', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: /初回利用後のお知らせ/ }).click();
  await expect(page.getByLabel('お知らせの内容')).toContainText('新着の本文');
  await expect(badge).toHaveCount(0);
  await page.clock.install();
  const count = inboxRequests;
  await page.clock.runFor(180000);
  expect(inboxRequests).toBe(count);
  expect(readRequests).toBe(0);
  await page.goto('/tests/discovery-harness.html?entry=/home');
  await bell.click();
  await expect(page.getByLabel('既読', { exact: true })).toHaveCount(2);
  await expect(badge).toHaveCount(0);
});

test('端末の既読はアカウント別に保存し、別タブとオフラインでも維持する', async ({
  page,
  context,
}) => {
  await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/home');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/features/notifications/local-state.ts';
    const store = await import(modulePath);
    const old = { id: 'old', createdAt: '2026-10-01T00:00:00Z' };
    const a = { id: 'a', createdAt: '2026-10-03T00:00:00Z' };
    const b = { id: 'b', createdAt: '2026-10-03T01:00:00Z' };
    const first = await store.syncNoticeState('local-alice', {
      asOf: '2026-10-02T00:00:00Z',
      items: [old],
    });
    const next = await store.syncNoticeState('local-alice', {
      asOf: '2026-10-04T00:00:00Z',
      items: [old, a, b],
    });
    await store.syncNoticeState('local-alice', { asOf: '2026-10-05T00:00:00Z', items: [] }, null);
    const raced = await store.readNoticeState('local-alice');
    await Promise.all([
      store.markNoticeRead('local-alice', a),
      store.markNoticeRead('local-alice', b),
    ]);
    const bob = await store.syncNoticeState('local-bob', {
      asOf: '2026-10-05T00:00:00Z',
      items: [old, a, b],
    });
    return {
      oldRead: store.noticeIsRead(first, old),
      newUnread: !store.noticeIsRead(next, a) && !store.noticeIsRead(raced, a),
      firstBaseline: first.baseline,
      bobBaseline: bob.baseline,
    };
  });
  expect(result).toEqual({
    oldRead: true,
    newUnread: true,
    firstBaseline: '2026-10-02T00:00:00Z',
    bobBaseline: '2026-10-05T00:00:00Z',
  });
  const other = await context.newPage();
  await fixture(other);
  await other.goto('/tests/discovery-harness.html?entry=/home');
  await context.setOffline(true);
  const baseline = await other.evaluate(async () => {
    const modulePath = '/src/features/notifications/local-state.ts';
    return (await (await import(modulePath)).readNoticeState('local-alice')).baseline;
  });
  expect(baseline).toBe('2026-10-04T00:00:00Z');
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
          '/results?category=community&subcategory=community-02&year=2024&course=tankyu&cursor=old',
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
    await page.getByRole('combobox', { name: 'カテゴリ', exact: true }).selectOption('mind_body');
    await expect(page.getByRole('combobox', { name: 'サブカテゴリ', exact: true })).toHaveValue('');
    await page.screenshot({
      path: testInfo.outputPath(`filter-${width}.png`),
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'この条件で検索' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/category=mind_body/);
    expect(new URL(page.url()).searchParams.has('subcategory')).toBe(false);
    expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
    await page.getByRole('button', { name: '2024年度入学の条件を解除' }).click();
    await expect.poll(() => requests.at(-1)?.searchParams.has('year')).toBe(false);
    for (const sort of ['oldest', 'likes', 'newest']) {
      await page.getByRole('combobox', { name: '並び順' }).selectOption(sort);
      await expect.poll(() => requests.at(-1)?.searchParams.get('sort')).toBe(sort);
    }
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }));
        return page.locator('.results-controls').evaluate((element) => {
          const top = parseFloat(getComputedStyle(element).top);
          return Math.abs(element.getBoundingClientRect().top - top);
        });
      })
      .toBeLessThan(2);
    const sticky = await page.locator('.results-controls').boundingBox();
    const header = await page.locator('.site-header').boundingBox();
    expect(sticky!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 2);
    await page.screenshot({ path: testInfo.outputPath(`results-sticky-${width}.png`) });
    await trigger.click();
    await page.getByRole('button', { name: '条件をクリア', exact: true }).click();
    await expect(page.getByRole('button', { name: 'この条件で検索' })).toBeDisabled();
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'フィルターを閉じる' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByLabel('適用中の検索条件')).toBeVisible();
    await expect(page.getByRole('combobox', { name: '並び順' })).toHaveValue('newest');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
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
          items: [{ ...first, category2: 'mind_body', subCategory2: 'mind_body-04' }],
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
        encodeURIComponent('/results?category=community&subcategory=community-02'),
    );
    await expect(page.locator('.result-category-title')).toContainText('地域');
    await expect(page.locator('.result-category-title img')).toHaveAttribute(
      'src',
      '/images/categories/society.svg',
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
    expect(new URL(page.url()).searchParams.get('category')).toBe('community');
    await expect(search).toHaveValue('SNS');
    await expect(page.getByText('検索結果', { exact: true })).toHaveCount(0);
    if (width >= 900)
      await expect(page.getByRole('link', { name: '探究アーカイブのトップ' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`result-header-${width}.png`) });
    await page.getByRole('link', { name: '架空の水の探究の詳細' }).click();
    await expect(page.locator('main h1')).toHaveText(title);
    if (width < 900)
      await expect(page.locator('.work-toolbar-title')).toHaveAttribute('aria-hidden', 'true');
    else await expect(page.locator('.work-toolbar-title')).toHaveCount(0);
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
  // Native Tab navigation may focus the browser chrome, but never background controls.
  expect(
    await modal.evaluate(
      (el) => document.activeElement === document.body || el.contains(document.activeElement),
    ),
  ).toBe(true);
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const box = await modal.boundingBox();
      return Math.max(
        Math.abs(box!.x + box!.width / 2 - viewport.width / 2),
        Math.abs(box!.y + box!.height / 2 - viewport.height / 2),
      );
    })
    .toBeLessThan(2);
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
    .filter({ has: page.getByRole('link', { name: `${first.title}の詳細`, exact: true }) });
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
      suggestions.getByRole('link', { name: 'カテゴリ「環境・資源」で探す', exact: true }),
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
      .getByRole('link', { name: 'カテゴリ「環境・資源」で「プラスチック」を検索', exact: true })
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
    await expect(page.locator('article')).toHaveCount(40);
  });

test('KRGPは条件変更・追加表示・詳細からの復帰で作品を再取得しない', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/tests/discovery-harness.html?entry=/awards');
  await expect(page.locator('article')).toHaveCount(40);
  await page.getByRole('button', { name: 'さらに表示', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(55);
  await page.getByRole('button', { name: 'KRGP 2024 22', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(22);
  await page.getByLabel('並び順', { exact: true }).selectOption('oldest');
  await page.getByRole('button', { name: 'KRGP 2025 33', exact: true }).click();
  await expect(page.getByRole('button', { name: 'KRGP 2025 33', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('article')).toHaveCount(33);
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

for (const width of [390, 1440]) {
  test(`読み込み表示: ${width}pxでスケルトンから作品へ切り替わり、追加取得にインジケーターを表示`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fixture(page);
    let release!: () => void;
    let blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/works?**', async (route) => {
      await blocked;
      await route.fallback();
    });
    await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水'));
    const skeleton = page.getByRole('status', { name: '作品一覧を読み込み中', exact: true });
    await expect(skeleton).toBeVisible();
    await expect(page.getByText('作品を探しています…', { exact: true })).toHaveCount(0);
    expect(await skeleton.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const cover = skeleton.locator('[aria-hidden="true"] > div > div').first();
    expect(await cover.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    expect(await cover.evaluate((element) => getComputedStyle(element).animationName)).not.toBe(
      'none',
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.screenshot({ path: test.info().outputPath('loading-skeleton.png') });
    release();
    await expect(skeleton).toHaveCount(0);
    await expect(page.locator('article')).toHaveCount(1);
    blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.getByRole('button', { name: 'さらに表示', exact: true }).click();
    await expect(
      page.getByRole('status', { name: '追加の作品を読み込み中', exact: true }),
    ).toBeVisible();
    await expect(page.locator('article')).toHaveCount(1);
    release();
    await expect(page.locator('article')).toHaveCount(2);
    await expect(
      page.getByRole('status', { name: '追加の作品を読み込み中', exact: true }),
    ).toHaveCount(0);
  });
}

for (const width of [320, 390, 820, 1440]) {
  test(`新しい作品一覧はタイトル1回・2カテゴリの斜め分割・行の余白から開ける: ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    const dual = {
      ...first,
      category2: 'mind_body',
      subCategory2: 'mind_body-04',
      isFavorite: false,
      favoriteRevision: 0,
      favoriteCount: 7,
    };
    await page.route('**/api/works?**', (route) =>
      route.fulfill({ json: { version: '1', items: [dual], nextCursor: null } }),
    );
    let puts = 0;
    await page.route('**/api/favorites/24000010', async (route) => {
      puts++;
      await route.fulfill({ json: { version: '1', favorite: true, revision: 1, count: 8 } });
    });
    const entry = '/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水');
    await page.goto(entry);
    const card = page.locator('article').first();
    await expect(card.getByText(first.title, { exact: true })).toHaveCount(1);
    await expect(card.locator('.category-art-pair img')).toHaveCount(2);
    await expect(card.locator('.category-art-pair img').nth(0)).toHaveAttribute(
      'src',
      '/images/subcategories/community-02.svg',
    );
    await expect(card.locator('.category-art-pair img').nth(1)).toHaveAttribute(
      'src',
      '/images/subcategories/mind_body-04.svg',
    );
    const pair = card.locator('.category-art-pair');
    expect(
      await pair.evaluate((element) => getComputedStyle(element, '::after').backgroundImage),
    ).toContain('linear-gradient');
    const category = card.getByText('防災・減災 ／ 睡眠', { exact: true });
    await expect(category).toBeVisible();
    await expect(card.getByText('2024年度入学・探究科・架空班', { exact: true })).toBeVisible();
    await expect(card.getByText('ポスター', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const favorite = card.getByRole('button', { name: 'お気に入りに追加', exact: true });
    await favorite.click();
    await expect(page).toHaveURL(/results\?q=/);
    await expect(
      card.getByRole('button', { name: 'お気に入りから外す', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(puts).toBe(1);
    await page.screenshot({ path: testInfo.outputPath(`work-cards-${width}.png`), fullPage: true });
    // Top-right padding contains no text or action button, but belongs to the work link.
    const box = (await card.boundingBox())!;
    await card.click({ position: { x: box.width - 12, y: 12 } });
    await expect(page).toHaveURL(/works\/24000010\?from=/);
    const from = new URL(new URL(page.url()).searchParams.get('from')!, page.url());
    expect(from.pathname).toBe('/results');
    expect(from.searchParams.get('q')).toBe('水');
  });
}

test('サブカテゴリの名前は所属カテゴリごとに解決し、2分類を残す', async () => {
  const { workCategoryLabels } = await import('../src/features/discovery/search');
  expect(
    workCategoryLabels({
      category1: 'community',
      subCategory1: 'community-02',
      category2: 'community',
      subCategory2: 'community-01',
    }),
  ).toEqual(['防災・減災', '交通・移動']);
  expect(
    workCategoryLabels({
      category1: 'community',
      subCategory1: 'community-01',
      category2: 'none',
      subCategory2: 'none',
    }),
  ).toEqual(['交通・移動']);
});

test.describe('スマホで作品行全体をタップ', () => {
  test.use({ hasTouch: true });
  test('画像・余白をタップして開き、ハートでは移動しない', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fixture(page);
    await page.route('**/api/works?**', (route) =>
      route.fulfill({
        json: {
          version: '1',
          items: [{ ...first, isFavorite: false, favoriteRevision: 0, favoriteCount: 1 }],
          nextCursor: null,
        },
      }),
    );
    await page.route('**/api/favorites/24000010', (route) =>
      route.fulfill({ json: { version: '1', favorite: true, revision: 1, count: 2 } }),
    );
    const entry = '/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水');
    await page.goto(entry);
    let card = page.locator('article').first();
    await card.getByRole('button', { name: 'お気に入りに追加', exact: true }).tap();
    await expect(page).toHaveURL(/results\?q=/);
    const box = (await card.boundingBox())!;
    await card.tap({ position: { x: box.width - 3, y: 3 } });
    await expect(page).toHaveURL(/works\/24000010/);
    await page.goto(entry);
    card = page.locator('article').first();
    const thumbnail = (await card.locator('img').first().boundingBox())!;
    await page.touchscreen.tap(
      thumbnail.x + thumbnail.width / 2,
      thumbnail.y + thumbnail.height / 2,
    );
    await expect(page).toHaveURL(/works\/24000010/);
  });
});

for (const width of [320, 390, 1440]) {
  test(`作品の分類・タイトル・学科を含む情報をコンパクトに表示: ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    const title = '地域の交通と防災について調査し持続可能な社会を考える長い研究タイトル';
    await page.route('**/api/works?**', (route) =>
      route.fulfill({
        json: {
          version: '1',
          nextCursor: null,
          items: [
            {
              ...first,
              title,
              course: 'general',
              category2: 'mind_body',
              subCategory2: 'mind_body-04',
              isFavorite: false,
              awardType: 1,
            },
          ],
        },
      }),
    );
    await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水'));
    const card = page.locator('article').first();
    await expect(card.getByText('防災・減災 ／ 睡眠', { exact: true })).toBeVisible();
    await expect(card.getByText('2024年度入学・普通科・架空班', { exact: true })).toBeVisible();
    await expect(card.getByText('KRGP受賞', { exact: false })).toBeVisible();
    await expect(card.getByText('ポスター', { exact: true })).toHaveCount(0);
    if (width < 768) {
      const heading = card.locator('h3');
      expect(
        await heading.evaluate((el) => ({
          overflow: getComputedStyle(el).textOverflow,
          nowrap: getComputedStyle(el).whiteSpace,
          lines: getComputedStyle(el).webkitLineClamp,
        })),
      ).toEqual({ overflow: 'ellipsis', nowrap: 'normal', lines: '2' });
      expect(
        await card
          .getByText('防災・減災 ／ 睡眠', { exact: true })
          .evaluate((el) => getComputedStyle(el).whiteSpace),
      ).toBe('nowrap');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`compact-details-${width}.png`),
      fullPage: true,
    });
  });
}

for (const entry of ['/search', '/results', '/results?sort=newest&q=%20%20']) {
  test(`条件なしの検索を送信しない: ${entry}`, async ({ page }) => {
    const calls = await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent(entry));
    if (entry === '/search') {
      const search = page.getByRole('searchbox', { name: '作品をキーワードで検索' });
      const submit = page.getByRole('button', { name: '検索する', exact: true });
      await expect(submit).toBeDisabled();
      await search.fill('   ');
      await search.press('Enter');
      await expect(submit).toBeDisabled();
      await expect(page).toHaveURL(/\/search$/);
      await search.fill('水');
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(page).toHaveURL(/q=/);
    } else {
      await expect(page.getByText('キーワードか条件を選んで検索してください。')).toBeVisible();
      expect(calls.some((c) => c.path.startsWith('/api/works?'))).toBe(false);
      await page.locator('.filter-trigger').click();
      await expect(page.getByRole('button', { name: 'この条件で検索' })).toBeDisabled();
      await page.getByRole('combobox', { name: '学科', exact: true }).selectOption('general');
      await expect(page.getByRole('button', { name: 'この条件で検索' })).toBeEnabled();
    }
  });
}
for (const width of [820, 1194]) {
  test(`iPadの安全な上端をヘッダーと固定操作に適用: ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 820 ? 1180 : 834 });
    await fixture(page);
    await page.goto('/tests/discovery-harness.html?entry=/results?category=community');
    await page.addStyleTag({
      content: ':root { --app-safe-top: 24px; --app-safe-left: 12px; --app-safe-right: 12px; }',
    });
    const header = page.locator('.site-header');
    await expect.poll(async () => (await header.boundingBox())!.y).toBe(24);
    await page.evaluate(() => window.scrollTo(0, 500));
    const h = (await header.boundingBox())!;
    expect(h.y).toBe(24);
    expect((await page.locator('.results-controls').boundingBox())!.y).toBeGreaterThanOrEqual(
      h.y + h.height - 1,
    );
    await page.locator('.filter-trigger').click();
    const dialog = (await page
      .getByRole('dialog', { name: 'フィルター', exact: true })
      .boundingBox())!;
    expect(dialog.y).toBeGreaterThanOrEqual(24);
    expect(dialog.y + dialog.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.getByRole('button', { name: 'フィルターを閉じる' }).click();
    const strip = await page.locator('.app-shell').evaluate((el) => ({
      height: getComputedStyle(el, '::before').height,
      position: getComputedStyle(el, '::before').position,
    }));
    expect(strip).toEqual({ height: '24px', position: 'fixed' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const width of [390, 1440]) {
  test(`${width}px: 受賞作品一覧の戻るはホーム、個別作品の戻るは受賞一覧へ戻す`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto(
      '/tests/discovery-harness.html?entry=' + encodeURIComponent('/awards?year=2024'),
    );
    const back = page.getByRole('link', { name: 'ホームに戻る', exact: true });
    await expect(back).toHaveAttribute('href', '/home');
    await page.getByRole('link', { name: '架空の水の探究の詳細', exact: true }).click();
    const list = page.getByRole('link', { name: '一覧へ戻る', exact: true });
    await expect(list).toHaveAttribute('href', '/awards?year=2024');
    await list.click();
    await expect(page).toHaveURL(/\/awards\?year=2024$/);
    await page.getByRole('link', { name: 'ホームに戻る', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
  });
}

test('サブカテゴリアートは作品で使い、同じ親の2分類も区別する', async ({ page }) => {
  await fixture(page);
  const works = [
    {
      ...first,
      category1: 'nature',
      subCategory1: 'nature-02',
      category2: 'nature',
      subCategory2: 'nature-03',
    },
    { ...second, category1: 'technology', subCategory1: 'unknown-subcategory' },
    { ...first, documentID: '24000030', category1: 'technology', subCategory1: 'nature-02' },
  ];
  await page.route('**/api/works?**', (route) =>
    route.fulfill({ json: { version: '1', items: works, nextCursor: null } }),
  );
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水'));
  const images = page.locator('article').first().locator('.category-art-pair img');
  await expect(images).toHaveCount(2);
  await expect(images.nth(0)).toHaveAttribute('src', '/images/subcategories/nature-02.svg');
  await expect(images.nth(1)).toHaveAttribute('src', '/images/subcategories/nature-03.svg');
  await expect(page.locator('article').nth(1).locator('img')).toHaveAttribute(
    'src',
    '/images/categories/technology.svg',
  );
  await expect(page.locator('article').nth(2).locator('img')).toHaveAttribute(
    'src',
    '/images/categories/technology.svg',
  );
  for (const img of await images.all()) {
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
      .toBe(400);
  }
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/explore/nature'));
  await expect(page.locator('img[src^="/images/subcategories/"]')).toHaveCount(0);
});

test('全107個のSVGをデコードでき、全カテゴリの作品に対応する', async ({ page }) => {
  test.setTimeout(60_000);
  const { CATEGORY_CATALOG } = await import('../src/contracts/catalog.generated');
  await fixture(page);
  const icons = CATEGORY_CATALOG.flatMap((category) =>
    category.subcategories.map((sub) => ({ category: category.id, subcategory: sub.id })),
  );
  expect(icons).toHaveLength(107);
  const works = icons.map((icon, index) => ({
    ...first,
    documentID: String(24001000 + index * 10),
    category1: icon.category,
    subCategory1: icon.subcategory,
  }));
  await page.route('**/api/works?**', (route) =>
    route.fulfill({ json: { version: '1', items: works, nextCursor: null } }),
  );
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水'));
  await expect(page.locator('article')).toHaveCount(107);
  const sources = await page
    .locator('article picture img')
    .evaluateAll((images) => images.map((img) => img.getAttribute('src')));
  expect(sources).toEqual(
    icons.map(
      (icon) =>
        `/images/subcategories/${icon.category === 'food_life' ? 'light/' : ''}${icon.subcategory}.svg`,
    ),
  );
  const decoded = await page.evaluate(
    async (paths) =>
      Promise.all(
        paths.map(async (src) => {
          const img = new Image();
          img.src = src!;
          await img.decode();
          return { width: img.naturalWidth, height: img.naturalHeight };
        }),
      ),
    sources,
  );
  expect(decoded.every((img) => img.width === 400 && img.height === 400)).toBe(true);
  for (const category of CATEGORY_CATALOG) {
    await page.goto(
      '/tests/discovery-harness.html?entry=' + encodeURIComponent(`/explore/${category.id}`),
    );
    await expect(page.getByRole('heading', { name: category.label, exact: true })).toBeVisible();
    await expect(page.locator('img[src^="/images/subcategories/"]')).toHaveCount(0);
  }
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 1280]) {
    test(`カテゴリの直立・背景色・明暗のコントラスト: ${theme} ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem('archive-theme', value), theme);
      await fixture(page);
      await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/explore'));
      await expect(page.locator('.genre-card')).toHaveCount(14);
      for (const picture of await page.locator('.genre-card picture').all()) {
        await expect(picture).toHaveCSS('transform', 'none');
      }
      for (const [category, color] of [
        ['sports', '#d80000'],
        ['entertainment', '#7b00d8'],
      ]) {
        expect(
          await page
            .locator(`.genre-card[data-category="${category}"]`)
            .evaluate((el) => getComputedStyle(el).getPropertyValue('--genre-color').trim()),
        ).toBe(color);
      }
      await expect(page.locator('.genre-card[data-category="society"] img')).toHaveAttribute(
        'src',
        `/images/categories/${theme === 'dark' ? 'rights_for_dark' : 'rights'}.svg`,
      );
      await expect(page.locator('.genre-card[data-category="food_life"] img')).toHaveAttribute(
        'src',
        `/images/categories/${theme === 'light' ? 'life_for_light' : 'life'}.svg`,
      );
      await page.screenshot({
        path: testInfo.outputPath(`explore-${theme}-${width}.png`),
        fullPage: true,
      });
      const categories = ['society', 'food_life', 'sports', 'entertainment'];
      const subs = ['society-01', 'food_life-01', 'sports-01', 'entertainment-games'];
      await page.route('**/api/works?**', (route) =>
        route.fulfill({
          json: {
            version: '1',
            nextCursor: null,
            items: categories.map((category, i) => ({
              ...first,
              documentID: String(24001000 + i * 10),
              category1: category,
              subCategory1: subs[i],
            })),
          },
        }),
      );
      await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水'));
      await expect(page.locator('article')).toHaveCount(4);
      await expect(page.locator('article').nth(0).locator('img')).toHaveAttribute(
        'src',
        `/images/subcategories/${theme === 'dark' ? 'dark/' : ''}society-01.svg`,
      );
      await expect(page.locator('article').nth(1).locator('img')).toHaveAttribute(
        'src',
        `/images/subcategories/${theme === 'light' ? 'light/' : ''}food_life-01.svg`,
      );
      for (const [index, color] of [
        [0, theme === 'dark' ? '#c58cdd' : '#492256'],
        [1, theme === 'light' ? '#807d00' : '#d4d800'],
      ] as const) {
        const ratio = await page
          .locator('article')
          .nth(index)
          .locator('[data-category]')
          .evaluate((el, foreground) => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            const ctx = canvas.getContext('2d')!;
            const luminance = (value: string) => {
              ctx.fillStyle = value;
              ctx.fillRect(0, 0, 1, 1);
              const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
                const s = v / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              });
              return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
            };
            const a = luminance(foreground),
              b = luminance(getComputedStyle(el).backgroundColor);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          }, color);
        expect(ratio).toBeGreaterThanOrEqual(3);
      }
      const covers = await page
        .locator('article [data-category]')
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
      expect(covers[2]).not.toBe(covers[3]);
      await page.screenshot({
        path: testInfo.outputPath(`cards-${theme}-${width}.png`),
        fullPage: true,
      });
    });
  }
}

for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 1280]) {
    test(`2分類の背景もアイコンと同じ斜め線で分割する: ${theme} ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem('archive-theme', value), theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await fixture(page);
      const groups = [
        {
          category1: 'nature',
          subCategory1: 'nature-03',
          category2: 'technology',
          subCategory2: 'technology-04',
        },
        {
          category1: 'technology',
          subCategory1: 'technology-04',
          category2: 'nature',
          subCategory2: 'nature-03',
        },
        {
          category1: 'society',
          subCategory1: 'society-01',
          category2: 'food_life',
          subCategory2: 'food_life-01',
        },
        {
          category1: 'food_life',
          subCategory1: 'food_life-01',
          category2: 'society',
          subCategory2: 'society-01',
        },
        {
          category1: 'nature',
          subCategory1: 'nature-02',
          category2: 'nature',
          subCategory2: 'nature-03',
        },
        { category1: 'nature', subCategory1: 'nature-03', category2: 'none', subCategory2: 'none' },
      ];
      await page.route('**/api/works?**', (route) =>
        route.fulfill({
          json: {
            version: '1',
            nextCursor: null,
            items: groups.map((group, i) => ({
              ...first,
              ...group,
              documentID: String(24001000 + i * 10),
              title: [
                '水質センサーをつくる',
                'センサーで水質を調べる',
                '食生活を社会から考える',
                '食とくらしの社会調査',
                '物理と化学の探究',
                '化学の探究',
              ][i],
            })),
          },
        }),
      );
      await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水'));
      const rows = page.locator('article');
      await expect(rows).toHaveCount(6);
      const backgrounds = await rows.evaluateAll((articles) =>
        articles.map((article) => {
          const cover = article.querySelector('[data-category]')!;
          const secondary = article.querySelector('[data-category-background]');
          return {
            primary: getComputedStyle(cover).backgroundColor,
            secondary: secondary ? getComputedStyle(secondary).backgroundColor : null,
          };
        }),
      );
      expect(backgrounds[0]!.primary).toBe(backgrounds[1]!.secondary);
      expect(backgrounds[1]!.primary).toBe(backgrounds[0]!.secondary);
      expect(backgrounds[2]!.primary).toBe(backgrounds[3]!.secondary);
      expect(backgrounds[3]!.primary).toBe(backgrounds[2]!.secondary);
      expect(backgrounds[0]!.primary).not.toBe(backgrounds[0]!.secondary);
      await expect(rows.nth(4).locator('[data-category-background]')).toHaveCount(0);
      await expect(rows.nth(4).locator('.category-art-pair')).toHaveCount(1);
      await expect(rows.nth(5).locator('[data-category-background]')).toHaveCount(0);
      await expect(rows.nth(5).locator('.category-art-pair')).toHaveCount(0);
      await expect(rows.first().locator('[data-category-background]')).toHaveCSS(
        'mask-image',
        /linear-gradient\(135deg/,
      );
      const clip = rows.first().locator('.category-art-first');
      await expect(clip).toHaveCSS('clip-path', 'polygon(0px 0px, 100% 0px, 0px 100%)');
      const geometry = await rows
        .first()
        .locator('.category-art-pair')
        .evaluate((el) => {
          const box = el.getBoundingClientRect(),
            image = el.querySelector('img')!.getBoundingClientRect();
          return { ratio: image.width / box.width, square: box.width === box.height };
        });
      expect(geometry.square).toBe(true);
      expect(geometry.ratio).toBeCloseTo(0.84, 2);
      await page.screenshot({
        path: testInfo.outputPath(`split-${theme}-${width}.png`),
        fullPage: true,
      });
    });
  }
}

test('全14カテゴリは主分類と副分類で同じ背景色を使う', async ({ page }) => {
  const { CATEGORY_CATALOG } = await import('../src/contracts/catalog.generated');
  await fixture(page);
  const groups = CATEGORY_CATALOG.map((category, i) => {
    const secondary = CATEGORY_CATALOG[(i + 1) % CATEGORY_CATALOG.length]!;
    return {
      ...first,
      documentID: String(24001000 + i * 10),
      category1: category.id,
      subCategory1: category.subcategories[0].id,
      category2: secondary.id,
      subCategory2: secondary.subcategories[0].id,
    };
  });
  await page.route('**/api/works?**', (route) =>
    route.fulfill({ json: { version: '1', nextCursor: null, items: groups } }),
  );
  for (const theme of ['light', 'dark']) {
    await page.addInitScript((value) => localStorage.setItem('archive-theme', value), theme);
    await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/results?q=水'));
    await expect(page.locator('article')).toHaveCount(14);
    const backgrounds = await page.locator('article').evaluateAll((articles) =>
      articles.map((article) => ({
        primary: getComputedStyle(article.querySelector('[data-category]')!).backgroundColor,
        secondary: getComputedStyle(article.querySelector('[data-category-background]')!)
          .backgroundColor,
      })),
    );
    for (let i = 0; i < 14; i++)
      expect(backgrounds[i]!.secondary).toBe(backgrounds[(i + 1) % 14]!.primary);
    // These categories must use their own green family rather than the default brown.
    const economy = CATEGORY_CATALOG.findIndex((c) => c.id === 'economy');
    const agriculture = CATEGORY_CATALOG.findIndex((c) => c.id === 'agriculture');
    expect(backgrounds[economy]!.primary).toBe(
      theme === 'light' ? 'rgb(220, 239, 231)' : 'rgb(32, 55, 46)',
    );
    expect(backgrounds[agriculture]!.primary).toBe(
      theme === 'light' ? 'rgb(237, 240, 216)' : 'rgb(50, 55, 35)',
    );
  }
});
