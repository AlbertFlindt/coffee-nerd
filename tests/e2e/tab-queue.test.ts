import Database from 'better-sqlite3';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { dataUrl } from '../../src/lib/offline';

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
  const keptNow = () =>
    page.evaluate(async () => {
      const name = (await caches.keys()).find((k) => k.startsWith('pages-'));
      const keys = name ? await (await caches.open(name)).keys() : [];
      return keys.map((r) => new URL(r.url).pathname + new URL(r.url).search);
    });
  // Every open bean adds a shot-form page; the shots logged by earlier files decide how many there are.
  // They are kept one after the other, so the check waits until every page the server lists is there
  // with its data, not only those kept so far.
  const listed = await page.evaluate(
    async () => (await fetch('/offline')).json() as Promise<string[]>
  );
  expect(listed.length).toBeGreaterThan(2);
  await expect
    .poll(async () => {
      const kept = await keptNow();
      // The shot form as the Journal opens it keeps only its data.
      const page = (p: string) => p.includes('from=journal') || kept.includes(p);
      return listed.filter((p) => !page(p) || !kept.includes(dataUrl(p)));
    })
    .toEqual([]);
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
  const sentBodies: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/queue') sentBodies.push(r.postData()!);
  });
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

  const [phoneSent] = sentBodies;
  // Sent again under another account: refused, nothing changes.
  const send = (body: unknown) =>
    page.evaluate(async (b) => {
      const response = await fetch('/queue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(b)
      });
      return response.status;
    }, body);
  expect(await send({ ownerId: 'x', kind: 'rate', shotId: entry.shotId, score: 3 })).toBe(409);
  // Sent again by the phone (an answer lost on the way): still one shot, with the same score.
  expect(await send(JSON.parse(phoneSent))).toBe(200);
  expect(newShots()).toEqual([entry.shotId]);
  const d2 = db();
  expect(d2.prepare('select score from shot where id = ?').get(entry.shotId)).toEqual({ score: 8 });
  d2.close();
});

test('D-220: an edit saved offline keeps the brew time of its shot', async () => {
  const [id] = newShots();
  const brewedAt = () => {
    const d = db();
    const row = d.prepare('select brewed_at from shot where id = ?').get(id) as {
      brewed_at: number;
    };
    d.close();
    return row.brewed_at;
  };
  await page.goto(`/journal/${id}/edit`);
  await expect(page.getByRole('heading', { name: 'Edit shot' })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Time plus 1 second' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  const [entry] = await entries();
  expect(entry).toEqual(expect.objectContaining({ kind: 'edit', brewedAt: brewedAt() }));
  await context.setOffline(false);
  await expect.poll(entries, { timeout: 15_000 }).toEqual([]);
  expect(brewedAt()).toBe(entry.brewedAt);
});

test('D-239, D-238: the edit page shows the change waiting for the shot; it can be discarded or saved', async () => {
  const [id] = newShots();
  const timeOnServer = () => {
    const d = db();
    const row = d.prepare('select time from shot where id = ?').get(id) as { time: number };
    d.close();
    return row.time;
  };
  const before = timeOnServer();
  // An edit saved offline that cannot reach the server yet.
  const waitWithChange = async () => {
    await context.route('**/queue', (route) => route.abort());
    await page.goto(`/journal/${id}/edit`);
    await expect(page.getByRole('heading', { name: 'Edit shot' })).toBeVisible();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Time plus 1 second' }).click();
    const time = await valueOf('Time');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
    await context.setOffline(false);
    return time;
  };

  const time = await waitWithChange();
  await page.goto(`/journal/${id}/edit`);
  expect(await valueOf('Time')).toBe(time);
  await screenshot('EditWaitingChange');
  await page.getByRole('button', { name: 'Discard change' }).click();
  await expect(page.getByRole('heading', { name: 'Edit shot' })).toHaveCount(0);
  expect(await entries()).toEqual([]);
  expect(timeOnServer()).toBe(before);

  // An online save the server refuses or fails on leaves the change waiting as it was.
  const kept = await waitWithChange();
  for (const answer of [
    {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'failure',
        status: 400,
        data: '[{"problems":1},[2],"Refused."]'
      })
    },
    { status: 500, contentType: 'text/html', body: '<p>Internal Error</p>' }
  ]) {
    await page.goto(`/journal/${id}/edit`);
    const save = (url: URL) => url.pathname.endsWith('/edit') && url.search === '?/save';
    await context.route(save, (route) => route.fulfill(answer));
    const answered = page.waitForResponse((r) => save(new URL(r.url())));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await answered;
    await expect.poll(async () => (await entries()).map((e) => e.shotId)).toEqual([id]);
    await context.unroute(save);
    await page.goto('/journal');
    await page.goto(`/journal/${id}/edit`);
    expect(await valueOf('Time')).toBe(kept);
  }
  expect(timeOnServer()).toBe(before);
  await page.getByRole('button', { name: 'Discard change' }).click();
  await expect(page.getByRole('heading', { name: 'Edit shot' })).toHaveCount(0);

  const again = await waitWithChange();
  await page.goto(`/journal/${id}/edit`);
  expect(await valueOf('Time')).toBe(again);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Edit shot' })).toHaveCount(0);
  expect(await entries()).toEqual([]);
  expect(timeOnServer()).toBe(before + 1000);
  await context.unroute('**/queue');
});

