import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './client';
import { newId } from './ids';
import { insertBuiltInTags } from './built-in-tags';
import { appState, bean, gear, recipe, shot, shotTag, tag, user } from './schema';
import { REFERENCE, seedReferenceSetup, type SeededIds } from './seed';
import { editShot, saveShot, ShotRejected, type ShotInput } from './shots';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-shots-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 17, 6, 0);
const MINUTE = 60_000;
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `shots-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
});

function input(overrides: Partial<ShotInput> = {}, minutes = 1): ShotInput {
  const now = T0 + minutes * MINUTE;
  return {
    id: newId(now),
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
    taste: { score: null, balance: null, body: null, sweetness: null, aftertaste: null },
    tagIds: [],
    notes: null,
    brewedAt: now,
    ...overrides
  };
}

const save = (shotInput: ShotInput, now = shotInput.brewedAt) =>
  saveShot(db, ids.userId, shotInput, now);
const recipeCount = () => db.select().from(recipe).all().length;

describe('saveShot', () => {
  it('D-63: the first shot creates its recipe; the same values reuse it', () => {
    const first = save(input({}, 1));
    expect(first).toMatchObject({ status: 'saved', recipeShotCount: 1, newRecipe: true });
    const second = save(input({}, 2));
    expect(second).toMatchObject({ status: 'saved', recipeId: first.recipeId, recipeShotCount: 2 });
    expect(recipeCount()).toBe(1);
  });

  it('D-16: going back to an earlier grind reuses that recipe', () => {
    const at16 = save(input({ grind: 1600 }, 1));
    const at15 = save(input({ grind: 1500 }, 2));
    const back = save(input({ grind: 1600 }, 3));
    expect(at15.recipeId).not.toBe(at16.recipeId);
    expect(back).toMatchObject({ recipeId: at16.recipeId, recipeShotCount: 2, newRecipe: false });
  });

  it('D-65: renaming a feature label does not make a new recipe', () => {
    const first = save(input({}, 1));
    const renamed = input({}, 2);
    renamed.setup.features = {
      ...renamed.setup.features,
      temperature: { label: 'Brew temperature', unit: '°C', on: true, value: 93000 }
    };
    expect(save(renamed).recipeId).toBe(first.recipeId);
  });

  it('D-63: the server recomputes the fingerprint and stores the recipe values', () => {
    const { recipeId } = save(input({ grind: 1700 }, 1));
    const stored = db.select().from(recipe).where(eq(recipe.id, recipeId)).get()!;
    expect(stored).toMatchObject({ grind: 1700, dose: 18000, method: 'espresso' });
    expect(stored.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('D-61: saving the same shot twice changes nothing', () => {
    const shotInput = input({}, 1);
    save(shotInput);
    const again = save({ ...shotInput, grind: 1900 });
    expect(again.status).toBe('duplicate');
    expect(db.select().from(shot).all()).toHaveLength(1);
    expect(recipeCount()).toBe(1);
  });

  it('D-11: taste is stored as given; not rated stays empty, never 0', () => {
    const { shotId } = save(input({}, 1));
    expect(db.select().from(shot).where(eq(shot.id, shotId)).get()).toMatchObject({
      score: null,
      balance: null,
      body: null
    });
    const rated = save(
      input({ taste: { score: 8, balance: -2, body: 6, sweetness: null, aftertaste: null } }, 2)
    );
    expect(db.select().from(shot).where(eq(shot.id, rated.shotId)).get()).toMatchObject({
      score: 8,
      balance: -2,
      body: 6,
      sweetness: null
    });
  });

  it('D-23: flavor notes are linked to the shot', () => {
    const [berry, caramel] = db.select().from(tag).limit(2).all();
    const { shotId } = save(input({ tagIds: [berry.id, caramel.id] }, 1));
    expect(
      db
        .select()
        .from(shotTag)
        .where(eq(shotTag.shotId, shotId))
        .all()
        .map((row) => row.tagId)
        .sort()
    ).toEqual([berry.id, caramel.id].sort());
  });

  it('D-43: saving a shot clears Brew next', () => {
    const { recipeId } = save(input({}, 1));
    db.update(appState).set({ brewNextRecipeId: recipeId }).run();
    save(input({}, 2));
    expect(db.select().from(appState).get()?.brewNextRecipeId).toBeNull();
  });

  it('D-40: the bean finishes automatically when a shot uses up the bag', () => {
    db.update(bean).set({ bagWeight: 36000 }).where(eq(bean.id, ids.beanId)).run();
    expect(save(input({}, 1)).autoFinished).toBe(false);
    expect(save(input({}, 2)).autoFinished).toBe(true);
    expect(db.select().from(bean).get()).toMatchObject({
      status: 'finished',
      finishedAutomatically: true,
      finishedAt: T0 + 2 * MINUTE
    });
  });

  it('D-40: after reopening, the next shot does not finish the bean again', () => {
    db.update(bean).set({ bagWeight: 36000 }).where(eq(bean.id, ids.beanId)).run();
    save(input({}, 1));
    save(input({}, 2));
    db.update(bean).set({ status: 'open', finishedAt: null, finishedAutomatically: false }).run();
    expect(save(input({}, 3)).autoFinished).toBe(false);
    expect(db.select().from(bean).get()?.status).toBe('open');
  });

  describe('rejects invalid shots without writing anything', () => {
    const rejects = (shotInput: ShotInput, problem: RegExp) => {
      expect(() => save(shotInput)).toThrow(ShotRejected);
      expect(() => save(shotInput)).toThrow(problem);
      expect(db.select().from(shot).all()).toHaveLength(0);
      expect(recipeCount()).toBe(0);
    };

    it('D-09: a score outside 1–10', () => {
      rejects(
        input({
          taste: { score: 11, balance: null, body: null, sweetness: null, aftertaste: null }
        }),
        /taste/
      );
    });

    it('D-02: a setup that does not fit the machine', () => {
      const bad = input();
      bad.setup.features = {
        ...bad.setup.features,
        temperature: { label: 'Temperature', on: false }
      };
      rejects(bad, /setup/);
    });

    it('D-52: a step value that does not fit its step', () => {
      const bad = input();
      bad.setup.routine!.steps[1] = { ...bad.setup.routine!.steps[1], value: 5000 };
      rejects(bad, /routine/);
    });

    it('D-51: puck prep that does not match the routine', () => {
      rejects(input({ routineId: null }), /routine/);
    });

    it('D-68: gear of the wrong kind', () => {
      rejects(input({ grinderId: ids.machineId }), /grinder/);
    });

    it('D-65: a setup that is not a setup at all', () => {
      rejects(input({ setup: null as never }), /setup/);
      rejects(input({ setup: { features: {}, routine: { name: 'Broken' } } as never }), /setup/);
    });

    it('D-63: a dose that is not a positive whole number of thousandths', () => {
      rejects(input({ dose: 0 }), /dose/);
      rejects(input({ grind: 1.5 }), /grind/);
    });
  });

  it('D-63: a failure part way through a save rolls everything back', () => {
    db.run(
      sql`CREATE TRIGGER fail_tags BEFORE INSERT ON shot_tag BEGIN SELECT RAISE(ABORT, 'boom'); END`
    );
    const [berry] = db.select().from(tag).limit(1).all();
    expect(() => save(input({ tagIds: [berry.id] }))).toThrow(/boom/);
    expect(db.select().from(shot).all()).toHaveLength(0);
    expect(recipeCount()).toBe(0);
  });

  it('D-63, D-65: only the checked setup is stored in the recipe, never extra fields', () => {
    const extra = input();
    (extra.setup as Record<string, unknown>).injected = 'not part of a setup';
    const { recipeId } = save(extra);
    expect(db.select().from(recipe).where(eq(recipe.id, recipeId)).get()?.setup).not.toHaveProperty(
      'injected'
    );
  });

  it('D-60: another owner’s bean, gear or tags cannot be used, and their rows stay untouched', () => {
    const other = seedOtherAccount();
    expect(() => save(input({ beanId: other.beanId }))).toThrow(/bean/);
    expect(() => save(input({ machineId: other.machineId }))).toThrow(/machine/);
    const otherTag = db.select().from(tag).where(eq(tag.ownerId, other.userId)).get()!;
    expect(() => save(input({ tagIds: [otherTag.id] }))).toThrow(/tag/);
    expect(db.select().from(shot).all()).toHaveLength(0);
  });
});

describe('editShot', () => {
  it('D-57: editing a shot that moves it to a new recipe removes the recipe left without shots', () => {
    const first = save(input({ grind: 1600 }, 1));
    const { shotId, recipeId } = save(input({ grind: 1500 }, 2));
    const edited = editShot(
      db,
      ids.userId,
      shotId,
      { ...input({ grind: 1600 }, 2), id: shotId },
      T0
    );
    expect(edited).toMatchObject({ recipeId: first.recipeId, recipeShotCount: 2 });
    expect(db.select().from(recipe).where(eq(recipe.id, recipeId)).get()).toBeUndefined();
    expect(recipeCount()).toBe(1);
  });

  it('D-43: a recipe left without shots is kept when it is marked Brew next', () => {
    const { shotId, recipeId } = save(input({ grind: 1500 }, 1));
    db.update(appState).set({ brewNextRecipeId: recipeId }).run();
    editShot(db, ids.userId, shotId, { ...input({ grind: 1700 }, 1), id: shotId }, T0);
    expect(db.select().from(recipe).where(eq(recipe.id, recipeId)).get()).toBeDefined();
    expect(db.select().from(appState).get()?.brewNextRecipeId).toBe(recipeId);
  });

  it('D-57: editing result and taste keeps the recipe and replaces the flavor notes', () => {
    const [berry, caramel] = db.select().from(tag).limit(2).all();
    const shotInput = input({ tagIds: [berry.id] }, 1);
    const { recipeId } = save(shotInput);
    const edited = editShot(
      db,
      ids.userId,
      shotInput.id,
      {
        ...shotInput,
        yield: 38500,
        taste: { ...shotInput.taste, score: 7 },
        tagIds: [caramel.id]
      },
      T0
    );
    expect(edited.recipeId).toBe(recipeId);
    expect(db.select().from(shot).get()).toMatchObject({ yield: 38500, score: 7 });
    expect(
      db
        .select()
        .from(shotTag)
        .all()
        .map((row) => row.tagId)
    ).toEqual([caramel.id]);
  });

  it('data-model §4.1: a recipe that still has other shots stays when one of them moves away', () => {
    const first = save(input({ grind: 1600 }, 1));
    const second = save(input({ grind: 1600 }, 2));
    editShot(
      db,
      ids.userId,
      second.shotId,
      { ...input({ grind: 1500 }, 2), id: second.shotId },
      T0
    );
    expect(db.select().from(recipe).where(eq(recipe.id, first.recipeId)).get()).toBeDefined();
    expect(recipeCount()).toBe(2);
  });

  it('D-57: a rejected edit changes nothing', () => {
    const [berry] = db.select().from(tag).limit(1).all();
    const shotInput = input({ tagIds: [berry.id] }, 1);
    const { recipeId } = save(shotInput);
    const bad = {
      ...shotInput,
      grind: 1500,
      taste: { ...shotInput.taste, score: 0 },
      tagIds: []
    };
    expect(() => editShot(db, ids.userId, shotInput.id, bad, T0)).toThrow(ShotRejected);
    expect(db.select().from(shot).get()).toMatchObject({ recipeId, score: null });
    expect(db.select().from(shotTag).all()).toHaveLength(1);
    expect(recipeCount()).toBe(1);
  });

  it('D-57, D-16: editing a shot onto another bean moves it to that bean’s recipe', () => {
    const otherBeanId = newId(T0 + 5);
    db.insert(bean)
      .values({
        id: otherBeanId,
        ownerId: ids.userId,
        name: 'Kiambu AA',
        roastDate: '2026-10-13',
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    const { shotId, recipeId } = save(input({}, 1));
    const edited = editShot(
      db,
      ids.userId,
      shotId,
      { ...input({ beanId: otherBeanId }, 1), id: shotId },
      T0
    );
    expect(edited.recipeId).not.toBe(recipeId);
    expect(db.select().from(recipe).where(eq(recipe.id, edited.recipeId)).get()?.beanId).toBe(
      otherBeanId
    );
    expect(db.select().from(recipe).where(eq(recipe.id, recipeId)).get()).toBeUndefined();
  });

  it('D-60: a shot of another owner cannot be edited', () => {
    const { shotId } = save(input({}, 1));
    const other = seedOtherAccount();
    expect(() => editShot(db, other.userId, shotId, input({}, 1), T0)).toThrow(/shot/);
  });
});

/** A second account in the same database, with its own bean, machine and tags. */
function seedOtherAccount() {
  const now = T0 + 1000;
  const stamps = { createdAt: now, updatedAt: now };
  const userId = newId(now);
  db.insert(user)
    .values({ id: userId, name: 'Other', passwordHash: 'x', ...stamps })
    .run();
  insertBuiltInTags(db, userId, now);
  const machineId = newId(now);
  db.insert(gear)
    .values({
      id: machineId,
      ownerId: userId,
      kind: 'machine',
      name: 'Other machine',
      spec: REFERENCE.machine.spec,
      ...stamps
    })
    .run();
  const beanId = newId(now);
  db.insert(bean)
    .values({ id: beanId, ownerId: userId, name: 'Other bean', roastDate: '2026-10-01', ...stamps })
    .run();
  return { userId, machineId, beanId };
}
