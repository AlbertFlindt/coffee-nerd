import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { isDatabaseReachable, openDatabase } from './client';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-db-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('openDatabase', () => {
  it('D-59: creates the SQLite file and its folder, and applies the migrations', () => {
    const path = join(dir, 'nested', 'coffee-nerd.db');
    const db = openDatabase(path);

    expect(existsSync(path)).toBe(true);
    const applied = db.all<{ hash: string }>(sql`select hash from __drizzle_migrations`);
    expect(applied.length).toBeGreaterThan(0);
  });

  it('D-59: opening an existing database again does not re-apply migrations', () => {
    const path = join(dir, 'reopen.db');
    const count = () =>
      openDatabase(path).get<{ n: number }>(sql`select count(*) as n from __drizzle_migrations`)?.n;

    expect(count()).toBe(count());
  });

  it('D-59: uses write-ahead logging and enforces foreign keys', () => {
    const db = openDatabase(join(dir, 'pragmas.db'));

    expect(db.get<{ journal_mode: string }>(sql`pragma journal_mode`)?.journal_mode).toBe('wal');
    expect(db.get<{ foreign_keys: number }>(sql`pragma foreign_keys`)?.foreign_keys).toBe(1);
  });
});

describe('isDatabaseReachable', () => {
  it('is true for an open database', () => {
    expect(isDatabaseReachable(openDatabase(join(dir, 'health.db')))).toBe(true);
  });

  it('is false once the connection is closed', () => {
    const db = openDatabase(join(dir, 'closed.db'));
    db.$client.close();

    expect(isDatabaseReachable(db)).toBe(false);
  });
});
