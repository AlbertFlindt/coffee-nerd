import { mkdtempSync, rmSync } from 'node:fs';
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
function oldRecipe(dose: number, minutes: number): string {
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
      ownerId: ids.userId,
      ...values,
      fingerprint: `old-${recipeFingerprint(values)}-${dose}`,
      createdAt: now,
      updatedAt: now
    })
    .run();
  db.insert(shot)
    .values({
      id: newId(now + 1),
      ownerId: ids.userId,
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
  it('D-186: recipes within 0.2 g of an earlier one join it, with their shots and Brew next mark', () => {
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

  it('D-186: it runs once', () => {
    oldRecipe(18000, 1);
    const later = oldRecipe(18100, 2);
    // The database is already marked as matched by dose when it was opened.
    rematchRecipesByDose(db);
    expect(db.select().from(recipe).where(eq(recipe.id, later)).get()).toBeDefined();
  });
});
