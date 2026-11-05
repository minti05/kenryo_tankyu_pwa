import { test, expect, type Page } from '@playwright/test';
const safari =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const safari26 = safari.replace('Version/18.6', 'Version/26.0');
const chromeIos = safari.replace('Version/18.6', 'CriOS/140.0.0.0');
const android =
  'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const desktop =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const macSafari =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
async function setup(
  page: Page,
  ua = desktop,
  options: {
    standalone?: boolean;
    blockStorage?: boolean;
    dismissedDays?: number;
    platform?: string;
    touch?: number;
  } = {},
) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(
    ({ ua, options }) => {
      Object.defineProperty(navigator, 'userAgent', { get: () => ua });
      if (options.platform)
        Object.defineProperty(navigator, 'platform', { get: () => options.platform });
      if (options.touch)
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => options.touch });
      if (options.standalone) Object.defineProperty(navigator, 'standalone', { get: () => true });
      if (options.dismissedDays !== undefined)
        localStorage.setItem(
          'archive-install-dismissed-at',
          String(Date.now() - options.dismissedDays * 86400000),
        );
      if (options.blockStorage) {
        Storage.prototype.getItem = () => {
          throw new Error('storage_disabled');
        };
        Storage.prototype.setItem = () => {
          throw new Error('storage_disabled');
        };
      }
    },
    { ua, options },
  );
  await page.route('**/api/**', (route) =>
    route.fulfill({ json: { version: '1', items: [], nextCursor: null } }),
  );
  await page.route('https://lh3.googleusercontent.com/**', (route) => route.abort());
}
async function account(page: Page, entry = '/account') {
  await page.goto('/tests/discovery-harness.html?strict=1&entry=' + encodeURIComponent(entry));
  await expect(page.getByRole('button', { name: 'アプリとしてインストール' })).toBeVisible();
}
async function nativePrompt(
  page: Page,
  outcome: 'accepted' | 'dismissed' | 'error' = 'accepted',
  installed = true,
) {
  return page.evaluate(
    ({ outcome, installed }) => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          document.body.dataset.promptCount = String(
            Number(document.body.dataset.promptCount || 0) + 1,
          );
          if (outcome === 'error') throw Error('prompt_failed');
          if (outcome === 'accepted' && installed) window.dispatchEvent(new Event('appinstalled'));
        },
        userChoice: Promise.resolve({ outcome }),
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { outcome, installed },
  );
}
const dialog = (page: Page) => page.getByRole('dialog', { name: 'アプリとしてインストール' });
const invitation = (page: Page) =>
  page.getByRole('complementary', { name: 'ホーム画面への追加案内' });

