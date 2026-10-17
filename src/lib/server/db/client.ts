import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { MIGRATIONS_FOLDER } from './paths';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/** Opens (creating if needed) the SQLite file at `path` and applies all migrations. */
export function openDatabase(path: string, migrationsFolder = MIGRATIONS_FOLDER): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const client = new Database(path);
  client.pragma('journal_mode = WAL');
  client.pragma('foreign_keys = ON');
  const db = drizzle(client, { schema });
  migrate(db, { migrationsFolder });
  return db;
}

/** True when the database answers a trivial query. Used by `/health`. */
export function isDatabaseReachable(db: Db): boolean {
  try {
    return db.get<{ ok: number }>(sql`select 1 as ok`)?.ok === 1;
  } catch {
    return false;
  }
}
