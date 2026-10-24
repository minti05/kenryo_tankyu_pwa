import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { summaryFixturePdf } from './ai-summary-fixture.mjs';

const body =
  '雨の後も使いやすいベンチを目指した。200mLの水をかけ、10分後の残水量を測定した。\n2度の傾斜で残水量が最少となった。';
const phrase = '200mLの水をかけ、10分後の残水量を測定';
for (const [name, width, height] of [
  ['スマホ', 390, 844],
  ['タブレット', 820, 1180],
  ['PC', 1440, 1000],
] as const) {
  test(`${name}: 初期PDF・要約・部分下線から別資料の実ページへ・取得再利用`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const bytes = summaryFixturePdf(),
      revision = 'a'.repeat(64),
      sha = createHash('sha256').update(bytes).digest('hex'),
      calls: string[] = [];
    await page.route('**/api/**', async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      calls.push(req.method() + ' ' + path);
      if (path === '/api/works/24000010')
        return route.fulfill({
          json: {
            version: '1',
            authorizedAt: new Date().toISOString(),
            work: {
              contractVersion: '1',
              documentID: '24000010',
              title: '雨の後も使えるベンチ',
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
              revision: 'fixture',
            },
            documents: ['poster', 'report'].map((kind) => ({
              kind,
              state: 'available',
              bytes: bytes.length,
              revision,
              sha256: sha,
            })),
            summary: {
              body,
              evidence: [
                {
                  targets: [
                    { start: body.indexOf(phrase), end: body.indexOf(phrase) + phrase.length },
                  ],
                  kind: 'report',
                  page: 2,
                },
              ],
            },
          },
        });
      if (path.endsWith('/state'))
        return route.fulfill({ json: { version: '1', favorite: false, revision: 0, count: 0 } });
      if (path === '/api/history') return route.fulfill({ json: { version: '1', ok: true } });
      if (path.includes('/pdf/'))
        return route.fulfill({
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': String(bytes.length),
            'X-Document-Revision': revision,
            'X-Content-SHA256': sha,
            'X-Authorized-At': new Date().toISOString(),
          },
          body: req.method() === 'HEAD' ? undefined : bytes,
        });
      return route.fulfill({ json: { version: '1', items: [] } });
    });
    await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent('/works/24000010'));
    const pdf = page.getByRole('region', { name: 'PDFビューア', exact: true });
    await expect
      .poll(
        () =>
          pdf
            .locator('img')
            .evaluateAll((images) =>
              images.some((img) => (img as HTMLImageElement).naturalWidth > 0),
            ),
        { timeout: 30000 },
      )
      .toBe(true);
    await expect(page.getByRole('button', { name: 'ポスター', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    if (width < 900) {
      const chip = page.getByRole('button', { name: 'AI要約', exact: true });
      await expect(chip).toHaveAttribute('aria-pressed', 'false');
      expect(
        await page
          .getByRole('group', { name: '資料の種類' })
          .getByRole('button')
          .first()
          .textContent(),
      ).toBe('AI要約');
      await chip.click();
      await expect(pdf).toBeHidden();
    } else await expect(page.getByRole('button', { name: 'AI要約', exact: true })).toHaveCount(0);
    const summary = page.getByRole('region', { name: 'AI要約', exact: true });
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('button', { name: phrase, exact: true })).toHaveCount(0);
    await summary.getByRole('button', { name: '根拠を確認', exact: true }).click();
    await expect(summary.getByRole('button', { name: phrase, exact: true })).toBeVisible();
    await page.screenshot({ path: `/private/tmp/ai-summary-${width}.png`, fullPage: true });
    await summary.getByRole('button', { name: phrase, exact: true }).click();
    await expect(page.getByRole('button', { name: 'レポート', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(pdf).toBeVisible();
    // This value is updated from the EmbedPDF scroll capability/page-change event, not the requested page.
    await expect(pdf).toHaveAttribute('data-pdf-page', '2', { timeout: 30000 });
    if (width < 900) {
      await page.getByRole('button', { name: 'AI要約', exact: true }).click();
      await summary.getByRole('button', { name: '根拠を確認', exact: true }).click();
    }
    await summary.getByRole('button', { name: phrase, exact: true }).click();
    await expect(pdf).toHaveAttribute('data-pdf-page', '2');
    expect(calls.filter((c) => c === 'GET /api/works/24000010')).toHaveLength(1);
    expect(calls.filter((c) => c === 'GET /api/works/24000010/pdf/report')).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
