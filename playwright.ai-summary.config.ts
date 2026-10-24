import base from './playwright.pdf.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testMatch: 'ai-summary.spec.ts',
  outputDir: '/private/tmp/tankyu-pwa-ai-tests',
});
