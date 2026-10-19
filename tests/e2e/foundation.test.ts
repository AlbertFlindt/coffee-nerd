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

  // D-157: the step-by-step start begins with the machine.
  await expect(page).toHaveURL(/\/library\/gear\/new\?kind=machine&guide=1$/);
  await expect(page.getByRole('heading', { name: 'Add machine', level: 1 })).toBeVisible();
  await expect(page.getByText('Step 1 of 5')).toBeVisible();
  await expectNoPageScroll(page);
  await page.screenshot({ path: 'screenshots/GuideMachine.png' });
});

test('D-157: step by step from the machine to a ready shot form; leaving halfway resumes', async ({
  page
}) => {
  await page.goto('/login');
  await page.getByLabel('Name').fill(NAME);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();

  // "+" resumes at the first missing step.
  await page.goto('/shot/new');
  await expect(page.getByText('Step 1 of 5')).toBeVisible();
  // A problem keeps you on the step.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('alert')).toHaveText('Name is required');
  await expect(page.getByText('Step 1 of 5')).toBeVisible();
  await page.getByLabel('Name').fill('Gaggia Classic');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Add grinder', level: 1 })).toBeVisible();
  await expect(page.getByText('Step 2 of 5')).toBeVisible();
  // Screen 37: the Gear page before My setup exists, without Default chips (D-149).
  await page.goto('/library/gear');
  await expect(page.getByRole('region', { name: 'My setup' })).toContainText('Not set up yet');
  await expect(page.getByText('Default', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'screenshots/GearFirstRun.png' });
  await page.goto('/shot/new');
  await expect(page.getByText('Step 2 of 5')).toBeVisible();
  await page.getByLabel('Name').fill('Comandante C40');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Add basket', level: 1 })).toBeVisible();
  await expect(page.getByText('Step 3 of 5')).toBeVisible();
  await expectNoPageScroll(page);
  await page.screenshot({ path: 'screenshots/GuideBasket.png' });
  // Leaving halfway is fine: "+" comes back to the basket.
  await page.getByRole('link', { name: 'Leave for now' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await page.goto('/shot/new');
  await expect(page.getByText('Step 3 of 5')).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();

  await expect(page.getByRole('heading', { name: 'My setup', level: 1 })).toBeVisible();
  await expect(page.getByText('Step 4 of 5 · Starting point for new beans')).toBeVisible();
  // Nothing was chosen yet: your only machine and grinder are (D-157).
  await expect(page.getByRole('button', { name: 'Machine, Gaggia Classic' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grinder, Comandante C40' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Basket, No basket' })).toBeVisible();
  for (const [label, value] of [
    ['Dose', '18'],
    ['Yield', '36'],
    ['Grind', '2.5'],
    ['Temperature', '93']
  ]) {
    await page.getByRole('button', { name: new RegExp(`^${label}, .*tap to type$`) }).click();
    await page.getByRole('textbox', { name: label }).fill(value);
    await page.getByRole('textbox', { name: label }).press('Enter');
  }
  await page.getByRole('button', { name: /^Pressure profile/ }).click();
  // D-78: flat pressure waits for a value; from empty each tap adds one step of 0.5 bar.
  for (let i = 0; i < 18; i++)
    await page.getByRole('button', { name: 'Flat plus 0.5 bar' }).click();
  await expect(page.getByRole('region', { name: 'Pressure profile' })).toContainText('9.0');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Pressure profile' })).toHaveCount(0);
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await expectNoPageScroll(page);
  await page.screenshot({ path: 'screenshots/GuideSetup.png' });
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Add bean', level: 1 })).toBeVisible();
  await expect(page.getByText('Step 5 of 5')).toBeVisible();
  await page.getByLabel('Name').fill('Guji Hambela');
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.locator('input[name=roastDate]').fill(today);
  await page.getByRole('button', { name: 'Next' }).click();

  // The shot form opens ready, from My setup.
  await expect(page).toHaveURL(/\/shot\/new$/);
  await expect(
    page.getByRole('button', { name: /^Guji Hambela, choose another bean$/ })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Dose, 18\.0 g,/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Grind, 2\.5,/ })).toBeVisible();

  // The first shot saves, and "+" now opens the shot form.
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('status')).toContainText('Shot saved');
  await page.goto('/shot/new');
  await expect(page.getByRole('button', { name: 'Save shot' })).toBeVisible();
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
