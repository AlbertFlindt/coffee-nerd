// Saves a 412 × 915 screenshot of a route to screenshots/, for comparing with docs/screens/.
// Usage: npm run screenshot -- <route> [name]. Needs a running server (npm run dev); override with BASE_URL.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [route, name] = process.argv.slice(2);
if (!route?.startsWith('/')) {
  console.error('Usage: npm run screenshot -- <route> [name]   e.g. npm run screenshot -- / Home');
  process.exit(1);
}

const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';
const fileName = `${name ?? (route.replace(/^\/|\/$/g, '').replaceAll('/', '-') || 'root')}.png`;
const out = join('screenshots', fileName);
mkdirSync('screenshots', { recursive: true });

// The reference PNGs in docs/screens/ are 412 × 915 at 2× pixel density.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2
  });
  const response = await page.goto(new URL(route, baseURL).href, { waitUntil: 'networkidle' });
  if (!response?.ok()) throw new Error(`${route} answered ${response?.status() ?? 'nothing'}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  console.log(`Saved ${out}`);
} catch (err) {
  console.error(`Could not screenshot ${route} at ${baseURL}: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
