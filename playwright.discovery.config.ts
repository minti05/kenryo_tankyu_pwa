import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results-discovery',
  testMatch: 'discovery.spec.ts',
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://127.0.0.1:4176', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 4176 --strictPort',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
