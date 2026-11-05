import base from './playwright.discovery.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testMatch: 'motion.spec.ts',
  outputDir: '/private/tmp/tankyu-motion-tests',
});
