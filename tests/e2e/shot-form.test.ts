import Database from 'better-sqlite3';
import { expect, test, type Locator, type Page } from '@playwright/test';

// The shot form on the reference seed (roadmap M3): Lelit Bianca, Timemore 064S, VST 18 g, Daily
// routine, one open bean. The steps run in order and build on each other's shots. Each designed state is
// saved to screenshots/ for comparing with docs/screens/.
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

async function expectNoPageScroll() {
  const overflow = await page.evaluate(() =>
    [document.documentElement, document.querySelector('.cn-root')!].map(
      (el) => el.scrollHeight - el.clientHeight
    )
  );
  expect(overflow).toEqual([0, 0]);
}

async function screenshot(name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `screenshots/${name}.png` });
}

const card = (label: string): Locator =>
  page.getByRole('region', { name: 'Core values' }).locator('.cn-value-card', { hasText: label });

async function typeValue(label: string, value: string) {
  await page.getByRole('button', { name: new RegExp(`^${label}, .*tap to type$`) }).click();
  await page.getByRole('textbox', { name: label }).fill(value);
  await page.getByRole('textbox', { name: label }).press('Enter');
}

async function setSlider(name: string, value: number, min: number, max: number) {
  const slider = page.getByRole('slider', { name });
  const box = (await slider.boundingBox())!;
  await page.mouse.click(box.x + ((value - min) / (max - min)) * box.width, box.y + box.height / 2);
}

const recipeTag = () => page.locator('.cn-tag');
const save = async () => {
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('status')).toContainText('Shot saved');
};

test('D-38, D-72, D-77, D-99: a bean’s first shot starts from My setup, with an empty time', async () => {
  await page.getByRole('link', { name: 'New shot' }).click();

  await expect(page.getByRole('heading', { name: 'New shot' })).toBeVisible();
  await expect(page.getByText('Guji Hambela · Natural')).toBeVisible();
  await expect(page.getByText('Lelit Bianca · Timemore 064S')).toBeVisible();
  // D-100: switched-on phases, then the temperature.
  await expect(page.getByText('Preinfusion 4 s · Low bar start 5 s · 93 °C')).toBeVisible();
  await expect(recipeTag()).toHaveText('New recipe');
  await expect(card('Grind')).toContainText('1.6');
  await expect(card('Dose')).toContainText('18.0 g');
  await expect(card('Yield')).toContainText('36.0 g');
  await expect(card('Time')).toContainText('— s');
  await expect(page.getByText('No earlier score')).toBeVisible();
  // D-11: taste starts empty.
  await expect(page.getByRole('slider', { name: 'Balance, sour to bitter' })).toHaveAttribute(
    'aria-valuetext',
    'Not set'
  );
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expectNoPageScroll();
});

test('D-91: the first shot is saved with an empty time; D-10: tap a score', async () => {
  await page.getByRole('radio', { name: '8' }).click();
  await expect(page.getByRole('radio', { name: '8' })).toHaveAttribute('aria-checked', 'true');
  await save();
});

test('D-03, D-16, D-12: the next shot copies the last one; its recipe is reused', async () => {
  await page.getByRole('link', { name: 'New shot' }).click();
  await expect(recipeTag()).toHaveText('Recipe reused 1x');
  await expect(page.getByText('Last with this recipe: 8')).toBeVisible();
  // D-80: + on an empty time counts from 0; then the time is typed (D-06).
  await card('Time').getByRole('button', { name: 'Time plus 1 second' }).click();
  await expect(card('Time')).toContainText('1.0 s');
  await typeValue('Time', '28');
  await expect(card('Time')).toContainText('28.0 s');
  // D-98: tapping the chosen score again clears it, so the shot stays not rated.
  await page.getByRole('radio', { name: '7' }).click();
  await page.getByRole('radio', { name: '7' }).click();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await save();
});

test('Main: a reused recipe with its earlier score', async () => {
  await page.getByRole('link', { name: 'New shot' }).click();
  await expect(recipeTag()).toHaveText('Recipe reused 2x');
  await expect(page.getByText('Last with this recipe: 8')).toBeVisible();
  await expect(page.getByRole('radio', { name: '8, last score with this recipe' })).toBeVisible();
  await expect(page.getByText('Ratio 1 : 2.0')).toBeVisible();
  await expect(page.locator('.cn-delta')).toHaveCount(0);
  await expectNoPageScroll();
  await screenshot('Main');
});

