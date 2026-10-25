import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';

// Home (screen 6, roadmap M8) on the shots logged by the shot-* files, which run first (files run in name
// order, one worker). Each test leaves the data as it found it: the bean added for switching is removed,
// a score taken away is given back. The designed screen is saved to screenshots/ for comparing.
test.describe.configure({ mode: 'serial' });

const DATABASE = 'test-results/e2e-seeded.db';

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

function sql<T = unknown>(query: string, ...params: unknown[]): T {
  const db = new Database(DATABASE);
  try {
    const statement = db.prepare(query);
    return (statement.reader ? statement.get(...params) : statement.run(...params)) as T;
  } finally {
    db.close();
  }
}

const lastShot = () => page.getByRole('region', { name: 'Last shot' });
const best = () => page.getByRole('region', { name: 'Best recipe for this bean' });
const numbers = () => page.getByRole('region', { name: 'Quick numbers' });
const pill = () => page.getByRole('button', { name: /, choose another bean$/ });
const openCount = () =>
  sql<{ n: number }>("select count(*) as n from bean where status = 'open'").n;

test('Home, D-32, D-34: banner, bean pill, last shot, quick numbers and best recipe', async () => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Coffee Nerd', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(pill()).toHaveText('Guji Hambela · Natural');
  await expect(page.getByText(`${openCount()} open`, { exact: true })).toBeVisible();
  await expect(lastShot()).toContainText(/Today \d\d:\d\d/);
  // D-91, D-11: what was not entered is left out; grind and dose always are.
  await expect(lastShot()).toContainText(/Grind \d\.\d/);
  await expect(lastShot()).toContainText(/In \d+\.\d g/);
  await expect(lastShot().locator('.cn-tag')).toHaveText(/^(Recipe reused \d+x|New recipe)$/);
  await expect(numbers()).toContainText(/Bean freshness\s*\d+ days\s*since roast/);
  // D-194: this bean's shots since Monday, their average and how many are rated.
  await expect(numbers()).toContainText(/This week\s*\d+ shots?/);
  // D-197, D-135: the best recipe's score as on the Beans pages.
  await expect(best()).toContainText(/^Best recipe for this bean\s*\d+(\.\d)? \/ 10/);
  await expect(best()).toContainText(/Grind \d\.\d · \d+\.\d g/);
  await expect(best()).toContainText(/Reused \d+x|Tried once/);
  // D-196: the score of the last rated shots, oldest first, as the only graph (D-193).
  const graph = page.getByRole('region', { name: 'Dial-in progress' });
  await expect(graph).toContainText(/Score per shot · last \d+ shots/);
  await expect(graph.getByRole('img', { name: /^Score per shot, oldest first: / })).toBeVisible();
  await expect(graph).toContainText('Last shot');
  await expect(graph).toContainText('New recipe');
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expectNoPageScroll();
  await screenshot('Home');
});

test('D-196: with more rated shots, recipe changes are marked on the graph', async () => {
  // Rate the bean's unrated shots for this test only; the shot-* files brewed several recipes.
  const db = new Database(DATABASE);
  const unrated = db
    .prepare(
      `select s.id from shot s join recipe r on r.id = s.recipe_id join bean b on b.id = r.bean_id
       where b.name = 'Guji Hambela' and s.score is null`
    )
    .all() as { id: string }[];
  db.close();
  unrated.forEach(({ id }, i) => sql('update shot set score = ? where id = ?', 5 + (i % 4), id));
  try {
    await page.reload();
    const graph = page.getByRole('region', { name: 'Dial-in progress' });
    await expect(graph.getByRole('img', { name: /a new recipe at shot \d+/ })).toBeVisible();
    await expectNoPageScroll();
    await screenshot('HomeDialIn');
  } finally {
    for (const { id } of unrated) sql('update shot set score = null where id = ?', id);
  }
});

test('D-36: on a shorter screen the graph gives up height, and Home still fits', async () => {
  await page.setViewportSize({ width: 412, height: 780 });
  try {
    await expect(
      page.getByRole('region', { name: 'Dial-in progress' }).getByRole('img')
    ).toBeVisible();
    await expectNoPageScroll();
  } finally {
    await page.setViewportSize({ width: 412, height: 915 });
  }
});

