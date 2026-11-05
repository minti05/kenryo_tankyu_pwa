import { test, expect, type Page } from '@playwright/test';
async function fixture(page: Page) {
  await page.route('**/src/features/auth/firebase.ts', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
    export const authConfigured=true;
    window.fixtureUid='fixture-alice';
    const auth={get currentUser(){const uid=window.fixtureUid;return uid?{uid,email:'fixture@kenryo.ed.jp',emailVerified:true,displayName:'Fixture',photoURL:null,providerData:[{providerId:'google.com'}],getIdToken:async()=>uid}:null}};
    export async function initializeAuth(){return {auth,provider:{},sdk:{onIdTokenChanged:(_,fn)=>{queueMicrotask(fn);window.addEventListener('fixture-refresh',fn);return()=>window.removeEventListener('fixture-refresh',fn)},signOut:async()=>{window.fixtureUid=null;window.dispatchEvent(new Event('fixture-refresh'))}}};}
  `,
    }),
  );
  let role = 'student',
    status = 200,
    sessions = 0,
    probes = 0;
  let hold: Promise<void> | undefined;
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/session') {
      sessions++;
      const uid = route.request().headers().authorization.replace('Bearer ', '');
      const gate = hold;
      if (gate) await gate;
      return route.fulfill({
        status,
        json:
          status === 200
            ? { version: '1', uid, role }
            : { error: { code: status === 403 ? 'app_suspended' : 'session_expired' } },
      });
    }
    probes++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('/tests/auth-refresh-harness.html');
  await expect(page.getByTestId('loaded')).toHaveText('loaded');
  return {
    sessions: () => sessions,
    probes: () => probes,
    role: (value: string) => {
      role = value;
    },
    status: (value: number) => {
      status = value;
    },
    hold: () => {
      let release!: () => void;
      hold = new Promise<void>((resolve) => {
        release = () => {
          hold = undefined;
          resolve();
        };
      });
      return release;
    },
  };
}
test('同じユーザー・権限の認証更新は読みかけと取得済みデータを保持する', async ({ page }) => {
  const f = await fixture(page);
  const mount = await page.getByTestId('mount').textContent();
  await page.getByLabel('読みかけのメモ').fill('読みかけ');
  const release = f.hold();
  await page.evaluate(() => window.dispatchEvent(new Event('fixture-refresh')));
  await expect.poll(f.sessions).toBe(2);
  await expect(page.getByLabel('読みかけのメモ')).toHaveValue('読みかけ');
  expect(f.probes()).toBe(1);
  release();
  await expect(page.getByTestId('mount')).toHaveText(mount!);
  await expect(page.getByLabel('読みかけのメモ')).toHaveValue('読みかけ');
  expect(f.probes()).toBe(1);
});
test('権限変更・アカウント変更では古い画面とキャッシュを保持しない', async ({ page }) => {
  const f = await fixture(page);
  const mount = await page.getByTestId('mount').textContent();
  await page.getByLabel('読みかけのメモ').fill('古い権限のメモ');
  f.role('teacher');
  await page.evaluate(() => window.dispatchEvent(new Event('fixture-refresh')));
  await expect(page.getByTestId('role')).toHaveText('teacher');
  await expect(page.getByTestId('mount')).not.toHaveText(mount!);
  await expect(page.getByLabel('読みかけのメモ')).toHaveValue('');
  await expect(page.getByTestId('loaded')).toHaveText('loaded');
  await page.evaluate(() => {
    Object.assign(window, { fixtureUid: 'fixture-bob' });
    window.dispatchEvent(new Event('fixture-refresh'));
  });
  await expect(page.getByTestId('uid')).toHaveText('fixture-bob');
  await expect(page.getByTestId('loaded')).toHaveText('loaded');
  await expect.poll(f.probes).toBeGreaterThanOrEqual(3);
});
test('更新時に利用停止が判明したら表示を消す', async ({ page }) => {
  const f = await fixture(page);
  f.status(403);
  await page.evaluate(() => window.dispatchEvent(new Event('fixture-refresh')));
  await expect(page.getByTestId('mount')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '学校のアカウントでログイン' })).toBeVisible();
});
