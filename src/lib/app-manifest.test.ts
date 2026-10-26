import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The manifest and app.html cannot read CSS tokens, so they repeat the page background; this keeps
// them in step with the design system after a sync (D-58, D-217).
const bg = JSON.parse(readFileSync('design-system/tokens.json', 'utf8')).color.tokens.find(
  (t: { name: string }) => t.name === 'bg'
).value.dark;

describe('installable app colors', () => {
  it('D-217: the manifest uses the page background', () => {
    const manifest = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf8'));
    expect(manifest.background_color).toBe(bg);
    expect(manifest.theme_color).toBe(bg);
  });

  it('D-217: the theme color in app.html is the page background', () => {
    expect(readFileSync('src/app.html', 'utf8')).toContain(
      `<meta name="theme-color" content="${bg}" />`
    );
  });
});
