// Sets a new password for the account and signs out every device.
// On the server: docker compose exec coffee-nerd node scripts/reset-password.mjs
// Locally: DATABASE_PATH=./data/coffee-nerd.db node scripts/reset-password.mjs
// Reads the new password twice: hidden at a terminal, or as two lines on standard input.
import { createInterface } from 'node:readline';
import Database from 'better-sqlite3';
import { hashPassword } from '../src/lib/server/auth/password.js';

const MIN_LENGTH = 8;
const path = process.env.DATABASE_PATH || './data/coffee-nerd.db';

/** At a terminal: asks for one line without showing what is typed. */
function askHidden(rl, question) {
  return new Promise((resolve) => {
    rl.output.write(question);
    rl._writeToOutput = () => {};
    rl.question('', (answer) => {
      delete rl._writeToOutput;
      rl.output.write('\n');
      resolve(answer);
    });
  });
}

/** The new password twice: hidden prompts at a terminal, otherwise the first two lines of input. */
async function readPasswords(name) {
  if (!process.stdin.isTTY) {
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    const [first = '', second = ''] = text.split(/\r?\n/);
    return [first, second];
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const first = await askHidden(rl, `New password for ${name}: `);
  const second = await askHidden(rl, 'Same password again: ');
  rl.close();
  return [first, second];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const db = new Database(path, { fileMustExist: true });
const users = db.prepare('select id, name from user').all();
if (users.length === 0) fail('There is no account yet. Open the app to create it.');
const [account] = users;

const [password, repeat] = await readPasswords(account.name);

if (password.length < MIN_LENGTH) fail(`Use a password of at least ${MIN_LENGTH} characters.`);
if (password !== repeat) fail('The two passwords are not the same. Nothing was changed.');

const hash = await hashPassword(password);
const now = Date.now();
db.transaction(() => {
  db.prepare('update user set password_hash = ?, updated_at = ? where id = ?').run(
    hash,
    now,
    account.id
  );
  db.prepare('delete from session where user_id = ?').run(account.id);
})();
console.log('Password changed. Every device is signed out.');
