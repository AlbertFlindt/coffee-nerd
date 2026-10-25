// Run with: node --test .claude/hooks/session-start.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./session-start.mjs', import.meta.url));

// Runs the hook in an empty project folder; `setup` adds files first. None of these cases may start npm.
function run(remote, setup = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'session-start-'));
  try {
    setup(dir);
    const before = readdirSync(dir, { recursive: true }).sort();
    const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
    if (remote) env.CLAUDE_CODE_REMOTE = 'true';
    else delete env.CLAUDE_CODE_REMOTE;
    const result = spawnSync(process.execPath, [hook], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.deepEqual(readdirSync(dir, { recursive: true }).sort(), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('outside a cloud session it installs nothing', () => {
  run(false, (dir) => writeFileSync(join(dir, 'package-lock.json'), '{}'));
});

test('in a cloud session without a lockfile it installs nothing', () => {
  run(true);
});

test('in a cloud session it skips while node_modules is newer than the lockfile', () => {
  run(true, (dir) => {
    writeFileSync(join(dir, 'package-lock.json'), '{}');
    utimesSync(join(dir, 'package-lock.json'), new Date(2026, 0, 1), new Date(2026, 0, 1));
    mkdirSync(join(dir, 'node_modules'));
    writeFileSync(join(dir, 'node_modules', '.package-lock.json'), '{}');
  });
});
