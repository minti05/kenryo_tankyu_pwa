import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'pwa-updates.spec.ts',
  outputDir: '/private/tmp/tankyu-pwa-update-tests',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:4179', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/pwa-update-test-server.mjs',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