for (const [name, ua, copy] of [
  ['iPhone Safari', safari, 'Safariの「共有」をタップ'],
  ['iOS 26 Safari', safari26, 'Safariの「共有」をタップ（画面下部の「…」メニュー内）'],
  ['iPhone Chrome', chromeIos, 'Chromeのアドレスバーにある「共有」をタップ'],
  ['Android Chrome', android, '「アプリをインストール」または「ホーム画面に追加」を選ぶ'],
  ['Mac Safari', macSafari, 'Safariの「ファイル」メニューを開く'],
  [
    '未対応ブラウザ',
    desktop.replace('Chrome/140.0.0.0', 'Firefox/140.0'),
    'ブラウザのメニュー（⋮ または …）を開く',
  ],
]) {
  test(`${name}: 設定から環境に応じた手順を表示`, async ({ page }) => {
    await setup(page, ua);
    await account(page);
    const button = page.getByRole('button', { name: 'アプリとしてインストール' });
    await button.click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByText(copy, { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(button).toBeFocused();
  });
}

test('iPadOSのデスクトップUAでも共有メニューを案内する', async ({ page }) => {
  await setup(page, macSafari, { platform: 'MacIntel', touch: 5 });
  await account(page);
  await page.getByRole('button', { name: 'アプリとしてインストール' }).click();
  await expect(dialog(page).getByText('Safariの「共有」をタップ', { exact: true })).toBeVisible();
  await expect(dialog(page)).not.toHaveClass(/install-guide--iphone/);
});

const startButton = (page: Page) => page.getByRole('button', { name: '探究アーカイブをはじめる' });
const choice = (page: Page) => page.getByRole('dialog', { name: '使い方を選んでください' });
async function welcome(page: Page, extra = '') {
  await page.goto('/tests/discovery-harness.html?strict=1&guest=1&entry=/welcome' + extra);
  await expect(startButton(page)).toBeVisible();
}
async function chooseApp(page: Page) {
  await startButton(page).click();
  await choice(page).getByRole('button', { name: 'アプリとして使う' }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(choice(page)).toHaveCount(0);
}

for (const [name, ua, copy] of [
  ['iPhone Safari', safari, 'Safariの「共有」をタップ'],
  ['iPhone Chrome', chromeIos, 'Chromeのアドレスバーにある「共有」をタップ'],
  ['Android Chrome', android, '「アプリをインストール」または「ホーム画面に追加」を選ぶ'],
]) {
  test(`${name}: ログイン前にアプリの追加手順を開き、選択に戻れる`, async ({ page }) => {
    await setup(page, ua);
    await welcome(page);
    await expect(
      page.getByRole('button', { name: '学校のGoogleアカウントでログイン' }),
    ).toHaveCount(0);
    await chooseApp(page);
    await expect(dialog(page).getByText(copy, { exact: true })).toBeVisible();
    await expect(
      dialog(page).getByText(
        '追加したら、アプリを開いて、学校のGoogleアカウントでログインしてください。',
      ),
    ).toBeVisible();
    expect(await page.locator('body').getAttribute('data-login-count')).toBeNull();
    await dialog(page).getByRole('button', { name: '使い方の選択に戻る', exact: true }).click();
    await expect(choice(page)).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
    expect(await page.locator('body').evaluate((el) => el.style.overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(choice(page)).toHaveCount(0);
    await expect(startButton(page)).toBeFocused();
    expect(await page.locator('body').evaluate((el) => el.style.overflow)).not.toBe('hidden');
  });
}

test('ブラウザでログインを選んだクリックから認証を開始する', async ({ page }) => {
  await setup(page, safari);
  await welcome(page);
  await startButton(page).click();
  await expect(choice(page).getByRole('button')).toHaveCount(3);
  expect(await page.locator('body').getAttribute('data-login-count')).toBeNull();
  await choice(page).getByRole('button', { name: 'ブラウザでログイン' }).click();
  await expect(choice(page)).toHaveCount(0);
  expect(await page.locator('body').getAttribute('data-login-count')).toBe('1');
});

test('standalone起動では使い方の選択を省き、直接ログインする', async ({ page }) => {
  await setup(page, safari, { standalone: true });
  await page.goto('/tests/discovery-harness.html?guest=1&entry=/welcome');
  await expect(startButton(page)).toHaveCount(0);
  await page.getByRole('button', { name: '学校のGoogleアカウントでログイン' }).click();
  expect(await page.locator('body').getAttribute('data-login-count')).toBe('1');
  await expect(choice(page)).toHaveCount(0);
  await expect(dialog(page)).toHaveCount(0);
});

test('ログイン済みのアプリはwelcomeを飛ばしてホームへ進む', async ({ page }) => {
  await setup(page, safari, { standalone: true });
  await page.goto('/tests/discovery-harness.html?entry=/welcome');
  await expect(page).toHaveURL(/\/home$/);
  await expect(startButton(page)).toHaveCount(0);
});

test('ブラウザログインを選んでも戻り先URLを維持する', async ({ page }) => {
  await setup(page);
  const entry = '/welcome?next=' + encodeURIComponent('/works/24000010?from=/library');
  await page.goto('/tests/discovery-harness.html?guest=1&entry=' + encodeURIComponent(entry));
  await startButton(page).click();
  await choice(page).getByRole('button', { name: 'ブラウザでログイン' }).click();
  expect(new URL(page.url()).searchParams.get('next')).toBe('/works/24000010?from=/library');
  await page.goto('/tests/discovery-harness.html?entry=' + encodeURIComponent(entry));
  await expect(page).toHaveURL(/\/works\/24000010\?from=\/library$/);
});

test('認証の接続設定がなくてもインストール案内は利用できる', async ({ page }) => {
  await setup(page, safari);
  await welcome(page, '&unconfigured=1');
  await startButton(page).click();
  await expect(choice(page).getByRole('button', { name: 'ブラウザでログイン' })).toBeDisabled();
  await choice(page).getByRole('button', { name: 'アプリとして使う' }).click();
  await expect(dialog(page)).toBeVisible();
});

for (const installed of [true, false]) {
  test(`Android: インストール受付後はアイコンからの起動を案内し、ブラウザで自動ログインしない（完了通知${installed}）`, async ({
    page,
  }) => {
    await setup(page, android);
    await welcome(page);
    expect(await nativePrompt(page, 'accepted', installed)).toBe(true);
    await chooseApp(page);
    await page.getByRole('button', { name: 'インストールする', exact: true }).click();
    await expect(dialog(page).getByRole('status')).toContainText(
      'ホーム画面やアプリ一覧の「探究アーカイブ」から開いてください。',
    );
    expect(await page.locator('body').getAttribute('data-login-count')).toBeNull();
    expect(await page.locator('body').getAttribute('data-prompt-count')).toBe('1');
    await dialog(page).getByRole('button', { name: '使い方の選択に戻る', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(startButton(page)).toBeVisible();
  });
}

for (const outcome of ['dismissed', 'error'] as const) {
  test(`Chromeの${outcome}: イベントを再利用せず、次のイベントで再試行できる`, async ({ page }) => {
    await setup(page);
    await account(page);
    await nativePrompt(page, outcome);
    await page.getByRole('button', { name: 'アプリとしてインストール' }).click();
    await page.getByRole('button', { name: 'インストールする', exact: true }).click();
    await expect(dialog(page).getByRole('status')).toContainText(
      outcome === 'error' ? '開けませんでした' : '見送りました',
    );
    await expect(page.getByRole('button', { name: 'インストールする', exact: true })).toHaveCount(
      0,
    );
    await nativePrompt(page);
    await page.getByRole('button', { name: 'インストールする', exact: true }).click();
    await expect(dialog(page).getByRole('status')).toContainText('インストールを受け付けました');
    expect(await page.locator('body').getAttribute('data-prompt-count')).toBe('2');
  });
}

test('インストール完了をアプリとして実行中とは区別する', async ({ page }) => {
  await setup(page, android);
  await account(page);
  await nativePrompt(page);
  await page.getByRole('button', { name: 'アプリとしてインストール' }).click();
  await page.getByRole('button', { name: 'インストールする', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'アプリとしてインストール' })).toBeVisible();
  await expect(page.getByText('アプリとして利用中', { exact: true })).toHaveCount(0);
});

test('standaloneの設定では案内を表示しない', async ({ page }) => {
  await setup(page, safari, { standalone: true });
  await page.goto('/tests/discovery-harness.html?entry=/account');
  await expect(page.getByRole('region', { name: 'アプリのインストール' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'アプリとしてインストール' })).toHaveCount(0);
});

test('保存領域が無効でもログイン前の案内を開ける', async ({ page }) => {
  await setup(page, safari, { blockStorage: true });
  await welcome(page);
  await chooseApp(page);
  await expect(dialog(page)).toBeVisible();
});

for (const entry of ['/account', '/home', '/explore', '/library', '/welcome']) {
  test(`${entry}: 時間経過やインストール可能通知で自動案内を出さない`, async ({ page }) => {
    await setup(page, safari);
    await page.clock.install();
    await page.goto(
      '/tests/discovery-harness.html?entry=' + entry + (entry === '/welcome' ? '&guest=1' : ''),
    );
    if (entry === '/welcome') await expect(startButton(page)).toBeVisible();
    else await expect(page.getByRole('navigation', { name: 'メインナビゲーション' })).toBeVisible();
    await nativePrompt(page);
    await page.clock.fastForward(60000);
    await expect(invitation(page)).toHaveCount(0);
    await expect(dialog(page)).toHaveCount(0);
    await expect(choice(page)).toHaveCount(0);
  });
}

for (const width of [320, 390, 1280]) {
  test(`${width}px: welcomeからの選択とインストール案内が画面に収まる`, async ({
    page,
  }, testInfo) => {
    await setup(page, safari);
    await page.setViewportSize({ width, height: 740 });
    await welcome(page);
    await startButton(page).click();
    await expect(choice(page)).toBeVisible();
    let box = await choice(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath('welcome-choice.png'),
      animations: 'disabled',
    });
    await choice(page).getByRole('button', { name: 'アプリとして使う' }).click();
    box = await dialog(page).boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(740);
    await page.screenshot({
      path: testInfo.outputPath('welcome-install.png'),
      animations: 'disabled',
    });
  });
}

test('選択画面に学校アカウントの案内を別の行に表示する', async ({ page }) => {
  await setup(page, safari);
  await welcome(page);
  await expect(page.getByText('アプリでも、ブラウザでも使えます。', { exact: true })).toHaveCount(
    0,
  );
  await startButton(page).click();
  const option = choice(page).getByRole('button', { name: 'ブラウザでログイン' });
  await expect(option.getByText('インストールせずに使えます', { exact: true })).toBeVisible();
  const school = option.getByText('縣陵のアカウント（@kenryo.ed.jp）でログインしてください', {
    exact: true,
  });
  await expect(school).toBeVisible();
  const first = await option.getByText('インストールせずに使えます', { exact: true }).boundingBox();
  const second = await school.boundingBox();
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
});

test('手動追加では最初に3つの手順を表示し、その後にログインを案内する', async ({ page }) => {
  await setup(page, safari);
  await welcome(page);
  await chooseApp(page);
  await expect(dialog(page).locator('.work-modal-body > :first-child')).toHaveClass(
    'install-steps',
  );
  await expect(dialog(page).getByRole('listitem')).toHaveCount(3);
  await expect(dialog(page).locator('.install-share-hint')).toHaveCount(0);
  const order = await dialog(page).evaluate((element) => {
    const steps = element.querySelector('ol')!;
    const note = element.querySelector('.install-launch-note')!;
    return !!(steps.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  const help = dialog(page).getByText(
    '共有ボタンの位置は表示設定によって異なります。見つからないときは「…」メニューを開いてください。',
    { exact: true },
  );
  await expect(help).not.toBeVisible();
  await dialog(page).getByText('追加できないとき', { exact: true }).click();
  await expect(help).toBeVisible();
});

test('ブラウザのアカウント設定ではインストールを一番上に表示する', async ({ page }) => {
  await setup(page, safari);
  await account(page);
  const firstGroup = page.locator('.settings-page > section').first();
  await expect(firstGroup).toHaveAttribute('aria-label', 'アプリのインストール');
  await expect(
    firstGroup.getByText('ホーム画面から、探究アーカイブを起動', { exact: true }),
  ).toBeVisible();
  await expect(firstGroup.locator('.setting-copy > span')).toHaveText('アプリとしてインストール');
  await expect(firstGroup.locator('.setting-copy > small')).toHaveText(
    'ホーム画面から、探究アーカイブを起動',
  );
  await firstGroup.getByRole('button').click();
  await expect(dialog(page)).toBeVisible();
});
