import { DATABASE_PATH } from '$app/env/private';
import { openDatabase, type Db } from './client';

let instance: Db | undefined;

/** The app's database, opened and migrated on first use. */
export function getDb(): Db {
  instance ??= openDatabase(DATABASE_PATH);
  return instance;
}
