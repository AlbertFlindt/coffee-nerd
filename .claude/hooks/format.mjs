// PostToolUse hook: format the file Claude just edited with Prettier.
// Silent no-op until Prettier is installed or for file types Prettier doesn't handle.
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input?.tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const prettier = join(root, 'node_modules', '.bin', 'prettier');
const formatted = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.svelte',
  '.css',
  '.json',
  '.md',
  '.html',
  '.yml',
  '.yaml'
]);

if (file && existsSync(file) && existsSync(prettier) && formatted.has(extname(file))) {
  try {
    execFileSync(prettier, ['--write', '--log-level', 'warn', file], { cwd: root, stdio: 'pipe' });
  } catch (err) {
    // Report but never block: a syntax error will surface in check/lint anyway.
    process.stderr.write(`prettier could not format ${file}: ${err.stderr ?? err.message}\n`);
  }
}
