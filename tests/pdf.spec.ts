import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
// Only fictional bytes are committed. Real SSD acceptance is explicitly opt-in, read-only.
function fixturePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 420] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...['First fictional page', 'Second fictional page'].map((label) => {
      const stream = `0.2 0.5 0.7 rg 20 20 100 100 re f BT /F1 18 Tf 20 200 Td (${label}) Tj ET`;
      return `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
    }),
  ];
  let result = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(result));
    result += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  result += offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('');
  result += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(result);
}
const revision = 'a'.repeat(64);
async function setup(
  page: Page,
  options: { bytes?: Buffer; state?: string; corrupt?: boolean; headStatus?: number } = {},
) {
  const bytes = options.bytes ?? fixturePdf();
  const sha = createHash('sha256').update(bytes).digest('hex');
  const calls: string[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    expect(request.headers().authorization).toBe('Bearer fixture-token');
    calls.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === '/api/works/24000010')
      return route.fulfill({
        json: {
          version: '1',
          authorizedAt: new Date().toISOString(),
          work: {
            contractVersion: '1',
            documentID: '24000010',
            title: '架空のPDF作品',
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
            revision: 'fixture-r1',
          },
          documents: ['poster', 'report'].map((kind) => ({
            kind,
            state: options.state ?? 'available',
            bytes: bytes.length,
            revision,
            sha256: sha,
          })),
        },
      });
    if (request.method() === 'HEAD' && options.headStatus)
      return route.fulfill({
        status: options.headStatus,
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });
    return route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(bytes.length),
        'X-Document-Revision': revision,
        'X-Content-SHA256': options.corrupt ? 'b'.repeat(64) : sha,
        'X-Authorized-At': new Date().toISOString(),
        'Cache-Control': 'private, no-store',
      },
      body: request.method() === 'HEAD' ? undefined : bytes,
    });
  });
  await page.goto(
    '/tests/discovery-harness.html?entry=' +
      encodeURIComponent('/works/24000010?from=%2Fexplore%3Fq%3Dwater'),
  );
  await expect(page.getByRole('heading', { name: '架空のPDF作品' })).toBeVisible();
  return calls;
}
for (const [name, width, height] of [
  ['スマホ', 390, 844],
  ['iPad', 820, 1180],
  ['PC', 1440, 1000],
] as const) {
  test(`${name}: 実PDFエンジン・ページ・拡大・種類・保存`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const calls = await setup(page);
    await expect(page.getByRole('button', { name: '次のページ' })).toBeEnabled();
    expect(
      await page.locator('canvas').evaluate((el: HTMLCanvasElement) => el.width * el.height),
    ).toBeLessThanOrEqual(4_000_000);
    await page.getByRole('button', { name: '次のページ' }).click();
    await expect(page.getByText('2 / 2 ページ')).toBeVisible();
    await expect(page.getByRole('button', { name: '前のページ' })).toBeEnabled();
    await page.getByLabel('拡大率').selectOption('3');
    await expect
      .poll(() => page.locator('canvas').evaluate((el: HTMLCanvasElement) => el.width * el.height))
      .toBeGreaterThan(0);
    expect(
      await page.locator('canvas').evaluate((el: HTMLCanvasElement) => el.width * el.height),
    ).toBeLessThanOrEqual(4_000_000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'レポート', exact: true }).click();
    await expect(page.getByText('1 / 2 ページ')).toBeVisible();
    await page.getByRole('button', { name: 'ダウンロード', exact: true }).click();
    const link = page.getByRole('link', { name: 'PDFを端末に保存' });
    await expect(link).toBeVisible();
    expect(calls.filter((c) => c === 'GET /api/works/24000010/pdf/report')).toHaveLength(1);
    expect(calls.filter((c) => c === 'HEAD /api/works/24000010/pdf/report')).toHaveLength(1);
    const downloadPromise = page.waitForEvent('download');
    await link.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/24000010-report\.pdf$/);
    const path = await download.path();
    expect(await readFile(path!)).toEqual(fixturePdf());
    await page.getByRole('link', { name: '一覧へ戻る' }).click();
    await expect(page).toHaveURL(/explore\?q=water/);
  });
}
test('取得失敗・サイズ状態・ハッシュ破損・認可失効時の保存拒否', async ({ page }) => {
  await setup(page, { state: 'missing' });
  await expect(page.getByText('この資料はまだ見つかりません。', { exact: false })).toBeVisible();
  await setup(page, { state: 'too_large' });
  await expect(page.getByText('3MBを超える資料', { exact: false })).toBeVisible();
  await setup(page, { corrupt: true });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await setup(page, { headStatus: 403 });
  await expect(page.getByRole('button', { name: 'ダウンロード', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'ダウンロード', exact: true }).click();
  await expect(
    page.getByText('資料を読み込めませんでした。通信を確認してお試しください。'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'PDFを端末に保存' })).toHaveCount(0);
});
test('破損PDFでも明示保存可能・共有の手動コピーfallback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('denied');
        },
      },
      configurable: true,
    });
  });
  await setup(page, { bytes: Buffer.from('%PDF-1.7\ninvalid fixture\n%%EOF') });
  await expect(page.getByRole('alert')).toContainText('PDFを表示できませんでした');
  await page.getByRole('button', { name: 'ダウンロード', exact: true }).click();
  await expect(page.getByRole('link', { name: 'PDFを端末に保存' })).toBeVisible();
  await page.getByRole('button', { name: '作品のリンクを共有' }).click();
  await expect(page.getByLabel('共有する作品のリンク')).toHaveValue(
    /\/works\/24000010\?kind=poster$/,
  );
});
test('通常WelcomeはPDFエンジンを取得せず、共有URLからログインへ', async ({ page }) => {
  const pdfRequests: string[] = [];
  page.on('request', (r) => {
    if (/pdf-runtime|pdf\.worker|\/pdfjs\//.test(r.url())) pdfRequests.push(r.url());
  });
  await page.goto('/works/24000010?kind=poster');
  await expect(page.getByRole('heading', { name: '学校のアカウントでログイン' })).toBeVisible();
  const link = page.getByRole('link', { name: /ログイン/ });
  await link.click();
  await expect(page).toHaveURL(/next=/);
  expect(pdfRequests).toHaveLength(0);
});
test('実SSD PDFをコピーせず表示（明示したローカル受入のみ）', async ({ page }) => {
  test.skip(!process.env.TANKYU_PDF_PATH, '実PDFはGit・公開サーバーに配置しない');
  const bytes = await readFile(process.env.TANKYU_PDF_PATH!);
  const start = Date.now();
  await setup(page, { bytes });
  await expect(page.getByRole('button', { name: 'ダウンロード', exact: true })).toBeEnabled();
  await expect(page.getByText(/1 \/ \d+ ページ/)).toBeVisible();
  await expect(page.getByText('ページを描画しています…')).toHaveCount(0, { timeout: 25000 });
  expect(
    await page.locator('canvas').evaluate((el: HTMLCanvasElement) => el.width * el.height),
  ).toBeGreaterThan(0);
  console.log(
    JSON.stringify({
      bytes: bytes.length,
      elapsedMs: Date.now() - start,
      pages: await page.getByText(/1 \/ \d+ ページ/).textContent(),
    }),
  );
  await page.screenshot({
    path: process.env.TANKYU_PDF_SCREENSHOT ?? '/private/tmp/tankyu-t09-real-pdf.png',
    fullPage: true,
  });
});

test('資料を繰り返し切り替えてもcanvasとBlob URLを解放・版変更時は保存しない', async ({ page }) => {
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    const counts = { created: 0, revoked: 0 };
    Object.assign(window, { pdfTestCounts: counts });
    URL.createObjectURL = (blob) => {
      counts.created++;
      return create(blob);
    };
    URL.revokeObjectURL = (url) => {
      counts.revoked++;
      revoke(url);
    };
  });
  await setup(page, { headStatus: 409 });
  for (let n = 0; n < 6; n++) {
    await expect(page.getByRole('button', { name: '次のページ' })).toBeEnabled();
    await expect(page.locator('canvas')).toHaveCount(1);
    await page
      .getByRole('button', { name: n % 2 === 0 ? 'レポート' : 'ポスター', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: n % 2 === 0 ? 'レポート' : 'ポスター', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '次のページ' })).toBeEnabled();
  }
  await expect(page.getByRole('button', { name: '次のページ' })).toBeEnabled();
  const counts = await page.evaluate(
    () =>
      (window as unknown as { pdfTestCounts: { created: number; revoked: number } }).pdfTestCounts,
  );
  expect(counts.created).toBe(7);
  expect(counts.revoked).toBe(6);
  await page.getByRole('button', { name: 'ダウンロード', exact: true }).click();
  await expect(
    page.getByText('資料を読み込めませんでした。通信を確認してお試しください。'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'PDFを端末に保存' })).toHaveCount(0);
});
