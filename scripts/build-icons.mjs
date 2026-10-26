// Draws the home-screen icons from the logo (D-217), into static/icons/. The favicon is the logo
// itself (src/routes/+layout.svelte).
// Usage: npm run icons. Run it again after a design-system sync changes the logo.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const LOGO = 'design-system/logo/coffee-nerd-mark.svg';
const OUT = 'static/icons';
// The page background (tokens.json "bg"): the square behind the mark where a phone needs one.
const BG = JSON.parse(readFileSync('design-system/tokens.json', 'utf8')).color.tokens.find(
  (t) => t.name === 'bg'
).value.dark;

const svg = readFileSync(LOGO, 'utf8');
// The bean fits a circle of radius 16 around (20, 21) in the logo's 40 × 40 box, and a box about
// 27 × 32 units. Android crops an adaptive (maskable) icon to a circle whose radius is 40 % of its size,
// so there the box at 90 % of the icon, centred on the bean, keeps the whole bean inside it. The plain
// icons, which a launcher may shrink onto a white disc, are cropped to the bean: it fills 92 % of their
// height (D-217, D-230).
const icons = [
  { file: 'icon-192.png', size: 192, background: null, scale: 1.17 },
  { file: 'icon-512.png', size: 512, background: null, scale: 1.17 },
  { file: 'icon-maskable-512.png', size: 512, background: BG, scale: 0.9 },
  // iOS fills a transparent icon with black, so its icon carries the background too.
  { file: 'apple-touch-icon.png', size: 180, background: BG, scale: 0.9 }
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const { file, size, background, scale } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<body style="margin:0;background:${background ?? 'transparent'}">` +
        `<div style="width:${size}px;height:${size}px;transform:translateY(${(-scale * size) / 40}px) scale(${scale})">` +
        svg.replace(/width="40" height="40"/, `width="${size}" height="${size}"`) +
        '</div></body>'
    );
    await page.screenshot({ path: join(OUT, file), omitBackground: background === null });
    await page.close();
    console.log(`Saved ${join(OUT, file)}`);
  }
} finally {
  await browser.close();
}
