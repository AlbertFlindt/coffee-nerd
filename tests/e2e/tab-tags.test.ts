import { expect, test, type Page } from '@playwright/test';

// Library › Tags on the reference seed. Notes added here are merged or deleted again; the one
// a shot used ends archived, so the page shows the same notes as before.
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

const chip = (name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name}, \\d+ shots?`) });
const card = () => page.getByRole('region', { name: 'Possible duplicate' });

async function addTag(name: string, family: string) {
  await page.getByRole('button', { name: 'Add tag' }).click();
  const sheet = page.getByRole('region', { name: 'New tag' });
  // Every bottom sheet has a line outline.
  await expect(sheet).toHaveCSS('border-top-width', '1px');
  await expect(sheet.getByRole('radio', { name: 'Other' })).toHaveAttribute('aria-checked', 'true');
  await sheet.getByLabel('Name').fill(name);
  await sheet.getByRole('radio', { name: family }).click();
  return sheet;
}

test('Tags: notes by family; "Add tag" asks a name and a family', async () => {
  await page.goto('/library');
  await page.getByRole('link', { name: /^Tags/ }).click();
  await expect(page.getByRole('heading', { name: 'Tags', level: 1 })).toBeVisible();
  const fruity = page.getByRole('region', { name: 'Fruity' });
  await expect(fruity.getByRole('heading')).toHaveText(/^Fruity · \d+$/);
  await expect(fruity.getByRole('button', { name: /^Berry, \d+ shots?$/ })).toBeVisible();
  await expect(card()).toHaveCount(0);

  // Screen 59: a new tag starts empty, with Other chosen.
  await page.getByRole('button', { name: 'Add tag' }).click();
  await expect(page.getByRole('region', { name: 'New tag' })).toBeVisible();
  await screenshot('TagNew');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'New tag' })).toHaveCount(0);
  const sheet = await addTag('Dark choclate', 'Sweet');
  await expectNoPageScroll();
  await screenshot('TagAdd');
  await sheet.getByRole('button', { name: 'Add tag' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(
    page
      .getByRole('region', { name: 'Sweet' })
      .getByRole('button', { name: /^Dark choclate, 0 shots, custom$/ })
  ).toBeVisible();
});

test('the "Same tag twice?" card merges into the more used note', async () => {
  await expect(card()).toContainText('Same tag twice?');
  await expect(card()).toContainText('"Dark choclate" (0 shots) looks like "Dark chocolate"');
  await expectNoPageScroll();
  await screenshot('Tags');
  await card().getByRole('button', { name: 'Merge Dark choclate into Dark chocolate' }).click();
  // It asks first.
  const confirm = page.getByRole('region', { name: 'Edit Dark choclate' });
  await expect(confirm.getByRole('heading', { name: 'Merge into Dark chocolate?' })).toBeVisible();
  await expect(confirm).toContainText('This cannot be undone.');
  await confirm.getByRole('button', { name: 'Merge' }).click();
  await expect(card()).toHaveCount(0);
  await expect(chip('Dark choclate')).toHaveCount(0);
  await expect(chip('Dark chocolate')).toBeVisible();
});

test('"Keep both" is remembered for that pair', async () => {
  await (await addTag('Carmel', 'Sweet')).getByRole('button', { name: 'Add tag' }).click();
  await expect(card()).toContainText('"Carmel"');
  await card().getByRole('button', { name: 'Keep both' }).click();
  await expect(card()).toHaveCount(0);
  await page.reload();
  await expect(card()).toHaveCount(0);

  // Screens 57, 58: the search keeps matching notes; nothing found says so.
  await page.getByLabel('Search tags').fill('car');
  await expect(chip('Carmel')).toBeVisible();
  await screenshot('TagsSearch');
  await page.getByLabel('Search tags').fill('lavender');
  await expect(page.getByText('No tags match.')).toBeVisible();
  await screenshot('TagsNoMatch');
  await page.getByLabel('Search tags').fill('');

  // Screens 60, 62, 63: your own note's sheet and its merge steps.
  await chip('Carmel').click();
  const sheet = page.getByRole('region', { name: 'Edit Carmel' });
  await expect(sheet.getByRole('radiogroup', { name: 'Family' })).toBeVisible();
  await screenshot('TagEdit');
  await sheet.getByRole('button', { name: 'Merge into another tag' }).click();
  await expect(sheet.getByRole('heading', { name: 'Merge Carmel into' })).toBeVisible();
  await screenshot('TagMergeList');
  await sheet.getByRole('button', { name: /^Caramel/ }).click();
  await expect(sheet.getByRole('heading', { name: 'Merge into Caramel?' })).toBeVisible();
  // Merging removes a tag, so it is red and going back amber.
  await expect(sheet.getByRole('button', { name: 'Merge', exact: true })).toHaveClass(
    /cn-btn-danger/
  );
  await expect(sheet.getByRole('button', { name: 'Back' })).toHaveClass(/cn-btn-primary/);
  await screenshot('TagMergeConfirm');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  // A note no shot used is deleted.
  await chip('Carmel').click();
  await sheet.getByRole('button', { name: 'Remove tag' }).click();
  await expect(sheet.getByRole('heading', { name: 'Delete this tag?' })).toBeVisible();
  // Deleting is red, keeping amber.
  await expect(sheet.getByRole('button', { name: 'Delete tag' })).toHaveClass(/cn-btn-danger/);
  await expect(sheet.getByRole('button', { name: 'Keep it' })).toHaveClass(/cn-btn-primary/);
  await screenshot('TagRemove');
  await sheet.getByRole('button', { name: 'Delete tag' }).click();
  await expect(chip('Carmel')).toHaveCount(0);
});

test('a built-in note can be renamed but keeps its family', async () => {
  await chip('Berry').click();
  const sheet = page.getByRole('region', { name: 'Edit Berry' });
  await expect(sheet.getByRole('radiogroup', { name: 'Family' })).toHaveCount(0);
  await expect(sheet).toContainText('Built in · Fruity');
  await expectNoPageScroll();
  await screenshot('TagSheet');
  await screenshot('TagBuiltIn');
  await sheet.getByLabel('Name').fill('Citrus');
  await sheet.getByRole('button', { name: 'Save tag' }).click();
  await expect(sheet.getByRole('status')).toHaveText('There is already a tag with this name');
  await sheet.getByLabel('Name').fill('Berries');
  await sheet.getByRole('button', { name: 'Save tag' }).click();
  await expect(chip('Berries')).toBeVisible();
  // And back, so the seed stays as it was.
  await chip('Berries').click();
  const again = page.getByRole('region', { name: 'Edit Berries' });
  await again.getByLabel('Name').fill('Berry');
  await again.getByRole('button', { name: 'Save tag' }).click();
  await expect(chip('Berry')).toBeVisible();
});

test('a note a shot used is removed from the page and the chips, and stays on its shot', async () => {
  // Brew a shot with a new note, added in the Tasting sheet.
  await page.goto('/shot/new');
  await page.getByRole('button', { name: 'Tasting', exact: true }).click();
  const more = page.getByRole('region', { name: 'Tasting', exact: true });
  await more.getByRole('button', { name: 'Add your own' }).click();
  await more.getByRole('textbox', { name: 'New flavor note' }).fill('Funky');
  await more.getByRole('textbox', { name: 'New flavor note' }).press('Enter');
  await page.getByRole('button', { name: 'Close Tasting' }).click({ position: { x: 200, y: 20 } });
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('status')).toContainText('Shot saved');

  await page.goto('/library/tags');
  await chip('Funky').click();
  const sheet = page.getByRole('region', { name: 'Edit Funky' });
  await sheet.getByRole('button', { name: 'Remove tag' }).click();
  await expect(sheet).toContainText('Past shots keep it.');
  await sheet.getByRole('button', { name: 'Remove tag' }).click();
  await expect(chip('Funky')).toHaveCount(0);

  await page.goto('/shot/new');
  await page.getByRole('button', { name: 'Tasting', exact: true }).click();
  await expect(more.getByRole('button', { name: 'Funky' })).toHaveCount(0);

  await page.goto('/journal');
  await page.getByRole('main').getByRole('link').first().click();
  await expect(page.getByRole('list', { name: 'Flavor notes' })).toContainText('Funky');

  // The removed note is listed under Archived and comes back with Restore.
  await page.goto('/library/tags');
  await page.getByRole('link', { name: /^Archived · \d+/ }).click();
  await expect(page.getByRole('main')).toContainText('Funky');
  await screenshot('TagsArchived');
  await page.getByRole('button', { name: 'Restore Funky' }).click();
  await page.getByRole('link', { name: 'Back to Tags' }).click();
  await expect(chip('Funky')).toBeVisible();
  await chip('Funky').click();
  const again = page.getByRole('region', { name: 'Edit Funky' });
  await again.getByRole('button', { name: 'Remove tag' }).click();
  await again.getByRole('button', { name: 'Remove tag' }).click();
  await expect(chip('Funky')).toHaveCount(0);
});
