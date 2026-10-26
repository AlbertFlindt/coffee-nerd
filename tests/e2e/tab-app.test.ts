import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// The installable app (roadmap M10, D-217, D-227): the manifest and the logo icons, and the service
// worker that keeps the app's own files on the phone. Nothing is saved.
test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;

async function signIn(p: Page) {
  await p.goto('/login');
  await p.getByLabel('Name').fill('Demo');
  await p.getByLabel('Password').fill('coffee-nerd');
  await p.getByRole('button', { name: 'Sign in' }).click();
  await expect(p.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await signIn(page);
});

test.afterAll(() => context.close());

test('D-217, D-228: the manifest names the app, opens it standalone and uses the logo as icon', async ({
  request
}) => {
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  // Signed out too: the browser fetches the manifest and icons on its own.
  const response = await request.get(href!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: 'Coffee Nerd',
    short_name: 'Coffee Nerd',
    start_url: '/',
    display: 'standalone',
    background_color: '#2E2522',
    theme_color: '#2E2522'
  });
  const icons: { src: string; sizes: string; purpose: string }[] = manifest.icons;
  expect(icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual([
    '192x192 any',
    '512x512 any',
    '512x512 maskable'
  ]);
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  for (const src of [...icons.map((i) => i.src), appleIcon!]) {
    const icon = await request.get(src);
    expect(icon.ok(), src).toBe(true);
    expect(icon.headers()['content-type']).toBe('image/png');
  }
  // The favicon is the logo too.
  expect(await page.locator('link[rel="icon"]').getAttribute('href')).toContain(
    'a%20coffee%20bean%20wearing%20glasses'
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#2E2522');
});

test("D-61: the service worker keeps the app's own files and answers for them", async () => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names.find((n) => n.startsWith('app-'))!);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached).toContain('/manifest.webmanifest');
  expect(cached).toContain('/icons/icon-512.png');
  expect(cached.some((p) => p.startsWith('/_app/immutable/'))).toBe(true);
  // A script of the app comes from the service worker's own copy (pages: tab-offline.test.ts).
  const fromWorker: Record<string, boolean> = {};
  page.on('response', (r) => {
    fromWorker[new URL(r.url()).pathname] = r.fromServiceWorker();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  expect(Object.entries(fromWorker).some(([p, w]) => p.startsWith('/_app/immutable/') && w)).toBe(
    true
  );
});

test('D-219: on the first visit the app is ready offline without opening it again', async ({
  browser
}) => {
  const fresh = await browser.newContext();
  const first = await fresh.newPage();
  await signIn(first);
  // The service worker takes the open page, then keeps Home for offline use, with no reload.
  await expect.poll(() => first.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect
    .poll(() =>
      first.evaluate(async () => {
        const name = (await caches.keys()).find((k) => k.startsWith('pages-'));
        const keys = name ? await (await caches.open(name)).keys() : [];
        return keys.map((r) => new URL(r.url).pathname);
      })
    )
    .toContain('/__data.json');
  await fresh.close();
});

test('D-36: in a browser tab the screen does not stretch or pull down past the end of a list', async () => {
  await page.goto('/journal');
  for (const element of ['html', 'body'])
    await expect(page.locator(element)).toHaveCSS('overscroll-behavior-y', 'none');
  const pageMoves = await page.evaluate(
    () => document.scrollingElement!.scrollHeight > document.scrollingElement!.clientHeight
  );
  expect(pageMoves).toBe(false);
});

test('D-227, D-229: a new version waits until the app is closed, then takes over', async () => {
  // A shot in progress: the form is open and a value was entered.
  await page.goto('/shot/new');
  await page.getByRole('radio', { name: '7' }).click();
  const controller = () =>
    page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null);
  const before = await controller();
  // A new version: the service worker under another address counts as a new one.
  const next = '/service-worker.js?version=next';
  const waiting = await page.evaluate(async (url) => {
    const registration = await navigator.serviceWorker.register(url);
    const worker = registration.installing ?? registration.waiting;
    if (worker && worker.state !== 'installed')
      await new Promise((done) =>
        worker.addEventListener('statechange', () => worker.state === 'installed' && done(null))
      );
    return registration.waiting?.scriptURL ?? null;
  }, next);
  // The open app keeps its version: nothing changes under the shot in progress.
  expect(waiting).toContain(next);
  expect(await controller()).toBe(before);
  await expect(page.getByRole('radio', { name: '7' })).toHaveAttribute('aria-checked', 'true');
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistration())!.active!.scriptURL
    )
  ).not.toContain(next);

  // Closing every window of the app lets the new version take over the next time it opens. The
  // check opens a page without the app's own script, which would register the current version again.
  await page.close();
  await expect
    .poll(async () => {
      const check = await context.newPage();
      await check.goto('/health');
      const url = await check.evaluate(
        async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL
      );
      await check.close();
      return url;
    })
    .toContain(next);
});
