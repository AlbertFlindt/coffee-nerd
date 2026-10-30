import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/client';
import { session, user } from '../db/schema';
import { createAccount } from './account';
import { verifyPassword } from './password.js';
import { createSession } from './session';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-reset-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const T0 = Date.UTC(2026, 9, 17, 6, 0);

function reset(path: string, input: string) {
  return spawnSync('node', ['scripts/reset-password.mjs'], {
    input,
    env: { ...process.env, DATABASE_PATH: path },
    encoding: 'utf8'
  });
}

describe('scripts/reset-password.mjs', () => {
  it('sets a new password and signs out every device', async () => {
    const path = join(dir, 'reset.db');
    const db = openDatabase(path);
    const userId = await createAccount(
      db,
      { name: 'Albert', password: 'old-password', timeZone: 'UTC' },
      T0
    );
    createSession(db, userId, T0);

    const result = reset(path, 'new-password\nnew-password\n');
    expect(result.status, result.stderr).toBe(0);
    const hash = db.select().from(user).get()!.passwordHash;
    expect(await verifyPassword('new-password', hash)).toBe(true);
    expect(await verifyPassword('old-password', hash)).toBe(false);
    expect(db.select().from(session).all()).toHaveLength(0);
  });

  it('changes nothing when the two passwords differ or are too short', async () => {
    const path = join(dir, 'unchanged.db');
    const db = openDatabase(path);
    await createAccount(db, { name: 'Albert', password: 'old-password', timeZone: 'UTC' }, T0);
    expect(reset(path, 'new-password\nother-password\n').status).toBe(1);
    expect(reset(path, 'short\nshort\n').status).toBe(1);
    expect(await verifyPassword('old-password', db.select().from(user).get()!.passwordHash)).toBe(
      true
    );
  });

  it('says so when there is no account yet', () => {
    const path = join(dir, 'empty.db');
    openDatabase(path);
    const result = reset(path, 'new-password\nnew-password\n');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/no account/);
  });
});
