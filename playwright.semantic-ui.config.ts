import base from './playwright.discovery.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testMatch: 'semantic-ui.spec.ts',
  outputDir: 'test-results-semantic',
});
