import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Moving to a new server: "Export everything" on the seeded installation, then "Import everything"
// into a new account on this empty one.
test.describe.configure({ mode: 'serial' });

// The installation with the seeded shot history (214 shots); the test only reads it.
const SEEDED = 'http://localhost:4175';

test('a new account imports the export of another server, once', async ({ browser, page }) => {
  // The old server: sign in and export.
  const old = await browser.newPage();
  await old.goto(`${SEEDED}/login`);
  await old.getByLabel('Name').fill('Demo');
  await old.getByLabel('Password', { exact: true }).fill('coffee-nerd');
  await old.getByRole('button', { name: 'Sign in' }).click();
  await expect(old.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await old.goto(`${SEEDED}/settings`);
  const [download] = await Promise.all([
    old.waitForEvent('download'),
    old.getByRole('button', { name: /^Export everything/ }).click()
  ]);
  const text = readFileSync(await download.path(), 'utf8');
  const everything = JSON.parse(text);
  await old.close();

  // The new server: create the account, leave the step-by-step start, open Settings.
  await page.goto('/welcome');
  await page.getByLabel('Name').fill('Albert');
  await page.getByLabel('Password', { exact: true }).fill('espresso-at-dawn');
  await page.getByLabel('Password again').fill('espresso-at-dawn');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Step 1 of 5')).toBeVisible();
  await page.getByRole('link', { name: 'Leave for now' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  const row = page.locator('label', { hasText: 'Import everything' });
  await expect(row).toContainText('Move your journal from another Coffee Nerd');

  // A file that is not an export changes nothing.
  await page.getByLabel('Import everything').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}')
  });
  await expect(row).toContainText('This is not an "Export everything" file from Coffee Nerd');
  await expect(page.getByLabel('Import everything')).toBeEnabled();

  await page.getByLabel('Import everything').setInputFiles({
    name: download.suggestedFilename(),
    mimeType: 'application/json',
    buffer: Buffer.from(text)
  });
  const shots = everything.shots.length;
  const beans = everything.beans.length;
  await expect(row).toContainText(`Imported ${shots} shots and ${beans} beans`);
  // The journal is no longer empty, so a second import can't start.
  await expect(page.getByLabel('Import everything')).toBeDisabled();
  await page.reload();
  await expect(row).toContainText('Only into a new, empty journal');

  // Home is ready to brew, with the seeded bean, and the Journal has every shot.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await expect(page.getByText(everything.beans.at(-1).name).first()).toBeVisible();
  await page.goto('/shot/new');
  await expect(page.getByText(/^Step \d of 5$/)).toHaveCount(0);
});