test('D-197: the last shot opens its detail, and Back returns to Home', async () => {
  await lastShot().getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Shot', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd', level: 1 })).toBeVisible();
});

test('D-197: the best recipe opens the bean page', async () => {
  await best().getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Guji Hambela', level: 1 })).toBeVisible();
  await page.goto('/');
});

test('D-197, D-111: an unrated last shot has a Rate block that saves its score', async () => {
  const shot = sql<{ id: string; score: number | null }>(
    'select id, score from shot order by brewed_at desc, id desc limit 1'
  );
  sql('update shot set score = null where id = ?', shot.id);
  try {
    await page.reload();
    const rate = page.getByRole('button', { name: /^Rate the shot at / });
    await expect(rate).toBeVisible();
    await rate.click();
    const sheet = page.getByRole('region', { name: 'Rate the shot' });
    await sheet.getByRole('radio', { name: '6', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(lastShot()).toContainText('6score');
    await expect(rate).toBeHidden();
  } finally {
    sql('update shot set score = ? where id = ?', shot.score, shot.id);
  }
});

test('D-195: switching the bean on Home changes every card and the bean "+" starts from', async () => {
  const guji = sql<{ id: string }>("select id from bean where name = 'Guji Hambela'").id;
  const now = Date.now();
  sql(
    `insert into bean (id, owner_id, name, process, roast_date, status, created_at, updated_at)
     select 'home-test-bean', owner_id, 'Huila Pink Bourbon', 'washed', date('now', '-5 days'), 'open', ?, ?
     from bean where id = ?`,
    now,
    now,
    guji
  );
  try {
    await page.reload();
    await expect(page.getByText(`${openCount()} open`, { exact: true })).toBeVisible();
    await pill().click();
    const sheet = page.getByRole('region', { name: 'Choose a bean' });
    await expect(sheet.getByRole('button', { name: /Guji Hambela/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await sheet.getByRole('button', { name: /Huila Pink Bourbon/ }).click();
    await expect(pill()).toHaveText('Huila Pink Bourbon · Washed');
    // D-198: a bean without shots keeps the layout, with plain lines.
    await expect(lastShot()).toContainText('No shots yet');
    await expect(numbers()).toContainText(/Bean freshness\s*5 days/);
    await expect(numbers()).toContainText(/This week\s*0 shots\s*No shots yet/);
    await expect(best()).toContainText('No shots yet');
    await expect(page.getByRole('region', { name: 'Dial-in progress' })).toContainText(
      'No shots yet'
    );
    await expectNoPageScroll();
    await screenshot('HomeNoShots');

    await page.getByRole('link', { name: 'New shot' }).click();
    await expect(page.getByText('Huila Pink Bourbon · Washed')).toBeVisible();
    await page.goto('/');
    await pill().click();
    await sheet.getByRole('button', { name: /Guji Hambela/ }).click();
    await expect(pill()).toHaveText('Guji Hambela · Natural');
  } finally {
    sql("update app_state set current_bean_id = ? where current_bean_id = 'home-test-bean'", guji);
    sql("delete from bean where id = 'home-test-bean'");
  }
});

test('D-198: with no open bean, Home offers Add bean', async () => {
  const db = new Database(DATABASE);
  const open = db.prepare("select id from bean where status = 'open'").all() as { id: string }[];
  db.close();
  sql("update bean set status = 'finished', finished_at = ? where status = 'open'", Date.now());
  try {
    await page.reload();
    const card = page.getByRole('region', { name: 'No open beans' });
    await expect(card).toBeVisible();
    await expect(pill()).toBeHidden();
    await expectNoPageScroll();
    await screenshot('HomeNoBean');
    await card.getByRole('link', { name: 'Add bean' }).click();
    await expect(page).toHaveURL(/\/library\/beans\/new$/);
  } finally {
    for (const { id } of open)
      sql("update bean set status = 'open', finished_at = null where id = ?", id);
  }
});

test('D-199: the gear opens Settings with Sign out, and Back returns to Home', async () => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expectNoPageScroll();
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Nerd', level: 1 })).toBeVisible();
});