test('D-220, D-61: several waiting shots arrive once each, in brew order, also when a send is cut off', async () => {
  const before = shotIds();
  await page.goto('/journal');
  await context.setOffline(true);
  for (let i = 0; i < 2; i++) {
    await page.getByRole('link', { name: 'New shot' }).click();
    await page.getByRole('button', { name: 'Save shot' }).click();
    await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  }
  const waitingIds = (await entries()).sort((a, b) => a.brewedAt - b.brewedAt).map((e) => e.shotId);
  expect(waitingIds).toHaveLength(2);
  // The first send reaches the server, but its answer is lost on the way back.
  let cut = true;
  await context.route('**/queue', async (route) => {
    if (!cut) return route.continue();
    cut = false;
    await route.fetch();
    return route.abort();
  });
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        await page.evaluate(() => dispatchEvent(new Event('online')));
        return (await entries()).length;
      },
      { timeout: 15_000 }
    )
    .toBe(0);
  const d = db();
  const arrived = (
    d.prepare(`select id from shot where id in (?, ?) order by brewed_at`).all(...waitingIds) as {
      id: string;
    }[]
  ).map((r) => r.id);
  d.close();
  expect(arrived).toEqual(waitingIds);
  expect(shotIds().filter((s) => !before.includes(s))).toHaveLength(2);
  await context.unroute('**/queue');
});

test('D-237: a shot the server keeps failing on is "Not saved" with the reason, to save again or delete', async () => {
  await page.goto('/journal');
  await context.setOffline(true);
  await page.getByRole('link', { name: 'New shot' }).click();
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  // The server answers with an error of its own, every time.
  let tries = 0;
  await context.route('**/queue', (route) => {
    tries += 1;
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Internal Error' })
    });
  });
  await context.setOffline(false);
  const first = page.locator('main .item').first();
  await expect
    .poll(
      async () => {
        await page.evaluate(() => dispatchEvent(new Event('online')));
        return first.getByText('Not saved').count();
      },
      { timeout: 15_000 }
    )
    .toBe(1);
  expect(tries).toBe(3);
  await first.getByRole('link').click();
  await expect(page.getByText('The server could not save it.')).toBeVisible();
  await screenshot('ShotFormServerFailed');
  await context.unroute('**/queue');
  await page.getByRole('button', { name: 'Delete shot' }).click();
  await page
    .getByRole('region', { name: 'Delete this shot' })
    .getByRole('button', { name: 'Delete shot' })
    .click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  expect(await entries()).toEqual([]);
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

test('D-235: a save the server has not answered in 4 seconds waits on the phone, and so does a slow send', async () => {
  const before = shotIds();
  await page.goto('/journal');
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
  // The server takes 6 seconds, then the answer is lost.
  const slow = (url: URL) =>
    url.pathname === '/queue' || (url.pathname === '/shot/new' && url.search === '?/save');
  await context.route(slow, async (route) => {
    await new Promise((done) => setTimeout(done, 6_000));
    await route.abort().catch(() => {});
  });
  await page.getByRole('link', { name: 'New shot' }).click();
  await expect(page.getByRole('button', { name: 'Save shot' })).toBeVisible();
  const pressed = Date.now();
  await page.getByRole('button', { name: 'Save shot' }).click();
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Shot saved')).toBeVisible();
  expect(Date.now() - pressed).toBeLessThan(6_000);
  // Sending it times out as well: it keeps waiting, it is not "Not saved".
  await page.waitForTimeout(5_000);
  expect(await entries()).toEqual([expect.objectContaining({ kind: 'new', status: 'waiting' })]);
  await context.unroute(slow);
  await expect
    .poll(
      async () => {
        await page.evaluate(() => dispatchEvent(new Event('online')));
        return (await entries()).length;
      },
      { timeout: 15_000 }
    )
    .toBe(0);
  expect(shotIds().filter((s) => !before.includes(s))).toHaveLength(1);
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
