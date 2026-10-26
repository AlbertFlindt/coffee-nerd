import Database from 'better-sqlite3';
import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test';

// Opening offline (roadmap M10, D-219, D-225): the service worker keeps Home, the Journal and the shot
// form ready, pages already opened open as the phone kept them, and changes need a connection.
// Nothing is saved, so the files after this one find the data as is.
test.describe.configure({ mode: 'serial' });

const DATABASE = 'test-results/e2e-seeded.db';
const OFFLINE_LINE = 'Offline: showing what the phone kept. Changes need a connection.';
const NOTHING_CHANGED = 'You are offline. This needs a connection, so nothing was changed.';

let context: BrowserContext;
// The line at the top of every page while offline (D-219).
const line = () => page.getByRole('status').filter({ hasText: /offline/i });
let page: Page;

const kept = () =>
  page.evaluate(async () => {
    const name = (await caches.keys()).find((key) => key.startsWith('pages-'));
    if (!name) return [];
    const keys = await (await caches.open(name)).keys();
    return keys.map((request) => {
      const url = new URL(request.url);
      return url.pathname + url.search;
    });
  });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Name').fill('Demo');
  await page.getByLabel('Password').fill('coffee-nerd');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Controlled by the service worker from the next page on.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
});

test.afterAll(() => context.close());

test('D-219: Home, the Journal and the shot form for every open bean are kept, with their data', async () => {
  // Moving to another page asks the service worker to keep them.
  await page.getByRole('link', { name: 'Journal' }).click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  const db = new Database(DATABASE, { readonly: true });
  const beans = db.prepare("select id from bean where status = 'open'").all() as { id: string }[];
  db.close();
  const expected = ['/', '/__data.json', '/journal', '/journal/__data.json', '/shot/new'];
  for (const { id } of beans)
    expected.push(`/shot/new?bean=${id}`, `/shot/new/__data.json?bean=${id}&from=journal`);
  await expect.poll(kept).toEqual(expect.arrayContaining(expected));
  // The shot form as the Journal opens it keeps only its data: it only opens from inside the app.
  expect(await kept()).not.toContain('/shot/new?from=journal');
});

test('D-219, D-200, D-117: the kept copies take no "Shot saved" and leave the cookies as they are', async () => {
  // A "Shot saved" waiting for the next page, and the Journal filtered by bean.
  const { origin } = new URL(page.url());
  await page.request.get('/journal?unrated=1');
  await context.addCookies([{ name: 'flash', value: '{"kind":"saved"}', url: origin }]);
  const cookies = async () =>
    Object.fromEntries((await context.cookies()).map((c) => [c.name, c.value]));
  const before = await cookies();
  expect(before['journal-filters']).toBe('unrated=1');

  const copy = await page.request.get('/__data.json', {
    headers: { 'x-coffee-nerd-offline-copy': '1' }
  });
  expect(copy.ok()).toBe(true);
  expect(await copy.text()).not.toContain('saved');
  expect(copy.headers()['set-cookie']).toBeUndefined();
  const journal = await page.request.get('/journal', {
    headers: { 'x-coffee-nerd-offline-copy': '1' }
  });
  expect(journal.headers()['set-cookie']).toBeUndefined();
  expect(await cookies()).toEqual(before);

  // The real visit still gets the message, once.
  const visit = await page.request.get('/__data.json');
  expect(await visit.text()).toContain('saved');
  await page.request.get('/journal');
});

test('D-219: a page opened before is kept as it was opened', async () => {
  await page.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect.poll(kept).toContain('/library/__data.json');
  // Opened as a whole page, the page itself is kept as it arrived: only its data is fetched again.
  const copies: string[] = [];
  const count = (request: Request) => {
    if (request.headers()['x-coffee-nerd-offline-copy'])
      copies.push(new URL(request.url()).pathname);
  };
  context.on('request', count);
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect
    .poll(() => copies.filter((p) => p.startsWith('/library')))
    .toEqual(['/library/__data.json']);
  context.off('request', count);
  expect(await kept()).toEqual(expect.arrayContaining(['/library', '/library/__data.json']));
});

