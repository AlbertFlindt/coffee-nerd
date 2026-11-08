import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Moving to a new server: "Export everything" on the installation with the seeded shot history,
// then "Move my journal" when creating the account on this empty one.
test.describe.configure({ mode: 'serial' });

// The installation with the seeded shot history (214 shots); the test only reads it.
const SEEDED = 'http://localhost:4175';

test('the first visit offers a new journal or moving one; moving imports the export', async ({
  browser,
  page
}) => {
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

  // The new server: a new journal is the default; "Move my journal" asks for the file.
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  const choice = page.getByRole('radiogroup', { name: 'How to start' });
  await expect(choice.getByRole('radio', { name: 'New journal' })).toBeChecked();
  await expect(page.getByLabel('Export everything file')).toHaveCount(0);
  await choice.getByRole('radio', { name: 'Move my journal' }).click();
  await expect(page.getByText('Bring your journal from another Coffee Nerd.')).toBeVisible();
  await page.getByLabel('Name').fill('Albert');
  await page.getByLabel('Password', { exact: true }).fill('espresso-at-dawn');
  await page.getByLabel('Password again').fill('espresso-at-dawn');

  // A file that is not an export makes no account, and keeps the choice.
  await page.getByLabel('Export everything file').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}')
  });
  await expect(page.getByText('notes.json')).toBeVisible();
  await page.getByRole('button', { name: 'Create account and import' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'This is not an "Export everything" file from Coffee Nerd'
  );
  await expect(choice.getByRole('radio', { name: 'Move my journal' })).toBeChecked();
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);

  // The real export: the account is made with the journal in it, and Home opens.
  await choice.getByRole('radio', { name: 'Move my journal' }).click();
  await page.getByLabel('Name').fill('Albert');
  await page.getByLabel('Password', { exact: true }).fill('espresso-at-dawn');
  await page.getByLabel('Password again').fill('espresso-at-dawn');
  await page.getByLabel('Export everything file').setInputFiles({
    name: download.suggestedFilename(),
    mimeType: 'application/json',
    buffer: Buffer.from(text)
  });
  await expect(page.getByText(download.suggestedFilename())).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'screenshots/MoveJournal.png' });
  await page.getByRole('button', { name: 'Create account and import' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await expect(page.getByText(everything.beans.at(-1).name).first()).toBeVisible();
  // Ready to brew: "+" opens the shot form, not the step-by-step start.
  await page.goto('/shot/new');
  await expect(page.getByText(/^Step \d of 5$/)).toHaveCount(0);

  // The journal is no longer empty, so Settings can't import into it.
  await page.goto('/settings');
  await expect(page.getByLabel('Import everything')).toBeDisabled();
  await expect(page.locator('label', { hasText: 'Import everything' })).toContainText(
    'Only into a new, empty journal'
  );

  // Every shot came across.
  const [moved] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^Export everything/ }).click()
  ]);
  const after = JSON.parse(readFileSync(await moved.path(), 'utf8'));
  expect(after.shots).toEqual(everything.shots);
});
