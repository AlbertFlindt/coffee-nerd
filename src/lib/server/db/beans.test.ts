import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addBean as addBeanFromForm,
  BeanRejected,
  deleteBean,
  finishBean,
  loadBeanDetail,
  reopenBean,
  toggleBrewNext,
  loadBeanForm,
  rebuyChoices,
  rebuyFields,
  updateBean
} from './beans';
import { loadBeans } from './beans';
import { openDatabase, type Db } from './client';
import { newId } from './ids';
import type { BeanInput } from '../../domain/schemas';
import { appState, bean, recipe } from './schema';
import { REFERENCE, seedReferenceSetup, type SeededIds } from './seed';
import { clearBrewNext, deleteShot, saveShot, type ShotInput } from './shots';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-beans-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 17, 6, 0);
const DAY = 86_400_000;
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `beans-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0 - 30 * DAY, name: 'Demo', passwordHash: 'x' });
});

function shot(brewedAt: number, overrides: Partial<ShotInput> = {}) {
  return saveShot(
    db,
    ids.userId,
    {
      id: newId(brewedAt),
      beanId: ids.beanId,
      machineId: ids.machineId,
      grinderId: ids.grinderId,
      basketId: ids.basketId,
      routineId: null,
      grind: 1600,
      dose: 18000,
      setup: { features: { ...REFERENCE.myFeatures }, routine: null },
      yield: 36000,
      time: 28000,
      taste: { score: 8, balance: 0, body: null, sweetness: null, aftertaste: null },
      tagIds: [],
      notes: null,
      brewedAt,
      ...overrides
    },
    brewedAt
  );
}

function addBean(values: Partial<typeof bean.$inferInsert> & { name: string }): string {
  const id = newId(T0);
  db.insert(bean)
    .values({
      id,
      ownerId: ids.userId,
      roastDate: '2026-10-13',
      status: 'open',
      createdAt: T0,
      updatedAt: T0,
      ...values
    })
    .run();
  return id;
}

const taste = (score: number | null) => ({
  score,
  balance: null,
  body: null,
  sweetness: null,
  aftertaste: null
});

describe('loadBeans', () => {
  it('an open bean with its roast age, origin, best score, recipes and shots', () => {
    shot(T0 - 2 * DAY, { taste: taste(7) });
    shot(T0 - DAY, { taste: taste(8), grind: 1500 });
    const { open, finished } = loadBeans(db, ids.userId, T0);
    expect(finished).toEqual([]);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      id: ids.beanId,
      name: 'Guji Hambela',
      origin: 'Nordlys Roasters · Ethiopia · Natural',
      roastAgeDays: 42,
      best: '8',
      recipes: 2,
      shots: 2,
      gramsLeft: null
    });
  });

  it('the best score is the best recipe’s average once it has 3 rated shots', () => {
    for (const [i, score] of [8, 8, 7].entries()) shot(T0 - (5 - i) * DAY, { taste: taste(score) });
    shot(T0 - DAY, { taste: taste(9), grind: 1500 });
    expect(loadBeans(db, ids.userId, T0).open[0].best).toBe('7.7');
  });

  it('a bean without a rated shot has no best score', () => {
    shot(T0 - DAY, { taste: taste(null) });
    expect(loadBeans(db, ids.userId, T0).open[0].best).toBeNull();
  });

  it('grams left with a bag weight', () => {
    db.update(bean).set({ bagWeight: 250000 }).where(eq(bean.id, ids.beanId)).run();
    shot(T0 - DAY);
    expect(loadBeans(db, ids.userId, T0).open[0].gramsLeft).toBe('232 g left');
  });

  it('open beans newest first; finished beans below, most recently finished first', () => {
    const kiambu = addBean({ name: 'Kiambu AA', createdAt: T0 });
    addBean({ name: 'Huila', status: 'finished', finishedAt: T0 - 9 * DAY });
    addBean({ name: 'Cerrado', status: 'finished', finishedAt: T0 - 2 * DAY });
    const { open, finished } = loadBeans(db, ids.userId, T0);
    expect(open.map((b) => b.id)).toEqual([kiambu, ids.beanId]);
    expect(open[0]).toMatchObject({ roastAgeDays: 4, recipes: 0, shots: 0, best: null });
    expect(finished.map((b) => b.name)).toEqual(['Cerrado', 'Huila']);
  });

  it('another user’s beans are not listed', () => {
    expect(loadBeans(db, 'someone-else', T0)).toEqual({ open: [], finished: [] });
  });
});

const input = (overrides: Partial<BeanInput> = {}): BeanInput => ({
  name: 'Kiambu AA',
  roaster: 'Havnens Rösteri',
  countryCode: 'KE',
  region: 'Kiambu',
  variety: 'SL28',
  process: 'washed',
  altitudeMinM: 1700,
  altitudeMaxM: 1800,
  roastLevel: 'medium_light',
  roastDate: '2026-10-13',
  bagWeight: 250000,
  rebuyOfId: null,
  ...overrides
});

describe('addBean', () => {
  it('saves an open bean with what was entered', () => {
    const id = addBeanFromForm(db, ids.userId, input(), T0);
    expect(db.select().from(bean).where(eq(bean.id, id)).get()).toMatchObject({
      ownerId: ids.userId,
      name: 'Kiambu AA',
      countryCode: 'KE',
      roastDate: '2026-10-13',
      bagWeight: 250000,
      status: 'open',
      rebuyOfId: null
    });
  });

  it('a roast date after today is refused', () => {
    // T0 is 17 Oct 2026, 06:00 UTC.
    expect(() => addBeanFromForm(db, ids.userId, input({ roastDate: '2026-10-18' }), T0)).toThrow(
      BeanRejected
    );
    expect(() =>
      addBeanFromForm(db, ids.userId, input({ roastDate: '2026-10-17' }), T0)
    ).not.toThrow();
  });

  it('a re-buy links to an earlier bag of yours only', () => {
    const id = addBeanFromForm(db, ids.userId, input({ rebuyOfId: ids.beanId }), T0);
    expect(db.select().from(bean).where(eq(bean.id, id)).get()?.rebuyOfId).toBe(ids.beanId);
    const other = seedReferenceSetup(openDatabase(join(dir, `other-${counter++}.db`)), {
      now: T0,
      name: 'Other',
      passwordHash: 'x'
    });
    expect(() => addBeanFromForm(db, ids.userId, input({ rebuyOfId: other.beanId }), T0)).toThrow(
      BeanRejected
    );
  });

  it('adding a bean does not change the current bean', () => {
    const before = db.select().from(appState).get()?.currentBeanId;
    addBeanFromForm(db, ids.userId, input(), T0);
    expect(db.select().from(appState).get()?.currentBeanId).toBe(before);
  });
});

describe('rebuyChoices', () => {
  it('every earlier bean once, as its latest bag, newest first', () => {
    const older = addBean({
      name: 'Kiambu AA',
      roaster: 'Havnens Rösteri',
      createdAt: T0 - 9 * DAY
    });
    const latest = addBean({
      name: 'Kiambu AA',
      roaster: 'Havnens Rösteri',
      status: 'finished',
      createdAt: T0 - 2 * DAY
    });
    const choices = rebuyChoices(db, ids.userId);
    expect(choices.map((c) => c.id)).toEqual([latest, ids.beanId]);
    expect(choices.map((c) => c.id)).not.toContain(older);
    expect(choices[0]).toMatchObject({ name: 'Kiambu AA', origin: 'Havnens Rösteri' });
  });

  it('the same bean despite upper and lower case and spaces at either end', () => {
    const latest = addBean({ name: 'guji hambela ', roaster: ' Nordlys roasters', createdAt: T0 });
    expect(rebuyChoices(db, ids.userId).map((c) => c.id)).toEqual([latest]);
  });

  it('only your own beans', () => {
    expect(rebuyChoices(db, 'someone-else')).toEqual([]);
  });
});

describe('rebuyFields', () => {
  it('everything but roast date and bag weight, linked to that bag', () => {
    db.update(bean).set({ bagWeight: 250000 }).where(eq(bean.id, ids.beanId)).run();
    const fields = rebuyFields(db, ids.userId, ids.beanId)!;
    expect(fields).toMatchObject({
      name: 'Guji Hambela',
      roaster: 'Nordlys Roasters',
      countryCode: 'ET',
      region: 'Guji',
      process: 'natural',
      altitudeMinM: 1900,
      altitudeMaxM: 2100,
      roastLevel: 'light',
      roastDate: null,
      bagWeight: null,
      rebuyOfId: ids.beanId
    });
    expect(rebuyFields(db, 'someone-else', ids.beanId)).toBeNull();
  });
});

describe('editing a bean', () => {
  it('the form starts from the bean, and saving changes it but keeps its re-buy link', () => {
    const id = addBeanFromForm(db, ids.userId, input({ rebuyOfId: ids.beanId }), T0);
    const form = loadBeanForm(db, ids.userId, id)!;
    expect(form).toMatchObject({ name: 'Kiambu AA', roastDate: '2026-10-13', bagWeight: 250000 });
    updateBean(db, ids.userId, id, input({ name: 'Kiambu AA Peaberry', rebuyOfId: null }), T0);
    expect(db.select().from(bean).where(eq(bean.id, id)).get()).toMatchObject({
      name: 'Kiambu AA Peaberry',
      rebuyOfId: ids.beanId
    });
  });

  it('another user’s bean is not found', () => {
    expect(loadBeanForm(db, 'someone-else', ids.beanId)).toBeNull();
    expect(() => updateBean(db, 'someone-else', ids.beanId, input(), T0)).toThrow(BeanRejected);
  });
});

const brewNext = () => db.select().from(appState).get()?.brewNextRecipeId ?? null;
const statusOf = (id: string) => db.select().from(bean).where(eq(bean.id, id)).get()!;

describe('loadBeanDetail', () => {
  it('about lines, numbers, and recipes best first with their rows', () => {
    shot(T0 - 5 * DAY, { taste: taste(7), yield: 38000, time: 26000 });
    shot(T0 - 4 * DAY, { taste: taste(9), yield: 36000, time: 30000 });
    shot(T0 - 3 * DAY, { taste: taste(null), grind: 1500, yield: null, time: null });
    const detail = loadBeanDetail(db, ids.userId, ids.beanId, T0)!;
    expect(detail).toMatchObject({
      name: 'Guji Hambela',
      status: 'open',
      roastAgeDays: 42,
      about: [
        'Nordlys Roasters',
        'Ethiopia · Guji · Natural',
        'Heirloom · 1,900–2,100 m · Light',
        'Roasted 5 Sep · Open'
      ],
      best: '9',
      recipeCount: 2,
      shotCount: 3
    });
    expect(detail.recipes).toMatchObject([
      {
        title: 'Grind 1.6 · 18.0 g → 36.0 g',
        // Both recipes are brewed at 93 °C, so the rows leave it out.
        detail: 'Preinfusion 4 s · Low bar start 5 s · avg 28.0 s',
        history: { text: 'Reused 1x', reused: true },
        best: 9,
        marked: false
      },
      {
        title: 'Grind 1.5 · 18.0 g',
        history: { text: 'Tried once', reused: false },
        best: null,
        marked: false
      }
    ]);
  });

  it('when the recipes differ in temperature, every row names it', () => {
    shot(T0 - 2 * DAY);
    const hot = shot(T0 - DAY, {
      setup: {
        features: {
          ...REFERENCE.myFeatures,
          temperature: { ...REFERENCE.myFeatures.temperature, value: 94000 }
        },
        routine: null
      }
    });
    const rows = loadBeanDetail(db, ids.userId, ids.beanId, T0)!.recipes;
    expect(rows.find((r) => r.id === hot.recipeId)?.detail).toMatch(/· 94 °C ·/);
    expect(rows.find((r) => r.id !== hot.recipeId)?.detail).toMatch(/· 93 °C ·/);
  });

  it('the same temperature under another label still counts as shared', () => {
    shot(T0 - 2 * DAY);
    shot(T0 - DAY, {
      grind: 1500,
      setup: {
        features: {
          ...REFERENCE.myFeatures,
          temperature: { ...REFERENCE.myFeatures.temperature, label: 'Brew temperature' }
        },
        routine: null
      }
    });
    const rows = loadBeanDetail(db, ids.userId, ids.beanId, T0)!.recipes;
    for (const row of rows) expect(row.detail).not.toMatch(/°C/);
  });

  it('another user’s bean is not found', () => {
    expect(loadBeanDetail(db, 'someone-else', ids.beanId, T0)).toBeNull();
  });
});

describe('toggleBrewNext', () => {
  it('marks one recipe; marking another moves the mark; tapping again clears it', () => {
    const a = shot(T0 - 2 * DAY).recipeId;
    const b = shot(T0 - DAY, { grind: 1500 }).recipeId;
    expect(toggleBrewNext(db, ids.userId, ids.beanId, a, T0)).toBe('marked');
    expect(brewNext()).toBe(a);
    expect(
      loadBeanDetail(db, ids.userId, ids.beanId, T0)!.recipes.find((r) => r.id === a)?.marked
    ).toBe(true);
    toggleBrewNext(db, ids.userId, ids.beanId, b, T0);
    expect(brewNext()).toBe(b);
    expect(toggleBrewNext(db, ids.userId, ids.beanId, b, T0)).toBe('cleared');
    expect(brewNext()).toBeNull();
  });

  it('on a finished bean, marking reopens the bean', () => {
    const a = shot(T0 - DAY).recipeId;
    finishBean(db, ids.userId, ids.beanId, T0);
    expect(toggleBrewNext(db, ids.userId, ids.beanId, a, T0)).toBe('reopened');
    expect(statusOf(ids.beanId)).toMatchObject({ status: 'open', finishedAt: null });
    expect(brewNext()).toBe(a);
  });

  it('a recipe kept only by its mark goes when the mark does', () => {
    const saved = shot(T0 - DAY);
    toggleBrewNext(db, ids.userId, ids.beanId, saved.recipeId, T0);
    deleteShot(db, ids.userId, saved.shotId);
    const kept = loadBeanDetail(db, ids.userId, ids.beanId, T0)!;
    expect(kept.recipes).toMatchObject([{ history: { text: 'New recipe' }, marked: true }]);
    toggleBrewNext(db, ids.userId, ids.beanId, saved.recipeId, T0);
    expect(db.select().from(recipe).where(eq(recipe.id, saved.recipeId)).get()).toBeUndefined();
  });

  it('"Use last shot recipe" also removes a recipe kept only by its mark', () => {
    const saved = shot(T0 - DAY);
    toggleBrewNext(db, ids.userId, ids.beanId, saved.recipeId, T0);
    deleteShot(db, ids.userId, saved.shotId);
    clearBrewNext(db, ids.userId, T0);
    expect(db.select().from(recipe).where(eq(recipe.id, saved.recipeId)).get()).toBeUndefined();
  });

  it('a shot on another recipe removes the recipe only the mark kept', () => {
    const saved = shot(T0 - 2 * DAY);
    toggleBrewNext(db, ids.userId, ids.beanId, saved.recipeId, T0);
    deleteShot(db, ids.userId, saved.shotId);
    shot(T0 - DAY, { grind: 1500 });
    expect(brewNext()).toBeNull();
    expect(db.select().from(recipe).where(eq(recipe.id, saved.recipeId)).get()).toBeUndefined();
  });

  it('moving the mark removes a recipe only the old mark kept', () => {
    const a = shot(T0 - 2 * DAY);
    const b = shot(T0 - DAY, { grind: 1500 }).recipeId;
    toggleBrewNext(db, ids.userId, ids.beanId, a.recipeId, T0);
    deleteShot(db, ids.userId, a.shotId);
    toggleBrewNext(db, ids.userId, ids.beanId, b, T0);
    expect(brewNext()).toBe(b);
    expect(db.select().from(recipe).where(eq(recipe.id, a.recipeId)).get()).toBeUndefined();
  });

  it('only a recipe of the bean on the page can be marked from it', () => {
    const a = shot(T0 - DAY).recipeId;
    expect(toggleBrewNext(db, ids.userId, newId(T0), a, T0)).toBeNull();
    expect(brewNext()).toBeNull();
  });

  it('another user’s recipe cannot be marked', () => {
    const a = shot(T0 - DAY).recipeId;
    expect(toggleBrewNext(db, 'someone-else', ids.beanId, a, T0)).toBeNull();
    expect(brewNext()).toBeNull();
  });
});

describe('finishing a bean', () => {
  it('finished by hand, then reopened (the undo)', () => {
    expect(finishBean(db, ids.userId, ids.beanId, T0)).toBe(true);
    expect(statusOf(ids.beanId)).toMatchObject({
      status: 'finished',
      finishedAt: T0,
      finishedAutomatically: false
    });
    expect(reopenBean(db, ids.userId, ids.beanId, T0)).toBe(true);
    expect(statusOf(ids.beanId)).toMatchObject({ status: 'open', finishedAt: null });
  });

  it('not another user’s bean', () => {
    expect(finishBean(db, 'someone-else', ids.beanId, T0)).toBe(false);
    expect(statusOf(ids.beanId).status).toBe('open');
  });
});

describe('deleteBean', () => {
  it('a bean without shots is deleted', () => {
    const id = addBean({ name: 'Mistake' });
    expect(deleteBean(db, ids.userId, id)).toBe('deleted');
    expect(db.select().from(bean).where(eq(bean.id, id)).get()).toBeUndefined();
  });

  it('a bean with shots is never deleted', () => {
    shot(T0 - DAY);
    expect(deleteBean(db, ids.userId, ids.beanId)).toBe('has_shots');
    expect(statusOf(ids.beanId)).toBeDefined();
  });

  it('a recipe kept only by its Brew next mark goes with the bean, and so does the mark', () => {
    const saved = shot(T0 - DAY);
    toggleBrewNext(db, ids.userId, ids.beanId, saved.recipeId, T0);
    deleteShot(db, ids.userId, saved.shotId);
    expect(deleteBean(db, ids.userId, ids.beanId)).toBe('deleted');
    expect(brewNext()).toBeNull();
    expect(db.select().from(recipe).where(eq(recipe.id, saved.recipeId)).get()).toBeUndefined();
  });

  it('Home no longer points at a deleted bean', () => {
    expect(db.select().from(appState).get()?.currentBeanId).toBe(ids.beanId);
    deleteBean(db, ids.userId, ids.beanId);
    expect(db.select().from(appState).get()?.currentBeanId).toBeNull();
  });

  it('a re-buy of the deleted bag links to the bag before it', () => {
    const middle = addBean({ name: 'Guji Hambela', rebuyOfId: ids.beanId });
    const latest = addBean({ name: 'Guji Hambela', rebuyOfId: middle });
    deleteBean(db, ids.userId, middle);
    expect(statusOf(latest).rebuyOfId).toBe(ids.beanId);
  });

  it('not another user’s bean', () => {
    expect(deleteBean(db, 'someone-else', ids.beanId)).toBeNull();
    expect(statusOf(ids.beanId)).toBeDefined();
  });
});
