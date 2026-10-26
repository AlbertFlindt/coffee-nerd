import Database from 'better-sqlite3';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// The shot form's draft (roadmap M10, D-226): what is being entered survives a reload and closing the
// app; Save and Back end it; another bean starts a new shot again. The shot saved here is deleted again.
test.describe.configure({ mode: 'serial' });

const DATABASE = 'test-results/e2e-seeded.db';

let context: BrowserContext;
let page: Page;

const grind = () => page.getByRole('button', { name: /^Grind, .*tap to type$/ }).innerText();
const time = () => page.getByRole('button', { name: /^Time, .*tap to type$/ }).innerText();
const drafts = () => page.evaluate(() => localStorage.getItem('coffee-nerd-drafts'));

async function newShot() {
  await page.goto('/shot/new');
  await expect(page.getByRole('button', { name: 'Save shot' })).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Name').fill('Demo');
  await page.getByLabel('Password').fill('coffee-nerd');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
});

test.afterAll(() => context.close());

let prefilled = '';

test('D-226: a new shot survives a reload and closing the app; Back ends it', async () => {
  await newShot();
  prefilled = await grind();
  await page.getByRole('button', { name: 'Grind plus 0.1' }).click();
  const entered = await grind();
  expect(entered).not.toBe(prefilled);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Save shot' })).toBeVisible();
  expect(await grind()).toBe(entered);
  // Closing the app and opening it again.
  await page.close();
  page = await context.newPage();
  await newShot();
  expect(await grind()).toBe(entered);
  await page.getByRole('link', { name: 'Back without saving' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await newShot();
  expect(await grind()).toBe(prefilled);
  expect(await drafts()).toBeNull();
});

test('D-226, D-94: another bean starts the new shot again, without the draft', async () => {
  // Kiambu AA is opened by the shot-* files before this one.
  await page.getByRole('button', { name: 'Grind plus 0.1' }).click();
  const chooseBean = async (name: string) => {
    await page
      .getByRole('button', { name: /choose another bean/ })
      .click({ position: { x: 22, y: 10 } });
    await page.getByRole('region', { name: 'Choose a bean' }).getByRole('button', { name }).click();
    await expect(
      page.getByRole('button', { name: new RegExp(`^${name}.*, choose another bean$`) })
    ).toBeVisible();
  };
  await chooseBean('Kiambu AA');
  await chooseBean('Guji Hambela');
  expect(await grind()).toBe(prefilled);
});

test('D-226: an edit survives a reload; Save ends it', async () => {
  const db = new Database(DATABASE, { readonly: true });
  const { id } = db.prepare('select id from shot order by brewed_at desc limit 1').get() as {
    id: string;
  };
  db.close();
  await page.goto(`/journal/${id}/edit`);
  const before = await time();
  await page.getByRole('button', { name: 'Time plus 1 second' }).click();
  const entered = await time();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Edit shot' })).toBeVisible();
  expect(await time()).toBe(entered);
  // The new shot's form is apart from it.
  await newShot();
  expect(await grind()).toBe(prefilled);
  await page.goto(`/journal/${id}/edit`);
  expect(await time()).toBe(entered);
  // Put back as it was, and saved: nothing is left over.
  await page.getByRole('button', { name: 'Time minus 1 second' }).click();
  expect(await time()).toBe(before);
  await page.getByRole('button', { name: 'Time plus 1 second' }).click();
  await page.getByRole('button', { name: 'Time minus 1 second' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Edit shot' })).toHaveCount(0);
  expect(await drafts()).toBeNull();
});

test('D-225, D-226: signing out leaves no draft on the phone', async () => {
  await newShot();
  await page.getByRole('button', { name: 'Grind plus 0.1' }).click();
  expect(await drafts()).not.toBeNull();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(await drafts()).toBeNull();
});
