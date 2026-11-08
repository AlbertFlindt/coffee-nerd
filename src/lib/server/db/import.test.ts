import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { readImport, type ImportData } from '../../domain/import';
import { createAccount } from '../auth/account';
import { loadInsights } from '../insights/insights';
import { openDatabase } from './client';
import { exportEverything } from './export';
import { importEverything, ImportError, isJournalEmpty } from './import';
import { recipe, tag } from './schema';
import { seedReferenceSetup } from './seed';
import { seedShotHistory } from './seed-history';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-import-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const T0 = Date.UTC(2026, 9, 17, 6, 0);
const LATER = T0 + 86_400_000;
let counter = 0;

/** The seeded journal with its 13 weeks of shots, exported as a file's text. */
function exported() {
  const db = openDatabase(join(dir, `from-${counter++}.db`));
  const ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
  seedShotHistory(db, ids, T0);
  return { db, ids, text: JSON.stringify(exportEverything(db, ids.userId, T0), null, 2) };
}

/** A new server: one new account, as "Create your account" makes it. */
async function newServer() {
  const db = openDatabase(join(dir, `to-${counter++}.db`));
  const userId = await createAccount(
    db,
    { name: 'Albert', password: 'password', timeZone: 'UTC' },
    LATER
  );
  return { db, userId };
}

function data(text: string): ImportData {
  const result = readImport(text);
  if (!result.ok) throw new Error(result.problem);
  return result.data;
}

describe('isJournalEmpty', () => {
  it('a new account is empty; the seeded one is not', async () => {
    const to = await newServer();
    expect(isJournalEmpty(to.db, to.userId)).toBe(true);
    const from = exported();
    expect(isJournalEmpty(from.db, from.ids.userId)).toBe(false);
  });
});

describe('importEverything', () => {
  it('a new server exports exactly what the old one exported, after importing it', async () => {
    const from = exported();
    const to = await newServer();
    const counts = importEverything(to.db, to.userId, data(from.text), LATER);
    expect(counts).toEqual({ shots: 214, beans: 9, gear: expect.any(Number) });
    const again = exportEverything(to.db, to.userId, T0);
    // Only the account's name is the new server's own.
    expect({ ...again, account: null }).toEqual({ ...JSON.parse(from.text), account: null });
  });

  it('recipes keep their fingerprint, so the next shot finds the same recipe', async () => {
    const from = exported();
    const to = await newServer();
    importEverything(to.db, to.userId, data(from.text), LATER);
    const fingerprints = (db: typeof to.db) =>
      db
        .select({ id: recipe.id, fingerprint: recipe.fingerprint })
        .from(recipe)
        .orderBy(recipe.id)
        .all();
    expect(fingerprints(to.db)).toEqual(fingerprints(from.db));
  });

  it('Insights read the same on the new server', async () => {
    const from = exported();
    const to = await newServer();
    importEverything(to.db, to.userId, data(from.text), LATER);
    expect(loadInsights(to.db, to.userId, T0)).toEqual(loadInsights(from.db, from.ids.userId, T0));
  });

  it('the new account’s built-in flavor notes give way to the file’s', async () => {
    const from = exported();
    const to = await newServer();
    importEverything(to.db, to.userId, data(from.text), LATER);
    const names = (db: typeof to.db, ownerId: string) =>
      db.select({ id: tag.id }).from(tag).where(eq(tag.ownerId, ownerId)).orderBy(tag.id).all();
    expect(names(to.db, to.userId)).toEqual(names(from.db, from.ids.userId));
  });

  it('a journal that already has something is refused and left as it was', async () => {
    const from = exported();
    expect(() => importEverything(from.db, from.ids.userId, data(from.text), LATER)).toThrow(
      ImportError
    );
    const to = await newServer();
    importEverything(to.db, to.userId, data(from.text), LATER);
    expect(() => importEverything(to.db, to.userId, data(from.text), LATER)).toThrow(ImportError);
  });

  it('an import that fails halfway changes nothing', async () => {
    const from = exported();
    const to = await newServer();
    const broken = data(from.text);
    // Two shots with one id: the second insert fails after gear, beans and recipes went in.
    broken.shots.push({ ...broken.shots[0] });
    expect(() => importEverything(to.db, to.userId, broken, LATER)).toThrow();
    expect(isJournalEmpty(to.db, to.userId)).toBe(true);
    expect(to.db.select().from(tag).where(eq(tag.ownerId, to.userId)).all().length).toBeGreaterThan(
      0
    );
  });
});
