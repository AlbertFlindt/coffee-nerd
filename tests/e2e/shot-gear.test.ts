import { expect, test, type Page } from '@playwright/test';

// The shot form's gear (roadmap M6) on the reference seed: switching the grinder for one shot (D-153),
// the dose hint (D-154), and leaving out the basket or puck prep (D-155). Nothing is saved, so the shots
// the next files count stay as they are; the grinder added here is archived at the end.
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

test('D-153: the gear line switches the grinder for this shot; the grind control follows', async () => {
  await page.goto('/library/gear');
  await page.getByRole('button', { name: 'Add gear' }).click();
  await page.getByRole('button', { name: 'Grinder' }).click();
  await page.getByLabel('Name').fill('Comandante C40');
  await page.getByLabel('Step interval').fill('1');
  await page.getByLabel('Step interval').blur();
  await page.getByLabel('Coarsest').fill('40');
  await page.getByLabel('Coarsest').blur();
  await page.getByRole('button', { name: 'Add grinder' }).click();
  await expect(page.getByRole('link', { name: /^Comandante C40/ })).toBeVisible();

  await page.goto('/shot/new');
  await expect(page.getByRole('button', { name: 'Grind plus 0.1' })).toBeVisible();
  await page.getByRole('button', { name: /choose another machine or grinder$/ }).click();
  const sheet = page.getByRole('region', { name: 'Choose machine and grinder' });
  await expect(sheet.getByRole('button', { name: 'Lelit Bianca' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(sheet.getByRole('button', { name: 'Timemore 064S' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expectNoPageScroll();
  await screenshot('ShotGearSheet');
  await sheet.getByRole('button', { name: 'Comandante C40' }).click();
  await expect(page.locator('.card')).toContainText('Lelit Bianca · Comandante C40');
  await expect(page.getByRole('button', { name: 'Grind plus 1' })).toBeVisible();
  await expect(page.locator('.cn-tag')).toContainText('New recipe');
});

test('D-153: switching the machine brings its own features; values both have stay', async () => {
  await page.goto('/library/gear');
  await page.getByRole('button', { name: 'Add gear' }).click();
  await page.getByRole('button', { name: 'Machine' }).click();
  // D-158: a new machine has temperature and flat pressure, no phases.
  await page.getByLabel('Name').fill('Gaggia Classic');
  await page.getByRole('button', { name: 'Add machine' }).click();
  await expect(page.getByRole('link', { name: /^Gaggia Classic/ })).toBeVisible();

  await page.goto('/shot/new');
  await expect(page.locator('.card')).toContainText('Preinfusion 4 s');
  await page.getByRole('button', { name: /choose another machine or grinder$/ }).click();
  await page
    .getByRole('region', { name: 'Choose machine and grinder' })
    .getByRole('button', { name: 'Gaggia Classic' })
    .click();
  await expect(page.locator('.card')).toContainText('Gaggia Classic · Timemore 064S');
  await expect(page.locator('.card')).not.toContainText('Preinfusion');
  await expect(page.locator('.card')).toContainText('93 °C');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const more = page.getByRole('region', { name: 'More', exact: true });
  await expect(more.getByRole('switch', { name: 'Preinfusion' })).toHaveCount(0);
  await expect(more.getByText('Flat')).toBeVisible();
});

test('D-154: a dose outside the basket’s range shows a gentle hint, never a block', async () => {
  await page.goto('/shot/new');
  await expect(page.getByText(/holds 17\.0–19\.0 g/)).toHaveCount(0);
  await page.getByRole('button', { name: /^Dose, .*tap to type$/ }).click();
  await page.getByRole('textbox', { name: 'Dose' }).fill('20');
  await page.getByRole('textbox', { name: 'Dose' }).press('Enter');
  await expect(page.getByText('VST · 18 g holds 17.0–19.0 g')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save shot' })).toBeEnabled();
  await expectNoPageScroll();
  await screenshot('ShotDoseHint');
});

test('D-155: the basket and puck prep pickers start with leaving them out', async () => {
  await page.goto('/shot/new');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const sheet = page.getByRole('region', { name: 'More', exact: true });
  await sheet.getByRole('button', { name: /^Basket/ }).click();
  await expect(sheet.locator('.pick').first()).toHaveText('No basket');
  // Screen 28: the list ends with a way back.
  await expect(sheet.getByRole('button', { name: 'Back to Setup' })).toBeVisible();
  await screenshot('MoreBasket');
  await sheet.getByRole('button', { name: 'No basket' }).click();
  await expect(sheet.getByRole('button', { name: /^Basket/ })).toContainText('No basket');
  await expect(page.locator('.cn-tag')).toContainText('New recipe');

  await sheet.getByRole('button', { name: /Puck prep/ }).click();
  // D-166: the row opens the routine's steps; "Routine" there opens the picker.
  await sheet.getByRole('button', { name: /^Routine/ }).click();
  await expect(sheet.locator('.pick').first()).toHaveText('No puck prep');
  await expect(
    sheet.getByText(
      'Shots are easier to repeat with a puck prep routine. Add one in Library › Puck prep.'
    )
  ).toBeVisible();
  await screenshot('ShotNoPuckPrep');
  await sheet.getByRole('button', { name: 'No puck prep' }).click();
  await expect(sheet.getByRole('button', { name: /Puck prep/ })).toContainText('No puck prep');
});

test('the machine and grinder added for this file are archived again', async () => {
  await page.goto('/library/gear');
  await page.getByRole('link', { name: /^Gaggia Classic/ }).click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await page
    .getByRole('region', { name: 'Archive this machine' })
    .getByRole('button', { name: 'Archive' })
    .click();
  await expect(page.getByRole('link', { name: /^Gaggia Classic/ })).toHaveCount(0);

  await page.goto('/library/gear');
  await page.getByRole('link', { name: /^Comandante C40/ }).click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await page
    .getByRole('region', { name: 'Archive this grinder' })
    .getByRole('button', { name: 'Archive' })
    .click();
  await expect(page.getByRole('link', { name: /^Comandante C40/ })).toHaveCount(0);
});
