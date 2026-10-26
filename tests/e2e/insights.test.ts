import { expect, test, type Page } from '@playwright/test';

// Insights (screens 23–25, roadmap M9) on the seeded shot history (npm run db:seed -- --history): 214
// shots on 9 beans. The designed screens are saved to screenshots/ for comparing. The last tests save
// and rate a shot, so they run after the screenshots.
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
    /^Ethiopia: average \d(\.\d)?, standard deviation \d(\.\d)?, 41 shots$/
  );
});

test('D-36: only the card list scrolls', async () => {
  const main = page.locator('main');
  const scrolls = await main.evaluate((el) => getComputedStyle(el).overflowY);
  expect(scrolls).toBe('auto');
  await expectNoPageScroll();
});

async function openTopic(name: string) {
  const tab = page.getByRole('tab', { name });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

test('InsightsProgress, D-56, D-212: Progress shows the weekly average score with its band', async () => {
  await openTopic('Progress');
  const weekly = card('Better and steadier');
  // The sentence spans the first to the last drawn week (D-212). Early in the week (a Monday) this
  // week has fewer than 2 rated shots yet and is a gap, so the span is 11 weeks, and a whole
  // change reads "2 points".
  await expect(weekly).toContainText(
    /^.*Up \d(\.\d)? points in 1[12] weeks, and your spread (halved|narrowed): σ went from \d(\.\d)? to \d(\.\d)?\./
  );
  await expect(weekly).toContainText('12 weeks ago');
  await expect(weekly).toContainText('This week');
  await expect(weekly).toContainText('Weekly average score · shaded band = ± 1 standard deviation');
  // D-201: the bell curve is not under Progress.
  await expect(page.getByRole('article')).toHaveCount(1);
  const week = weekly.getByRole('button', { name: /^Week of .*: average / }).last();
  await week.click();
  await expect(weekly.locator('.tip')).toHaveText(
    /^Week of \d+ \w{3}: average \d(\.\d)?, standard deviation \d(\.\d)?, \d+ shots$/
  );
  await week.click();
  await expectNoPageScroll();
  await page.screenshot({ path: 'screenshots/InsightsProgress.png' });
});

test('InsightsDialIn, D-201, D-205: Dial-in shows the shot time of the best Guji recipe', async () => {
  await openTopic('Dial-in');
  const bell = card('Your shot time is under control');
  await expect(bell).toContainText(
    /On your best Guji Hambela recipe, 2 in 3 shots land between \d+\.\d and \d+\.\d s\./
  );
  await expect(bell).toContainText(
    /^.*Shot time · Guji Hambela · Grind 1\.6 · 18\.0 g → \d+\.\d g · \d+ shots · μ \d+\.\d s · σ \d\.\d s$/
  );
  await expect(bell.getByRole('img')).toHaveAttribute(
    'aria-label',
    /^Distribution of shot time on this recipe: \d+ shots/
  );
  await expectNoPageScroll();
  await page.screenshot({ path: 'screenshots/InsightsDialIn.png' });
});

test('InsightsCompare, D-204, D-210, D-211: Comparisons shows routines and the steadiest beans', async () => {
  await openTopic('Comparisons');
  const routines = card('Daily routine is more repeatable');
  await expect(routines).toContainText(
    'Same bean, same recipe: your shot time wanders less with the Daily routine.'
  );
  await expect(routines).toContainText(
    'Guji Hambela only · average shot time ± 1 standard deviation'
  );
  await expect(routines.getByRole('button', { name: /^Daily routine: average/ })).toBeVisible();
  const beans = card('Most consistent beans');
  await expect(beans).toContainText('Standard deviation of score · reused recipes only');
  await expect(beans.getByRole('button')).toHaveCount(4);
  await expect(beans.getByRole('button').first()).toHaveAccessibleName(
    /^Guji Hambela: standard deviation 0\.\d, 25 shots$/
  );
  await expectNoPageScroll();
  await page.screenshot({ path: 'screenshots/InsightsCompare.png' });
});

test('D-208: Insights opens on What I like each time', async () => {
  await page.goto('/insights');
  await expect(page.getByRole('tab', { name: 'What I like' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
});

test('D-208: saving a shot updates the header', async () => {
  await page.getByRole('link', { name: 'New shot' }).click();
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('status')).toContainText('Shot saved');
  await page.goto('/insights');
  await expect(page.getByText('From 215 shots · 9 beans')).toBeVisible();
});

test('D-11, D-111: rating a shot updates the score cards', async () => {
  await page.goto('/journal?unrated=1');
  await page
    .getByRole('button', { name: /^Rate the shot at / })
    .first()
    .click();
  const sheet = page.getByRole('region', { name: 'Rate the shot' });
  await sheet.getByRole('radio', { name: '9', exact: true }).click();
  await expect(sheet).toBeHidden();
  await page.goto('/insights');
  await expect(card(/leads your origins$/)).toContainText(
    'Average score ± 1 standard deviation · 97 rated shots'
  );
});
