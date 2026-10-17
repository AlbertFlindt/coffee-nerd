// PreToolUse hook (Bash): block pushes to main. Changes reach main only through pull requests (D-62, D-70).
// Exit code 2 blocks the command and shows the message to Claude.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const input = JSON.parse(readFileSync(0, 'utf8'));
const command = input?.tool_input?.command ?? '';
if (!/\bgit\b[^;&|]*\bpush\b/.test(command)) process.exit(0);

let branch = '';
try {
  branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
    encoding: 'utf8'
  }).trim();
} catch {
  // not a git repository: nothing to guard
}

const targetsMain = /(^|[\s:])(refs\/heads\/)?main(\s|$)/.test(command.replace(/^.*?\bpush\b/, ''));
if (branch === 'main' || targetsMain) {
  process.stderr.write(
    'Blocked: never push to main. Create a branch (git switch -c <milestone>-<name>), push it and open a pull request.\n'
  );
  process.exit(2);
}
