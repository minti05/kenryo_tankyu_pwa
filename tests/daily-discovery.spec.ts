import { test, expect } from '@playwright/test';
import { discoveryDay, nextDiscoveryDay } from '../src/pages/daily-discovery';
test('日付は日本時間の午前0時に切り替わる', () => {
  const now = Date.parse('2026-10-26T14:59:59Z');
  expect(discoveryDay(now)).toBe('2026-10-26');
  expect(nextDiscoveryDay(now)).toBe(Date.parse('2026-10-26T15:00:00Z'));
  expect(discoveryDay(nextDiscoveryDay(now))).toBe('2026-10-27');
});
test('ホームを開いたままでも日本時間の翌日におすすめを再取得する', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T14:59:58Z') });
  let calls = 0;
  await page.route('**/api/**', (route) => {
    if (new URL(route.request().url()).pathname === '/api/discovery') calls++;
    return route.fulfill({ json: { version: '1', items: [], nextCursor: null } });
  });
  await page.goto('/tests/discovery-harness.html?entry=/home');
  await expect(page.getByRole('heading', { name: '今日のおすすめ' })).toBeVisible();
  await expect.poll(() => calls).toBe(1);
  await page.clock.runFor(3000);
  await expect.poll(() => calls).toBe(2);
  await page.clock.runFor(60_000);
  expect(calls).toBe(2);
});
