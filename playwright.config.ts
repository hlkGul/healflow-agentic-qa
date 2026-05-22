import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/generated',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'https://www.modanisa.com',
    headless: !!process.env['CI'],
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    navigationTimeout: 15000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  reporter: [['html', { open: 'never' }]],
});
