#!/usr/bin/env node
// Keep the handoff docs lean (run by CI's checks job).
//
// Each file loaded into every Claude session, or read before every change, has a line budget,
// and none talks about the people behind the project in the third person: write the decision
// and its reason, not who made it. Over budget means prune (the release skill says how), not
// raise the number.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET = { 'CLAUDE.md': 85, 'PROGRESS.md': 110, 'ROADMAP.md': 50 };
const NO_PEOPLE = /\b(Albert|the owner|owner's)\b/;
const markdown = (dir) =>
  readdirSync(join(ROOT, dir), { recursive: true })
    .filter((file) => file.endsWith('.md'))
    .map((file) => join(dir, file));
const checked = [
  ...Object.keys(BUDGET),
  'docs/SPEC.md',
  'docs/design-gaps.md',
  ...markdown('.claude')
];

const errors = [];
for (const [file, limit] of Object.entries(BUDGET)) {
  const lines = readFileSync(join(ROOT, file), 'utf8').trimEnd().split('\n').length;
  if (lines > limit) errors.push(`${file}: ${lines} lines, budget ${limit}`);
}
for (const file of checked) {
  readFileSync(join(ROOT, file), 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (NO_PEOPLE.test(line))
        errors.push(
          `${relative(ROOT, join(ROOT, file))}:${i + 1}: names a person; state the decision and its reason instead`
        );
    });
}
for (const error of errors) console.error(`    ${error}`);
if (errors.length) process.exit(1);
console.log('The handoff docs are within budget.');
