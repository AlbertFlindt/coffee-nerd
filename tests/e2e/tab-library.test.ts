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

test('AddBean, D-126, D-139: "Same as before" fills the form from an earlier bean', async () => {
  await page.getByRole('button', { name: /Same as before/ }).click();
  await page.getByRole('link', { name: /Guji Hambela/ }).click();
  await expect(page.getByText('Same as Guji Hambela')).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Beans', level: 1 })).toBeVisible();
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
