import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createHash } from 'node:crypto';
import { fixturePdf } from './pdf-fixture.mjs';
const bytes = fixturePdf(),
  sha = createHash('sha256').update(bytes).digest('hex'),
  revision = 'a'.repeat(64);
const work = {
  contractVersion: '1',
  documentID: '24000010',
  title: '架空のオフライン作品',
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
};
async function fixture(page: Page, context: BrowserContext) {
  await context.addCookies([
    { url: 'http://127.0.0.1:4178', name: 'offline-test', value: crypto.randomUUID() },
  ]);
  await context.addInitScript(() => {
    if (!localStorage.getItem('fixture-initialized')) {
      localStorage.setItem('offline-fixture-user', 'fixture-alice');
      localStorage.setItem('fixture-initialized', '1');
    }
  });
  const calls = async (): Promise<string[]> =>
    (await (await page.request.get('/__offline-fixture')).json()).calls;
  const state = async (value: Record<string, unknown>) => {
    await page.request.post('/__offline-fixture', { data: value });
  };
  await page.goto('/welcome');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  return { calls, state };
}
async function save(page: Page) {
  await page.goto('/works/24000010');
  await expect(page.getByText('この端末に3日間保存しました。', { exact: true })).toBeVisible({
    timeout: 90000,
  });
  await expect(page.getByRole('button', { name: '次のページ' })).toBeEnabled();
}
async function rows(page: Page) {
  return page.evaluate(async () => {
    const s = (
      window as unknown as { offlineFixtureStore: typeof import('../src/features/offline/store') }
    ).offlineFixtureStore;
    const grant = await s.resumeCache('fixture-alice');
    return grant ? await s.listSaved(grant.cacheSession) : [];
  });
}
test('閲覧した種類だけ保存・完全オフラインの再起動・表示・保存・期限不延長', async ({
  page,
  context,
}) => {
  const { calls } = await fixture(page, context);
  await save(page);
  const publicKeys = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys())
      for (const r of await (await caches.open(name)).keys()) urls.push(new URL(r.url).pathname);
    return urls;
  });
  expect(publicKeys.some((path) => path.startsWith('/api/') || /\.pdf$/.test(path))).toBe(false);
  expect(publicKeys.some((path) => path.includes('pdf-runtime-'))).toBe(true);
  const before = await rows(page);
  expect(before).toHaveLength(1);
  expect(before[0]!.kind).toBe('poster');
  await page.goto('/saved');
  await expect(page.getByRole('link', { name: /架空のオフライン作品/ })).toBeVisible();
  const count = (await calls()).length;
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText('オフラインです。以前ログインした同じアカウントの保存資料だけを開けます。'),
  ).toBeVisible();
  await page.getByRole('link', { name: /架空のオフライン作品/ }).click();
  await expect(page.getByRole('button', { name: '次のページ' })).toBeEnabled();
  await page.getByRole('button', { name: '次のページ' }).click();
  await expect(page.getByText('2 / 2 ページ')).toBeVisible();
  await page.getByRole('button', { name: 'ダウンロード', exact: true }).click();
  await expect(page.getByRole('link', { name: 'PDFを端末に保存' })).toBeVisible();
  expect((await rows(page))[0]!.expiresAt).toBe(before[0]!.expiresAt);
  expect(await calls()).toHaveLength(count);
  const missing = new URL('/works/24000010?kind=report', page.url()).href;
  await page.goto(missing);
  await expect(page.getByRole('alert')).toContainText('未保存');
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'オフラインです' })).toBeVisible();
  expect(await calls()).toHaveLength(count);
});
test('オンライン再閲覧はHEADで再認可しGETを繰り返さず、更新版は置換', async ({ page, context }) => {
  const { calls, state } = await fixture(page, context);
  await save(page);
  const first = (await rows(page))[0]!;
  await page.evaluate(() => caches.delete('tankyu-pdf-assets-v1'));
  await page.goto('/saved');
  await page.goto('/works/24000010');
  await expect(page.getByText('この端末に3日間保存しました。', { exact: true })).toBeVisible();
  expect((await calls()).filter((c) => c === 'GET /api/works/24000010/pdf/poster')).toHaveLength(1);
  expect((await calls()).some((c) => c === 'HEAD /api/works/24000010/pdf/poster')).toBe(true);
  expect((await rows(page))[0]!.onlineViewedAt).toBeGreaterThanOrEqual(first.onlineViewedAt);
  expect(
    await page.evaluate(
      async () => (await (await caches.open('tankyu-pdf-assets-v1')).keys()).length,
    ),
  ).toBeGreaterThan(200);
  await state({ rev: 'b'.repeat(64) });
  await page.goto('/saved');
  await page.goto('/works/24000010');
  await expect(page.getByText('この端末に3日間保存しました。', { exact: true })).toBeVisible();
  const updated = await rows(page);
  expect(updated).toHaveLength(1);
  expect(updated[0]!.revision).toBe('b'.repeat(64));
});
test('72時間ちょうどで表示中のPDF・保存リンクを破棄する', async ({ page, context }) => {
  await fixture(page, context);
  await save(page);
  const entry = (await rows(page))[0]!;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '次のページ' })).toBeEnabled();
  await page.clock.install();
  await page.clock.setSystemTime(entry.expiresAt + 10);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await rows(page)).toHaveLength(0);
  await expect(page.getByRole('link', { name: 'PDFを端末に保存' })).toHaveCount(0);
});
test('失効403は保存を消し、503ではオフラインのふりで本文へ逃げない', async ({ page, context }) => {
  const { state } = await fixture(page, context);
  await save(page);
  await state({ status: 503 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '学校のアカウントでログイン' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await state({ status: 403 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '学校のアカウントでログイン' })).toBeVisible();
  await expect.poll(async () => (await rows(page)).length).toBe(0);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('canvas')).toHaveCount(0);
});
test('ログアウトは別タブの表示も閉じ、別UIDと初回オフラインは開けない', async ({
  page,
  context,
}) => {
  await fixture(page, context);
  await save(page);
  const other = await context.newPage();
  await other.goto('/works/24000010');
  await expect(other.getByRole('button', { name: '次のページ' })).toBeEnabled();
  await page.goto('/account');
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
  await expect(other.locator('canvas')).toHaveCount(0);
  expect(await rows(page)).toHaveLength(0);
  await context.setOffline(true);
  await other.reload();
  await expect(other.locator('canvas')).toHaveCount(0);
  await other.evaluate(() => {
    localStorage.setItem('offline-fixture-user', 'fixture-bob');
    window.dispatchEvent(new Event('offline-fixture-user'));
  });
  await expect(other.locator('canvas')).toHaveCount(0);
});
test('保存拒否でもオンライン表示を継続', async ({ page, context }) => {
  await context.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.name === 'files') throw new DOMException('fixture', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await fixture(page, context);
  await page.goto('/works/24000010');
  await expect(page.getByRole('button', { name: '次のページ' })).toBeEnabled();
  await expect(
    page.getByText('この端末に保存できませんでした。オンラインでは引き続き閲覧できます。'),
  ).toBeVisible();
  await page.getByRole('button', { name: '次のページ' }).click();
  await expect(page.getByText('2 / 2 ページ')).toBeVisible();
});
test('IndexedDBの期限境界・時計巻戻し・別UID・失効後の遅い保存を拒否', async ({
  page,
  context,
}) => {
  await fixture(page, context);
  const result = await page.evaluate(
    async ({ work, bytes, revision, sha }) => {
      const s = (
        window as unknown as { offlineFixtureStore: typeof import('../src/features/offline/store') }
      ).offlineFixtureStore;
      const perfDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
      Object.defineProperty(performance, 'now', { value: () => 0, configurable: true });
      const owner = await s.activateCache('fixture-alice'),
        now = Date.now(),
        oldNow = Date.now;
      Date.now = () => now;
      const data = {
        blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
        revision,
        sha256: sha,
        authorizedAt: new Date(now).toISOString(),
        receivedMono: performance.now(),
      };
      await s.saveViewed(
        owner,
        { version: '1', uid: owner.uid, role: 'student' },
        work as import('../src/contracts/discovery.generated').SearchWorkDto,
        'poster',
        data,
      );
      Date.now = () => now + s.TTL - 1;
      const before = (await s.listSaved(owner)).length;
      Date.now = () => now + s.TTL;
      const at = (await s.listSaved(owner)).length;
      Date.now = oldNow;
      await s.saveViewed(
        owner,
        { version: '1', uid: owner.uid, role: 'student' },
        work as import('../src/contracts/discovery.generated').SearchWorkDto,
        'poster',
        { ...data, receivedMono: performance.now() },
      );
      Date.now = () => now - 120000;
      const rolled = await s.resumeCache(owner.uid);
      Date.now = oldNow;
      await s.saveViewed(
        owner,
        { version: '1', uid: owner.uid, role: 'student' },
        work as import('../src/contracts/discovery.generated').SearchWorkDto,
        'poster',
        { ...data, receivedMono: performance.now() },
      );
      const other = await s.resumeCache('fixture-bob');
      await s.revokeCache();
      let staleRejected = false;
      try {
        await s.saveViewed(
          owner,
          { version: '1', uid: owner.uid, role: 'student' },
          work as import('../src/contracts/discovery.generated').SearchWorkDto,
          'poster',
          data,
        );
      } catch {
        staleRejected = true;
      }
      if (perfDescriptor) Object.defineProperty(performance, 'now', perfDescriptor);
      else delete (performance as unknown as { now?: unknown }).now;
      return { before, at, rolled, other, staleRejected };
    },
    { work, bytes: [...bytes], revision, sha },
  );
  expect(result).toEqual({ before: 1, at: 0, rolled: null, other: null, staleRejected: true });
});
test('100MiB上限・古い順の削除・期間削除・破損hashを拒否', async ({ page, context }) => {
  await fixture(page, context);
  const result = await page.evaluate(
    async ({ work, revision }) => {
      const s = (
        window as unknown as { offlineFixtureStore: typeof import('../src/features/offline/store') }
      ).offlineFixtureStore;
      const owner = await s.activateCache('fixture-alice'),
        session = { version: '1' as const, uid: owner.uid, role: 'student' as const };
      const bytes = new Uint8Array(3_000_000);
      bytes.set(new TextEncoder().encode('%PDF-'));
      const blob = new Blob([bytes], { type: 'application/pdf' }),
        sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      const now = Date.now();
      for (let n = 0; n < 36; n++)
        await s.saveViewed(
          owner,
          session,
          {
            ...work,
            documentID: String(24000010 + n),
          } as import('../src/contracts/discovery.generated').SearchWorkDto,
          'poster',
          {
            blob,
            revision,
            sha256,
            authorizedAt: new Date(now + n).toISOString(),
            receivedMono: performance.now(),
          },
        );
      const rows = await s.listSaved(owner),
        total = rows.reduce((n, r) => n + r.bytes, 0),
        oldest = rows.at(-1)!.id;
      await s.deleteSaved(owner, undefined, undefined, { from: now + 2, to: now + 4 });
      const remaining = (await s.listSaved(owner)).length;
      await s.saveViewed(
        owner,
        session,
        work as import('../src/contracts/discovery.generated').SearchWorkDto,
        'poster',
        {
          blob,
          revision,
          sha256: 'f'.repeat(64),
          authorizedAt: new Date(now + 40).toISOString(),
          receivedMono: performance.now(),
        },
      );
      const corrupted = await s.readSaved(owner, work.documentID, 'poster');
      return { count: rows.length, total, limit: s.LIMIT, oldest, remaining, corrupted };
    },
    { work, revision },
  );
  expect(result.count).toBe(34);
  expect(result.total).toBeLessThanOrEqual(result.limit);
  expect(result.oldest).toBe('24000012');
  expect(result.remaining).toBe(32);
  expect(result.corrupted).toBeNull();
});

