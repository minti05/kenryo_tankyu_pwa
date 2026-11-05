import base from './playwright.discovery.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testMatch: 'contact.spec.ts',
  outputDir: '/private/tmp/tankyu-contact-tests',
});
