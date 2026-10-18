import { expect, test, type Page } from '@playwright/test';

// The Library tab (roadmap M5) on the shots logged by shot-form.test.ts and shot-journal.test.ts, which run
// first (files run in name order, one worker). Each designed screen is saved to screenshots/ for comparing
// with docs/screens/.
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

test('Beans, D-124: the Library tab opens the Beans overview', async () => {
  const bar = page.getByRole('navigation', { name: 'Main' });
  await bar.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Beans', level: 1 })).toBeVisible();
  await expect(bar.getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Back to Library' })).toHaveCount(0);

  // D-37: open beans as cards with their roast age, origin and numbers (D-132); shot-form.test.ts added
  // a second open bean.
  const cards = page.getByRole('main').locator('.card');
  await expect(page.getByRole('heading', { name: `Open · ${await cards.count()}` })).toBeVisible();
  const card = cards.filter({ hasText: 'Guji Hambela' });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('days');
  await expect(card).toContainText('since roast');
  await expect(card).toContainText('Nordlys Roasters · Ethiopia · Natural');
  await expect(card.locator('.numbers')).toContainText('Best');
  await expect(card.locator('.numbers')).toContainText(/Recipes \d+/);
  await expect(card.locator('.numbers')).toContainText(/Shots \d+/);
  await expect(page.getByRole('heading', { name: /Finished/ })).toHaveCount(0);
  await expectNoPageScroll();
  await screenshot('Beans');
});
