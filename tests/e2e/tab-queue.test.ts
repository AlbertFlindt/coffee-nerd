import Database from 'better-sqlite3';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// Shots saved offline (roadmap M10, D-61, D-220 to D-225, D-231 to D-234): they wait on the phone, show at
// once, and reach the server once when the connection returns. The shots saved here are deleted again at
// the end, and the app state put back, so the files after this one find the data as before.
test.describe.configure({ mode: 'serial' });

const DATABASE = 'test-results/e2e-seeded.db';
const WAITING = 'Waiting to send';

let context: BrowserContext;
let page: Page;
let before: { shots: string[]; appState: Record<string, unknown> };

const db = () => new Database(DATABASE);
const shotIds = () => {
  const d = db();
  try {
    return (d.prepare('select id from shot').all() as { id: string }[]).map((r) => r.id);
  } finally {
    d.close();
  }
};
const newShots = () => shotIds().filter((id) => !before.shots.includes(id));

const entries = () =>
  page.evaluate(
    () =>
      new Promise<{ shotId: string; status: string; kind: string; brewedAt: number }[]>(
        (done, fail) => {
          const open = indexedDB.open('coffee-nerd', 1);
          open.onupgradeneeded = () =>
            open.result.createObjectStore('waiting-shots', { keyPath: 'shotId' });
          open.onsuccess = () => {
            const read = open.result
              .transaction('waiting-shots')
              .objectStore('waiting-shots')
              .getAll();
            read.onsuccess = () => {
              open.result.close();
              done(read.result);
            };
          };
          open.onerror = () => fail(open.error);
        }
      )
  );

const valueOf = (label: string) =>
  page.getByRole('button', { name: new RegExp(`^${label}, .*tap to type$`) }).innerText();

async function screenshot(name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await page.screenshot({ path: `screenshots/${name}.png` });
}

test.beforeAll(async ({ browser }) => {
  const d = db();
  before = {
    shots: (d.prepare('select id from shot').all() as { id: string }[]).map((r) => r.id),
    appState: d.prepare('select * from app_state').get() as Record<string, unknown>
  };
  d.close();
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
  // The pages the phone keeps for offline use are ready: every page with its data (D-219).
  await page.getByRole('link', { name: 'Journal' }).click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  await page.getByRole('link', { name: 'Home' }).click();
  const keptPairs = () =>
    page.evaluate(async () => {
      const name = (await caches.keys()).find((k) => k.startsWith('pages-'));
      const keys = name ? await (await caches.open(name)).keys() : [];
      const kept = keys.map((r) => new URL(r.url).pathname + new URL(r.url).search);
      const pages = kept.filter((k) => !k.includes('__data.json'));
      return {
        pages: pages.length,
        withData: pages.filter((p) => {
          const [path, search] = p.split('?');
          const data = `${path.replace(/\/$/, '')}/__data.json${search ? `?${search}` : ''}`;
          return kept.includes(data);
        }).length
      };
    });
  // Every open bean adds a shot-form page; the shots logged by earlier files decide how many there are.
  // They are kept one after the other, so the check waits until the last one has its data.
  await expect
    .poll(async () => {
      const { pages, withData } = await keptPairs();
      return pages > 2 && withData === pages;
    })
    .toBe(true);
});

test.afterAll(async () => {
  await context.close();
  const d = db();
  const added = newShots();
  for (const id of added) {
    d.prepare('delete from shot_tag where shot_id = ?').run(id);
    d.prepare('delete from shot where id = ?').run(id);
  }
  d.prepare(
    'delete from recipe where id not in (select recipe_id from shot) and id not in (select brew_next_recipe_id from app_state where brew_next_recipe_id is not null)'
  ).run();
  const { user_id, ...rest } = before.appState;
  const columns = Object.keys(rest);
  d.prepare(
    `update app_state set ${columns.map((c) => `${c} = ?`).join(', ')} where user_id = ?`
  ).run(...columns.map((c) => rest[c]), user_id);
  d.close();
});

let savedAt = 0;

test('D-61, D-220, D-232: offline, a saved shot waits on the phone and the page returns as online', async () => {
  await context.setOffline(true);
  await page.getByRole('link', { name: 'New shot' }).click();
  await expect(page.getByRole('button', { name: 'Save shot' })).toBeVisible();
  await page.getByRole('button', { name: 'Grind plus 0.1' }).click();
  const grind = await valueOf('Grind');
  savedAt = Date.now();
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await expect(page.getByText('Shot saved')).toBeVisible();
  // D-221, D-233: Home's Last shot card shows it at once.
  const card = page.getByRole('region', { name: 'Last shot' });
  await expect(card.getByText(WAITING)).toBeVisible();
  await expect(card.getByText(`Grind ${grind}`)).toBeVisible();
  expect(newShots()).toEqual([]);
  expect(await entries()).toEqual([expect.objectContaining({ kind: 'new', status: 'waiting' })]);
  await expect(page.getByText('Shot saved')).toHaveCount(0);
  await screenshot('HomeWaiting');
});

test('D-222: the next shot starts from the waiting shot', async () => {
  const card = page.getByRole('region', { name: 'Last shot' });
  const grind = (await card.getByText(/^Grind /).innerText()).replace('Grind ', '');
  await page.getByRole('link', { name: 'New shot' }).click();
  await expect(page.getByRole('button', { name: 'Save shot' })).toBeVisible();
  expect(await valueOf('Grind')).toContain(grind);
  await expect(page.locator('.cn-tag')).toHaveText(/Recipe reused 1x/);
  await page.getByRole('link', { name: 'Back without saving' }).click();
});