test('RecipeChanged, D-15, D-16: a finer grind is a new recipe, named, with deltas', async () => {
  await card('Grind').getByRole('button', { name: 'Grind minus 0.1' }).click();
  await typeValue('Time', '31');

  await expect(recipeTag()).toHaveText('New recipe · grind changed');
  await expect(card('Grind')).toContainText('1.5');
  await expect(card('Grind').locator('.cn-delta')).toHaveText('−0.1');
  await expect(card('Time').locator('.cn-delta')).toHaveText('+3.0');
  await expect(page.getByText('No earlier score')).toBeVisible();
  await expectNoPageScroll();
  await screenshot('RecipeChanged');
  await save();
});

test('M3 acceptance, D-16: going back to the first grind says "Recipe reused"', async () => {
  await page.getByRole('link', { name: 'New shot' }).click();
  await expect(card('Grind')).toContainText('1.5');
  await expect(recipeTag()).toHaveText('Recipe reused 1x');

  await card('Grind').getByRole('button', { name: 'Grind plus 0.1' }).click();
  await expect(recipeTag()).toHaveText('Recipe reused 2x');
  await expect(page.getByText('Last with this recipe: 8')).toBeVisible();
  await typeValue('Time', '28');
  await save();
});

test('Rated, D-15, D-96: changed results, a balance in words and a score', async () => {
  await page.getByRole('link', { name: 'New shot' }).click();
  await expect(recipeTag()).toHaveText('Recipe reused 3x');
  await typeValue('Yield', '38.5');
  await typeValue('Time', '25.5');
  await setSlider('Balance, sour to bitter', -3, -10, 10);
  await page.getByRole('radio', { name: '7' }).click();

  await expect(card('Yield').locator('.cn-delta')).toHaveText('+2.5');
  await expect(card('Time').locator('.cn-delta')).toHaveText('−2.5');
  await expect(card('Grind').locator('.cn-delta')).toHaveCount(0);
  await expect(page.getByText('Ratio 1 : 2.1')).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Balance, sour to bitter' })).toHaveAttribute(
    'aria-valuetext',
    'Slightly sour'
  );
  await expectNoPageScroll();
  await screenshot('Rated');
});

test('MoreSetup, D-21, D-24, D-90: the Setup tab; a changed value turns sage', async () => {
  await page.getByRole('button', { name: 'More' }).click();
  const sheet = page.getByRole('region', { name: 'More' });
  await expect(sheet.getByRole('tab', { name: 'Setup' })).toHaveAttribute('aria-selected', 'true');
  await expect(sheet.getByText('Pressure profile')).toBeVisible();
  await expect(sheet.getByRole('switch', { name: 'Low bar end' })).toHaveAttribute(
    'aria-checked',
    'false'
  );
  await expect(sheet.getByText('Daily routine')).toBeVisible();
  // D-21: Save stays visible and usable under the sheet.
  await expect(page.getByRole('button', { name: 'Save shot' })).toBeVisible();
  await expectNoPageScroll();
  await screenshot('MoreSetup');

  await sheet.getByRole('button', { name: 'Temperature plus 1 °C' }).click();
  await expect(sheet.locator('.cn-delta', { hasText: '+1' })).toBeVisible();
  await expect(recipeTag()).toHaveText('New recipe · temperature changed');
  await sheet.getByRole('button', { name: 'Temperature minus 1 °C' }).click();
  await expect(recipeTag()).toHaveText('Recipe reused 3x');

  await sheet.getByRole('switch', { name: 'Low bar end' }).click();
  await expect(sheet.locator('.cn-delta', { hasText: 'On' })).toBeVisible();
  await sheet.getByRole('switch', { name: 'Low bar end' }).click();
});

