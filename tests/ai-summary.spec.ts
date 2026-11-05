import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { summaryFixturePdf } from './ai-summary-fixture.mjs';

const body =
  '雨の後も使いやすいベンチを目指した。200mLの水をかけ、10分後の残水量を測定した。\n2度の傾斜で残水量が最少となった。';
const phrase = '200mLの水をかけ、10分後の残水量を測定';
for (const [name, width, height] of [
  ['スマホ', 390, 844],
  ['タブレット', 820, 1180],
  ['横向きスマホ', 844, 390],
  ['中間', 1100, 820],
  ['PC', 1440, 1000],
] as const) {
  test(`${name}: 初期PDF・要約・部分下線から別資料の実ページへ・取得再利用`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const safeTop = width === 820 ? 24 : 0;
    if (safeTop)
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.setProperty('--app-safe-top', '24px');
        });
      });
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
              keywords: ['ベンチ', '排水', '傾斜'],
              evidence: [
                {
                  targets: [
                    {
                      start: body.indexOf(phrase),
                      end: body.indexOf(phrase) + phrase.length,
                    },
                  ],
                  kind: 'report',
                  page: 2,
                },
              ],
            },
          },
        });
      if (path.endsWith('/similar'))
        return route.fulfill({
          json: {
            items: [20, 30, 40].map((n) => ({
              similarity: 0.8,
              work: {
                contractVersion: '1',
                documentID: String(24000000 + n),
                title: '関連する架空作品 ' + n,
                author: '架空班',
                enterYear: 2024,
                course: 'tankyu',
                eventName: 'individualTankyu',
                category1: 'society',
                subCategory1: 'disasterPrevention',
                category2: 'none',
                subCategory2: 'none',
                existsPoster: false,
                existsReport: false,
                existsSlide: false,
                existsThesis: false,
                revision: 'fixture',
              },
            })),
          },
        });
      if (path.endsWith('/state'))
        return route.fulfill({
          json: { version: '1', favorite: false, revision: 0, count: 0 },
        });
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
      await expect(
        page
          .getByRole('group', { name: '資料の種類' })
          .getByRole('button', { name: 'AI要約', exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole('button', { name: '作品の詳細を見る', exact: true })
        .filter({ visible: true })
        .click({ position: { x: 20, y: 20 } });
      await expect(pdf).toBeVisible();
      await expect(page.locator('.site-header')).not.toBeVisible();
      await expect
        .poll(async () => (await page.getByRole('group', { name: '資料の種類' }).boundingBox())!.y)
        .toBeLessThan(safeTop + 8);
      await page.locator('[data-reader-sheet]').evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished));
      });
    }
    const summary = page.getByRole('region', { name: 'AI要約', exact: true });
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('button', { name: phrase, exact: true })).toBeVisible();
    await expect(
      summary.getByRole('button', { name: '根拠を閉じる', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await summary.getByRole('button', { name: '根拠を閉じる', exact: true }).click();
    await expect(
      summary.getByText('AIが作成した要約です。詳しい内容は資料で確認できます。'),
    ).toHaveCount(0);
    const textLayout = () =>
      summary
        .locator('p')
        .first()
        .evaluate((element) => {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          const positions: { character: string; x: number; y: number }[] = [];
          let node: Node | null;
          while ((node = walker.nextNode())) {
            const text = node.textContent ?? '';
            for (let i = 0; i < text.length; i++) {
              if (/\s/.test(text[i])) continue;
              const range = document.createRange();
              range.setStart(node, i);
              range.setEnd(node, i + 1);
              const rect = range.getBoundingClientRect();
              positions.push({
                character: text[i],
                x: Math.round(rect.x * 100) / 100,
                y: Math.round(rect.y * 100) / 100,
              });
            }
          }
          return positions;
        });
    const before = await textLayout();
    await summary.getByRole('button', { name: '根拠を確認', exact: true }).click();
    await expect(summary.getByRole('button', { name: phrase, exact: true })).toBeVisible();
    const after = await textLayout();
    expect(after).toHaveLength(before.length);
    after.forEach((position, index) => {
      expect(position.character).toBe(before[index].character);
      // Inline fragments may round glyph positions by a fraction of a pixel.
      expect(Math.abs(position.x - before[index].x)).toBeLessThan(0.75);
      expect(Math.abs(position.y - before[index].y)).toBeLessThan(0.1);
    });
    await page.screenshot({
      path: `/private/tmp/ai-summary-${width}.png`,
      fullPage: true,
    });
    await summary.getByRole('button', { name: phrase, exact: true }).click();
    await expect(page.getByRole('button', { name: 'レポート', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(pdf).toBeVisible();
    // This value is updated from the EmbedPDF scroll capability/page-change event, not the requested page.
    await expect(pdf).toHaveAttribute('data-pdf-page', '2', { timeout: 30000 });
    await summary.getByRole('button', { name: phrase, exact: true }).press('Space');
    await expect(pdf).toHaveAttribute('data-pdf-page', '2');
    expect(calls.filter((c) => c === 'GET /api/works/24000010/pdf/report')).toHaveLength(1);
    if (width < 900) {
      const sheet = page.getByRole('region', {
        name: '作品の補足',
        exact: true,
      });
      const grip = sheet.getByRole('separator', { name: 'シートの高さ' }),
        beforeHeight = (await sheet.boundingBox())!.height;
      await grip.focus();
      await grip.press('ArrowUp');
      const maxHeight = Number(await grip.getAttribute('aria-valuemax'));
      expect((await sheet.boundingBox())!.height).toBeCloseTo(
        Math.min(maxHeight, beforeHeight + 40),
        0,
      );
      const viewBox = await pdf.boundingBox(),
        sheetBox = await sheet.boundingBox();
      expect(viewBox!.y).toBeGreaterThanOrEqual(safeTop);
      expect(viewBox!.y + viewBox!.height).toBeLessThanOrEqual(sheetBox!.y + 2);
      await sheet.getByRole('tab', { name: '情報', exact: true }).click();
      await expect(sheet.getByRole('heading', { name: '雨の後も使えるベンチ' })).toBeVisible();
      await expect(sheet.getByText('排水', { exact: true })).toBeVisible();
      // The sheet is non-modal: switching the main document remains possible.
      await page.getByRole('button', { name: 'ポスター', exact: true }).click();
      await expect(pdf).toHaveAttribute('data-pdf-ready', 'true');
      await expect(sheet).toBeVisible();
      await sheet.getByRole('tab', { name: '関連', exact: true }).click();
      await expect(sheet.getByRole('link', { name: '関連する架空作品 20の詳細' })).toBeVisible();
      await page.screenshot({
        path: `/private/tmp/reader-sheet-${width}.png`,
        fullPage: false,
      });
      await sheet.getByRole('button', { name: 'シートを閉じる' }).click();
      await expect(page.locator('.site-header')).toBeVisible();
      await expect(page.locator('[data-sheet-moving]')).toHaveAttribute(
        'data-sheet-moving',
        'false',
      );
      await page.getByRole('button', { name: 'レポート', exact: true }).click();
      await expect(pdf).toHaveAttribute('data-pdf-ready', 'true');
      const scrollPdf = async (position: 'top' | 'middle' | 'bottom') => {
        await pdf.locator('div').evaluateAll((elements, where) => {
          const el = elements
            .filter(
              (e) =>
                /auto|scroll/.test(getComputedStyle(e).overflowY) &&
                e.scrollHeight > e.clientHeight + 50,
            )
            .sort((a, b) => b.clientHeight - a.clientHeight)[0];
          if (!el) return;
          el.scrollTop = where === 'top' ? 0 : where === 'middle' ? 160 : el.scrollHeight;
        }, position);
      };
      await scrollPdf('top');
      await expect(page.locator('[data-title-collapsed]')).toHaveAttribute(
        'data-title-collapsed',
        'false',
      );
      await expect
        .poll(async () => {
          await scrollPdf('middle');
          return page.locator('[data-title-collapsed]').getAttribute('data-title-collapsed');
        })
        .toBe('true');
      await expect(page.locator('.site-header .work-toolbar-title')).toHaveText(
        '雨の後も使えるベンチ',
      );
      // The title moved into the header must remain an actual tap target.
      const headerTitle = page
        .locator('.site-header')
        .getByRole('button', { name: '雨の後も使えるベンチの詳細を見る', exact: true });
      await headerTitle.click({ position: { x: 12, y: 20 } });
      await expect(page.getByRole('region', { name: '作品の補足', exact: true })).toBeVisible();
      await expect(page.locator('.site-header')).not.toBeVisible();
      await page.getByRole('button', { name: 'シートを閉じる', exact: true }).click();
      await expect(page.locator('.site-header')).toBeVisible();
      await expect(page.locator('[data-sheet-moving]')).toHaveAttribute(
        'data-sheet-moving',
        'false',
      );
      await scrollPdf('bottom');
      await expect(page.locator('[data-after-pdf]')).toHaveCount(1);
      await expect(
        page.locator('[data-after-pdf]').getByRole('link', { name: '関連する架空作品 20の詳細' }),
      ).toBeVisible();
      await headerTitle.click();
      await expect(sheet).toBeVisible();
      await scrollPdf('bottom');
      await expect(page.locator('[data-after-pdf]')).toHaveCount(0);
      await sheet.getByRole('tab', { name: '関連', exact: true }).click();
      await expect(sheet.getByRole('link', { name: '関連する架空作品 20の詳細' })).toBeVisible();
      await sheet.getByRole('button', { name: 'シートを閉じる' }).click();
      await expect(page.locator('[data-after-pdf]')).toHaveCount(1);
      await expect(page.locator('[data-sheet-moving]')).toHaveAttribute(
        'data-sheet-moving',
        'false',
      );
      await scrollPdf('bottom');
      const endBox = await pdf.boundingBox();
      await page.mouse.move(endBox!.x + endBox!.width / 2, endBox!.y + endBox!.height - 30);
      await page.mouse.wheel(0, 500);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await page.screenshot({
        path: `/private/tmp/reader-end-${width}.png`,
        fullPage: false,
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await scrollPdf('top');
      await expect(page.locator('[data-title-collapsed]')).toHaveAttribute(
        'data-title-collapsed',
        'false',
      );
    } else {
      const summaryBox = await summary.boundingBox(),
        pdfBox = await pdf.boundingBox();
      expect(pdfBox!.width).toBeGreaterThan(550);
      if (width >= 1440) expect(summaryBox!.x).toBeGreaterThan(pdfBox!.x + pdfBox!.width);
      else expect(summaryBox!.x).toBeLessThan(pdfBox!.x);
    }
    if (width >= 1440) {
      await page.setViewportSize({ width, height: 500 });
      const left = page.getByRole('complementary', { name: '作品情報欄', exact: true });
      const right = page.getByRole('complementary', { name: '要約と関連作品', exact: true });
      const initial = await left.evaluate((el) => el.scrollTop);
      await right.hover();
      await page.mouse.wheel(0, 400);
      await expect.poll(() => right.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await left.evaluate((el) => el.scrollTop)).toBe(initial);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      const rightPosition = await right.evaluate((el) => el.scrollTop);
      await left.hover();
      await page.mouse.wheel(0, 300);
      await expect.poll(() => left.evaluate((el) => el.scrollTop)).toBeGreaterThan(initial);
      expect(await right.evaluate((el) => el.scrollTop)).toBe(rightPosition);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }
    expect(calls.filter((c) => c === 'GET /api/works/24000010')).toHaveLength(1);
    expect(calls.filter((c) => c === 'GET /api/works/24000010/pdf/report')).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
