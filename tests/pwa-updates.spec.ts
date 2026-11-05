import { test, expect, type Page } from '@playwright/test';
const welcome = (page: Page) => page.getByRole('heading', { level: 1, name: /先輩の問いから/ });
async function boot(page: Page, release: string) {
  await page.request.post('/__test__/release', {
    data: { release, broken: false, denyOld: false },
  });
  await page.goto('/welcome');
  await expect(welcome(page)).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(welcome(page)).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}
async function removeIndex(page: Page) {
  return page.evaluate(async () => {
    let removed = 0;
    for (const name of await caches.keys())
      if (name.startsWith('tankyu-shell-') || name.startsWith('workbox-precache-v2-')) {
        const c = await caches.open(name);
        for (const req of await c.keys())
          if (new URL(req.url).pathname === '/index.html') {
            await c.delete(req);
            removed++;
          }
      }
    return removed;
  });
}
test('旧版のキャッシュ欠落＋HTML転送でERR_FAILEDを再現し、保存情報を残して復旧', async ({
  page,
  context,
}, testInfo) => {
  await boot(page, 'old');
  await page.evaluate(async () => {
    localStorage.setItem('recovery-proof', 'keep');
    await (
      await caches.open('tankyu-pdf-assets-v1')
    ).put('/saved-pdf-proof', new Response('keep-pdf'));
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open('recovery-proof', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('saved');
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('saved', 'readwrite');
        tx.objectStore('saved').put('keep-document', 'pdf');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
      r.onerror = () => reject(r.error);
    });
  });
  await context.addCookies([
    { name: 'recovery-proof', value: 'keep-cookie', url: 'http://127.0.0.1:4179' },
  ]);
  expect(await removeIndex(page)).toBeGreaterThan(0);
  let failed = false;
  try {
    await page.reload();
  } catch {
    failed = true;
  }
  expect(failed).toBe(true);
  await page.request.post('/__test__/release', { data: { release: 'fixed' } });
  await page.goto('/assets/recover.html');
  await page.getByRole('button', { name: '修復して開く' }).click();
  await expect(welcome(page)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('recovery-proof'))).toBe('keep');
  expect((await context.cookies()).find((c) => c.name === 'recovery-proof')?.value).toBe(
    'keep-cookie',
  );
  expect(
    await page.evaluate(async () =>
      (await (await caches.open('tankyu-pdf-assets-v1')).match('/saved-pdf-proof'))?.text(),
    ),
  ).toBe('keep-pdf');
  expect(
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const r = indexedDB.open('recovery-proof');
          r.onsuccess = () => {
            const db = r.result;
            const tx = db.transaction('saved');
            const g = tx.objectStore('saved').get('pdf');
            g.onsuccess = () => {
              db.close();
              resolve(g.result);
            };
          };
        }),
    ),
  ).toBe('keep-document');
  await page.screenshot({ path: testInfo.outputPath('recovered.png') });
});
test('新版はキャッシュが欠けてもHTML転送から自己修復し、再びオフラインで開ける', async ({
  page,
  context,
}) => {
  await boot(page, 'fixed');
  await page.evaluate(async () => {
    for (const name of await caches.keys())
      if (name.startsWith('tankyu-shell-')) await caches.delete(name);
  });
  await page.reload();
  await expect(welcome(page)).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(welcome(page)).toBeVisible();
});
test('キャッシュ欠落中の通信失敗でもブラウザーのERR_FAILED画面にしない', async ({
  page,
  context,
}) => {
  await boot(page, 'fixed');
  await removeIndex(page);
  await context.setOffline(true);
  const response = await page.reload();
  expect(response?.status()).toBe(503);
  await expect(page.getByRole('heading', { name: 'アプリを開けませんでした' })).toBeVisible();
  await context.setOffline(false);
  await page.goto('/welcome');
  await expect(welcome(page)).toBeVisible();
});
test('2つのタブで更新しても通知・再読み込みは各1回、旧版の部品も保持', async ({
  page,
  context,
}) => {
  await context.addInitScript(() =>
    sessionStorage.setItem(
      'document-loads',
      String(Number(sessionStorage.getItem('document-loads') || 0) + 1),
    ),
  );
  await boot(page, 'fixed');
  const other = await context.newPage();
  await other.goto('/welcome');
  await expect(welcome(other)).toBeVisible();
  const before = await Promise.all(
    [page, other].map((p) => p.evaluate(() => Number(sessionStorage.getItem('document-loads')))),
  );
  const oldCache = await page.evaluate(async () =>
    (await caches.keys()).find((n) => n.startsWith('tankyu-shell-')),
  );
  const oldAsset = '/assets/retained-proof-12345678.js';
  await page.evaluate(
    async ({ name, url }) => {
      await (
        await caches.open(name!)
      ).put(
        url,
        new Response('old-release-byte', { headers: { 'Content-Type': 'application/javascript' } }),
      );
    },
    { name: oldCache, url: oldAsset },
  );
  await page.request.post('/__test__/release', { data: { release: 'fixed2', denyOld: true } });
  await Promise.all(
    [page, other].map((p) =>
      p.evaluate(async () => {
        await (await navigator.serviceWorker.getRegistration())!.update();
      }),
    ),
  );
  for (const p of [page, other])
    await expect(p.getByRole('dialog', { name: '新しいバージョンがあります' })).toHaveCount(1);
  await page.getByRole('button', { name: '更新する', exact: true }).click();
  for (const p of [page, other]) {
    await expect(welcome(p)).toBeVisible();
    await expect(p.getByRole('dialog')).toHaveCount(0);
  }
  await expect
    .poll(() => page.evaluate(() => Number(sessionStorage.getItem('document-loads'))))
    .toBe(before[0]! + 1);
  await expect
    .poll(() => other.evaluate(() => Number(sessionStorage.getItem('document-loads'))))
    .toBe(before[1]! + 1);
  await page.waitForTimeout(500);
  expect(await other.evaluate(() => Number(sessionStorage.getItem('document-loads')))).toBe(
    before[1]! + 1,
  );
  expect(await page.evaluate(async (url) => (await fetch(url)).text(), oldAsset)).toBe(
    'old-release-byte',
  );
});
test('配信途中の壊れたファイルでは更新を成立させず、旧版を維持', async ({ page }) => {
  await boot(page, 'fixed');
  const cacheBefore = await page.evaluate(async () => await caches.keys());
  await page.request.post('/__test__/release', { data: { release: 'fixed2', broken: true } });
  const state = await page.evaluate(async () => {
    const reg = (await navigator.serviceWorker.getRegistration())!;
    const installing = new Promise<ServiceWorker>((resolve) =>
      reg.addEventListener('updatefound', () => resolve(reg.installing!), { once: true }),
    );
    await reg.update();
    const worker = await installing;
    await new Promise<void>((resolve) => {
      const check = () => {
        if (worker.state === 'redundant') resolve();
      };
      worker.addEventListener('statechange', check);
      check();
    });
    return { state: worker.state, waiting: !!reg.waiting };
  });
  expect(state).toEqual({ state: 'redundant', waiting: false });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(welcome(page)).toBeVisible();
  const after = await page.evaluate(async () => await caches.keys());
  expect(cacheBefore.every((n) => after.includes(n))).toBe(true);
});
