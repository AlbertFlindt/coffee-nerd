import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run at the reference viewport, Pixel 8a 412 × 915 (CLAUDE.md).
// Three installations: "first-run" starts empty to test creating the account; "seeded" starts from
// the reference seed (npm run db:seed) for the screens, which use seeded data only; "insights" adds the
// seeded shot history (npm run db:seed -- --history) for Insights.
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  // One account per installation: the tests share it and run in order.
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Pixel 7'],
    viewport: { width: 412, height: 915 }
  },
  projects: [
    {
      name: 'first-run',
      testMatch: 'foundation.test.ts',
      use: { baseURL: 'http://localhost:4173' }
    },
    {
      name: 'seeded',
      // Files run in name order and build on each other's data: shot-*, then tab-*.
      testMatch: ['shot-*.test.ts', 'tab-*.test.ts'],
      // The reference PNGs in docs/screens/ are 2× pixel density; the tests save comparable screenshots.
      use: { baseURL: 'http://localhost:4174', deviceScaleFactor: 2 }
    },
    {
      name: 'insights',
      testMatch: 'insights.test.ts',
      use: { baseURL: 'http://localhost:4175', deviceScaleFactor: 2 }
    }
  ],
  // The real production server (adapter-node), not vite preview: it is what the Docker image runs.
  // Servers start in order, so the first one builds the app for both.
  webServer: [
    {
      command: 'rm -f test-results/e2e.db* && npm run build && node build',
      port: 4173,
      reuseExistingServer: !process.env.CI,
      env: { DATABASE_PATH: 'test-results/e2e.db', PORT: '4173' }
    },
    {
      command: 'rm -f test-results/e2e-seeded.db* && npm run db:seed && node build',
      port: 4174,
      reuseExistingServer: !process.env.CI,
      env: { DATABASE_PATH: 'test-results/e2e-seeded.db', PORT: '4174' }
    },
    {
      command: 'rm -f test-results/e2e-insights.db* && npm run db:seed -- --history && node build',
      port: 4175,
      reuseExistingServer: !process.env.CI,
      env: { DATABASE_PATH: 'test-results/e2e-insights.db', PORT: '4175' }
    }
  ]
});
