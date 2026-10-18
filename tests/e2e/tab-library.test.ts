import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { bestRecipe } from '../../src/lib/domain/best-recipe';

// The Library tab (roadmap M5) on the shots logged by shot-form.test.ts and shot-journal.test.ts, which run
// first (files run in name order, one worker). Each designed screen is saved to screenshots/ for comparing
// with docs/screens/.
test.describe.configure({ mode: 'serial' });

const DATABASE = 'test-results/e2e-seeded.db';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto('/login');
  await page.getByLabel('Name').fill('Demo');
  await page.getByLabel('Password').fill('coffee-nerd');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
});

test.afterAll(() => page.close());

const settled = () =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));

async function expectNoPageScroll() {
  await settled();
  const overflow = await page.evaluate(() =>
    [document.documentElement, document.querySelector('.cn-root')!].map(
      (el) => el.scrollHeight - el.clientHeight
    )
  );
  expect(overflow).toEqual([0, 0]);
}

async function screenshot(name: string) {
  await page.evaluate(() => document.fonts.ready);
  await settled();
  await page.screenshot({ path: `screenshots/${name}.png` });
}

test('Beans, D-124: the Library tab opens the Beans overview', async () => {
  const bar = page.getByRole('navigation', { name: 'Main' });
  await bar.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Beans', level: 1 })).toBeVisible();
  await expect(bar.getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Back to Library' })).toHaveCount(0);

  // D-37: open beans as cards with their roast age, origin and numbers (D-132); shot-form.test.ts added
  // a second open bean.
  const cards = page.getByRole('main').locator('.card');
  await expect(page.getByRole('heading', { name: `Open · ${await cards.count()}` })).toBeVisible();
  const card = cards.filter({ hasText: 'Guji Hambela' });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('days');
  await expect(card).toContainText('since roast');
  await expect(card).toContainText('Nordlys Roasters · Ethiopia · Natural');
  // D-132, D-135: dots between the numbers, then grams left (shot-form.test.ts gives the bean a bag weight).
  await expect(card.locator('.numbers')).toHaveText(
    /^(Best \d+(\.\d)?|Not rated yet)\s*·\s*Recipes \d+\s*·\s*Shots \d+(\s*·\s*\d+ g left)?\s*$/
  );
  await expect(page.getByRole('heading', { name: /Finished/ })).toHaveCount(0);
  await expectNoPageScroll();
  await screenshot('Beans');
});

test('AddBean, D-41: name and roast date are required', async () => {
  await page.getByRole('link', { name: 'Add bean' }).click();
  await expect(page.getByRole('heading', { name: 'Add bean', level: 1 })).toBeVisible();
  await expect(page.getByText('Not set')).toHaveCount(2); // country and roast date (D-138)
  await page.getByRole('button', { name: 'Add bean' }).click();
  await expect(page.getByRole('alert')).toHaveText(['Name is required', 'Roast date is required']);
  await expectNoPageScroll();
});

test('AddBean, D-141: tapping the chosen process or roast level again clears it', async () => {
  const washed = page.getByRole('button', { name: 'Washed' });
  await washed.click();
  await expect(washed).toHaveAttribute('aria-pressed', 'true');
  await washed.click();
  await expect(washed).toHaveAttribute('aria-pressed', 'false');
  const dark = page.getByRole('radio', { name: 'Dark' });
  await dark.click();
  await expect(dark).toHaveAttribute('aria-checked', 'true');
  await dark.click();
  await expect(dark).toHaveAttribute('aria-checked', 'false');
});

test('AddBean, D-133: Country opens a sheet with a search', async () => {
  await page.getByRole('button', { name: /Country, not set/ }).click();
  await page.getByLabel('Search').fill('ken');
  await page.getByRole('button', { name: 'Kenya' }).click();
  await expect(page.getByRole('button', { name: /Country, Kenya/ })).toBeVisible();
});

test('AddBean, D-126, D-139: "Same as before" fills the form from an earlier bean', async () => {
  await page.getByRole('button', { name: /Same as before/ }).click();
  await page.getByRole('button', { name: /Guji Hambela/ }).click();
  await expect(page.getByText('Same as Guji Hambela')).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Guji Hambela');
  // D-139: the × undoes the choice, then it is picked again.
  await page.getByRole('link', { name: 'Not a re-buy' }).click();
  await expect(page.getByText('Same as before')).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('');
  await page.getByRole('button', { name: /Same as before/ }).click();
  await page.getByRole('button', { name: /Guji Hambela/ }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Guji Hambela');
  await expect(page.getByLabel('Roaster')).toHaveValue('Nordlys Roasters');
  await expect(page.getByRole('button', { name: /Country, Ethiopia/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Natural' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  // Roast date and bag weight are new (D-41).
  await expect(page.getByLabel('Bag weight')).toHaveValue('');
  const twoDaysAgo = await page.evaluate(() => {
    const d = new Date(Date.now() - 2 * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.locator('input[name=roastDate]').fill(twoDaysAgo);
  await expect(page.getByText('2 days ago')).toBeVisible();
  await expectNoPageScroll();
  await screenshot('AddBean');
});

test('D-73, D-140: the re-buy is added, and its first shot starts from the earlier bag’s best recipe', async () => {
  await page.getByRole('button', { name: 'Add bean' }).click();
  // D-140: the new bean's page opens; it has no shots yet (D-131).
  await expect(page.getByRole('heading', { name: 'Guji Hambela', level: 1 })).toBeVisible();
  await expect(page.getByText('No shots yet')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Numbers' })).toContainText('Not rated yet');
  await page.getByRole('link', { name: 'Back to Beans' }).click();
  await expect(page.getByRole('main').locator('.card', { hasText: 'Guji Hambela' })).toHaveCount(2);

  // The earlier bag's best recipe (D-66), worked out from the test database.
  const db = new Database(DATABASE, { readonly: true });
  const earlier = db
    .prepare("select id from bean where name = 'Guji Hambela' order by created_at limit 1")
    .get() as { id: string };
  const shots = db
    .prepare(
      'select r.id as recipeId, r.grind, s.time, s.score, s.brewed_at as brewedAt from shot s join recipe r on r.id = s.recipe_id where r.bean_id = ?'
    )
    .all(earlier.id) as {
    recipeId: string;
    grind: number;
    score: number | null;
    brewedAt: number;
  }[];
  db.close();
  const recipeIds = [...new Set(shots.map((s) => s.recipeId))];
  const best = bestRecipe(
    recipeIds.map((recipeId) => ({ recipeId, shots: shots.filter((s) => s.recipeId === recipeId) }))
  )!;
  const ofBest = shots
    .filter((s) => s.recipeId === best.recipeId)
    .sort((a, b) => b.brewedAt - a.brewedAt);
  const { grind, time } = ofBest[0];
  expect(time).not.toBeNull(); // From My setup the time would be empty (D-72), so this tells them apart.

  await page.getByRole('link', { name: 'New shot' }).click();
  await page.getByRole('button', { name: /choose another bean/ }).click();
  // The newest bean comes first (D-137): the re-buy.
  await page.locator('.bean', { hasText: 'Guji Hambela' }).first().click();
  await expect(
    page
      .getByRole('region', { name: 'Core values' })
      .locator('.cn-value-card', { hasText: 'Grind' })
  ).toContainText((grind / 1000).toFixed(1));
  // D-73: yield and time from that recipe's latest shot.
  await expect(
    page.getByRole('region', { name: 'Core values' }).locator('.cn-value-card', { hasText: 'Time' })
  ).toContainText((time! / 1000).toFixed(1));
  await page.goBack();
});

test('D-130: Edit bean is the form filled in, without "Same as before"', async () => {
  const db = new Database(DATABASE, { readonly: true });
  const latest = db
    .prepare("select id from bean where name = 'Guji Hambela' order by created_at desc limit 1")
    .get() as { id: string };
  db.close();
  await page.goto(`/library/beans/${latest.id}/edit`);
  await expect(page.getByRole('heading', { name: 'Edit bean', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Same as before/ })).toHaveCount(0);
  await expect(page.getByLabel('Name')).toHaveValue('Guji Hambela');
  await expect(page.getByText('2 days ago')).toBeVisible();
  await page.getByLabel('Bag weight').fill('1,000');
  await page.getByRole('button', { name: 'Save changes' }).click();
  // D-130: back to the bean's page.
  await expect(page.getByRole('heading', { name: 'Guji Hambela', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Beans' }).click();
  // D-142: "1,000" is a thousand grams (shown without a separator, like other quantities).
  await expect(page.getByRole('main').locator('.card', { hasText: '1000 g left' })).toHaveCount(1);
});

const earliestGuji = () => page.locator('.card', { hasText: 'Guji Hambela' }).last();

test('BeanDetail, D-42: about, numbers and recipes best first', async () => {
  await earliestGuji().click();
  await expect(page.getByRole('heading', { name: 'Guji Hambela', level: 1 })).toBeVisible();
  const about = page.getByRole('region', { name: 'About this bean' });
  await expect(about).toContainText('since roast');
  await expect(about).toContainText('Nordlys Roasters');
  await expect(about).toContainText('Ethiopia · Guji · Natural');
  await expect(about).toContainText(/Roasted \d+ \w+ · Open/);
  await expect(page.getByText('Best first')).toBeVisible();
  const recipes = page.locator('.recipe');
  expect(await recipes.count()).toBeGreaterThan(1);
  await expect(recipes.first().locator('.title')).toHaveText(/^Grind \S+ · /);
  await expect(page.getByRole('button', { name: 'Mark as finished' })).toBeVisible();
  await expectNoPageScroll();
});

test('D-43: Brew next marks one recipe; tapping again clears it', async () => {
  const first = page.locator('.recipe').first();
  await first.getByRole('button', { name: 'Brew this recipe next' }).click();
  await expect(first).toContainText('Next shot starts here');
  await expectNoPageScroll();
  await screenshot('BeanDetail');
  await first.getByRole('button', { name: 'Brewing next. Tap to undo' }).click();
  await expect(first).not.toContainText('Next shot starts here');
});

test('D-125: a recipe opens the Journal filtered to it', async () => {
  const title = (await page.locator('.recipe .title').first().innerText()).trim();
  await page.locator('.recipe-open').first().click();
  await expect(page.getByRole('heading', { name: 'Journal', level: 1 })).toBeVisible();
  expect(page.url()).toMatch(/bean=.+&recipe=.+/);
  const grind = title.match(/^Grind (\S+)/)![1];
  for (const row of await page.getByRole('main').getByRole('link').all())
    await expect(row).toContainText(grind);
  await page.goBack();
});

test('D-40, D-127: finish by hand, Undo, finish again and Reopen', async () => {
  await page.getByRole('button', { name: 'Mark as finished' }).click();
  await expect(page.getByRole('status')).toContainText('Guji Hambela is finished');
  await expect(page.getByRole('region', { name: 'About this bean' })).toContainText('Finished');
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Mark as finished' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'About this bean' })).toContainText('Open');

  await page.getByRole('button', { name: 'Mark as finished' }).click();
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  await page.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByRole('button', { name: 'Mark as finished' })).toBeVisible();
});

test('D-129: Brew next on a finished bean reopens it', async () => {
  await page.getByRole('button', { name: 'Mark as finished' }).click();
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  const first = page.locator('.recipe').first();
  await first.getByRole('button', { name: 'Brew this recipe next' }).click();
  await expect(page.getByRole('status')).toContainText('Guji Hambela is open again');
  await expect(page.getByRole('button', { name: 'Mark as finished' })).toBeVisible();
  await expect(first).toContainText('Next shot starts here');
  // Leave no mark behind.
  await first.getByRole('button', { name: 'Brewing next. Tap to undo' }).click();
});