for (const [name, width, height] of [
  ['スマホ', 390, 844],
  ['iPad', 820, 1180],
  ['PC', 1440, 1000],
] as const)
  test(`${name}: 保存一覧・容量・削除・横幅`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    await fixture(page, context);
    await save(page);
    await page.goto('/saved');
    await expect(page.getByRole('link', { name: /架空のオフライン作品/ })).toBeVisible();
    await expect(page.getByText(/1件 · .*MiB \/ 100MiB/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (name === 'iPad')
      await page.screenshot({ path: '/private/tmp/tankyu-t10-saved-ipad.png', fullPage: true });
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    await page.getByLabel('保存日の開始').fill(day);
    await page.getByLabel('保存日の終了').fill(day);
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '期間内の保存を削除' }).click();
    await expect(page.getByRole('link', { name: /架空のオフライン作品/ })).toHaveCount(0);
  });

test('一時的な容量エラーは一度だけ再試行し、利用者切替は保存を消す', async ({ page, context }) => {
  await context.addInitScript(() => {
    let once = true;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.name === 'files' && once) {
        once = false;
        throw new DOMException('fixture', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await fixture(page, context);
  await save(page);
  expect(await rows(page)).toHaveLength(1);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '次のページ' })).toBeEnabled();
  await page.evaluate(() => {
    localStorage.setItem('offline-fixture-user', 'fixture-bob');
    window.dispatchEvent(new Event('offline-fixture-user'));
  });
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await rows(page)).toHaveLength(0);
});

