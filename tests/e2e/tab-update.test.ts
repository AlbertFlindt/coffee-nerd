import Database from 'better-sqlite3';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// D-236: while a new version waits for the app to be closed (D-229), the offline copies stay current.
// The newer server is played by changing the version its copies say they come from, for the version on
// the phone only; the version that waits gets them as they are. The shot saved here is deleted again.
test.describe.configure({ mode: 'serial' });

const DATABASE = 'test-results/e2e-seeded.db';
const NEXT = '/service-worker.js?version=next';

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Name').fill('Demo');
  await page.getByLabel('Password').fill('coffee-nerd');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
});

test.afterAll(() => context.close());

test('D-236: while a new version waits, the copies for offline use stay current', async () => {
  // A newer server: every copy the version on the phone takes says it comes from another version.
  const pages = (url: URL) => !url.pathname.startsWith('/_app/');
  await context.route(pages, async (route) => {
    const request = route.request();
    const worker = request.serviceWorker()?.url() ?? '';
    if (!request.headers()['x-coffee-nerd-offline-copy'] || worker.includes('version=next'))
      return route.fallback();
    // A copy still on its way when the test goes offline is dropped, as the phone would drop it.
    try {
      const response = await route.fetch();
      const body = (await response.text()).replace(/version: "[^"]*"/, 'version: "next"');
      await route.fulfill({
        response,
        body,
        headers: { ...response.headers(), 'x-sveltekit-version': 'next' }
      });
    } catch {
      await route.abort().catch(() => {});
    }
  });
  // The new version installs and waits.
  const waiting = await page.evaluate(async (url) => {
    const registration = await navigator.serviceWorker.register(url);
    const worker = registration.installing ?? registration.waiting;
    if (worker && worker.state !== 'installed')
      await new Promise((done) =>
        worker.addEventListener('statechange', () => worker.state === 'installed' && done(null))
      );
    return registration.waiting?.scriptURL ?? null;
  }, NEXT);
  expect(waiting).toContain(NEXT);

  // A shot saved online, with a grind of its own.
  await page.goto('/shot/new');
  await page.getByRole('button', { name: 'Grind plus 0.1' }).click();
  await page.getByRole('button', { name: 'Grind plus 0.1' }).click();
  const grind = await page.getByRole('button', { name: /^Grind, .*tap to type$/ }).innerText();
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  const db = new Database(DATABASE, { readonly: true });
  const { id } = db.prepare('select id from shot order by brewed_at desc limit 1').get() as {
    id: string;
  };
  db.close();
  // The version that waits keeps Home with it, which the version on the phone cannot.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const kept = await caches.match('/__data.json');
        return kept ? kept.text() : '';
      })
    )
    .toContain(id);

  // Offline, Home opens with the shot.
  await context.setOffline(true);
  await page.goto('/');
  const card = page.getByRole('region', { name: 'Last shot' });
  await expect(card.getByText(`Grind ${grind}`)).toBeVisible();
  await context.setOffline(false);
  await context.unroute(pages);

  await page.goto(`/journal/${id}/edit`);
  await page.getByRole('button', { name: 'Delete shot' }).click();
  await page
    .getByRole('region', { name: 'Delete this shot' })
    .getByRole('button', { name: 'Delete shot' })
    .click();
  await expect(page.getByRole('heading', { name: 'Edit shot' })).toHaveCount(0);
});