test('D-219: offline, the app opens on Home with the "Offline" line, and "+" opens the shot form', async () => {
  // The form as it opens online, to compare with.
  await page.goto('/shot/new');
  const tag = await page.locator('.cn-tag').innerText();
  await context.setOffline(true);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await expect(line()).toHaveText(OFFLINE_LINE);
  await page.screenshot({ path: 'screenshots/HomeOffline.png' });
  await page.getByRole('link', { name: 'New shot' }).click();
  await expect(page.getByRole('button', { name: 'Save shot' })).toBeVisible();
  await expect(page.locator('.cn-tag')).toHaveText(tag);
  await expect(line()).toHaveText(OFFLINE_LINE);
  await page.screenshot({ path: 'screenshots/ShotFormOffline.png' });
});

test('D-219: offline, a change other than a shot changes nothing and says so', async () => {
  // Saving a shot waits on the phone instead (tab-queue.test.ts); choosing Home's bean needs the server.
  await page.getByRole('link', { name: 'Back without saving' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await page.getByRole('button', { name: /, choose another bean$/ }).click();
  await page.getByRole('region', { name: 'Choose a bean' }).getByRole('button').first().click();
  await expect(line()).toHaveText(NOTHING_CHANGED);
  await page.screenshot({ path: 'screenshots/HomeOfflineChange.png' });
});

test('D-219: offline, the Journal and a page opened before open; another page says it is not kept', async () => {
  await page.goto('/journal');
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  await page.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(line()).toHaveText(OFFLINE_LINE);
  await page.getByRole('link', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { name: 'This page could not open' })).toBeVisible();
  await expect(
    page.getByText('This page is not on the phone yet. Open it once with a connection to keep it.')
  ).toBeVisible();
  await page.screenshot({ path: 'screenshots/PageNotKept.png' });
});

test('D-219: a change that cannot reach the server changes nothing and says so', async () => {
  await page.goto('/');
  await expect(line()).toHaveText(OFFLINE_LINE);
  // Sent straight away, as when the page has not noticed yet: the service worker answers instead.
  const answers = await page.evaluate(async () => {
    const plain = await fetch('/logout', { method: 'POST' });
    const enhanced = await fetch('/journal?/rate', {
      method: 'POST',
      headers: { 'x-sveltekit-action': 'true' },
      body: new FormData()
    });
    return [plain.status, await enhanced.json()];
  });
  // A form without JavaScript stays on its page; one with it fails without problems of its own.
  expect(answers).toEqual([204, { type: 'failure', status: 503, data: '[{}]' }]);
  await expect(line()).toHaveText(NOTHING_CHANGED);
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
});

test('D-219: back online, the "Offline" line goes', async () => {
  await context.setOffline(false);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await expect(line()).toHaveCount(0);
});

test('D-235: a server that has not answered in 4 seconds counts as offline: a kept page opens from its copy', async () => {
  // The server takes 6 seconds, then the answer is lost.
  const slow = (url: URL) => url.pathname === '/journal/__data.json';
  await context.route(slow, async (route) => {
    await new Promise((done) => setTimeout(done, 6_000));
    await route.abort().catch(() => {});
  });
  const pressed = Date.now();
  await page.getByRole('link', { name: 'Journal' }).click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible({ timeout: 10_000 });
  expect(Date.now() - pressed).toBeLessThan(6_000);
  await expect(line()).toHaveText(OFFLINE_LINE);
  await context.unroute(slow);
  // The next answer in time: online again.
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await expect(line()).toHaveCount(0);
});

test('D-225, D-87: a session ended elsewhere leaves nothing of the account on the phone', async () => {
  await expect.poll(kept).toContain('/');
  const db = new Database(DATABASE);
  db.prepare('delete from session').run();
  db.close();
  // The next page finds the sign-in page instead.
  await page.goto('/journal');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect.poll(kept).toEqual([]);
  await page.getByLabel('Name').fill('Demo');
  await page.getByLabel('Password').fill('coffee-nerd');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
});

test('D-225: signing out leaves no page or data of the account on the phone', async () => {
  await expect.poll(kept).toContain('/');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect.poll(kept).toEqual([]);
  // Offline, the app has nothing of the account to open.
  await context.setOffline(true);
  await expect(page.goto('/journal')).rejects.toThrow();
  await context.setOffline(false);
});
