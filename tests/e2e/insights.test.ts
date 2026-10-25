import { expect, test, type Page } from '@playwright/test';

// Insights (screens 23–25, roadmap M9) on the seeded shot history (npm run db:seed -- --history): 214
// shots on 9 beans. The designed screen is saved to screenshots/ for comparing.
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

const card = (title: string | RegExp) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) });

test('Insights, D-55, D-208, D-69: the tab bar opens it on What I like with the data basis', async () => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).host !== 'localhost:4175') external.push(r.url());
  });
  const bar = page.getByRole('navigation', { name: 'Main' });
  await bar.getByRole('link', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { name: 'Insights', level: 1 })).toBeVisible();
  await expect(bar.getByRole('link', { name: 'Insights' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('From 214 shots · 9 beans')).toBeVisible();
  const topics = page.getByRole('tablist', { name: 'Insight topics' });
  await expect(topics.getByRole('tab')).toHaveText([
    'What I like',
    'Progress',
    'Dial-in',
    'Comparisons'
  ]);
  await expect(topics.getByRole('tab', { name: 'What I like' })).toHaveAttribute(
    'aria-selected',
    'true'
  );

  // D-56: score by process as a box plot, score by origin as average ± 1 σ, each with its basis.
  await expect(card('Naturals are your thing')).toContainText(
    'Score by process · box = middle 50% · amber line = median · whiskers = full range'
  );
  await expect(card('Naturals are your thing').getByRole('img')).toHaveAttribute(
    'aria-label',
    /^Box plot of score\. Natural: median 8, .*38 shots; Honey: .*12 shots; Washed: .*36 shots$/
  );
  await expect(card('Ethiopia leads your origins')).toContainText(
    'Average score ± 1 standard deviation · 96 rated shots'
  );
  await expectNoPageScroll();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'screenshots/Insights.png' });
  // No request leaves the server: the app is self-hosted and private.
  expect(external).toEqual([]);
});

test('D-56: tapping a row shows its exact numbers, tapping again hides them', async () => {
  const process = card('Naturals are your thing');
  const natural = process.getByRole('button', { name: /^Natural: median 8/ });
  await natural.click();
  await expect(natural).toHaveAttribute('aria-pressed', 'true');
  await expect(process.locator('.tip')).toHaveText(/^Natural: median 8, middle half .*, 38 shots$/);
  await natural.click();
  await expect(process.locator('.tip')).toHaveCount(0);

  const ethiopia = card('Ethiopia leads your origins').getByRole('button', { name: /^Ethiopia:/ });
  await ethiopia.click();
  await expect(card('Ethiopia leads your origins').locator('.tip')).toHaveText(
    /^Ethiopia: average 8(\.\d)?, standard deviation \d\.\d, 41 shots$/
  );
});

test('D-36: only the card list scrolls', async () => {
  const main = page.locator('main');
  const scrolls = await main.evaluate((el) => getComputedStyle(el).overflowY);
  expect(scrolls).toBe('auto');
  await expectNoPageScroll();
});

test('D-208: Insights opens on What I like each time', async () => {
  await page.goto('/insights');
  await expect(page.getByRole('tab', { name: 'What I like' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
});
