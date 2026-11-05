import { test, expect } from '@playwright/test';
for (const guest of [false, true]) {
  test(`問い合わせは${guest ? 'ログイン前は空欄' : '登録メールを事前入力'}、通信失敗後の再送で重複しない`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const submitted: Record<string, string>[] = [];
    await page.route('**/api/contact', async (route) => {
      const data = route.request().postDataJSON();
      submitted.push(data);
      await route.fulfill(
        submitted.length === 1
          ? { status: 503, json: { error: { code: 'contact_unavailable' } } }
          : { json: { id: data.id, status: 'received' } },
      );
    });
    await page.goto('/tests/discovery-harness.html?entry=/contact' + (guest ? '&guest=1' : ''));
    const email = page.getByRole('textbox', { name: '連絡可能なメールアドレス' });
    await expect(email).toHaveValue(guest ? '' : 'fixture.alice@kenryo.ed.jp');
    await email.fill('reply@example.com');
    await page.getByRole('textbox', { name: '件名', exact: true }).fill('表示について');
    await page
      .getByRole('textbox', { name: '内容', exact: true })
      .fill('タブレットでの表示について確認をお願いします。\n追加の説明です。');
    if (!guest)
      await page.screenshot({
        path: `/private/tmp/contact-form-${test.info().project.name}.png`,
        fullPage: true,
      });
    await page.getByRole('button', { name: '送信する', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('送信できませんでした');
    await expect(email).toHaveValue('reply@example.com');
    await page.getByRole('button', { name: '送信する', exact: true }).click();
    await expect(page.getByRole('heading', { name: '送信しました', exact: true })).toBeVisible();
    expect(submitted).toHaveLength(2);
    expect(submitted[0]).toEqual(submitted[1]);
    expect(submitted[1].email).toBe('reply@example.com');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
for (const kind of ['privacy', 'terms']) {
  test(`ログイン不要の内部${kind}は本文・制作委員会・連絡先を表示`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tests/discovery-harness.html?guest=1&entry=/' + kind);
    await expect(page.locator('main h1')).toHaveText(
      kind === 'privacy' ? 'プライバシーポリシー' : '利用規約',
    );
    await expect(page.locator('main')).toContainText('探究アーカイブ制作委員会');
    await expect(page.locator('main')).toContainText('goto.aoi.516@gmail.com');
    await expect(page.locator('main')).not.toContainText('製作委員会');
    await expect(page.locator('main')).not.toContainText('kenryo.tankyu.app@gmail.com');
    await expect(page.locator('main h2')).toHaveCount(kind === 'privacy' ? 10 : 14);
    await page.getByRole('link', { name: 'お問い合わせフォーム' }).click();
    await expect(page).toHaveURL(/\/contact$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
