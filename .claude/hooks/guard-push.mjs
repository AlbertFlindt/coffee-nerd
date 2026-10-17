// PreToolUse hook (Bash): block pushes to main. Changes reach main only through pull requests (D-62, D-70).
// Exit code 2 blocks the command and shows the message to Claude.
// Test: node --test .claude/hooks/guard-push.test.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The text after `push` in each `git … push …` invocation, up to the next ; && || | or newline.
// Only these are inspected, so "main" elsewhere in the command (a commit message, say) is ignored.
export function pushArguments(command) {
  return command
    .split(/;|&&|\|\|?|\r?\n/)
    .map((segment) => segment.match(/\bgit\b.*?\bpush\b(.*)$/)?.[1])
    .filter((args) => args !== undefined);
}

export function isPush(command) {
  return pushArguments(command).length > 0;
}

export function targetsMain(command) {
  return pushArguments(command).some((args) => /(^|[\s:])(refs\/heads\/)?main(\s|$)/.test(args));
}

function currentBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return ''; // not a git repository: nothing to guard
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = input?.tool_input?.command ?? '';
  if (isPush(command) && (targetsMain(command) || currentBranch() === 'main')) {
    process.stderr.write(
      'Blocked: never push to main. Create a branch (git switch -c <milestone>-<name>), push it and open a pull request.\n'
    );
    process.exit(2);
  }
}
