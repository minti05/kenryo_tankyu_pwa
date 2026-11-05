import base from './playwright.discovery.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testMatch: 'daily-discovery.spec.ts',
  outputDir: '/private/tmp/tankyu-daily-discovery-tests',
});
