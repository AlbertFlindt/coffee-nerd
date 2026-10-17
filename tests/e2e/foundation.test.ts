import { expect, test, type Page } from '@playwright/test';

// One installation, one account (D-60): these steps run in order on a fresh database.
test.describe.configure({ mode: 'serial' });

const NAME = 'Albert';
const PASSWORD = 'espresso-at-dawn';

async function expectNoPageScroll(page: Page) {
  // The app shell clips overflow, so check both the document and the shell itself (D-36).
  const overflow = await page.evaluate(() =>
    [document.documentElement, document.querySelector('.cn-root')!].map(
      (el) => el.scrollHeight - el.clientHeight
    )
  );
  expect(overflow).toEqual([0, 0]);
}

test('D-59: /health reports the app and its database as ok, without signing in', async ({
  request
}) => {
  const response = await request.get('/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

test('D-88: on first run every page leads to creating the account', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expectNoPageScroll(page);
});

test('D-18, D-69: the app uses the design system and self-hosted Figtree, with no external requests', async ({
  page
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).host !== 'localhost:4173') external.push(r.url());
  });
  await page.goto('/welcome');

  await expect(page.locator('.cn-root')).toHaveCSS('font-family', /Figtree/);
  const loaded = await page.evaluate(
    async () => (await document.fonts.load('700 16px Figtree')).length
  );
  expect(loaded).toBeGreaterThan(0);
  expect(external).toEqual([]);
});

test('D-85: the two passwords must match', async ({ page }) => {
  await page.goto('/welcome');
  await page.getByLabel('Name').fill(NAME);
  await page.getByLabel('Password · at least 8 characters').fill(PASSWORD);
  await page.getByLabel('Password again').fill('something-else');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('alert')).toHaveText('The two passwords are not the same.');
  await expect(page.getByLabel('Name')).toHaveValue(NAME);
});

test('D-85, D-86: creating the account signs you in', async ({ page }) => {
  await page.goto('/welcome');
  await page.getByLabel('Name').fill(NAME);
  await page.getByLabel('Password · at least 8 characters').fill(PASSWORD);
  await page.getByLabel('Password again').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await expectNoPageScroll(page);
});

test('D-60: after first run, signed-out visits lead to sign-in, and /welcome is gone', async ({
  page
}) => {
  await page.goto('/welcome');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expectNoPageScroll(page);
});

test('D-85: a wrong password does not sign in', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Name').fill(NAME);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toHaveText('That name and password do not match.');
  await expect(page).toHaveURL(/\/login$/);
});

test('D-86: sign in, stay signed in, sign out', async ({ page, context }) => {
  await page.goto('/login');
  await page.getByLabel('Name').fill(NAME.toLowerCase());
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();

  const [cookie] = (await context.cookies()).filter((c) => c.name === 'session');
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.expires * 1000 - Date.now()).toBeGreaterThan(360 * 86_400_000);

  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
