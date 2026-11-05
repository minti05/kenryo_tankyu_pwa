import { test, expect } from '@playwright/test';
for (const width of [390, 1440]) {
  test(`ナビ移動・押下・動きを減らす設定: ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.route('**/api/**', (route) =>
      route.fulfill({
        json: {
          version: '1',
          items: [],
          nextCursor: null,
          today: 0,
          week: 0,
          total: 0,
          serverTime: new Date().toISOString(),
        },
      }),
    );
    await page.goto('/tests/discovery-harness.html?entry=/home');
    const nav = page.getByRole('navigation', { name: 'メインナビゲーション' });
    const marker = nav.locator('.nav-active-indicator');
    const aligns = async () => {
      const a = await nav.locator('a.active').boundingBox(),
        b = await marker.boundingBox();
      return (
        !!a &&
        !!b &&
        Math.abs(a.x - b.x) < 2 &&
        Math.abs(a.y - b.y) < 2 &&
        Math.abs(a.width - b.width) < 2 &&
        Math.abs(a.height - b.height) < 2
      );
    };
    await expect.poll(aligns).toBe(true);
    const start = await marker.boundingBox();
    await nav.getByRole('link', { name: '探索', exact: true }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect.poll(aligns).toBe(true);
    const after = await marker.boundingBox();
    expect(width < 900 ? after!.x : after!.y).toBeGreaterThan(width < 900 ? start!.x : start!.y);
    await nav.getByRole('link', { name: 'ライブラリ', exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect.poll(aligns).toBe(true);
    // Changing screen orientation must not leave the highlight at its old location.
    await page.setViewportSize({ width: width < 900 ? 1440 : 390, height: 900 });
    await expect.poll(aligns).toBe(true);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/tests/discovery-harness.html?entry=/search');
    await page.getByRole('searchbox', { name: '作品をキーワードで検索' }).fill('水');
    const button = page.getByRole('button', { name: '検索する', exact: true });
    const box = await button.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await expect
      .poll(() => button.evaluate((el) => Number.parseFloat(getComputedStyle(el).scale)))
      .toBeLessThan(1);
    await page.mouse.up();
    await expect(page).toHaveURL(/\/results(?:\?|$)/);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page
      .getByRole('navigation', { name: 'メインナビゲーション' })
      .getByRole('link', { name: '探索', exact: true })
      .click();
    await expect.poll(aligns).toBe(true);
    expect(await marker.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe('none');
    expect(
      await page.evaluate(
        () => document.getAnimations().filter((a) => a.playState === 'running').length,
      ),
    ).toBe(0);
  });
}