test('D-221, D-223: the Journal shows the waiting shot first, and it can be rated offline', async () => {
  await page.getByRole('link', { name: 'Journal' }).click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  const first = page.locator('main .item').first();
  await expect(first.getByText(WAITING)).toBeVisible();
  await first.getByRole('button', { name: /^Rate the shot/ }).click();
  await page.getByRole('radio', { name: '8' }).click();
  await expect(page.getByRole('region', { name: 'Rate the shot' })).toHaveCount(0);
  await expect(first.getByText('8', { exact: true })).toBeVisible();
  await expect(first.getByText(WAITING)).toBeVisible();
  expect(newShots()).toEqual([]);
  await screenshot('JournalWaiting');
});

test('D-231: tapping a waiting shot opens its form; a change keeps it waiting with its brew time', async () => {
  await page.locator('main .item').first().getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Edit shot' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '8' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Time plus 1 second' }).click();
  const time = await valueOf('Time');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  const first = page.locator('main .item').first();
  await expect(first.getByText(WAITING)).toBeVisible();
  await expect(first).toContainText(time.replace(/\s+/g, ' ').replace(' s', ''));
  const [entry] = await entries();
  expect(entry.brewedAt).toBeGreaterThanOrEqual(savedAt);
  expect(entry.brewedAt).toBeLessThan(savedAt + 5000);
});

test('D-61, D-220, D-223: back online, the shot reaches the server once, with its brew time and score', async () => {
  const [entry] = await entries();
  await context.setOffline(false);
  await expect(page.locator('main .item').first().getByText(WAITING)).toHaveCount(0, {
    timeout: 15_000
  });
  expect(await entries()).toEqual([]);
  expect(newShots()).toEqual([entry.shotId]);
  const d = db();
  const row = d
    .prepare('select brewed_at, score, time from shot where id = ?')
    .get(entry.shotId) as {
    brewed_at: number;
    score: number;
    time: number;
  };
  d.close();
  expect(row.brewed_at).toBe(entry.brewedAt);
  expect(row.score).toBe(8);

  // Sent again (an answer lost on the way): nothing changes.
  const again = await page.evaluate(async (id) => {
    const response = await fetch('/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ownerId: 'x', kind: 'rate', shotId: id, score: 3 })
    });
    return response.status;
  }, entry.shotId);
  expect(again).toBe(409);
  expect(newShots()).toEqual([entry.shotId]);
});

test('D-224: a waiting shot the server refuses is kept as "Not saved", to fix or delete', async () => {
  await context.setOffline(true);
  await page.getByRole('link', { name: 'New shot' }).click();
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  // A shot the server cannot take: its grinder is unknown there.
  await page.evaluate(
    () =>
      new Promise((done) => {
        const open = indexedDB.open('coffee-nerd', 1);
        open.onsuccess = () => {
          const store = open.result
            .transaction('waiting-shots', 'readwrite')
            .objectStore('waiting-shots');
          const read = store.getAll();
          read.onsuccess = () => {
            const [entry] = read.result;
            entry.shot.grinderId = 'no-such-grinder';
            store.put(entry).onsuccess = () => done(null);
          };
        };
      })
  );
  const count = shotIds().length;
  await context.setOffline(false);
  await page.reload();
  const first = page.locator('main .item').first();
  await expect(first.getByText('Not saved')).toBeVisible({ timeout: 15_000 });
  expect(shotIds()).toHaveLength(count);
  await screenshot('JournalNotSaved');

  await first.getByRole('link').click();
  await expect(
    page.getByText(
      'Not saved: the server did not take this shot. Change it and save again, or delete it.'
    )
  ).toBeVisible();
  await screenshot('ShotFormNotSaved');
  await page.getByRole('button', { name: 'Delete shot' }).click();
  await page
    .getByRole('region', { name: 'Delete this shot' })
    .getByRole('button', { name: 'Delete shot' })
    .click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  await expect(page.getByText('Not saved')).toHaveCount(0);
  expect(await entries()).toEqual([]);
});

test('D-225, D-234: signing out asks first while a shot waits, then leaves nothing on the phone', async () => {
  // A shot that cannot reach the server yet.
  await context.route('**/queue', (route) => route.abort());
  await context.setOffline(true);
  await page.goto('/shot/new');
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd' })).toBeVisible();
  await expect.poll(entries).toHaveLength(1);
  await context.setOffline(false);

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByText(/^Version of \d+ \w+ \d{4}, \d\d:\d\d$/)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  const sheet = page.getByRole('region', { name: 'Sign out' });
  await expect(
    sheet.getByRole('heading', { name: '1 shot is still waiting to send' })
  ).toBeVisible();
  await screenshot('SignOutWaiting');
  await sheet.getByRole('button', { name: 'Stay signed in' }).click();
  await expect(sheet).toHaveCount(0);
  expect(await entries()).toHaveLength(1);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page
    .getByRole('region', { name: 'Sign out' })
    .getByRole('button', { name: 'Sign out and delete' })
    .click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(await entries()).toEqual([]);
  await context.unroute('**/queue');
});
