import base from './playwright.discovery.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testMatch: 'pwa-install.spec.ts',
  outputDir: 'test-results-install',
});