test('ブラウザを終了し同じプロファイルでオフライン再起動', async ({ playwright }, info) => {
  const { mkdtemp, rm } = await import('node:fs/promises'),
    { tmpdir } = await import('node:os'),
    { join } = await import('node:path');
  const profile = await mkdtemp(join(tmpdir(), 'tankyu-offline-profile-'));
  const engine = info.project.name === 'webkit' ? playwright.webkit : playwright.chromium;
  let browserContext = await engine.launchPersistentContext(profile, {
    headless: true,
    baseURL: 'http://127.0.0.1:4178',
  });
  try {
    let page = browserContext.pages()[0] ?? (await browserContext.newPage());
    await fixture(page, browserContext);
    await save(page);
    const expires = (await rows(page))[0]!.expiresAt;
    await browserContext.close();
    browserContext = await engine.launchPersistentContext(profile, {
      headless: true,
      baseURL: 'http://127.0.0.1:4178',
    });
    await browserContext.setOffline(true);
    page = browserContext.pages()[0] ?? (await browserContext.newPage());
    await page.goto('/works/24000010?kind=poster');
    await expect(page.getByRole('button', { name: '次のページ' })).toBeEnabled();
    expect((await rows(page))[0]!.expiresAt).toBe(expires);
  } finally {
    await browserContext.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('退会: Google再認証後に受付し、保存とログイン状態を破棄', async ({ page, context }) => {
  const f = await fixture(page, context);
  await save(page);
  await page.goto('/account');
  await page.getByText('アカウントを削除する', { exact: true }).click();
  await page.getByLabel('削除内容を確認しました').check();
  await page.getByRole('button', { name: 'Googleで本人確認して退会する' }).click();
  await expect(page).toHaveURL(/welcome/);
  await expect(
    page.getByRole('status').filter({ hasText: '退会手続きを受け付けました' }),
  ).toBeVisible();
  expect(await rows(page)).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem('offline-fixture-user'))).toBeNull();
  expect((await f.calls()).filter((x) => x === 'POST /api/account-deletion')).toHaveLength(1);
});
test('退会: 再認証中断では送信も保存削除もしない', async ({ page, context }) => {
  const f = await fixture(page, context);
  await save(page);
  await page.evaluate(() => localStorage.setItem('fixture-reauth-fail', '1'));
  await page.goto('/account');
  await page.getByText('アカウントを削除する', { exact: true }).click();
  await page.getByLabel('削除内容を確認しました').check();
  await page.getByRole('button', { name: 'Googleで本人確認して退会する' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect((await f.calls()).filter((x) => x === 'POST /api/account-deletion')).toHaveLength(0);
  expect(await rows(page)).toHaveLength(1);
});
test('退会: 受付後の応答不明は本人の受付を照会してログアウト', async ({ page, context }) => {
  const f = await fixture(page, context);
  await f.state({ deleteResponseFail: true });
  await page.goto('/account');
  await page.getByText('アカウントを削除する', { exact: true }).click();
  await page.getByLabel('削除内容を確認しました').check();
  await page.getByRole('button', { name: 'Googleで本人確認して退会する' }).click();
  await expect(page).toHaveURL(/welcome/);
  expect((await f.calls()).filter((x) => x === 'GET /api/account-deletion')).toHaveLength(1);
});

async function notificationFixture(page: Page, context: BrowserContext) {
  await context.addInitScript(() => {
    let permission = 'default';
    class FixtureNotification {
      static get permission() {
        return permission;
      }
      static requestPermission() {
        permission = 'granted';
        return Promise.resolve('granted');
      }
    }
    Object.defineProperty(ServiceWorkerRegistration.prototype, 'pushManager', {
      configurable: true,
      get: () => ({ getSubscription: async () => null }),
    });
    Object.defineProperty(ServiceWorkerRegistration.prototype, 'getNotifications', {
      configurable: true,
      value: async () => [],
    });
    Object.defineProperty(window, 'Notification', {
      value: FixtureNotification,
      configurable: true,
    });
    if (!('PushManager' in window))
      Object.defineProperty(window, 'PushManager', { value: class {} });
  });
  return fixture(page, context);
}
async function pushMessage(page: Page, type: string, data: unknown) {
  return page.evaluate(
    ({ type, data }) =>
      new Promise<{ shown: { title: string; options: { body: string } }[]; opened: string[] }>(
        (resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (e) => resolve(e.data);
          navigator.serviceWorker.controller!.postMessage({ type, data }, [channel.port2]);
        },
      ),
    { type, data },
  );
}
async function enableNotifications(page: Page) {
  await page.goto('/notifications');
  await page.getByRole('button', { name: '通知を受け取る', exact: true }).click();
  await expect(page.getByText('端末登録：有効', { exact: true })).toBeVisible();
}
async function binding(page: Page) {
  return page.evaluate(
    () =>
      new Promise<import('../src/features/offline/store').PushBinding | null>((resolve, reject) => {
        const r = indexedDB.open('tankyu-offline-v1', 1);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction('control', 'readonly'),
            q = tx.objectStore('control').get('owner');
          q.onsuccess = () => resolve(q.result?.push ?? null);
          tx.oncomplete = () => r.result.close();
        };
      }),
  );
}
test('通知: 単一SWを指定した登録・前景案内・内容表示と既読', async ({ page, context }) => {
  await notificationFixture(page, context);
  await enableNotifications(page);
  await page.waitForFunction(
    () => !!(window as unknown as { fixtureMessagingReady: boolean }).fixtureMessagingReady,
  );
  const b = await binding(page);
  await page.evaluate(
    (data) => window.dispatchEvent(new CustomEvent('fixture-fcm-message', { detail: { data } })),
    {
      type: 'archive-notice',
      noticeId: '11111111-1111-4111-8111-111111111111',
      binding: b!.binding,
    },
  );
  await expect(page.getByText('新しいお知らせがあります。', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'お知らせを確認', exact: true }).click();
  await expect(page.getByLabel('お知らせの内容')).toContainText('これは通知の試験です。');
  await expect(page.getByLabel('お知らせ一覧')).toContainText('既読');
});
test('通知: 背景では一般文のみ表示・タップ先は自サービスの固定URL', async ({ page, context }) => {
  await notificationFixture(page, context);
  await enableNotifications(page);
  const b = await binding(page),
    data = {
      type: 'archive-notice',
      noticeId: '11111111-1111-4111-8111-111111111111',
      binding: b!.binding,
      title: '漏れてはいけない作者名',
      url: 'https://evil.example',
    };
  const result = await pushMessage(page, 'FIXTURE_PUSH', data);
  expect(result.shown).toHaveLength(1);
  expect(result.shown[0]!.options.body).toBe(
    '新しいお知らせがあります。アプリで確認してください。',
  );
  expect(JSON.stringify(result.shown)).not.toContain('漏れてはいけない作者名');
  const click = await pushMessage(page, 'FIXTURE_CLICK', data);
  expect(click.opened.at(-1)).toBe(
    'http://127.0.0.1:4178/notifications?open=11111111-1111-4111-8111-111111111111',
  );
});
test('通知: 停止・再有効化・ログアウト後に古いPushを表示しない', async ({ page, context }) => {
  const f = await notificationFixture(page, context);
  await enableNotifications(page);
  const b = await binding(page),
    data = {
      type: 'archive-notice',
      noticeId: '11111111-1111-4111-8111-111111111111',
      binding: b!.binding,
    };
  await page.getByRole('button', { name: 'この端末の通知を停止', exact: true }).click();
  await expect(page.getByText('端末登録：なし', { exact: true })).toBeVisible();
  expect((await pushMessage(page, 'FIXTURE_PUSH', data)).shown).toHaveLength(0);
  await page.getByRole('button', { name: '通知を受け取る', exact: true }).click();
  await expect(page.getByText('端末登録：有効', { exact: true })).toBeVisible();
  expect((await binding(page))!.binding).not.toBe(b!.binding);
  await page.goto('/account');
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
  await expect(page).toHaveURL(/welcome/);
  expect((await pushMessage(page, 'FIXTURE_PUSH', data)).shown).toHaveLength(0);
  expect((await f.calls()).filter((x) => x === 'DELETE /api/push-subscriptions').length).toBe(2);
});
test('通知: 不一致binding・不正通知ID・解除後のクリックを拒否', async ({ page, context }) => {
  await notificationFixture(page, context);
  await enableNotifications(page);
  await page.waitForFunction(
    () => !!(window as unknown as { fixtureMessagingReady: boolean }).fixtureMessagingReady,
  );
  const b = await binding(page);
  for (const data of [
    { type: 'archive-notice', noticeId: '../evil', binding: b!.binding },
    { type: 'archive-notice', noticeId: '11111111-1111-4111-8111-111111111111', binding: 'wrong' },
  ])
    expect((await pushMessage(page, 'FIXTURE_PUSH', data)).shown).toHaveLength(0);
  await page.getByRole('button', { name: 'この端末の通知を停止', exact: true }).click();
  await expect(page.getByText('端末登録：なし', { exact: true })).toBeVisible();
  expect(
    (
      await pushMessage(page, 'FIXTURE_CLICK', {
        noticeId: '11111111-1111-4111-8111-111111111111',
        binding: b!.binding,
      })
    ).opened,
  ).toHaveLength(0);
});
