import Database from 'better-sqlite3';
import { expect, test, type Locator, type Page } from '@playwright/test';

// The shot form on the reference seed (roadmap M3): Lelit Bianca, Timemore 064S, VST · 18 g, Daily
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

/** Sheets slide in and out (D-108); measure once they are in place. */
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
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const sheet = page.getByRole('region', { name: 'More', exact: true });
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
  // At the reference size the whole Setup tab fits inside the sheet, down to puck prep.
  const prep = (await sheet.getByRole('button', { name: /Puck prep/ }).boundingBox())!;
  const sheetBox = (await sheet.boundingBox())!;
  expect(prep.y + prep.height).toBeLessThanOrEqual(sheetBox.y + sheetBox.height);
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
  const sheet = page.getByRole('region', { name: 'More', exact: true });
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
  // The mark is set with the recipe's button on the bean detail page (D-42).
  await page.goto('/library/beans');
  await page.locator('.card', { hasText: 'Guji Hambela' }).click();
  const row = page.locator('.recipe', { hasText: 'Grind 1.5' });
  await row.getByRole('button', { name: 'Brew this recipe next' }).click();
  await expect(row.getByRole('button', { name: 'Brewing next. Tap to undo' })).toBeVisible();
  await expect(row).toContainText('Next shot starts here');

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
  await page
    .getByRole('button', { name: /choose another bean/ })
    .click({ position: { x: 22, y: 10 } });
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

// D-36: the form adapts to a phone whose browser leaves less height than the reference, e.g. a Pixel 8a
// in Chrome with its address bar (about 412 × 780), and the More sheet still fits above Save.
test.describe('a shorter screen', () => {
  for (const height of [780, 700]) {
    test(`D-36, D-21: at 412 × ${height} nothing overlaps Save and the sheet fits`, async () => {
      await page.setViewportSize({ width: 412, height });
      await page.goto('/shot/new');
      const save = page.getByRole('button', { name: 'Save shot' });
      await expect(save).toBeVisible();
      await expectNoPageScroll();
      // Save is not covered by anything above it, and the form ends above the Save area.
      const covered = await save.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + 4);
        return top !== el && !el.contains(top);
      });
      expect(covered).toBe(false);
      await screenshot(`Main-${height}`);
      const formBottom = await page.locator('main').evaluate((el) => {
        const last = el.lastElementChild!.getBoundingClientRect();
        return last.bottom <= el.getBoundingClientRect().bottom + 0.5;
      });
      // At 780 the whole form fits; on a smaller screen it may scroll inside its own area instead.
      if (height >= 780) expect(formBottom).toBe(true);

      await page.getByRole('button', { name: 'More', exact: true }).click();
      const sheet = page.getByRole('region', { name: 'More', exact: true });
      await sheet.getByRole('tab', { name: 'Tasting' }).click();
      // D-97: at least a row of flavor chips stays in view.
      await expect(sheet.getByRole('button', { name: 'Berry' })).toBeInViewport();
      await screenshot(`MoreTasting-${height}`);
      const sheetBottom = (await sheet.boundingBox())!;
      const saveBox = (await save.boundingBox())!;
      expect(sheetBottom.y + sheetBottom.height).toBeLessThanOrEqual(saveBox.y);
      await page.getByRole('button', { name: 'Close More' }).click({ position: { x: 200, y: 20 } });
      await expect(sheet).toBeHidden();
    });
  }
});

test('D-106, D-107, D-108: empty sliders show a handle, buttons flash when pressed, the sheet drags closed', async () => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/shot/new');

  // D-106: an empty slider shows a hollow dashed handle in the middle.
  const balance = page.getByRole('slider', { name: 'Balance, sour to bitter' });
  await expect(balance.locator('.cn-slider-handle--empty')).toHaveCSS('border-top-style', 'dashed');

  // D-107: a −/+ button turns amber while it is held down.
  const plus = page.getByRole('button', { name: 'Dose plus 0.1 gram' });
  const box = (await plus.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(plus).toHaveCSS('background-color', 'rgb(231, 169, 85)');
  await page.mouse.up();
  await expect(plus).not.toHaveCSS('background-color', 'rgb(231, 169, 85)');

  // D-108: a short drag on the handle springs back; a longer one closes the sheet.
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const sheet = page.getByRole('region', { name: 'More', exact: true });
  await expect(sheet).toBeVisible();
  await settled();
  // Measure once the sheet has stopped moving: its top is the same in two frames in a row.
  await expect
    .poll(async () => {
      const before = (await sheet.boundingBox())!.y;
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
      return (await sheet.boundingBox())!.y === before;
    })
    .toBe(true);
  const grip = (await sheet.locator('.cn-sheet__grip').boundingBox())!;
  // The whole 44 px strip from the sheet's top edge can be dragged; the handle sits in its middle.
  const sheetBox = (await sheet.boundingBox())!;
  const handle = (await sheet.locator('.cn-sheet__handle').boundingBox())!;
  // Chromium lays out in 1/64 px; a fractional position can read 44 px as 43.99999.
  const layoutPx = (n: number) => Math.round(n * 64) / 64;
  expect(layoutPx(grip.height)).toBeGreaterThanOrEqual(44);
  expect(Math.abs(grip.y - sheetBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(handle.y + handle.height / 2 - (grip.y + grip.height / 2))).toBeLessThanOrEqual(
    1
  );
  const drag = async (distance: number) => {
    await page.mouse.move(grip.x + grip.width / 2, grip.y + 10);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + 10 + distance, { steps: 5 });
    await page.mouse.up();
  };
  await drag(30);
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveCSS('transform', 'none');
  await drag(200);
  await expect(sheet).toBeHidden();

  // D-107: an amber button presses in while held.
  const save = page.getByRole('button', { name: 'Save shot' });
  const saveBox = (await save.boundingBox())!;
  await page.mouse.move(saveBox.x + saveBox.width / 2, saveBox.y + saveBox.height / 2);
  await page.mouse.down();
  await expect(save).not.toHaveCSS('transform', 'none');
  await page.mouse.move(0, 0);
  await page.mouse.up();
});

test('D-108: the sheet slides; with reduced motion it just appears; saving with it open leaves one page', async () => {
  await page.goto('/shot/new');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  expect(
    await page.evaluate(() => document.querySelector('section.sheet')!.getAnimations().length)
  ).toBeGreaterThan(0);
  await expect(page.getByRole('region', { name: 'More', exact: true })).toBeVisible();

  // D-21: Save works with the sheet open, and the form leaves at once (no sheet sliding out over Home).
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('status')).toContainText('Shot saved');
  await expect(page.getByRole('heading', { name: 'New shot' })).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/shot/new');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.getByRole('region', { name: 'More', exact: true })).toBeVisible();
  const sheetMotion = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll('.layer, .layer > *')].flatMap((el) => el.getAnimations())
          .length
    );
  expect(await sheetMotion()).toBe(0);
  await page.getByRole('button', { name: 'Close More' }).click({ position: { x: 200, y: 20 } });
  await expect(page.getByRole('region', { name: 'More', exact: true })).toBeHidden();
  await page.emulateMedia({ reducedMotion: null });
});
