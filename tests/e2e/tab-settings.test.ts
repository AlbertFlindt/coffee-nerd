import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// Settings (roadmap M11, D-248): the dose, yield and time steps (D-249), the backup (D-251) and the
// exports (D-252). Each test leaves the steps as it found them. The page is saved to screenshots/.
test.describe.configure({ mode: 'serial' });

const DATABASE = 'test-results/e2e-seeded.db';
const NOTHING_CHANGED = 'You are offline. This needs a connection, so nothing was changed.';

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Name').fill('Demo');
  await page.getByLabel('Password').fill('coffee-nerd');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
});

test.afterAll(() => context.close());

const settled = () =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));

function count(table: string): number {
  const db = new Database(DATABASE, { readonly: true });
  try {
    return (db.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n;
  } finally {
    db.close();
  }
}

const steps = (name: string) => page.getByRole('radiogroup', { name });

test('Settings, D-248: steps, your data, Sign out and the version, on one screen', async () => {
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Steps', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your data', level: 2 })).toBeVisible();
  // D-89: 0.1 g, 0.1 g and 1 s until changed.
  await expect(steps('Dose').getByRole('radio', { checked: true })).toHaveText('0.1 g');
  await expect(steps('Yield').getByRole('radio', { checked: true })).toHaveText('0.1 g');
  await expect(steps('Time').getByRole('radio', { checked: true })).toHaveText('1 s');
  for (const name of ['Download backup', 'Export shots', 'Export everything', 'Sign out'])
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(page.getByText(/^Version /)).toBeVisible();
  await settled();
  const overflow = await page.evaluate(() =>
    [document.documentElement, document.querySelector('.cn-root')!].map(
      (el) => el.scrollHeight - el.clientHeight
    )
  );
  expect(overflow).toEqual([0, 0]);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'screenshots/Settings.png' });
});

test('D-249: a step tapped in Settings is saved at once and used by the shot form', async () => {
  await steps('Dose').getByRole('radio', { name: '0.5 g', exact: true }).click();
  await expect(steps('Dose').getByRole('radio', { name: '0.5 g', exact: true })).toBeChecked();
  await steps('Time').getByRole('radio', { name: '0.1 s', exact: true }).click();
  await expect(steps('Time').getByRole('radio', { name: '0.1 s', exact: true })).toBeChecked();
  await page.goto('/shot/new');
  await expect(page.getByRole('button', { name: /^Dose plus 0\.5 gram/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Time plus 0\.1 second/ })).toBeVisible();
  await page.goto('/library/gear/setup');
  await expect(page.getByRole('button', { name: /^Dose plus 0\.5 gram/ })).toBeVisible();

  await page.goto('/settings');
  await steps('Dose').getByRole('radio', { name: '0.1 g', exact: true }).click();
  await expect(steps('Dose').getByRole('radio', { name: '0.1 g', exact: true })).toBeChecked();
  await steps('Time').getByRole('radio', { name: '1 s', exact: true }).click();
  await expect(steps('Time').getByRole('radio', { name: '1 s', exact: true })).toBeChecked();
});

test('D-251: "Download backup" saves a copy of the database without sign-ins', async () => {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^Download backup/ }).click()
  ]);
  expect(file.suggestedFilename()).toMatch(/^coffee-nerd-backup-\d{4}-\d{2}-\d{2}\.db$/);
  const backup = new Database(await file.path(), { readonly: true });
  try {
    expect(backup.prepare('select count(*) as n from shot').get()).toEqual({ n: count('shot') });
    expect(backup.prepare('select count(*) as n from session').get()).toEqual({ n: 0 });
  } finally {
    backup.close();
  }
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
});

test('D-252: "Export shots" saves a CSV file with one row per shot', async () => {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^Export shots/ }).click()
  ]);
  expect(file.suggestedFilename()).toMatch(/^coffee-nerd-shots-\d{4}-\d{2}-\d{2}\.csv$/);
  const lines = readFileSync(await file.path(), 'utf8').split('\r\n');
  expect(lines[0]).toMatch(/^\uFEFFDate,Time of day,Bean,/);
  expect(lines).toHaveLength(count('shot') + 2);
});

test('D-252: "Export everything" saves all the account holds as JSON', async () => {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^Export everything/ }).click()
  ]);
  expect(file.suggestedFilename()).toMatch(/^coffee-nerd-everything-\d{4}-\d{2}-\d{2}\.json$/);
  const all = JSON.parse(readFileSync(await file.path(), 'utf8'));
  expect(all.shots).toHaveLength(count('shot'));
  expect(all.gear).toHaveLength(count('gear'));
  expect(all.account).toEqual({ name: 'Demo' });
});

test('D-219, D-248: offline, the steps and the downloads need a connection and change nothing', async () => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await context.setOffline(true);
  const line = page.getByRole('status').filter({ hasText: /offline/i });
  await steps('Dose').getByRole('radio', { name: '1 g', exact: true }).click();
  await expect(line).toHaveText(NOTHING_CHANGED);
  await expect(steps('Dose').getByRole('radio', { name: '0.1 g', exact: true })).toBeChecked();
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await page.getByRole('button', { name: /^Download backup/ }).click();
  await expect(line).toHaveText(NOTHING_CHANGED);
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  expect(downloaded).toBe(false);
  await context.setOffline(false);
});
