import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';

// The Journal and shot detail (roadmap M4) on the shots logged by shot-form.test.ts, which runs first
// (files run in name order, one worker). The two oldest shots are moved back a day and four days, so the
// list shows several days. Each designed screen is saved to screenshots/ for comparing with docs/screens/.
test.describe.configure({ mode: 'serial' });

const DATABASE = 'test-results/e2e-seeded.db';
const DAY = 86_400_000;

let page: Page;

test.beforeAll(async ({ browser }) => {
  const db = new Database(DATABASE);
  const oldest = db.prepare('select id, brewed_at from shot order by brewed_at limit 2').all() as {
    id: string;
    brewed_at: number;
  }[];
  const move = db.prepare('update shot set brewed_at = ? where id = ?');
  move.run(oldest[0].brewed_at - 4 * DAY, oldest[0].id);
  move.run(oldest[1].brewed_at - DAY, oldest[1].id);
  // One shot with flavor notes and a note, as in the reference.
  const latest = db.prepare('select id from shot order by brewed_at desc limit 1').get() as {
    id: string;
  };
  db.prepare(
    'update shot set notes = ?, score = 7, balance = -2, body = 7, sweetness = 8 where id = ?'
  ).run('Ran fast, a bit thin. Try 0.1 finer tomorrow.', latest.id);
  for (const name of ['Berry', 'Dark chocolate'])
    db.prepare(
      'insert or ignore into shot_tag (shot_id, tag_id) select ?, id from tag where name = ?'
    ).run(latest.id, name);
  db.close();

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

const rows = () => page.getByRole('main').getByRole('link');

test('Journal, D-54: every shot, newest first, grouped by day', async () => {
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Journal' })
    .click();
  await expect(page.getByRole('heading', { name: 'Journal', level: 1 })).toBeVisible();
  await expect(page.getByText(/^\d+ shots? this week$/)).toBeVisible();
  const days = page.getByRole('main').getByRole('heading', { level: 2 });
  await expect(days.first()).toHaveText('Today');
  await expect(days.nth(1)).toHaveText('Yesterday');
  await expect(days).toHaveCount(3);

  const first = rows().first();
  await expect(first).toContainText('Guji Hambela');
  await expect(first).toContainText(/\d\.\d · \d+\.\d → \d+\.\d g · \d+\.\d s/);
  await expect(first.locator('.cn-tag')).toHaveText(/^(Recipe reused \d+x|New recipe)$/);
  // The oldest shot is its recipe's first (D-16).
  await expect(rows().last().locator('.cn-tag')).toHaveText('New recipe');
  // D-30, D-114: the tab bar; Library and Insights wait for their pages.
  const bar = page.getByRole('navigation', { name: 'Main' });
  await expect(bar.getByRole('link', { name: 'Journal' })).toHaveAttribute('aria-current', 'page');
  await expect(bar.getByRole('link', { name: 'New shot' })).toBeVisible();
  for (const name of ['Library', 'Insights'])
    await expect(bar.getByText(name)).toHaveAttribute('aria-disabled', 'true');
  await expectNoPageScroll();
  await screenshot('Journal');
});

test('D-36: only the list scrolls', async () => {
  const main = page.getByRole('main');
  const overflowY = await main.evaluate((el) => getComputedStyle(el).overflowY);
  expect(overflowY).toBe('auto');
});

test('D-54, D-11: "Unrated · N" shows the N unrated shots, with a Rate block', async () => {
  const chip = page.getByRole('button', { name: /^Unrated · \d+$/ });
  const n = Number((await chip.textContent())!.match(/\d+/)![0]);
  await chip.click();
  await expect(page.getByRole('button', { name: /^Unrated · / })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(rows()).toHaveCount(n);
  await expect(page.getByRole('button', { name: /^Rate the shot at / })).toHaveCount(n);
  await page.getByRole('button', { name: /^Unrated · / }).click();
  await expect(page.getByRole('button', { name: /^Unrated · / })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});

test('D-111: the Rate block opens a score sheet; a tap saves the score', async () => {
  const chip = page.getByRole('button', { name: /^Unrated · \d+$/ });
  const before = Number((await chip.textContent())!.match(/\d+/)![0]);
  const rate = page.getByRole('button', { name: /^Rate the shot at / }).first();
  const href = await rate.locator('xpath=..').getByRole('link').getAttribute('href');
  const row = page.locator(`a[href="${href}"]`);
  await rate.click();
  const sheet = page.getByRole('region', { name: 'Rate the shot' });
  await expect(sheet.getByRole('radiogroup', { name: 'Overall score 1 to 10' })).toBeVisible();
  await screenshot('JournalRate');
  await sheet.getByRole('radio', { name: '6', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: /^Unrated · / })).toHaveText(
    `Unrated · ${before - 1}`
  );
  await expect(row).toContainText('6score');
});

test('D-54: the bean filter lists the beans that have shots', async () => {
  const total = await rows().count();
  await page.getByRole('button', { name: 'All beans' }).click();
  const sheet = page.getByRole('region', { name: 'Choose a bean' });
  await expect(sheet.getByRole('button', { name: 'All beans' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await sheet.getByRole('button', { name: 'Guji Hambela' }).click();
  const chip = page.getByRole('group', { name: 'Filters' }).getByRole('button', {
    name: 'Guji Hambela'
  });
  await expect(chip).toHaveClass(/is-on/);
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/[?&]bean=/);
  await expect(rows()).toHaveCount(total);
  await chip.click();
  await sheet.getByRole('button', { name: 'All beans' }).click();
  await expect(page.getByRole('button', { name: 'All beans' })).toBeVisible();
});

test('ShotDetail, D-57: tapping a shot opens it', async () => {
  await rows().first().click();
  await expect(page.getByRole('heading', { name: 'Shot', level: 1 })).toBeVisible();
  await expect(page.getByText(/^Today \d\d:\d\d$/)).toBeVisible();
  const card = page.getByRole('region', { name: 'Bean and setup' });
  await expect(card).toContainText('Guji Hambela');
  await expect(card).toContainText(/\d+ days? since roast/);
  await expect(card).toContainText('Lelit Bianca · Timemore 064S · VST 18 g · Daily routine');
  await expect(card).toContainText('93 °C · Flat 9.0 bar');
  const values = page.getByRole('region', { name: 'Core values' });
  for (const label of ['Grind', 'Dose', 'Yield', 'Time']) await expect(values).toContainText(label);
  await expect(page.getByText(/^Ratio 1 : \d\.\d$/)).toBeVisible();
  const taste = page.getByRole('region', { name: 'Taste' });
  for (const label of ['Balance', 'Body', 'Sweetness']) await expect(taste).toContainText(label);
  await expect(taste).toContainText('Slightly sour');
  await expect(taste.getByRole('list', { name: 'Flavor notes' })).toContainText('Dark chocolate');
  // D-109, D-110: against the recipe's other shots; the count includes this one.
  const reused = Number((await card.locator('.cn-tag').textContent())!.match(/\d+/)?.[0] ?? 0);
  const compared = page.getByRole('region', { name: 'Compared with this recipe' });
  await expect(compared).toContainText(`${reused + 1} shots`);
  await expect(compared).toContainText(/Time\s*\d+\.\d s/);
  await expect(compared).toContainText(/vs μ \d+\.\d s/);
  await expect(compared).toContainText(/Within normal range|\d\.\dσ (faster|slower) than usual/);
  await expect(compared).toContainText(/Score\s*7/);
  await expect(page.getByRole('region', { name: 'Notes' })).toContainText('Notes · just for you');
  await expectNoPageScroll();
  await screenshot('ShotDetail');
});

test('D-57: back returns to the Journal', async () => {
  await page.getByRole('link', { name: 'Back to Journal' }).click();
  await expect(page.getByRole('heading', { name: 'Journal', level: 1 })).toBeVisible();
});
