#!/usr/bin/env node
// Release version helper. main carries the next version; every merge that changes the app
// publishes a pre-release of it, and a release pull request dates it as a stable release.
//
//   node scripts/version.mjs get          print the version in package.json (the one being worked on)
//   node scripts/version.mjs stable       print the latest stable version (the newest dated CHANGELOG section)
//   node scripts/version.mjs state        print "unreleased" or "stable" for the current version
//   node scripts/version.mjs check        every place names the right version, and CHANGELOG.md
//                                         has a section with entries for it (run by `npm run lint`)
//   node scripts/version.mjs bump X.Y.Z   work towards X.Y.Z: set package.json and the lockfile, and
//                                         name the top "(unreleased)" CHANGELOG section X.Y.Z (or add one)
//   node scripts/version.mjs release      date the current version's CHANGELOG section and set
//                                         "Latest release" in PROGRESS.md
//   node scripts/version.mjs notes        print the current version's CHANGELOG section (release notes)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^\d+\.\d+\.\d+$/;
const SECTION = /^## (\d+\.\d+\.\d+) \((unreleased|\d{4}-\d{2}-\d{2})\)$/gm;
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

/** Every CHANGELOG section as { version, when, index }, newest first; `when` is "unreleased" or a date. */
export function sections(changelog = readIfThere('CHANGELOG.md')) {
  return [...changelog.matchAll(SECTION)].map((m) => ({
    version: m[1],
    when: m[2],
    index: m.index
  }));
}

/** "unreleased", "stable", or null when CHANGELOG.md has no section for the version. */
export function state(version = get(), changelog = readIfThere('CHANGELOG.md')) {
  const found = sections(changelog).find((s) => s.version === version);
  return found ? (found.when === 'unreleased' ? 'unreleased' : 'stable') : null;
}

export function stable(changelog = readIfThere('CHANGELOG.md')) {
  return sections(changelog).find((s) => s.when !== 'unreleased')?.version ?? null;
}

/** The body of the `## X.Y.Z (…)` section, or null. */
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
  if (!state(version) || !notes(version))
    errors.push(
      `CHANGELOG.md: no '## ${version} (unreleased)' or '## ${version} (YYYY-MM-DD)' section with entries`
    );
  const latest = read('PROGRESS.md').match(LATEST)?.[2];
  if (latest !== stable())
    errors.push(
      `PROGRESS.md "Latest release": expected the latest stable ${stable()}, found ${latest ?? 'nothing'}`
    );
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
  if (state(version)) return;
  const log = read('CHANGELOG.md');
  const top = sections(log)[0];
  if (top?.when === 'unreleased') {
    const at = top.index + '## '.length;
    write('CHANGELOG.md', log.slice(0, at) + version + log.slice(at + top.version.length));
  } else {
    const at = top?.index ?? log.length;
    write('CHANGELOG.md', `${log.slice(0, at)}## ${version} (unreleased)\n\n${log.slice(at)}`);
  }
}

export function release(today = new Date().toISOString().slice(0, 10)) {
  const version = get();
  if (state(version) !== 'unreleased')
    throw new Error(`${version} has no '(unreleased)' CHANGELOG section to release`);
  write(
    'CHANGELOG.md',
    read('CHANGELOG.md').replace(`## ${version} (unreleased)`, `## ${version} (${today})`)
  );
  const progress = read('PROGRESS.md');
  if (!LATEST.test(progress)) throw new Error('PROGRESS.md has no "**Latest release:** " line');
  write('PROGRESS.md', progress.replace(LATEST, `$1${version}`));
  return today;
}

function main([command, arg]) {
  if (command === 'get') {
    console.log(get());
  } else if (command === 'stable') {
    console.log(stable());
  } else if (command === 'state') {
    console.log(state() ?? 'missing');
  } else if (command === 'check') {
    const errors = problems();
    for (const error of errors) console.error(`    ${error}`);
    if (errors.length) {
      console.error(`Version ${get()} is not consistent (see the release skill).`);
      process.exit(1);
    }
    console.log(`Version ${get()} (${state()}) is consistent.`);
  } else if (command === 'bump' && arg) {
    bump(arg);
    console.log(
      `Working towards ${arg}. Add the entries under '## ${arg} (unreleased)' in CHANGELOG.md.`
    );
  } else if (command === 'release') {
    console.log(`Dated ${get()} as ${release()}. Now prune PROGRESS.md and run check.`);
  } else if (command === 'notes') {
    const text = notes(get());
    if (!text) {
      console.error(`CHANGELOG.md has no section for ${get()}`);
      process.exit(1);
    }
    console.log(text);
  } else {
    console.error(
      'Usage: node scripts/version.mjs get | stable | state | check | bump X.Y.Z | release | notes'
    );
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
