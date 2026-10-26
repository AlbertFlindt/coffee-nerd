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
  const d = new Database(DATABASE, { readonly: true });
  appState = d.prepare('select * from app_state').get() as Record<string, unknown>;
  // A shot saved here may use up a bag (D-95): the beans are put back as they were too.
  beans = d.prepare('select * from bean').all() as Record<string, unknown>[];
  d.close();
});

test.afterAll(async () => {
  await context.close();
  // The shot saved here is deleted again, with a recipe it alone used.
  if (!added) return;
  const d = new Database(DATABASE);
  d.prepare('delete from shot_tag where shot_id = ?').run(added);
  d.prepare('delete from shot where id = ?').run(added);
  d.prepare(
    'delete from recipe where id not in (select recipe_id from shot) and id not in (select brew_next_recipe_id from app_state where brew_next_recipe_id is not null)'
  ).run();
  const { user_id, ...rest } = appState;
  const columns = Object.keys(rest);
  d.prepare(
    `update app_state set ${columns.map((c) => `${c} = ?`).join(', ')} where user_id = ?`
  ).run(...columns.map((c) => rest[c]), user_id);
  for (const { id, ...bean } of beans) {
    const keys = Object.keys(bean);
    d.prepare(`update bean set ${keys.map((c) => `${c} = ?`).join(', ')} where id = ?`).run(
      ...keys.map((c) => bean[c]),
      id
    );
  }
  d.close();
});

let prefilled = '';
let added: string | null = null;
let appState: Record<string, unknown> = {};
let beans: Record<string, unknown>[] = [];
const newestId = () => {
  const d = new Database(DATABASE, { readonly: true });
  const { id } = d.prepare('select id from shot order by brewed_at desc limit 1').get() as {
    id: string;
  };
  d.close();
  return id;
};

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

test("D-226: the phone's back gesture ends the draft too", async () => {
  await page.goto('/');
  await page.getByRole('link', { name: 'New shot' }).click();
  await page.getByRole('button', { name: 'Grind plus 0.1' }).click();
  expect(await drafts()).not.toBeNull();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  expect(await drafts()).toBeNull();
  await newShot();
  expect(await grind()).toBe(prefilled);
});

test('D-226, D-94: another bean starts the new shot again, without the draft', async () => {
  // Kiambu AA is opened by the shot-* files before this one.
  await newShot();
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

test('D-226, D-61: a draft whose Save already reached the server is saved as a shot of its own', async () => {
  // The app closed after Save reached the server, before the draft ended: the draft has the id of a
  // shot the server has.
  const db = new Database(DATABASE, { readonly: true });
  const { id } = db.prepare('select id from shot order by brewed_at desc limit 1').get() as {
    id: string;
  };
  const count = () => {
    const d = new Database(DATABASE, { readonly: true });
    const { n } = d.prepare('select count(*) as n from shot').get() as { n: number };
    d.close();
    return n;
  };
  db.close();
  await newShot();
  await page.getByRole('button', { name: 'Grind plus 0.1' }).click();
  await page.evaluate((savedId) => {
    const stored = JSON.parse(localStorage.getItem('coffee-nerd-drafts')!);
    stored[0].shot.id = savedId;
    localStorage.setItem('coffee-nerd-drafts', JSON.stringify(stored));
  }, id);
  const before = count();
  await page.reload();
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  expect(count()).toBe(before + 1);
  added = newestId();
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
