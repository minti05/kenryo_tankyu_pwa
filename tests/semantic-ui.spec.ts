import { test, expect } from '@playwright/test';
const work = {
  contractVersion: '1',
  documentID: '24000010',
  title: '雨の日の地域防災を考える',
  author: '架空班',
  enterYear: 2024,
  course: 'tankyu',
  eventName: 'individualTankyu',
  category1: 'society',
  subCategory1: 'disasterPrevention',
  category2: 'health',
  subCategory2: 'sleep',
  existsPoster: false,
  existsSlide: false,
  existsReport: false,
  existsThesis: false,
  revision: 'fixture-r1',
};
for (const width of [320, 390, 820, 1440]) {
  test(`自然言語検索と関連作品・導線・入力操作: ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const calls: string[] = [];
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      calls.push(path);
      if (path === '/api/works/24000010')
        return route.fulfill({
          json: {
            version: '1',
            authorizedAt: new Date().toISOString(),
            work,
            documents: [],
          },
        });
      if (path === '/api/semantic-search')
        return route.fulfill({
          json: {
            items: [
              {
                work: {
                  ...work,
                  documentID: '24000080',
                  title: '文章で見つけた探究',
                },
                similarity: 0.75,
              },
            ],
          },
        });
      if (path.endsWith('/similar')) {
        const exclude = new URL(route.request().url()).searchParams.get('exclude') ?? '';
        const ids = exclude ? '24000050,24000060,24000070' : '24000020,24000030,24000040';
        return route.fulfill({
          json: {
            items: ids.split(',').map((documentID, i) => ({
              work: { ...work, documentID, title: '関連候補 ' + documentID },
              similarity: 0.8 - i * 0.04,
            })),
          },
        });
      }
      if (path.endsWith('/state'))
        return route.fulfill({
          json: { version: '1', favorite: false, revision: 0, count: 0 },
        });
      return route.fulfill({
        json: { version: '1', items: [], nextCursor: null },
      });
    });
    await page.goto('/tests/discovery-harness.html?entry=/explore');
    const entry = page.getByRole('link', { name: /AIで探す/ });
    expect((await entry.boundingBox())!.y).toBeLessThan(
      (await page.getByLabel('カテゴリ', { exact: true }).boundingBox())!.y,
    );
    await entry.click();
    await expect(page).toHaveURL(/\/search\/chat$/);
    await expect(page.getByRole('heading', { name: 'AIで探す', exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'メインナビゲーション' })
        .getByRole('link', { name: '探索', exact: true }),
    ).toHaveClass(/active/);
    const input = page.getByRole('textbox', {
      name: '探したいこと',
      exact: true,
    });
    await expect(page.getByRole('button', { name: 'AIで検索する', exact: true })).toBeDisabled();
    await page
      .getByRole('button', {
        name: '睡眠と集中力の関係が気になる',
        exact: true,
      })
      .click();
    await expect(input).toHaveValue('睡眠と集中力の関係が気になる');
    await input.dispatchEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      keyCode: 229,
    });
    await expect(page.getByRole('log')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`natural-search-${width}.png`),
      fullPage: true,
    });
    await input.fill('睡眠と集中力について知りたい');
    await page.getByRole('button', { name: 'AIで検索する', exact: true }).click();
    await expect(page.getByRole('log')).toContainText('睡眠と集中力について知りたい');
    await expect(page.getByRole('log')).toContainText('文章で見つけた探究');
    await expect(page.locator('article')).toHaveCount(1);
    const fallback = page.getByRole('link', {
      name: 'キーワード検索で探す',
      exact: true,
    });
    expect(new URL((await fallback.getAttribute('href'))!, page.url()).searchParams.get('q')).toBe(
      '睡眠と集中力について知りたい',
    );
    await input.fill('もう少し身近な例も知りたい');
    await input.press('Enter');
    await expect(page.getByRole('log')).toContainText('もう少し身近な例も知りたい');
    await page.screenshot({
      path: testInfo.outputPath(`natural-conversation-${width}.png`),
      fullPage: true,
    });
    expect(calls.filter((path) => path === '/api/semantic-search')).toHaveLength(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'やり取りをクリア', exact: true }).click();
    await expect(page.getByRole('log')).toHaveCount(0);
    await expect(input).toHaveValue('');
    await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/works/24000010'));
    await expect(page.getByRole('button', { name: '似た探究作品を見る', exact: true })).toHaveCount(
      0,
    );
    if (width < 900) {
      await page
        .getByRole('button', { name: '作品の詳細を見る', exact: true })
        .filter({ visible: true })
        .click();
      await page.getByRole('tab', { name: '関連', exact: true }).click();
    }
    const related =
      width < 900
        ? page.getByRole('region', { name: '作品の補足', exact: true })
        : page.getByRole('complementary', {
            name: '要約と関連作品',
            exact: true,
          });
    await expect(related.getByText('関連候補 24000020')).toBeVisible();
    await related.getByRole('button', { name: 'ほかの候補を見る' }).click();
    await expect(related.getByText('関連候補 24000050')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`similar-works-${width}.png`),
      fullPage: true,
    });
    if (width < 900) await page.getByRole('button', { name: 'シートを閉じる' }).click();
    if (width < 900) {
      await page.goto('/tests/discovery-harness.html?entry=/home');
      await page.getByRole('link', { name: '検索画面を開く', exact: true }).click();
    } else await page.goto('/tests/discovery-harness.html?entry=/search');
    const keyword = '睡眠と集中力について知りたい';
    const keywordInput = page.getByPlaceholder('キーワードで検索', { exact: true });
    if (width < 900) {
      await expect(page.locator('.site-header').getByPlaceholder('キーワードで検索')).toBeVisible();
      await expect(keywordInput).toBeFocused();
      const header = await page.locator('.site-header').boundingBox();
      const inputBox = await keywordInput.boundingBox();
      expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(header!.y + header!.height);
    }
    const categoryEntry = await page
      .getByRole('link', { name: 'カテゴリから調べる', exact: true })
      .boundingBox();
    const aiBox = await page.getByRole('link', { name: 'AIで探す', exact: true }).boundingBox();
    expect(aiBox!.y - categoryEntry!.y - categoryEntry!.height).toBeLessThan(2);
    if (width < 900)
      expect(
        (await page.getByRole('heading', { name: '最近の検索' }).boundingBox())!.y,
      ).toBeLessThan(260);
    await page.screenshot({
      path: testInfo.outputPath(`search-header-${width}.png`),
      fullPage: true,
    });
    await keywordInput.fill(keyword);
    const aiEntry = page.getByRole('link', { name: 'AIで探す', exact: true });
    expect(new URL((await aiEntry.getAttribute('href'))!, page.url()).searchParams.get('q')).toBe(
      keyword,
    );
    await keywordInput.press('Enter');
    await expect(page).toHaveURL(/\/results\?q=/);
    await page.getByRole('link', { name: 'AIで探す', exact: true }).click();
    await expect(page).toHaveURL(/\/search\/chat\?q=/);
    await expect(page.getByRole('textbox', { name: '探したいこと', exact: true })).toHaveValue(
      keyword,
    );
    const submitAi = page.getByRole('button', { name: 'AIで検索する', exact: true });
    await expect(submitAi).toBeEnabled();
    expect(calls.filter((path) => path === '/api/semantic-search')).toHaveLength(2);
    await submitAi.click();
    await expect(page.getByRole('log')).toContainText(keyword);
    await expect(page.getByRole('log')).toContainText('文章で見つけた探究');
  });
}
