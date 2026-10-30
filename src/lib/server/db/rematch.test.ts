import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { recipeFingerprint } from '../../domain/fingerprint';
import { openDatabase, type Db } from './client';
import { newId } from './ids';
import { rematchRecipesByDose } from './rematch';
import { appState, recipe, shot } from './schema';
import { REFERENCE, seedReferenceSetup, type SeededIds } from './seed';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-rematch-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 23, 6, 0);
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `rematch-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
});

/** A recipe as saved before D-186, with an old-style fingerprint that held the dose, and one shot. */
function oldRecipe(dose: number, minutes: number, ownerId = ids.userId): string {
  const now = T0 + minutes * 60_000;
  const id = newId(now);
  const values = {
    beanId: ids.beanId,
    machineId: ids.machineId,
    grinderId: ids.grinderId,
    basketId: ids.basketId,
    routineId: null,
    grind: 1600,
    dose,
    setup: { features: { ...REFERENCE.myFeatures }, routine: null }
  };
  db.insert(recipe)
    .values({
      id,
      ownerId,
      ...values,
      fingerprint: `old-${recipeFingerprint(values)}-${dose}`,
      createdAt: now,
      updatedAt: now
    })
    .run();
  db.insert(shot)
    .values({
      id: newId(now + 1),
      ownerId,
      recipeId: id,
      brewedAt: now,
      dose,
      createdAt: now,
      updatedAt: now
    })
    .run();
  return id;
}

describe('rematchRecipesByDose', () => {
  it('recipes within 0.2 g of an earlier one join it, with their shots and Brew next mark', () => {
    const at180 = oldRecipe(18000, 1);
    const at181 = oldRecipe(18100, 2);
    const at185 = oldRecipe(18500, 3);
    db.update(appState)
      .set({ brewNextRecipeId: at181 })
      .where(eq(appState.userId, ids.userId))
      .run();
    db.$client.pragma('user_version = 0');

    rematchRecipesByDose(db);

    const left = db.select().from(recipe).orderBy(asc(recipe.createdAt)).all();
    expect(left.map((r) => r.id)).toEqual([at180, at185]);
    expect(left.every((r) => !r.fingerprint.startsWith('old-'))).toBe(true);
    const shots = db.select().from(shot).orderBy(asc(shot.brewedAt)).all();
    expect(shots.map((s) => [s.recipeId, s.dose])).toEqual([
      [at180, 18000],
      [at180, 18100],
      [at185, 18500]
    ]);
    expect(db.select().from(appState).get()?.brewNextRecipeId).toBe(at180);
  });

  it('it runs once', () => {
    oldRecipe(18000, 1);
    const later = oldRecipe(18100, 2);
    // The database is already marked as matched by dose when it was opened.
    rematchRecipesByDose(db);
    expect(db.select().from(recipe).where(eq(recipe.id, later)).get()).toBeDefined();
  });
});

describe('migration 0007 and the merge, on a database from before doses were matched within 0.2 g', () => {
  it('each shot gets its recipe’s dose, then recipes within 0.2 g are merged', () => {
    // The migrations up to 0006, as a database from before dose matching had them.
    const before = mkdtempSync(join(dir, 'migrations-'));
    cpSync('drizzle', before, { recursive: true });
    rmSync(join(before, '0007_shot_dose.sql'));
    const journalPath = join(before, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    journal.entries = journal.entries.filter((e: { idx: number }) => e.idx <= 6);
    writeFileSync(journalPath, JSON.stringify(journal));

    const path = join(dir, `old-${counter++}.db`);
    const old = openDatabase(path, before);
    const seeded = seedReferenceSetup(old, { now: T0, name: 'Demo', passwordHash: 'x' });
    const insertRecipe = (dose: number, n: number) => {
      const id = newId(T0 + n);
      old
        .insert(recipe)
        .values({
          id,
          ownerId: seeded.userId,
          beanId: seeded.beanId,
          machineId: seeded.machineId,
          grinderId: seeded.grinderId,
          basketId: null,
          routineId: null,
          grind: 1600,
          dose,
          setup: { features: {}, routine: null },
          fingerprint: `old-${dose}`,
          createdAt: T0 + n,
          updatedAt: T0 + n
        })
        .run();
      // Shots had no dose column yet.
      old.$client
        .prepare(
          'insert into shot (id, owner_id, recipe_id, brewed_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?)'
        )
        .run(newId(T0 + n + 1), seeded.userId, id, T0 + n, T0 + n, T0 + n);
      return id;
    };
    const first = insertRecipe(18000, 1);
    insertRecipe(18200, 2);
    old.$client.pragma('user_version = 0');
    old.$client.close();

    const now = openDatabase(path);
    const shots = now.select().from(shot).orderBy(asc(shot.brewedAt)).all();
    expect(shots.map((s) => [s.recipeId, s.dose])).toEqual([
      [first, 18000],
      [first, 18200]
    ]);
    expect(now.select().from(recipe).all()).toHaveLength(1);
    now.$client.close();
  });
});

describe('rematchRecipesByDose, more cases', () => {
  it('owners are matched apart', () => {
    const other = newId(T0);
    db.$client
      .prepare(
        'insert into user (id, name, password_hash, created_at, updated_at) values (?, ?, ?, ?, ?)'
      )
      .run(other, 'Other', 'x', T0, T0);
    oldRecipe(18000, 1);
    oldRecipe(18100, 2, other);
    db.$client.pragma('user_version = 0');
    rematchRecipesByDose(db);
    expect(db.select().from(recipe).all()).toHaveLength(2);
  });

  it('a later recipe within reach of two joins the closest', () => {
    const at180 = oldRecipe(18000, 1);
    const at183 = oldRecipe(18300, 2);
    oldRecipe(18200, 3);
    db.$client.pragma('user_version = 0');
    rematchRecipesByDose(db);
    const shots = db.select().from(shot).orderBy(asc(shot.brewedAt)).all();
    expect(shots.map((s) => s.recipeId)).toEqual([at180, at183, at183]);
  });
});
