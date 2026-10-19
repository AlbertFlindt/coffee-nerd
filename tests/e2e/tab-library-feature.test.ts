import { expect, test, type Page } from '@playwright/test';

// Screen 14 (D-46, D-151): your own feature on the machine page. It is added, shown, then deleted again
// (no shot used it), so the reference setup stays as it was. Runs after tab-library.test.ts (files run in
// name order, one worker).
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

async function openMachine() {
  await page.goto('/library/gear');
  await page.getByRole('link', { name: /^Lelit Bianca/ }).click();
  await expect(page.getByRole('heading', { name: 'Machine', level: 1 })).toBeVisible();
}

test('CustomFeature, D-46: a new feature is added from the machine page', async () => {
  await openMachine();
  await page.getByRole('button', { name: 'Add your own feature' }).click();
  const sheet = page.getByRole('region', { name: 'Add your own feature' });
  await expect(sheet.getByRole('heading', { name: 'Add your own feature' })).toBeVisible();
  await expect(sheet.getByRole('radio')).toHaveText([
    'Number with unit',
    'Seconds',
    'On / off',
    'Pick from a list'
  ]);
  await sheet.getByLabel('Name').fill('Bloom pause');
  await sheet.getByRole('radio', { name: 'Seconds' }).click();
  await sheet.getByLabel('Step').fill('1');
  const preview = sheet.getByRole('region', { name: 'Preview' });
  await expect(preview).toContainText('Shot form › More › Setup');
  await expect(preview).toContainText('Bloom pause');
  await expect(preview).toContainText('Part of the recipe: changing it starts a new recipe');
  await expectNoPageScroll();
  await screenshot('CustomFeature');
  await sheet.getByRole('button', { name: 'Add feature' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Bloom pause' })).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Gear', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /^Lelit Bianca/ }).click();
  await expect(page.getByRole('switch', { name: 'Bloom pause' })).toBeVisible();
});

test('CustomFeature, D-152: a list needs at least two options', async () => {
  await page.getByRole('button', { name: 'Add your own feature' }).click();
  const sheet = page.getByRole('region', { name: 'Add your own feature' });
  await sheet.getByLabel('Name').fill('Water');
  await sheet.getByRole('radio', { name: 'Pick from a list' }).click();
  const add = sheet.getByRole('button', { name: 'Add feature' });
  await expect(add).toBeDisabled();
  await sheet.getByLabel('Option 1').fill('Soft');
  await expect(sheet.getByText('Give at least two options a name')).toBeVisible();
  await screenshot('FeatureList');
  await sheet.getByLabel('Option 2').fill('Hard');
  await expect(add).toBeEnabled();
  await sheet.getByRole('button', { name: 'Add option' }).click();
  await sheet
    .getByRole('button', { name: /^Remove option/ })
    .last()
    .click();
  await expect(sheet.getByRole('button', { name: /^Remove option/ })).toHaveCount(0);
  await expectNoPageScroll();
  await page
    .getByRole('button', { name: 'Close without adding' })
    .click({ position: { x: 200, y: 20 } });
  await expect(sheet).toHaveCount(0);
});

test('CustomFeature, D-151: an unused feature is renamed or deleted from its own sheet', async () => {
  await page.getByRole('button', { name: 'Edit Bloom pause' }).click();
  const sheet = page.getByRole('region', { name: 'Edit Bloom pause' });
  await expect(sheet.getByRole('button', { name: 'Save feature' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Delete feature' }).click();
  await expect(page.getByRole('switch', { name: 'Bloom pause' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Gear', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /^Lelit Bianca/ }).click();
  await expect(page.getByRole('switch', { name: 'Bloom pause' })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Low bar end' })).toBeVisible();
});
