import { expect, test, type Page } from '@playwright/test';

// Library › Puck prep (roadmap M7) on the reference seed: the Daily routine and its four steps. A step
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

test('PuckPrep, D-51, D-163: routines with their flow, "In use", and your steps', async () => {
  await page.goto('/library');
  await page.getByRole('link', { name: /^Puck prep/ }).click();
  await expect(page.getByRole('heading', { name: 'Puck prep', level: 1 })).toBeVisible();
  const daily = page.getByRole('link', { name: 'Daily routine' });
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

test('NewStep, D-52: a new step with a number setting', async () => {
  await page.getByRole('button', { name: 'New step' }).click();
  const sheet = page.getByRole('region', { name: 'New step' });
  await sheet.getByLabel('Name').fill('RDT');
  await sheet.getByRole('radio', { name: 'Number with unit' }).click();
  await sheet.getByLabel('Unit').fill('sprays');
  await sheet.getByLabel('Starts at').fill('2');
  await expect(sheet.getByRole('region', { name: 'Preview' })).toContainText('RDT');
  await expect(sheet.getByRole('region', { name: 'Preview' })).toContainText('2 sprays');
  await expectNoPageScroll();
  await screenshot('NewStep');
  await sheet.getByRole('button', { name: 'Add step' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'RDT · sprays' })).toBeVisible();
});

test('D-168: a step can be renamed, and deleted while no shot used it', async () => {
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

test('D-169: a step in a routine stays', async () => {
  await page.getByRole('button', { name: 'Tamp · kg' }).click();
  const sheet = page.getByRole('region', { name: 'Edit Tamp' });
  await expect(sheet).toContainText('Used in Daily routine');
  await expect(sheet.getByRole('button', { name: /Delete step|Archive step/ })).toHaveCount(0);
  // D-168: Tamp has been used by shots, so its unit stays.
  await expect(sheet.getByLabel('Unit')).not.toBeEditable();
  await expectNoPageScroll();
  // D-175: a range the routine's 15 kg falls outside is refused, naming the routine.
  await sheet.getByLabel('Starts at').fill('5');
  await sheet.getByLabel('Range').fill('0–10');
  await sheet.getByRole('button', { name: 'Save step' }).click();
  await expect(sheet.getByRole('status')).toHaveText(
    'Daily routine uses 15 kg, outside this range'
  );
  await page
    .getByRole('button', { name: 'Close without saving' })
    .click({ position: { x: 200, y: 20 } });
  await expect(sheet).toHaveCount(0);
});
