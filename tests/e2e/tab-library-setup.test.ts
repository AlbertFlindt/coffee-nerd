import { expect, test, type Page } from '@playwright/test';

// Edit My setup (screen 13) on the reference setup. Each designed screen is saved to
// screenshots/ for comparing with docs/screens/. The setup is left as it was.
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

async function openEditSetup() {
  await page.goto('/library/gear');
  await expect(page.getByRole('heading', { name: 'Gear', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'My setup', level: 1 })).toBeVisible();
}

/** The dose on the Gear page's My setup card, e.g. "18.0". */
async function doseOnCard(): Promise<string> {
  const text = await page.getByRole('region', { name: 'My setup' }).innerText();
  return /Dose (\d+\.\d) g/.exec(text)![1];
}

test('EditSetup: a full-screen form that starts from My setup', async () => {
  await openEditSetup();
  await expect(page.getByText('Starting point for new beans')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gear', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Default values', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Machine, Lelit Bianca' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grinder, Timemore 064S' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Basket, VST · 18 g' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Puck prep, Daily routine' })).toBeVisible();
  // The steps are the ones in settings, 0.1 g by default.
  await expect(page.getByRole('button', { name: 'Dose plus 0.1 gram' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yield plus 0.1 gram' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Temperature plus 1 degree' })).toBeVisible();
  await expect(page.getByText(/^Ratio 1 : \d\.\d$/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pressure profile/ })).toContainText(
    'Flat 9.0 bar · Preinfusion 4 s · Low bar start 5 s at 2.0 bar'
  );
  await expect(page.getByRole('button', { name: 'Save setup' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await expectNoPageScroll();
  await screenshot('EditSetup');
});

test('EditSetup: the machine picker ticks the chosen machine (screen 44)', async () => {
  await page.getByRole('button', { name: /^Machine,/ }).click();
  await expect(page.getByRole('button', { name: 'Lelit Bianca', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await screenshot('SetupPicker');
  await page.keyboard.press('Escape');
});

test('EditSetup: the basket and puck prep pickers start with "No basket" and "No puck prep"', async () => {
  await page.getByRole('button', { name: /^Basket,/ }).click();
  await expect(page.getByRole('button', { name: 'No basket', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'VST · 18 g', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Puck prep,/ }).click();
  await expect(page.getByRole('button', { name: 'No puck prep', exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'Shots are easier to repeat with a puck prep routine. Add one in Library › Puck prep.'
    )
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'No puck prep', exact: true })).toHaveCount(0);
});

test('EditSetup: the pressure profile opens the phase rows', async () => {
  await page.getByRole('button', { name: /^Pressure profile/ }).click();
  await expect(page.getByRole('switch', { name: 'Preinfusion' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Low bar start' })).toBeVisible();
  await screenshot('SetupPressure');
  await page.keyboard.press('Escape');
});

test('EditSetup: a new dose is saved and shows on My setup', async () => {
  await page.goto('/library/gear');
  const before = await doseOnCard();
  const after = (Number(before) + 0.1).toFixed(1);
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Dose plus 0.1 gram' }).click();
  await page.getByRole('button', { name: 'Save setup' }).click();
  await expect(page.getByRole('heading', { name: 'Gear', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'My setup' })).toContainText(`Dose ${after} g`);

  // Back to what it was, so the reference setup stays as it was.
  await openEditSetup();
  await page.getByRole('button', { name: 'Dose minus 0.1 gram' }).click();
  await page.getByRole('button', { name: 'Save setup' }).click();
  await expect(page.getByRole('heading', { name: 'Gear', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'My setup' })).toContainText(`Dose ${before} g`);
});
