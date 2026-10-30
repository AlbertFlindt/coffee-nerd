#!/usr/bin/env node
// Release version helper. Every merge to main that changes the app ships as a release.
//
//   node scripts/version.mjs get          print the version in package.json
//   node scripts/version.mjs check        every place names the same version, and CHANGELOG.md
//                                         has a section for it (run by `npm run lint`)
//   node scripts/version.mjs bump X.Y.Z   set the version in the mechanical places; the
//                                         CHANGELOG.md section is written by hand, then run check
//   node scripts/version.mjs notes        print the current version's CHANGELOG section (release notes)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^\d+\.\d+\.\d+$/;
const LATEST = /(\*\*Latest release:\*\* )(\d+\.\d+\.\d+|none yet)/;

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const readIfThere = (rel) => {
  try {
    return read(rel);
  } catch {
    return '';
  }
};
const write = (rel, text) => writeFileSync(join(ROOT, rel), text);
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function get() {
  return JSON.parse(read('package.json')).version;
}

/** The body of the `## X.Y.Z (date)` section, or null. */
export function notes(version, changelog = readIfThere('CHANGELOG.md')) {
  const match = changelog.match(
    new RegExp(`^## ${escape(version)} \\(.*?\\)\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm')
  );
  const body = match?.[1].trim();
  return body ? body : null;
}

/** Every disagreement, as one line each; empty when the version is consistent. */
export function problems() {
  const version = get();
  const errors = [];
  if (!SEMVER.test(version)) errors.push(`package.json: "${version}" is not X.Y.Z`);
  const lock = JSON.parse(read('package-lock.json'));
  if (lock.version !== version)
    errors.push(`package-lock.json: expected ${version}, found ${lock.version}`);
  const root = lock.packages?.['']?.version;
  if (root !== version)
    errors.push(`package-lock.json packages[""]: expected ${version}, found ${root}`);
  const latest = read('PROGRESS.md').match(LATEST)?.[2];
  if (latest !== version)
    errors.push(`PROGRESS.md "Latest release": expected ${version}, found ${latest ?? 'nothing'}`);
  if (!notes(version)) errors.push(`CHANGELOG.md: no '## ${version} (YYYY-MM-DD)' section`);
  return errors;
}

export function bump(version) {
  if (!SEMVER.test(version)) throw new Error(`not a version: ${version}`);
  const pkg = JSON.parse(read('package.json'));
  pkg.version = version;
  write('package.json', JSON.stringify(pkg, null, 2) + '\n');
  const lock = JSON.parse(read('package-lock.json'));
  lock.version = version;
  lock.packages[''].version = version;
  write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  const progress = read('PROGRESS.md');
  if (!LATEST.test(progress)) throw new Error('PROGRESS.md has no "**Latest release:** " line');
  write('PROGRESS.md', progress.replace(LATEST, `$1${version}`));
}

function main([command, arg]) {
  if (command === 'get') {
    console.log(get());
  } else if (command === 'check') {
    const errors = problems();
    for (const error of errors) console.error(`    ${error}`);
    if (errors.length) {
      console.error(`Version ${get()} is not consistent (see the release skill).`);
      process.exit(1);
    }
    console.log(`Version ${get()} is consistent.`);
  } else if (command === 'bump' && arg) {
    bump(arg);
    console.log(`Set ${arg}. Now add the CHANGELOG.md section and run check.`);
  } else if (command === 'notes') {
    const text = notes(get());
    if (!text) {
      console.error(`CHANGELOG.md has no section for ${get()}`);
      process.exit(1);
    }
    console.log(text);
  } else {
    console.error('Usage: node scripts/version.mjs get | check | bump X.Y.Z | notes');
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
