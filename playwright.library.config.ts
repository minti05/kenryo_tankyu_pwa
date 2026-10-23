import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results-library',
  testMatch: 'library.spec.ts',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4179', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 4179 --strictPort',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
