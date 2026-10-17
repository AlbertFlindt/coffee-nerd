import { expect, test } from '@playwright/test';

test('/health reports the app and its database as ok', async ({ request }) => {
  const response = await request.get('/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

test('D-36: the start page fits the viewport without page scrolling', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  const { scrollHeight, clientHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight
  }));
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
});

test('the app uses the design system and self-hosted Figtree, with no external requests', async ({
  page
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).host !== 'localhost:4173') external.push(r.url());
  });
  await page.goto('/');

  const root = page.locator('.cn-root');
  await expect(root).toHaveCSS('font-family', /Figtree/);
  const loaded = await page.evaluate(
    async () => (await document.fonts.load('700 16px Figtree')).length
  );
  expect(loaded).toBeGreaterThan(0);
  expect(external).toEqual([]);
});
