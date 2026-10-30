import { expect, test, type Page } from '@playwright/test';

// Library › Puck prep on the reference seed: the Daily routine and its four steps. A step
// added here is deleted again, so the reference setup stays as it was.
test.describe.configure({ mode: 'serial' });

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

test('PuckPrep: routines with their flow, "In use", and your steps', async () => {
  await page.goto('/library');
  await page.getByRole('link', { name: /^Puck prep/ }).click();
  await expect(page.getByRole('heading', { name: 'Puck prep', level: 1 })).toBeVisible();
  const daily = page.getByRole('link', { name: /^Daily routine/ });
  await expect(daily).toContainText('In use');
  await expect(
    daily.getByLabel('WDT, then Distributor, then Tamp, then Puck screen')
  ).toBeVisible();
  await expect(daily).toContainText(/\d+ shots · average score \d\.\d/);
  await expect(page.getByRole('button', { name: 'WDT · seconds' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tamp · kg' })).toBeVisible();
  await expectNoPageScroll();
  await screenshot('PuckPrep');
});

test('NewStep: a new step with a number setting', async () => {
  await page.getByRole('button', { name: 'New step' }).click();
  const sheet = page.getByRole('region', { name: 'New step' });
  await sheet.getByLabel('Name').fill('RDT');
  await sheet.getByRole('radio', { name: 'Number with unit' }).click();
  await sheet.getByLabel('Unit').fill('sprays');
  await sheet.getByLabel('Starts at').fill('2');
  // Range opens the number keypad.
  await expect(sheet.getByLabel('Range')).toHaveAttribute('inputmode', 'decimal');
  await expect(sheet.getByRole('region', { name: 'Preview' })).toContainText('RDT');
  await expect(sheet.getByRole('region', { name: 'Preview' })).toContainText('2 sprays');
  await expectNoPageScroll();
  await screenshot('NewStep');
  await sheet.getByRole('button', { name: 'Add step' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'RDT · sprays' })).toBeVisible();
});

test('a list step starts on the option whose circle is tapped (screen 52)', async () => {
  await page.getByRole('button', { name: 'New step' }).click();
  const sheet = page.getByRole('region', { name: 'New step' });
  await sheet.getByLabel('Name').fill('Paper filter');
  await sheet.getByRole('radio', { name: 'Pick from a list' }).click();
  await sheet.getByLabel('Option 1', { exact: true }).fill('Bottom');
  await sheet.getByLabel('Option 2', { exact: true }).fill('Top');
  await expect(sheet.getByText('Tap the circle of the option it starts on')).toBeVisible();
  await sheet.getByRole('button', { name: 'Add option' }).click();
  await sheet.getByLabel('Option 3', { exact: true }).fill('Both');
  await sheet.getByRole('button', { name: 'Add step' }).click();
  await expect(sheet).toHaveCount(0);

  // Edit mode: titled with its name, "Save step" and, unused, a quiet "Delete step".
  await page.getByRole('button', { name: 'Paper filter', exact: true }).click();
  const edit = page.getByRole('region', { name: 'Edit Paper filter' });
  await expect(edit.getByRole('radio', { name: 'Starts at Bottom' })).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await screenshot('StepEdit');
  await edit.getByRole('button', { name: 'Delete step' }).click();
  await expect(page.getByRole('button', { name: 'Paper filter', exact: true })).toHaveCount(0);
});

test('a step can be renamed, and deleted while no shot used it', async () => {
  await page.getByRole('button', { name: 'RDT · sprays' }).click();
  const sheet = page.getByRole('region', { name: 'Edit RDT' });
  await sheet.getByLabel('Name').fill('Spritz');
  await sheet.getByRole('button', { name: 'Save step' }).click();
  await expect(page.getByRole('button', { name: 'Spritz · sprays' })).toBeVisible();

  await page.getByRole('button', { name: 'Spritz · sprays' }).click();
  await page
    .getByRole('region', { name: 'Edit Spritz' })
    .getByRole('button', { name: 'Delete step' })
    .click();
  await expect(page.getByRole('button', { name: /^Spritz/ })).toHaveCount(0);
});

test('a step in a routine stays', async () => {
  await page.getByRole('button', { name: 'Tamp · kg' }).click();
  const sheet = page.getByRole('region', { name: 'Edit Tamp' });
  await expect(sheet).toContainText('Used in Daily routine');
  await expect(sheet.getByRole('button', { name: /Delete step|Archive step/ })).toHaveCount(0);
  // Screen 53: Tamp has been used by shots, so its kind and unit only show.
  await expect(sheet).toContainText('Number with unit · kg');
  await expect(sheet.getByLabel('Unit')).toHaveCount(0);
  await expect(sheet.getByRole('radiogroup', { name: 'Setting' })).toHaveCount(0);
  await expectNoPageScroll();
  // A range the routine's 15 kg falls outside is refused, naming the routine.
  await sheet.getByLabel('Starts at').fill('5');
  await sheet.getByLabel('Range').fill('0–10');
  await sheet.getByRole('button', { name: 'Save step' }).click();
  await expect(sheet.getByRole('status')).toHaveText(
    'Daily routine uses 15 kg, outside this range'
  );
  await screenshot('StepUsed');
  await page
    .getByRole('button', { name: 'Close without saving' })
    .click({ position: { x: 200, y: 20 } });
  await expect(sheet).toHaveCount(0);
});

test('RoutineBuilder: a routine opens in the builder; My setup’s stays', async () => {
  await page.getByRole('link', { name: /^Daily routine/ }).click();
  await expect(page.getByRole('heading', { name: 'Routine', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Daily routine');
  const flow = page.getByRole('list', { name: 'Steps, top to bottom' });
  await expect(flow).toContainText('Dose in basket');
  await expect(
    page.getByRole('button', { name: /^WDT setting, \d+ s\. Tap to change$/ })
  ).toBeVisible();
  await expect(page.getByText('Used in My setup · choose another default first')).toBeVisible();
  await expectNoPageScroll();
  await screenshot('RoutineBuilder');
  await page.getByRole('link', { name: 'Close without saving' }).click();
  await expect(page.getByRole('heading', { name: 'Puck prep', level: 1 })).toBeVisible();
});

test('build a routine, set a value, reorder, and add a new step on the way', async () => {
  await page.getByRole('link', { name: 'New routine' }).click();
  // A name and a step are needed.
  await page.getByRole('button', { name: 'Save routine' }).click();
  await expect(page.getByRole('alert')).toHaveText(['Name is required', 'Add a step first']);
  await page.getByLabel('Name').fill('Light roast');
  await page.getByRole('button', { name: 'Insert a step after Dose in basket' }).click();
  await page
    .getByRole('region', { name: 'Insert a step' })
    .getByRole('button', { name: /^WDT/ })
    .click();
  await page.getByRole('button', { name: 'Insert a step after WDT' }).click();
  await page
    .getByRole('region', { name: 'Insert a step' })
    .getByRole('button', { name: /^Tamp/ })
    .click();

  // The value sheet.
  await page.getByRole('button', { name: /^WDT setting, 20 s/ }).click();
  const value = page.getByRole('region', { name: 'WDT setting' });
  await screenshot('RoutineValue');
  await value.getByRole('button', { name: 'WDT plus 1 second' }).click();
  await value.getByRole('button', { name: 'WDT plus 1 second' }).click();
  await value.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /^WDT setting, 22 s/ })).toBeVisible();

  // Reorder by dragging the handle, and with the arrow keys on it.
  const order = () =>
    page
      .getByRole('button', { name: /^Drag to move/ })
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const from = (await page.getByRole('button', { name: 'Drag to move Tamp' }).boundingBox())!;
  const to = (await page.getByRole('button', { name: 'Drag to move WDT' }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 10, { steps: 8 });
  await page.mouse.up();
  expect(await order()).toEqual(['Drag to move Tamp', 'Drag to move WDT']);
  await page.getByRole('button', { name: 'Drag to move Tamp' }).focus();
  await page.keyboard.press('ArrowDown');
  expect(await order()).toEqual(['Drag to move WDT', 'Drag to move Tamp']);
  await page.keyboard.press('ArrowUp');
  expect(await order()).toEqual(['Drag to move Tamp', 'Drag to move WDT']);

  // "New step" from the insert sheet goes in where + was tapped.
  await page.getByRole('button', { name: 'Insert a step after WDT' }).click();
  await screenshot('RoutineInsert');
  await page
    .getByRole('region', { name: 'Insert a step' })
    .getByRole('button', { name: 'New step' })
    .click();
  const sheet = page.getByRole('region', { name: 'New step' });
  await sheet.getByLabel('Name').fill('Paper filter');
  await sheet.getByRole('radio', { name: 'No setting' }).click();
  await sheet.getByRole('button', { name: 'Add step' }).click();
  await expect(page.getByRole('button', { name: 'Drag to move Paper filter' })).toBeVisible();

  await page.getByRole('button', { name: 'Save routine' }).click();
  await expect(page.getByRole('heading', { name: 'Puck prep', level: 1 })).toBeVisible();
  // A new routine asks to be used for new shots; "Not now" keeps My setup's routine.
  const ask = page.getByRole('region', { name: 'Use it for new shots' });
  await expect(ask.getByRole('heading', { name: 'Use it for new shots?' })).toBeVisible();
  await expect(ask).toContainText('Light roast becomes My setup’s routine');
  await screenshot('RoutineAsk');
  await ask.getByRole('button', { name: 'Not now' }).click();
  await expect(ask).toBeHidden();
  await expect(page).toHaveURL(/\/library\/puck-prep$/);
  await expect(
    page.getByRole('link', { name: /^Light roast/ }).getByLabel('Tamp, then WDT, then Paper filter')
  ).toBeVisible();
  // Screen 50: a routine no shot used says so.
  await expect(page.getByRole('link', { name: /^Light roast/ })).toContainText('No shots yet');
  await screenshot('PuckPrepNew');
});

test('a routine no shot used offers Delete', async () => {
  await page.getByRole('link', { name: /^Light roast/ }).click();
  await expect(page.getByRole('button', { name: 'Delete routine' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete routine' }).click();
  await expect(page.getByRole('heading', { name: 'Delete this routine?' })).toBeVisible();
  // Deleting is red, keeping amber.
  const confirm = page.getByRole('dialog', { name: 'Delete this routine' });
  await expect(confirm.getByRole('button', { name: 'Delete routine' })).toHaveClass(
    /cn-btn-danger/
  );
  await expect(confirm.getByRole('button', { name: 'Keep it' })).toHaveClass(/cn-btn-primary/);
  await screenshot('RoutineArchive');
  await page.getByRole('button', { name: 'Keep it' }).click();
  await page.getByRole('link', { name: 'Close without saving' }).click();
});

test('a step’s value changes for one shot, as a recipe change in sage', async () => {
  await page.goto('/shot/new');
  await page.getByRole('button', { name: 'Setup', exact: true }).click();
  const more = page.getByRole('region', { name: 'Setup', exact: true });
  await more.getByRole('button', { name: /Puck prep/ }).click();
  await expect(more.getByRole('button', { name: /^Routine/ })).toContainText('Daily routine');
  await expect(more).toContainText('No settings');
  await more.getByRole('button', { name: 'WDT plus 1 s' }).click();
  await expect(more.locator('.cn-delta', { hasText: '+1' })).toBeVisible();
  await expect(page.locator('.cn-tag')).toContainText('New recipe');
  await expect(page.locator('.cn-tag')).toContainText('routine');
  await expectNoPageScroll();
  await screenshot('MorePuckPrep');
  await more.getByRole('button', { name: 'WDT minus 1 s' }).click();
  await expect(more.locator('.cn-delta')).toHaveCount(0);
  await more.getByRole('button', { name: 'Back to Setup' }).click();
  await expect(more.getByRole('button', { name: /Puck prep/ })).toBeVisible();
});

test('once a shot used it, the routine is archived, and so is its step', async () => {
  // Brew one shot with Light roast.
  await page.goto('/shot/new');
  await page.getByRole('button', { name: 'Setup', exact: true }).click();
  const more = page.getByRole('region', { name: 'Setup', exact: true });
  await more.getByRole('button', { name: /Puck prep/ }).click();
  await more.getByRole('button', { name: /^Routine/ }).click();
  await more.getByRole('button', { name: 'Light roast' }).click();
  await page.getByRole('button', { name: 'Close Setup' }).click({ position: { x: 200, y: 20 } });
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('status')).toContainText('Shot saved');

  await page.goto('/library/puck-prep');
  await page.getByRole('link', { name: /^Light roast/ }).click();
  await expect(page.getByRole('button', { name: 'Delete routine' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Archive this routine' })
    .getByRole('button', { name: 'Archive' })
    .click();
  await expect(page.getByRole('heading', { name: 'Puck prep', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Light roast/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Paper filter' }).click();
  await page
    .getByRole('region', { name: 'Edit Paper filter' })
    .getByRole('button', { name: 'Archive step' })
    .click();
  await expect(page.getByRole('button', { name: 'Paper filter' })).toHaveCount(0);

  // Both are listed under Archived; a step can be restored on its own.
  await page.getByRole('link', { name: 'Archived · 2' }).click();
  await expect(page.getByRole('main')).toContainText('Light roast');
  await expect(page.getByRole('main')).toContainText('Paper filter');
  await screenshot('PuckPrepArchived');
  await page.getByRole('button', { name: 'Restore Paper filter' }).click();
  await expect(page.getByRole('button', { name: 'Restore Paper filter' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to Puck prep' }).click();
  await page.getByRole('button', { name: 'Paper filter' }).click();
  await page
    .getByRole('region', { name: 'Edit Paper filter' })
    .getByRole('button', { name: 'Archive step' })
    .click();
  await expect(page.getByRole('button', { name: 'Paper filter' })).toHaveCount(0);
});
