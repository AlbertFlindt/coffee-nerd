import { expect, test } from '@playwright/test';

test('D-59: /health reports the app and its database as ok', async ({ request }) => {
  const response = await request.get('/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

test('D-36: the start page fits the viewport without page scrolling', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  // The app shell clips overflow, so check both the document and the shell itself.
  const overflow = await page.evaluate(() =>
    [document.documentElement, document.querySelector('.cn-root')!].map(
      (el) => el.scrollHeight - el.clientHeight
    )
  );
  expect(overflow).toEqual([0, 0]);
});

test('D-18, D-69: the app uses the design system and self-hosted Figtree, with no external requests', async ({
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
