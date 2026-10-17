// Generates tokens.css from tokens.json. Run: node design-system/build-tokens.mjs
// tokens.json is a synced copy of the design system artifact; never edit tokens.css by hand.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'));
const theme = t.color.themes[0].id; // dark-first; a light theme gets its own validated steps later

const resolve = (v) => v.replace(/^\{(.+)\}$/, 'var(--$1)');
const lines = [];
for (const c of t.color.tokens) lines.push(`  --${c.name}: ${resolve(c.value[theme])};`);
for (const [k, v] of Object.entries(t.type.families)) lines.push(`  --font-${k}: ${v};`);
for (const group of ['spacing', 'radius', 'size']) {
  for (const s of t[group].tokens) lines.push(`  --${s.name}: ${s.value};`);
}

const typeClasses = t.type.groups
  .flatMap((g) => g.styles)
  .map(
    (s) =>
      `.cn-type-${s.name}{font-size:${s.fontSize};line-height:${s.lineHeight};font-weight:${s.fontWeight}` +
      (s.letterSpacing ? `;letter-spacing:${s.letterSpacing}` : '') +
      '}'
  );

const css = `/* GENERATED from tokens.json by build-tokens.mjs. Do not edit. */
:root{
  color-scheme: ${theme};
${lines.join('\n')}
}
${typeClasses.join('\n')}
`;
writeFileSync(join(here, 'tokens.css'), css);
console.log(`tokens.css: ${lines.length} variables, ${typeClasses.length} type styles`);
