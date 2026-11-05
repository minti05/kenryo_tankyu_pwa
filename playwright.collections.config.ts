import { defineConfig } from '@playwright/test';
import library from './playwright.library.config';
export default defineConfig({
  ...library,
  testMatch: 'collections.spec.ts',
  outputDir: 'test-results-collections',
});
