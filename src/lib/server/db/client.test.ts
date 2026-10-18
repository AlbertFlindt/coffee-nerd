import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
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
  it('D-59: is true for an open database', () => {
    expect(isDatabaseReachable(openDatabase(join(dir, 'health.db')))).toBe(true);
  });

  it('D-59: is false once the connection is closed', () => {
    const db = openDatabase(join(dir, 'closed.db'));
    db.$client.close();

    expect(isDatabaseReachable(db)).toBe(false);
  });
});

describe('migration 0003_basket_brand_size', () => {
  it('D-150: an existing basket is split once into brand and size', () => {
    const db = openDatabase(join(dir, 'baskets.db'));
    const raw = db.$client;
    const owner = raw.prepare(
      "insert into user (id, name, password_hash, created_at, updated_at) values ('u', 'U', 'x', 0, 0)"
    );
    owner.run();
    const add = raw.prepare(
      'insert into gear (id, owner_id, kind, name, spec, created_at, updated_at) values (?, \'u\', \'basket\', ?, \'{"type":"precision","shotSize":"double"}\', 0, 0)'
    );
    add.run('a', 'VST 18 g');
    add.run('b', 'Stock double');
    add.run('c', 'IMS E61 18.5 g');
    add.run('d', 'Gaggia E61 g');
    const migration = readFileSync(
      join(process.cwd(), 'drizzle/0003_basket_brand_size.sql'),
      'utf8'
    );
    for (const statement of migration.split('--> statement-breakpoint')) raw.exec(statement);
    const rows = raw.prepare('select id, name, spec from gear order by id').all() as {
      id: string;
      name: string;
      spec: string;
    }[];
    expect(rows.map((r) => [r.name, JSON.parse(r.spec)])).toEqual([
      ['VST · 18 g', { type: 'precision', shotSize: 'double', brand: 'VST', sizeG: 18000 }],
      ['Stock double', { type: 'precision', shotSize: 'double', brand: 'Stock double' }],
      // A brand that ends in digits keeps them; only a separate size is split off.
      [
        'IMS E61 · 18.5 g',
        { type: 'precision', shotSize: 'double', brand: 'IMS E61', sizeG: 18500 }
      ],
      ['Gaggia E61 g', { type: 'precision', shotSize: 'double', brand: 'Gaggia E61 g' }]
    ]);
    // Running it again changes nothing.
    for (const statement of migration.split('--> statement-breakpoint')) raw.exec(statement);
    expect(raw.prepare("select name from gear where id = 'a'").get()).toEqual({
      name: 'VST · 18 g'
    });
  });
});
