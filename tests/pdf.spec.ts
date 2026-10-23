import { test, expect, type Page } from '@playwright/test';
import { fixturePdf } from './pdf-fixture.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
// Only fictional bytes are committed. Real SSD acceptance is explicitly opt-in, read-only.
const revision = 'a'.repeat(64);
async function setup(
  page: Page,
  options: {
    bytes?: Buffer;
    state?: string;
    corrupt?: boolean;
    headStatus?: number;
    strict?: boolean;
    kinds?: string[];
    from?: string;
  } = {},
) {
  const bytes = options.bytes ?? fixturePdf();
  const kinds = options.kinds ?? ['poster', 'report'];
  const sha = createHash('sha256').update(bytes).digest('hex');
  const calls: string[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    expect(request.headers().authorization).toBe('Bearer fixture-token');
    calls.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === '/api/history') return route.fulfill({ json: { version: '1', ok: true } });
    if (url.pathname === '/api/works/24000010/state')
      return route.fulfill({ json: { version: '1', favorite: false, revision: 0, count: 0 } });
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
            existsPoster: kinds.includes('poster'),
            existsReport: kinds.includes('report'),
            existsSlide: kinds.includes('slide'),
            existsThesis: kinds.includes('thesis'),
            revision: 'fixture-r1',
          },
          documents: kinds.map((kind) => ({
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
    '/tests/discovery-harness.html?' +
      (options.strict ? 'strict=1&' : '') +
      'entry=' +
      encodeURIComponent(
        '/works/24000010?from=' + encodeURIComponent(options.from ?? '/explore?q=water'),
      ),
  );
  await expect(page.getByRole('heading', { name: '架空のPDF作品' })).toBeVisible();
  return calls;
}
async function openDownload(page: Page) {
  const direct = page.getByRole('button', { name: 'PDFダウンロード', exact: true });
  if (await direct.isVisible()) await direct.click();
  else {
    await page.getByRole('button', { name: 'その他', exact: true }).click();
    await page.getByRole('menuitem', { name: 'PDFダウンロード', exact: true }).click();
  }
  await expect(page.getByRole('dialog', { name: 'PDFダウンロード', exact: true })).toBeVisible();
}
async function prepareDownload(page: Page) {
  await openDownload(page);
  await page.getByRole('button', { name: '同意して進む', exact: true }).click();
}
async function expectPixels(page: Page) {
  await expect
    .poll(
      () =>
        page
          .getByRole('region', { name: 'PDFビューア', exact: true })
          .locator('img')
          .evaluateAll((images) =>
            images.some((image) => (image as HTMLImageElement).naturalWidth > 0),
          ),
      { timeout: 20000 },
    )
    .toBe(true);
}
for (const [name, width, height] of [
  ['スマホ', 390, 844],
  ['iPad', 820, 1180],
  ['PC', 1440, 1000],
] as const) {
  test(`${name}: 実PDFエンジン・ページ・拡大・種類・保存`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const calls = await setup(page);
    const viewer = page.getByRole('region', { name: 'PDFビューア', exact: true });
    await expectPixels(page);
    await expect(viewer.getByRole('button', { name: 'ドキュメントメニュー' })).toHaveCount(0);
    await page.screenshot({ path: `/tmp/reader-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'レポート', exact: true }).click();
    await expectPixels(page);
    await prepareDownload(page);
    const link = page.getByRole('link', { name: 'PDFを端末に保存' });
    await expect(link).toBeVisible();
    expect(calls.filter((c) => c === 'GET /api/works/24000010/pdf/report')).toHaveLength(2);
    expect(calls.filter((c) => c === 'HEAD /api/works/24000010/pdf/report')).toHaveLength(1);
    const downloadPromise = page.waitForEvent('download');
    await link.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/24000010-report\.pdf$/);
    const path = await download.path();
    expect(await readFile(path!)).toEqual(fixturePdf());
    await page.getByRole('button', { name: 'PDFダウンロードを閉じる' }).click();
    await page.getByRole('link', { name: '一覧へ戻る' }).click();
    await expect(page).toHaveURL(/results\?q=water/);
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
  await prepareDownload(page);
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
  await prepareDownload(page);
  await expect(page.getByRole('link', { name: 'PDFを端末に保存' })).toBeVisible();
  await page.getByRole('button', { name: 'PDFダウンロードを閉じる' }).click();
  await page.getByRole('button', { name: '共有する…', exact: true }).click();
  await expect(page.getByLabel('共有する作品のリンク')).toHaveValue(
    /\/works\/24000010\?kind=poster$/,
  );
});
test('通常WelcomeはPDFエンジンを取得せず、共有URLからログインへ', async ({ page }) => {
  const pdfRequests: string[] = [];
  page.on('request', (r) => {
    if (/pdf-runtime|pdf\.worker|\/pdfjs\/|\/embedpdf\//.test(r.url())) pdfRequests.push(r.url());
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
  const viewer = page.getByRole('region', { name: 'PDFビューア', exact: true });
  await expect
    .poll(
      () =>
        viewer
          .locator('img')
          .evaluateAll((images) => images.some((el) => (el as HTMLImageElement).naturalWidth > 0)),
      { timeout: 25000 },
    )
    .toBe(true);
  console.log(JSON.stringify({ bytes: bytes.length, elapsedMs: Date.now() - start }));
  await page.screenshot({
    path: process.env.TANKYU_PDF_SCREENSHOT ?? '/private/tmp/tankyu-t09-real-pdf.png',
    fullPage: true,
  });
});

test('資料を繰り返し切り替えてもビューアとWorkerとBlob URLを解放・版変更時は保存しない', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    const counts = { created: 0, revoked: 0, workers: 0 };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        counts.workers++;
      }
      override terminate() {
        counts.workers--;
        super.terminate();
      }
    };
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
  const calls = await setup(page);
  let engine: unknown;
  for (let n = 0; n < 6; n++) {
    await expectPixels(page);
    await expect(page.locator('embedpdf-container')).toHaveCount(1);
    const currentEngine = await page.locator('embedpdf-container').evaluate((el) => {
      const node = el as HTMLElement & { testIdentity?: string };
      return (node.testIdentity ??= crypto.randomUUID());
    });
    if (engine) expect(currentEngine).toBe(engine);
    engine = currentEngine;
    await expect
      .poll(() =>
        page
          .getByRole('region', { name: 'PDFビューア', exact: true })
          .locator('img')
          .evaluateAll((images) => images.some((el) => (el as HTMLImageElement).naturalWidth > 0)),
      )
      .toBe(true);
    await page
      .getByRole('button', { name: n % 2 === 0 ? 'レポート' : 'ポスター', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: n % 2 === 0 ? 'レポート' : 'ポスター', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expectPixels(page);
  }
  await expectPixels(page);
  expect(calls.filter((c) => c.startsWith('GET /api/works/24000010/pdf/'))).toHaveLength(2);
  expect(calls.filter((c) => c.startsWith('HEAD /api/works/24000010/pdf/'))).toHaveLength(5);
  await page.route('**/api/works/24000010/pdf/**', (route) =>
    route.fulfill({ status: 409, json: { code: 'document_changed' } }),
  );
  await prepareDownload(page);
  await expect(
    page.getByText('資料を読み込めませんでした。通信を確認してお試しください。'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'PDFを端末に保存' })).toHaveCount(0);
  await page.getByRole('button', { name: 'PDFダウンロードを閉じる' }).click();
  await page.getByRole('link', { name: '一覧へ戻る' }).click();
  await expect(page.locator('embedpdf-container')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = (
          window as unknown as {
            pdfTestCounts: { created: number; revoked: number; workers: number };
          }
        ).pdfTestCounts;
        return { urls: c.created - c.revoked, workers: c.workers };
      }),
    )
    .toEqual({ urls: 0, workers: 0 });
});

test('その他に統合・複数PDFは同意後にZIPで保存・選択変更で準備を破棄', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await setup(page);
  await expect(page.getByRole('heading', { name: '資料を手元に' })).toHaveCount(0);
  await expect(page.getByText('作品情報やPDFについて報告する', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'その他', exact: true }).click();
  await expect(page.getByRole('menuitem')).toHaveText([
    '共有する…',
    'PDFダウンロード',
    '作品情報を報告',
  ]);
  await page.screenshot({ path: testInfo.outputPath('work-menu.png') });
  await page.getByRole('menuitem', { name: 'PDFダウンロード', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'PDFダウンロード', exact: true });
  await expect(dialog).toContainText('SNSやWebサイトへのアップロード');
  const poster = dialog.getByRole('checkbox', { name: 'ポスター', exact: true }),
    report = dialog.getByRole('checkbox', { name: 'レポート', exact: true });
  await poster.uncheck();
  await expect(dialog.getByRole('button', { name: '同意して進む' })).toBeDisabled();
  await poster.check();
  await report.check();
  expect(calls.filter((c) => c.startsWith('HEAD '))).toHaveLength(0);
  await expect(dialog.getByRole('link')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('download-consent.png') });
  await dialog.getByRole('button', { name: '同意して進む' }).click();
  const link = dialog.getByRole('link', { name: 'ZIPを端末に保存' });
  await expect(link).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await link.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/24000010-資料\.zip$/);
  const { unzipSync } = await import('fflate');
  const files = unzipSync(await readFile((await download.path())!));
  expect(Object.keys(files)).toHaveLength(2);
  expect(Object.keys(files).some((name) => name.endsWith('-poster.pdf'))).toBe(true);
  expect(Object.keys(files).some((name) => name.endsWith('-report.pdf'))).toBe(true);
  for (const bytes of Object.values(files)) expect(Buffer.from(bytes)).toEqual(fixturePdf());
  await report.uncheck();
  await expect(dialog.getByRole('link')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '同意して進む' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'その他', exact: true })).toBeFocused();
});
test('保存ボタンの期限が切れたら再認可し、拒否されたZIPやPDFを保存しない', async ({ page }) => {
  await page.clock.install();
  await setup(page);
  await prepareDownload(page);
  const link = page.getByRole('link', { name: 'PDFを端末に保存' });
  await expect(link).toBeVisible();
  await page.route('**/api/works/24000010/pdf/**', (route) =>
    route.fulfill({ status: 403, json: { error: { code: 'membership_required' } } }),
  );
  await page.clock.fastForward(6000);
  const downloads: string[] = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));
  await link.click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '資料を読み込めませんでした',
  );
  await expect(link).toHaveCount(0);
  expect(downloads).toEqual([]);
});

test('StrictModeで開き直しても同意後のダウンロードが中断されたままにならない', async ({ page }) => {
  await setup(page, { strict: true });
  await prepareDownload(page);
  await expect(page.getByRole('link', { name: 'PDFを端末に保存' })).toBeVisible();
  await page.getByRole('button', { name: 'PDFダウンロードを閉じる' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await prepareDownload(page);
  await expect(page.getByRole('link', { name: 'PDFを端末に保存' })).toBeVisible();
});

test('EmbedPDF: 日本語フォントを自サイトから読み込み、検索・サムネイル・拡大と読取専用UIを使える', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const external: string[] = [],
    fonts: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== 'http://127.0.0.1:4177')
      external.push(url.href);
    if (url.pathname.includes('/embedpdf/') && url.pathname.includes('/fonts/'))
      fonts.push(url.pathname);
  });
  await page.addInitScript(() => localStorage.setItem('archive-theme', 'dark'));
  await setup(page, { bytes: fixturePdf(true) });
  const viewer = page.getByRole('region', { name: 'PDFビューア', exact: true });
  await expect
    .poll(
      () =>
        viewer
          .locator('img')
          .evaluateAll((images) => images.some((el) => (el as HTMLImageElement).naturalWidth > 0)),
      { timeout: 20000 },
    )
    .toBe(true);
  await expect.poll(() => fonts.some((path) => path.endsWith('NotoSansJP-Regular.otf'))).toBe(true);
  await expect(page.locator('embedpdf-container')).toHaveJSProperty('activeColorScheme', 'dark');
  await page.screenshot({ path: testInfo.outputPath('japanese-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'PDF内を検索', exact: true }).click();
  await expect(viewer.getByPlaceholder('検索', { exact: true })).toBeVisible();
  await viewer.getByPlaceholder('検索', { exact: true }).fill('探究');
  await expect(viewer.getByText('2件見つかりました', { exact: true })).toBeVisible();
  await expect(
    viewer.getByRole('button', { name: 'ドキュメントメニュー', exact: true }),
  ).toHaveCount(0);
  expect(external).toEqual([]);
});

test('EmbedPDFの初期化中に戻っても遅れて起動したWorkerを残さない', async ({ page }) => {
  await page.addInitScript(() => {
    const counts = { created: 0, active: 0 };
    Object.assign(window, { earlyWorkers: counts });
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        counts.created++;
        counts.active++;
      }
      override terminate() {
        counts.active--;
        super.terminate();
      }
    };
  });
  await setup(page);
  await page.waitForFunction(
    () => (window as unknown as { earlyWorkers: { created: number } }).earlyWorkers.created > 0,
  );
  await page.getByRole('link', { name: '一覧へ戻る', exact: true }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { earlyWorkers: { active: number } }).earlyWorkers.active,
        ),
      { timeout: 15000 },
    )
    .toBe(0);
  await expect(page.locator('embedpdf-container')).toHaveCount(0);
});

test('スマホはタイトル・丸い切替・折りたたみ詳細・大きなPDF、タップで操作を隠す', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await expectPixels(page);
  const details = page.getByRole('region', { name: '作品の詳細' });
  await expect(details).not.toBeVisible();
  await expect(page.locator('.site-header')).not.toContainText('架空のPDF作品');
  await expect(
    page.locator('.site-header').getByRole('button', { name: 'その他', exact: true }),
  ).toBeVisible();
  const title = await page.getByRole('heading', { level: 1 }).boundingBox();
  const tabs = await page.getByRole('group', { name: '資料の種類', exact: true }).boundingBox();
  expect(tabs!.y - (title!.y + title!.height)).toBeLessThan(28);
  expect(
    await page
      .getByRole('button', { name: 'レポート', exact: true })
      .evaluate((el) => getComputedStyle(el).borderRadius),
  ).toBe('999px');
  const viewer = page.getByRole('region', { name: 'PDFビューア', exact: true });
  expect((await viewer.boundingBox())!.width).toBeGreaterThanOrEqual(386);
  await page.getByRole('button', { name: '作品の詳細を見る' }).click();
  await expect(details).toBeVisible();
  await expect(details).toContainText('架空班');
  await expect(details).toContainText('2024年度');
  await expect(details).toContainText('探究科');
  await expect(details).toContainText('防災');
  await expect(details).toContainText('カテゴリ2');
  await page.getByRole('button', { name: '作品の詳細を閉じる' }).click();
  await page.screenshot({ path: testInfo.outputPath('mobile-reader.png'), fullPage: true });
  await viewer.click({ position: { x: 30, y: 30 } });
  await expect(page.getByRole('button', { name: 'PDF内を検索', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '全画面表示', exact: true })).toHaveCount(0);
  await viewer.click({ position: { x: 30, y: 30 } });
  await expect(page.getByRole('button', { name: '全画面表示', exact: true })).toBeVisible();
});

test('全画面は資料切替と検索だけのヘッダー、解除は右下に残り、切替後も全画面を保つ', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      value: undefined,
      configurable: true,
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { bytes: fixturePdf(true) });
  await expectPixels(page);
  await page.getByRole('button', { name: '全画面表示', exact: true }).click();
  await expect(page.locator('[data-reader-fullscreen="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).not.toBeVisible();
  await expect(page.getByRole('button', { name: '作品の詳細を見る' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ポスター', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'レポート', exact: true }).click();
  await expectPixels(page);
  await expect(page.locator('[data-reader-fullscreen="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'PDF内を検索', exact: true }).click();
  const query = page
    .getByRole('region', { name: 'PDFビューア', exact: true })
    .getByPlaceholder('検索', { exact: true });
  await query.fill('探究');
  await expect(page.getByText('2件見つかりました', { exact: true })).toBeVisible();
  const exit = page.getByRole('button', { name: '全画面表示を解除', exact: true });
  // The exit control must remain usable even above the SDK's mobile search sheet.
  await exit.click();
  await expect(page.locator('[data-reader-fullscreen="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: '全画面表示', exact: true }).click();
  await page.getByRole('button', { name: 'PDF内を検索', exact: true }).click();
  await expect(query).not.toBeVisible();
  const before = await exit.boundingBox();
  await page
    .getByRole('region', { name: 'PDFビューア', exact: true })
    .click({ position: { x: 30, y: 30 } });
  await expect(exit).toBeVisible();
  expect((await exit.boundingBox())!.y).toBeCloseTo(before!.y, 0);
  await page.screenshot({ path: testInfo.outputPath('fullscreen-reader.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-reader-fullscreen="true"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('PCは作品情報を左・PDFを右に配置し、全画面の解除で情報欄へ戻る', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await expectPixels(page);
  const info = page.getByRole('region', { name: '作品の詳細', exact: true });
  await expect(info).toBeVisible();
  const ib = await info.boundingBox();
  const vb = await page.getByRole('region', { name: 'PDFビューア', exact: true }).boundingBox();
  expect(ib!.x + ib!.width).toBeLessThan(vb!.x);
  expect(vb!.width).toBeGreaterThan(900);
  const title = await page.getByRole('heading', { level: 1 }).boundingBox();
  const tabs = await page.getByRole('group', { name: '資料の種類', exact: true }).boundingBox();
  const actions = await page.getByRole('button', { name: 'その他', exact: true }).boundingBox();
  expect(tabs!.x + tabs!.width).toBeLessThan(vb!.x);
  expect(actions!.x + actions!.width).toBeLessThan(vb!.x);
  expect(vb!.y).toBeLessThanOrEqual(title!.y + 2);
  await expect(page.locator('.site-header').getByRole('searchbox')).toHaveValue('water');
  await expect(
    page.locator('.site-header').getByRole('button', { name: 'その他', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: '作品の詳細を見る' })).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop-reader.png'), fullPage: true });
  await page.getByRole('button', { name: '全画面表示', exact: true }).click();
  await expect(page.locator('[data-reader-fullscreen="true"]')).toBeVisible();
  await expect(info).not.toBeVisible();
  await page.getByRole('button', { name: '全画面表示を解除', exact: true }).click();
  await expect(info).toBeVisible();
  await expect(page.locator('.site-header')).not.toHaveAttribute('inert');
});

test('メモリ内のPDFも再認可が終わるまで隠し、拒否されたら破棄する', async ({ page }) => {
  const calls = await setup(page);
  await expectPixels(page);
  await page.getByRole('button', { name: 'レポート', exact: true }).click();
  await expectPixels(page);
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/works/24000010/pdf/poster?**', async (route) => {
    expect(route.request().method()).toBe('HEAD');
    await blocked;
    await route.fulfill({ status: 403, json: { code: 'forbidden' } });
  });
  await page.getByRole('button', { name: 'ポスター', exact: true }).click();
  await expect(page.getByRole('region', { name: 'PDFビューア', exact: true })).not.toBeVisible();
  await expect(page.getByText('PDFを取得しています…', { exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('embedpdf-container')).toHaveCount(0);
  expect(calls.filter((c) => c.startsWith('GET /api/works/24000010/pdf/'))).toHaveLength(2);
});

test('4種類を往復してもPDF本体の取得は各1回、エンジンのWorker数は増えない', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    Object.assign(window, { workerStarts: 0 });
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        (window as unknown as { workerStarts: number }).workerStarts++;
      }
    };
  });
  const calls = await setup(page, { kinds: ['poster', 'report', 'slide', 'thesis'] });
  await expectPixels(page);
  const starts = await page.evaluate(
    () => (window as unknown as { workerStarts: number }).workerStarts,
  );
  expect(starts).toBeGreaterThan(0);
  for (const name of [
    'レポート',
    'スライド',
    '論文',
    'ポスター',
    '論文',
    'スライド',
    'レポート',
    'ポスター',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expectPixels(page);
    expect(
      await page.evaluate(() => (window as unknown as { workerStarts: number }).workerStarts),
    ).toBe(starts);
  }
  expect(calls.filter((c) => c.startsWith('GET /api/works/24000010/pdf/'))).toHaveLength(4);
});

test('PCの作品ヘッダーは探索のカテゴリを保ち、キーワードを追加して再検索できる', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page, {
    from: '/results?category=society&subcategory=disasterPrevention&sort=titleAsc',
  });
  const header = page.locator('.site-header');
  await expect(header).toContainText('地域');
  await header.getByRole('button', { name: 'この条件にキーワードを追加' }).click();
  await header.getByRole('searchbox').fill('防災');
  await header.getByRole('button', { name: '検索する', exact: true }).click();
  await expect(page).toHaveURL(/\/results\?/);
  const query = new URL(page.url()).searchParams;
  expect(query.get('category')).toBe('society');
  expect(query.get('subcategory')).toBe('disasterPrevention');
  expect(query.get('sort')).toBe('titleAsc');
  expect(query.get('q')).toBe('防災');
});

test('PCは共有・ダウンロードを直接表示し、ネイティブ共有を使わずリンクをコピーする', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        Object.assign(window, { nativeShareCalled: true });
        throw new Error('PC must not open native share');
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          Object.assign(window, { copiedWorkUrl: text });
        },
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await page.getByRole('button', { name: '共有する…', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '作品のリンクをコピーしました。' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { nativeShareCalled?: boolean }).nativeShareCalled,
    ),
  ).toBeUndefined();
  expect(
    await page.evaluate(() => (window as unknown as { copiedWorkUrl: string }).copiedWorkUrl),
  ).toMatch(/\/works\/24000010\?kind=poster$/);
  await expect(page.getByRole('button', { name: 'PDFダウンロード', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'その他', exact: true }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['作品情報を報告']);
  await page.getByRole('menuitem', { name: '作品情報を報告', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '作品情報を報告', exact: true })).toBeVisible();
});

for (const [device, width, height] of [
  ['スマホ', 390, 844],
  ['横向きiPad', 1024, 768],
] as const) {
  test(`${device}では端末の共有画面へ渡す`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: ShareData) => {
          Object.assign(window, { sharedWork: data });
        },
      });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error('Native sharing should be used');
          },
        },
      });
    });
    await page.setViewportSize({ width, height });
    await setup(page);
    const direct = page.getByRole('button', { name: '共有する…', exact: true });
    if (await direct.isVisible()) await direct.click();
    else {
      await page.getByRole('button', { name: 'その他', exact: true }).click();
      await page.getByRole('menuitem', { name: '共有する…', exact: true }).click();
    }
    await expect(page.getByRole('status').filter({ hasText: '共有しました。' })).toBeVisible();
    const shared = await page.evaluate(
      () => (window as unknown as { sharedWork: ShareData }).sharedWork,
    );
    expect(shared.title).toBe('架空のPDF作品');
    expect(shared.url).toMatch(/\/works\/24000010\?kind=poster$/);
  });
}

test('初期表示とチップとダウンロード選択肢はポスター・スライド・レポート・論文の優先順', async ({
  page,
}) => {
  await setup(page, { kinds: ['thesis', 'report', 'slide', 'poster'] });
  const chips = page.getByRole('group', { name: '資料の種類', exact: true });
  await expect(chips.getByRole('button')).toHaveText(['ポスター', 'スライド', 'レポート', '論文']);
  await expect(chips.getByRole('button', { name: 'ポスター', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await openDownload(page);
  expect(
    await page
      .getByRole('dialog', { name: 'PDFダウンロード', exact: true })
      .getByRole('checkbox')
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).labels?.[0]?.textContent?.trim()),
      ),
  ).toEqual(['ポスター', 'スライド', 'レポート', '論文']);
  await page.getByRole('button', { name: 'PDFダウンロードを閉じる' }).click();
  await setup(page, { kinds: ['report', 'thesis', 'slide'] });
  await expect(page.getByRole('button', { name: 'スライド', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await setup(page, { kinds: ['thesis', 'report'] });
  await expect(page.getByRole('button', { name: 'レポート', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
