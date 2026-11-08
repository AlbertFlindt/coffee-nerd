// Import: an "Export everything" file into an account that holds nothing yet, for moving to a new
// server. The file is read and checked in src/lib/domain/import.ts; here its rows go in, with their
// own ids, in one transaction, so a file that fails halfway leaves the account as it was.
import { eq } from 'drizzle-orm';
import type { ImportData } from '../../domain/import';
import { validTimeZone } from '../auth/account';
import type { Queryable } from './client';
import {
  appState,
  bean,
  gear,
  prepStep,
  recipe,
  routine,
  shot,
  shotTag,
  tag,
  tagMerged,
  tagPairKept,
  userSettings
} from './schema';

/** The import refused; the message can be shown as it is. */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export const NOT_EMPTY =
  'This journal already has gear, beans or puck prep. Import only goes into a new, empty journal.';

/**
 * True while the account has no gear, beans, puck prep steps, routines or shots: what a new account
 * has. Its flavor notes don't count; the file's replace them.
 */
export function isJournalEmpty(db: Queryable, ownerId: string): boolean {
  return [gear, bean, prepStep, routine, recipe, shot].every(
    (table) => !db.select({ id: table.id }).from(table).where(eq(table.ownerId, ownerId)).get()
  );
}

const CHUNK = 200;
function insertAll<T>(rows: readonly T[], insert: (chunk: T[]) => void) {
  for (let i = 0; i < rows.length; i += CHUNK) insert(rows.slice(i, i + CHUNK));
}

/** What an import brought in, for the line under the button. */
export type ImportCounts = { shots: number; beans: number; gear: number };

/** Puts the file's rows into the account. Throws ImportError when the journal is not empty. */
export function importEverything(
  db: Queryable,
  ownerId: string,
  data: ImportData,
  now: number
): ImportCounts {
  return db.transaction((tx) => {
    if (!isJournalEmpty(tx, ownerId)) throw new ImportError(NOT_EMPTY);
    const owned = <T extends object>(row: T) => ({ ...row, ownerId });

    // A new account's flavor notes are only the built-in ones, unused: the file's take their place.
    tx.delete(tagPairKept).where(eq(tagPairKept.ownerId, ownerId)).run();
    tx.delete(tagMerged).where(eq(tagMerged.ownerId, ownerId)).run();
    tx.delete(tag).where(eq(tag.ownerId, ownerId)).run();

    insertAll(data.gear, (rows) => tx.insert(gear).values(rows.map(owned)).run());
    insertAll(data.prepSteps, (rows) => tx.insert(prepStep).values(rows.map(owned)).run());
    insertAll(data.routines, (rows) => tx.insert(routine).values(rows.map(owned)).run());
    // A re-buy points to another bag in the file: linked once every bag is in.
    insertAll(data.beans, (rows) =>
      tx
        .insert(bean)
        .values(rows.map((b) => owned({ ...b, rebuyOfId: null })))
        .run()
    );
    for (const b of data.beans)
      if (b.rebuyOfId)
        tx.update(bean).set({ rebuyOfId: b.rebuyOfId }).where(eq(bean.id, b.id)).run();
    insertAll(data.tags, (rows) => tx.insert(tag).values(rows.map(owned)).run());
    insertAll(data.recipes, (rows) => tx.insert(recipe).values(rows.map(owned)).run());
    insertAll(data.shots, (rows) => tx.insert(shot).values(rows.map(owned)).run());
    insertAll(data.shotTags, (rows) => tx.insert(shotTag).values(rows).run());

    if (data.mySetup)
      tx.update(userSettings)
        .set({
          ...data.mySetup,
          timeZone: validTimeZone(data.mySetup.timeZone),
          updatedAt: now
        })
        .where(eq(userSettings.userId, ownerId))
        .run();
    tx.update(appState)
      .set({ brewNextRecipeId: data.brewNextRecipeId, updatedAt: now })
      .where(eq(appState.userId, ownerId))
      .run();
    return { shots: data.shots.length, beans: data.beans.length, gear: data.gear.length };
  });
}
