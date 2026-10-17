import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run at the reference viewport, Pixel 8a 412 × 915 (CLAUDE.md, D-36).
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  // One account per installation: the tests share it and run in order.
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    viewport: { width: 412, height: 915 }
  },
  webServer: {
    // A fresh database each run: the flow starts with the first-run account creation.
    command: 'rm -f test-results/e2e.db* && npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    env: { DATABASE_PATH: 'test-results/e2e.db' }
  }
});
