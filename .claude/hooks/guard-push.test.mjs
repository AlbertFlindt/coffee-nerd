// Run with: node --test .claude/hooks/guard-push.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPush, targetsMain } from './guard-push.mjs';

const hook = fileURLToPath(new URL('./guard-push.mjs', import.meta.url));

const multiLineCommit = [
  'git add .claude && git commit -m "Fix push guard',
  '',
  'The main protection now only looks at the push itself."',
  '&& git push -q origin some-branch'
].join('\n');

test('multi-line commit mentioning main, then a push to another branch, is allowed', () => {
  assert.equal(isPush(multiLineCommit), true);
  assert.equal(targetsMain(multiLineCommit), false);
});

test('"main" outside the push invocation is ignored', () => {
  assert.equal(targetsMain('git push -u origin m3-shot-form && echo main'), false);
  assert.equal(targetsMain('git checkout main; git push origin feature'), false);
  assert.equal(targetsMain('git push origin feature | grep main'), false);
  assert.equal(targetsMain('git push origin maintenance'), false);
  assert.equal(targetsMain('git push origin main-fix'), false);
});

test('pushes to main are blocked', () => {
  for (const command of [
    'git push origin main',
    'git push -u origin main',
    'git push origin HEAD:main',
    'git push origin refs/heads/main',
    'git push origin HEAD:refs/heads/main',
    'git push origin main 2>&1',
    'git -C /repo push origin main',
    'git commit -m "x" && git push origin main',
    'git commit -m "line one\nline two" && git push origin feature; git push origin main',
    'echo start\ngit push origin main\necho done'
  ]) {
    assert.equal(targetsMain(command), true, command);
  }
});

test('commands without a git push are not pushes', () => {
  assert.equal(isPush('git status'), false);
  assert.equal(isPush('npm run push-main'), false);
});

function runHook(command, cwd) {
  return spawnSync('node', [hook], {
    input: JSON.stringify({ tool_input: { command } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8'
  });
}

function withRepo(branch, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'guard-push-'));
  try {
    execFileSync('git', ['init', '-q', '-b', branch], { cwd: dir });
    // rev-parse --abbrev-ref HEAD needs a commit
    execFileSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x'],
      {
        cwd: dir
      }
    );
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('hook on stdin: allows the multi-line false positive, blocks a push to main', () => {
  withRepo('some-branch', (dir) => {
    assert.equal(runHook(multiLineCommit, dir).status, 0);
    const blocked = runHook('git push origin HEAD:main', dir);
    assert.equal(blocked.status, 2);
    assert.match(blocked.stderr, /never push to main/);
  });
});

test('hook on stdin: any push is blocked while on main', () => {
  withRepo('main', (dir) => {
    assert.equal(runHook('git push', dir).status, 2);
    assert.equal(runHook('git push -u origin feature', dir).status, 2);
    assert.equal(runHook('git status', dir).status, 0);
  });
});