test('MoreTasting, D-23, D-96, D-97, D-101: the Tasting tab', async () => {
  const sheet = page.getByRole('region', { name: 'More' });
  await sheet.getByRole('tab', { name: 'Tasting' }).click();
  await expect(sheet.getByRole('slider', { name: 'Aftertaste, short to long' })).toHaveAttribute(
    'aria-valuetext',
    'Not set'
  );
  await setSlider('Body, light to heavy', 6, 0, 10);
  await setSlider('Sweetness, low to high', 8, 0, 10);
  await expect(sheet.getByRole('slider', { name: 'Body, light to heavy' })).toHaveAttribute(
    'aria-valuetext',
    'Medium-heavy'
  );
  await sheet.getByRole('button', { name: 'Berry' }).click();
  await sheet.getByRole('button', { name: 'Dark chocolate' }).click();
  await expect(sheet.getByRole('button', { name: 'Berry' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(sheet.getByText('Just for you · not used in Insights')).toBeVisible();
  await expectNoPageScroll();
  await screenshot('MoreTasting');

  await sheet.getByRole('button', { name: 'Add your own' }).click();
  await sheet.getByRole('textbox', { name: 'New flavor note' }).fill('Blood orange');
  await sheet.getByRole('textbox', { name: 'New flavor note' }).press('Enter');
  await expect(sheet.getByRole('button', { name: 'Blood orange' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  // D-98: a set slider can be cleared.
  await sheet.getByRole('button', { name: 'Clear sweetness' }).click();
  await expect(sheet.getByRole('slider', { name: 'Sweetness, low to high' })).toHaveAttribute(
    'aria-valuetext',
    'Not set'
  );

  // D-21: tapping the dimmed form closes the sheet.
  await page.getByRole('button', { name: 'Close More' }).click({ position: { x: 200, y: 40 } });
  await expect(sheet).toBeHidden();
  await save();

  const db = new Database(DATABASE, { readonly: true });
  const saved = db
    .prepare(
      `select s.score, s.balance, s.body, s.sweetness, s.yield, s.time,
         (select group_concat(t.name, ',') from shot_tag st join tag t on t.id = st.tag_id
          where st.shot_id = s.id) as tags
       from shot s order by s.brewed_at desc limit 1`
    )
    .get();
  db.close();
  expect(saved).toEqual({
    score: 7,
    balance: -3,
    body: 6,
    sweetness: null,
    yield: 38500,
    time: 25500,
    tags: expect.stringMatching(/^(?=.*Berry)(?=.*Dark chocolate)(?=.*Blood orange)/)
  });
});

test('BrewNext, D-43: a recipe marked Brew next is where "+" starts, until cleared', async () => {
  // The bean detail page that marks a recipe comes in M5; until then the test sets the mark directly.
  const db = new Database(DATABASE);
  db.prepare(
    `update app_state set brew_next_recipe_id = (select id from recipe where grind = 1500)`
  ).run();
  db.close();

  await page.getByRole('link', { name: 'New shot' }).click();
  await expect(page.getByText('Recipe chosen from Library')).toBeVisible();
  await expect(card('Grind')).toContainText('1.5');
  await expect(recipeTag()).toHaveText('Recipe reused 1x');
  await expectNoPageScroll();
  await screenshot('BrewNext');

  await page.getByRole('button', { name: 'Use last shot recipe' }).click();
  await expect(page.getByText('Recipe chosen from Library')).toBeHidden();
  await expect(card('Grind')).toContainText('1.6');
});

test('D-94: the bean card lists the open beans', async () => {
  await page.getByRole('button', { name: /choose another bean/ }).click();
  const sheet = page.getByRole('region', { name: 'Choose a bean' });
  await expect(sheet.getByRole('button', { name: /Guji Hambela/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page
    .getByRole('button', { name: 'Close bean list' })
    .click({ position: { x: 200, y: 40 } });
  await expect(sheet).toBeHidden();
});

test('D-40, D-95: a shot that uses up the bag finishes the bean, with Undo', async () => {
  const db = new Database(DATABASE);
  const used = db
    .prepare('select sum(r.dose) as d from shot s join recipe r on r.id = s.recipe_id')
    .get() as {
    d: number;
  };
  db.prepare('update bean set bag_weight = ?').run(used.d + 18000);
  db.close();

  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Guji Hambela is finished: its bag is used up.'
  );
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('status')).toContainText('Guji Hambela is open again.');
  await page.getByRole('link', { name: 'New shot' }).click();
  await expect(page.getByText('Guji Hambela · Natural')).toBeVisible();
});
