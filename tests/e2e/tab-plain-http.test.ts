import { expect, test, type Page } from '@playwright/test';

// A self-hosted server is usually opened as http://<server>:3000, which the browser treats as not secure:
// APIs such as crypto.randomUUID are missing there, unlike on localhost. The browser reaches the test server
// under a made-up host name so the pages run the way they do at home. Nothing is saved.
test.describe.configure({ mode: 'serial' });
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP coffee-nerd.home 127.0.0.1'] } });

let page: Page;
const errors: string[] = [];

test.beforeAll(async ({ browser, baseURL }) => {
  const url = new URL(baseURL!);
  url.hostname = 'coffee-nerd.home';
  page = await browser.newPage({ baseURL: url.origin });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByLabel('Name').fill('Demo');
  await page.getByLabel('Password', { exact: true }).fill('coffee-nerd');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  expect(await page.evaluate(() => isSecureContext)).toBe(false);
});

test.afterAll(() => page.close());

test('NewStep: opens and takes list options on plain HTTP', async () => {
  errors.length = 0;
  await page.goto('/library/puck-prep');
  await page.getByRole('button', { name: 'New step' }).click();
  const sheet = page.getByRole('region', { name: 'New step' });
  await sheet.getByLabel('Name').fill('Paper filter');
  await sheet.getByRole('radio', { name: 'Pick from a list' }).click();
  await sheet.getByRole('button', { name: 'Add option' }).click();
  await expect(sheet.getByLabel('Option 3', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('CustomFeature: opens and adds the feature on plain HTTP', async () => {
  errors.length = 0;
  await page.goto('/library/gear');
  await page.getByRole('link', { name: /^Lelit Bianca/ }).click();
  await page.getByRole('button', { name: 'Add your own feature' }).click();
  const sheet = page.getByRole('region', { name: 'Add your own feature' });
  await sheet.getByLabel('Name').fill('Bloom');
  await sheet.getByRole('radio', { name: 'Seconds' }).click();
  await sheet.getByRole('button', { name: 'Add feature' }).click();
  await expect(sheet).toHaveCount(0);
  // Added to the machine page only; the page is left without pressing Save.
  await expect(page.getByRole('button', { name: 'Edit Bloom' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('on plain HTTP the app works online, without installing or a service worker', async () => {
  errors.length = 0;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  expect(await page.evaluate(() => 'serviceWorker' in navigator)).toBe(false);
  expect(errors).toEqual([]);
});
