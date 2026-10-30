import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './client';
import { newId } from './ids';
import { loadJournal, loadShotDetail } from './journal';
import { bean, tag, user, userSettings } from './schema';
import { REFERENCE, seedReferenceSetup, type SeededIds } from './seed';
import { saveShot, type ShotInput } from './shots';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-journal-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Saturday 17 Oct 2026, 08:00 in Copenhagen (the seed's time zone).
const T0 = Date.UTC(2026, 9, 17, 6, 0);
const MINUTE = 60_000;
const DAY = 86_400_000;
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `journal-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0 - 30 * DAY, name: 'Demo', passwordHash: 'x' });
});

function shotAt(brewedAt: number, overrides: Partial<ShotInput> = {}): ShotInput {
  return {
    id: newId(brewedAt),
    beanId: ids.beanId,
    machineId: ids.machineId,
    grinderId: ids.grinderId,
    basketId: ids.basketId,
    routineId: ids.routineId,
    grind: 1600,
    dose: 18000,
    setup: {
      features: { ...REFERENCE.myFeatures },
      routine: {
        name: 'Daily routine',
        steps: [
          { stepId: ids.stepIds[0], name: 'WDT', unit: 's', value: 20000 },
          { stepId: ids.stepIds[1], name: 'Distributor', value: null },
          { stepId: ids.stepIds[2], name: 'Tamp', unit: 'kg', value: 15000 },
          { stepId: ids.stepIds[3], name: 'Puck screen', value: null }
        ]
      }
    },
    yield: 36000,
    time: 28000,
    taste: { score: 8, balance: 0, body: null, sweetness: null, aftertaste: null },
    tagIds: [],
    notes: null,
    brewedAt,
    ...overrides
  };
}

const save = (input: ShotInput) => saveShot(db, ids.userId, input, input.brewedAt).shotId;

function secondBean(): string {
  const id = newId(T0);
  db.insert(bean)
    .values({
      id,
      ownerId: ids.userId,
      name: 'Kiambu AA',
      roastDate: '2026-10-01',
      status: 'open',
      createdAt: T0,
      updatedAt: T0
    })
    .run();
  return id;
}

describe('loadJournal', () => {
  it('every shot, newest first, with its bean, values and taste', () => {
    save(shotAt(T0 - 4 * DAY));
    save(
      shotAt(T0 - DAY, {
        taste: { score: null, balance: null, body: null, sweetness: null, aftertaste: null }
      })
    );
    save(
      shotAt(T0 - 10 * MINUTE, {
        yield: 38500,
        time: 25500,
        taste: { score: 7, balance: -2, body: null, sweetness: null, aftertaste: null }
      })
    );

    const journal = loadJournal(db, ids.userId, {}, T0);
    expect(journal.shots.map((s) => [s.beanName, s.score, s.balance, s.yield])).toEqual([
      ['Guji Hambela', 7, -2, 38500],
      ['Guji Hambela', null, null, 36000],
      ['Guji Hambela', 8, 0, 36000]
    ]);
    expect(journal.timeZone).toBe('Europe/Copenhagen');
    expect(journal.steps).toEqual({ dose: 100, yield: 100, time: 1000 });
  });

  it('each row says how often its recipe had been brewed before it', () => {
    save(shotAt(T0 - 3 * DAY)); // new recipe
    save(shotAt(T0 - 2 * DAY, { grind: 1500 })); // new recipe
    save(shotAt(T0 - DAY)); // reused 1x
    save(shotAt(T0 - MINUTE)); // reused 2x
    const tags = loadJournal(db, ids.userId, {}, T0).shots.map((s) => s.recipeTag);
    expect(tags).toEqual([
      { kind: 'reused', shotCount: 2 },
      { kind: 'reused', shotCount: 1 },
      { kind: 'new', changes: [] },
      { kind: 'new', changes: [] }
    ]);
  });

  it('each row knows its recipe’s last score before it', () => {
    const unrated = { score: null, balance: null, body: null, sweetness: null, aftertaste: null };
    save(shotAt(T0 - 3 * DAY)); // 8
    save(shotAt(T0 - 2 * DAY, { taste: unrated }));
    save(shotAt(T0 - DAY, { grind: 1500, taste: unrated })); // another recipe
    save(shotAt(T0 - MINUTE, { taste: unrated }));
    expect(loadJournal(db, ids.userId, {}, T0).shots.map((s) => s.previousScore)).toEqual([
      8,
      null,
      8,
      null
    ]);
  });

  it('"9 shots this week" counts from Monday, in the user’s time zone', () => {
    save(shotAt(T0 - MINUTE)); // Saturday
    save(shotAt(Date.UTC(2026, 9, 11, 22, 30))); // Monday 00:30 in Copenhagen
    save(shotAt(Date.UTC(2026, 9, 11, 21, 30))); // Sunday 23:30 in Copenhagen
    expect(loadJournal(db, ids.userId, {}, T0).shotsThisWeek).toBe(2);
  });

  it('filter by bean; the bean list holds the beans that have shots', () => {
    const kiambu = secondBean();
    save(shotAt(T0 - 2 * DAY));
    save(shotAt(T0 - DAY, { beanId: kiambu }));
    const all = loadJournal(db, ids.userId, {}, T0);
    expect(all.beans.map((b) => b.name)).toEqual(['Kiambu AA', 'Guji Hambela']);
    const filtered = loadJournal(db, ids.userId, { beanId: kiambu }, T0);
    expect(filtered.shots.map((s) => s.beanName)).toEqual(['Kiambu AA']);
    expect(filtered.beanId).toBe(kiambu);
  });

  it('with a bean chosen, its recipes, most recently brewed first, filter the list', () => {
    const kiambu = secondBean();
    save(shotAt(T0 - 4 * DAY)); // recipe A
    save(shotAt(T0 - 3 * DAY, { grind: 1500 })); // recipe B
    save(shotAt(T0 - 2 * DAY)); // recipe A
    save(shotAt(T0 - DAY, { beanId: kiambu }));
    expect(loadJournal(db, ids.userId, {}, T0).recipes).toEqual([]);

    const guji = loadJournal(db, ids.userId, { beanId: ids.beanId }, T0);
    expect(guji.recipes.map((r) => r.label)).toEqual([
      '1.6 · 18.0 g · Daily routine · 2 shots',
      '1.5 · 18.0 g · Daily routine · 1 shot'
    ]);
    const onlyB = loadJournal(
      db,
      ids.userId,
      { beanId: ids.beanId, recipeId: guji.recipes[1].id },
      T0
    );
    expect(onlyB.recipeId).toBe(guji.recipes[1].id);
    expect(onlyB.shots.map((s) => s.grind)).toEqual([1500]);
  });

  it('recipes that differ only in setup say which value tells them apart', () => {
    const at94 = shotAt(T0 - 2 * DAY);
    at94.setup.features = {
      ...at94.setup.features,
      temperature: { ...at94.setup.features.temperature, value: 94000 }
    };
    save(at94);
    save(shotAt(T0 - DAY));
    const labels = loadJournal(db, ids.userId, { beanId: ids.beanId }, T0).recipes.map(
      (r) => r.label
    );
    expect(labels).toEqual([
      '1.6 · 18.0 g · Daily routine · 93 °C · 1 shot',
      '1.6 · 18.0 g · Daily routine · 94 °C · 1 shot'
    ]);
  });

  it('recipes that differ only in a step value name it', () => {
    const longer = shotAt(T0 - 2 * DAY);
    longer.setup.routine = {
      ...longer.setup.routine!,
      steps: longer.setup.routine!.steps.map((step, i) =>
        i === 0 ? { ...step, value: 30000 } : step
      )
    };
    save(longer);
    save(shotAt(T0 - DAY));
    const labels = loadJournal(db, ids.userId, { beanId: ids.beanId }, T0).recipes.map(
      (r) => r.label
    );
    expect(labels).toEqual([
      '1.6 · 18.0 g · Daily routine · WDT 20 s · 1 shot',
      '1.6 · 18.0 g · Daily routine · WDT 30 s · 1 shot'
    ]);
  });

  it('a recipe filter needs its bean; without one it is ignored', () => {
    save(shotAt(T0 - DAY));
    const recipeId = loadJournal(db, ids.userId, { beanId: ids.beanId }, T0).recipes[0].id;
    expect(loadJournal(db, ids.userId, { recipeId }, T0)).toMatchObject({ recipeId: null });
  });

  it('"Unrated · N" counts the unrated shots and filters to them', () => {
    const unrated = { score: null, balance: -1, body: null, sweetness: null, aftertaste: null };
    save(shotAt(T0 - 3 * DAY));
    save(shotAt(T0 - 2 * DAY, { taste: unrated }));
    save(shotAt(T0 - DAY, { taste: unrated }));
    const journal = loadJournal(db, ids.userId, {}, T0);
    expect(journal.unratedCount).toBe(2);
    const only = loadJournal(db, ids.userId, { unrated: true }, T0);
    expect(only.shots).toHaveLength(2);
    expect(only.shots.every((s) => s.score === null)).toBe(true);
  });

  it('the unrated count follows the bean filter', () => {
    const kiambu = secondBean();
    const unrated = { score: null, balance: null, body: null, sweetness: null, aftertaste: null };
    save(shotAt(T0 - 2 * DAY, { taste: unrated }));
    save(shotAt(T0 - DAY, { beanId: kiambu, taste: unrated }));
    expect(loadJournal(db, ids.userId, { beanId: kiambu }, T0).unratedCount).toBe(1);
  });

  it('shows only the signed-in user’s shots; an unknown bean filter shows all', () => {
    save(shotAt(T0 - DAY));
    const otherId = otherUser();
    expect(loadJournal(db, otherId, {}, T0).shots).toEqual([]);
    expect(loadJournal(db, ids.userId, { beanId: 'nope' }, T0)).toMatchObject({ beanId: null });
  });
});

describe('loadShotDetail', () => {
  it('the recipe’s shot count and its other shots, without this one', () => {
    save(shotAt(T0 - 3 * DAY, { time: 28000 }));
    save(shotAt(T0 - 2 * DAY, { grind: 1500 })); // another recipe
    save(
      shotAt(T0 - DAY, {
        time: 29000,
        taste: { score: 7, balance: null, body: null, sweetness: null, aftertaste: null }
      })
    );
    const id = save(shotAt(T0 - MINUTE, { time: 25500 }));
    const detail = loadShotDetail(db, ids.userId, id)!;
    expect(detail.recipe.shotCount).toBe(3);
    expect(detail.recipe.others).toEqual([
      { time: 28000, score: 8 },
      { time: 29000, score: 7 }
    ]);
  });

  it('the bean, roast age, gear, setup, puck prep steps, values, taste, flavor notes and notes', () => {
    const berry = db.select().from(tag).where(eq(tag.name, 'Berry')).get()!;
    save(shotAt(T0 - DAY));
    const id = save(
      shotAt(T0 - 10 * MINUTE, {
        yield: 38500,
        time: 25500,
        taste: { score: 7, balance: -2, body: 7, sweetness: 8, aftertaste: null },
        tagIds: [berry.id],
        notes: 'Ran fast, a bit thin.'
      })
    );
    const detail = loadShotDetail(db, ids.userId, id)!;
    expect(detail).toMatchObject({
      beanName: 'Guji Hambela',
      roastDate: REFERENCE_ROAST(),
      gear: 'Lelit Bianca · Timemore 064S · VST · 18 g',
      setup: '93 °C · Flat 9.0 bar · Preinfusion 4 s · Low bar start 5 s at 2.0 bar',
      prep: 'Daily routine: WDT 20 s · Distributor · Tamp 15 kg · Puck screen',
      recipeTag: { kind: 'reused', shotCount: 1 },
      grind: 1600,
      dose: 18000,
      yield: 38500,
      time: 25500,
      taste: { score: 7, balance: -2, body: 7, sweetness: 8, aftertaste: null },
      flavors: ['Berry'],
      notes: 'Ran fast, a bit thin.',
      timeZone: 'Europe/Copenhagen'
    });
  });

  it('a recipe’s first shot names what changed since the bean’s shot before it', () => {
    const first = save(shotAt(T0 - 2 * DAY));
    const second = save(shotAt(T0 - DAY, { grind: 1500, dose: 18500 }));
    expect(loadShotDetail(db, ids.userId, first)!.recipeTag).toEqual({ kind: 'new', changes: [] });
    expect(loadShotDetail(db, ids.userId, second)!.recipeTag).toEqual({
      kind: 'new',
      changes: ['grind', 'dose']
    });
  });

  it('another user’s shot, or an unknown one, is not found', () => {
    const id = save(shotAt(T0 - DAY));
    const otherId = otherUser();
    expect(loadShotDetail(db, otherId, id)).toBeNull();
    expect(loadShotDetail(db, ids.userId, 'nope')).toBeNull();
  });
});

function otherUser(): string {
  const id = newId(T0);
  db.insert(user)
    .values({ id, name: 'Other', passwordHash: 'x', createdAt: T0, updatedAt: T0 })
    .run();
  db.insert(userSettings)
    .values({ userId: id, timeZone: 'UTC', createdAt: T0, updatedAt: T0 })
    .run();
  return id;
}

function REFERENCE_ROAST(): string {
  return db.select({ roastDate: bean.roastDate }).from(bean).where(eq(bean.id, ids.beanId)).get()!
    .roastDate;
}
