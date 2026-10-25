// SessionStart hook: install npm dependencies in Claude Code cloud sessions, so check, lint and tests run at once.
// Local sessions keep their own node_modules: there it does nothing.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const lock = join(root, 'package-lock.json');
const installed = join(root, 'node_modules', '.package-lock.json');

// npm ci, not npm install: npm install rewrites package-lock.json when the container's npm differs.
// Skipped while node_modules is newer than the lockfile, so a resumed session starts at once.
const stale = () => !existsSync(installed) || statSync(installed).mtimeMs < statSync(lock).mtimeMs;

if (process.env.CLAUDE_CODE_REMOTE === 'true' && existsSync(lock) && stale()) {
  // Output goes to stderr, so it never reaches Claude as session context.
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: root,
    stdio: ['ignore', process.stderr, 'inherit']
  });
}
