import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './client';
import { newId } from './ids';
import { appState, bean, gear, shot, tag, userSettings } from './schema';
import { REFERENCE, seedReferenceSetup, type SeededIds } from './seed';
import { loadEditShotForm, loadShotForm, type ShotFormData } from './shot-form';
import { saveShot, type ShotInput } from './shots';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-shot-form-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 17, 6, 0);
const MINUTE = 60_000;
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `form-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
});

function ready(data: ReturnType<typeof loadShotForm>): ShotFormData {
  if (data.state !== 'ready') throw new Error(`Expected a ready form, got ${data.state}`);
  return data;
}

function save(overrides: Partial<ShotInput>, minutes: number) {
  const form = ready(loadShotForm(db, ids.userId));
  const now = T0 + minutes * MINUTE;
  const { prefill } = form;
  return saveShot(
    db,
    ids.userId,
    {
      id: newId(now),
      beanId: prefill.beanId,
      machineId: prefill.machineId,
      grinderId: prefill.grinderId,
      basketId: prefill.basketId,
      routineId: prefill.routineId,
      grind: prefill.grind,
      dose: prefill.dose,
      setup: prefill.setup,
      yield: prefill.yield ?? 36000,
      time: prefill.time ?? 28000,
      taste: { score: null, balance: null, body: null, sweetness: null, aftertaste: null },
      tagIds: [],
      notes: null,
      brewedAt: now,
      ...overrides
    },
    now
  );
}

function addBean(values: Partial<typeof bean.$inferInsert> = {}): string {
  const id = newId(T0);
  db.insert(bean)
    .values({
      id,
      ownerId: ids.userId,
      name: 'Kenya Kiambu',
      process: 'washed',
      roastDate: '2026-10-10',
      createdAt: T0,
      updatedAt: T0,
      ...values
    })
    .run();
  return id;
}

describe('loadShotForm', () => {
  it('D-38, D-72, D-77: a bean’s first shot starts from My setup, with an empty time', () => {
    const form = ready(loadShotForm(db, ids.userId));
    expect(form.prefill).toMatchObject({
      source: 'my_setup',
      beanId: ids.beanId,
      grind: 1600,
      dose: 18000,
      yield: 36000,
      time: null
    });
    expect(form.prefill.taste).toEqual({
      score: null,
      balance: null,
      body: null,
      sweetness: null,
      aftertaste: null
    });
    expect(form.lastShot).toBeNull();
    expect(form.recipes).toEqual([]);
    expect(form.bean).toMatchObject({ id: ids.beanId, name: 'Guji Hambela', process: 'natural' });
    expect(form.machines.map((m) => m.name)).toEqual(['Lelit Bianca']);
    expect(form.grinders).toMatchObject([{ name: 'Timemore 064S', dial: { step: 100 } }]);
  });

  it('D-153: every machine and grinder you can pick, archived ones left out', () => {
    const add = (kind: 'machine' | 'grinder', name: string, archivedAt: number | null) => {
      const id = newId(T0);
      const spec = kind === 'machine' ? REFERENCE.machine.spec : REFERENCE.grinder.spec;
      db.insert(gear)
        .values({
          id,
          ownerId: ids.userId,
          kind,
          name,
          spec,
          archivedAt,
          createdAt: T0,
          updatedAt: T0
        })
        .run();
      return id;
    };
    add('grinder', 'Comandante C40', null);
    add('machine', 'Old Gaggia', T0);
    const form = ready(loadShotForm(db, ids.userId));
    expect(form.machines.map((m) => m.name)).toEqual(['Lelit Bianca']);
    expect(form.machines[0].features.every((f) => f.enabled)).toBe(true);
    expect(form.grinders.map((g) => g.name)).toEqual(['Comandante C40', 'Timemore 064S']);
    // Switching the machine fills new features from My setup (D-38, D-153).
    expect(form.defaultFeatures).toMatchObject({ temperature: { on: true, value: 93000 } });
  });

  it('D-154: a basket comes with its dose range for the hint', () => {
    const form = ready(loadShotForm(db, ids.userId));
    expect(form.baskets).toEqual([
      { id: ids.basketId, name: 'VST · 18 g', doseRange: { from: 17000, to: 19000 } }
    ]);
  });

  it('D-03, D-16, D-12: the next shot starts from the last one, and knows the bean’s recipes', () => {
    const first = save({ taste: { ...noTaste, score: 8 } }, 1);
    save({ grind: 1500, time: 31000 }, 2);
    const form = ready(loadShotForm(db, ids.userId));
    expect(form.prefill).toMatchObject({ source: 'last_shot', grind: 1500, time: 31000 });
    expect(form.lastShot).toMatchObject({ yield: 36000, time: 31000, recipe: { grind: 1500 } });
    const firstRecipe = form.recipes.find((r) => r.id === first.recipeId);
    expect(firstRecipe).toMatchObject({ shotCount: 1, lastScore: 8, machineId: ids.machineId });
    expect(form.recipes).toHaveLength(2);
  });

  it('D-12: the earlier score is the latest rated shot of the recipe', () => {
    save({ taste: { ...noTaste, score: 6 } }, 1);
    save({ taste: { ...noTaste, score: 8 } }, 2);
    save({}, 3);
    const [recipe] = ready(loadShotForm(db, ids.userId)).recipes;
    expect(recipe).toMatchObject({ shotCount: 3, lastScore: 8 });
  });

  it('D-43: a recipe marked Brew next is where the form starts', () => {
    const marked = save({ grind: 1700 }, 1);
    save({ grind: 1500 }, 2);
    db.update(appState).set({ brewNextRecipeId: marked.recipeId }).run();
    const form = ready(loadShotForm(db, ids.userId));
    expect(form.prefill).toMatchObject({ source: 'brew_next', grind: 1700 });
    expect(form.lastShot?.recipe.grind).toBe(1500);
  });

  it('D-43: a Brew next mark on a bean that is no longer open is ignored', () => {
    const marked = save({ grind: 1700 }, 1);
    db.update(appState).set({ brewNextRecipeId: marked.recipeId }).run();
    db.update(bean).set({ status: 'finished' }).where(eq(bean.id, ids.beanId)).run();
    const kenya = addBean();
    const form = ready(loadShotForm(db, ids.userId));
    expect(form.prefill).toMatchObject({ source: 'my_setup', beanId: kenya });
    expect(form.bean.id).toBe(kenya);
  });

  it('D-134: each open bean in the list has its roast age', () => {
    const form = ready(loadShotForm(db, ids.userId, undefined, T0 + 2 * 86_400_000));
    // The reference bean was roasted 12 days before the seed.
    expect(form.openBeans[0]).toMatchObject({ name: 'Guji Hambela', roastAgeDays: 14 });
  });

  it('D-94: choosing another open bean starts from that bean; Brew next of another bean waits', () => {
    const marked = save({}, 1);
    db.update(appState).set({ brewNextRecipeId: marked.recipeId }).run();
    const kenya = addBean();
    const form = ready(loadShotForm(db, ids.userId, kenya));
    expect(form.prefill).toMatchObject({ source: 'my_setup', beanId: kenya });
    expect(form.bean.name).toBe('Kenya Kiambu');
    expect(form.openBeans.map((b) => b.name).sort()).toEqual(['Guji Hambela', 'Kenya Kiambu']);
  });

  it('D-60, D-94: a bean that is finished or not yours is not offered and not used', () => {
    const finished = addBean({ name: 'Finished bean', status: 'finished' });
    const form = ready(loadShotForm(db, ids.userId, finished));
    expect(form.bean.id).toBe(ids.beanId);
    expect(form.openBeans.map((b) => b.id)).toEqual([ids.beanId]);
    expect(ready(loadShotForm(db, ids.userId, 'not-a-bean')).bean.id).toBe(ids.beanId);
  });

  it('D-32: without a current bean the form uses the newest open bean', () => {
    db.update(appState).set({ currentBeanId: null }).run();
    expect(ready(loadShotForm(db, ids.userId)).bean.id).toBe(ids.beanId);
  });

  it('D-73: a re-buy starts from the earlier bag’s best recipe, as a new recipe for this bag', () => {
    save({ grind: 1500, taste: { ...noTaste, score: 9 } }, 1);
    save({ grind: 1700, taste: { ...noTaste, score: 6 } }, 2);
    const again = addBean({ name: 'Guji Hambela', rebuyOfId: ids.beanId });
    const form = ready(loadShotForm(db, ids.userId, again));
    expect(form.prefill).toMatchObject({ source: 'rebuy', beanId: again, grind: 1500 });
    expect(form.recipes).toEqual([]);
    expect(form.lastShot).toBeNull();
  });

  it('D-75: archived gear in the last shot is swapped for My setup’s', () => {
    const otherBasket = newId(T0);
    db.insert(gear)
      .values({
        id: otherBasket,
        ownerId: ids.userId,
        kind: 'basket',
        name: 'IMS 20 g',
        spec: REFERENCE.basket.spec,
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    save({ basketId: otherBasket }, 1);
    db.update(gear).set({ archivedAt: T0 }).where(eq(gear.id, otherBasket)).run();
    const form = ready(loadShotForm(db, ids.userId));
    expect(form.prefill.basketId).toBe(ids.basketId);
    expect(form.baskets.map((b) => b.name)).toEqual(['VST · 18 g']);
    expect(form.gearNames[otherBasket]).toBe('IMS 20 g');
  });

  it('D-97: flavor notes come most used first, then A–Z', () => {
    const byName = Object.fromEntries(
      db
        .select()
        .from(tag)
        .all()
        .map((t) => [t.name, t.id])
    );
    save({ tagIds: [byName['Caramel'], byName['Winey']] }, 1);
    save({ tagIds: [byName['Winey']] }, 2);
    const names = ready(loadShotForm(db, ids.userId)).tags.map((t) => t.name);
    expect(names.slice(0, 4)).toEqual(['Winey', 'Caramel', 'Almond', 'Berry']);
    expect(names).toHaveLength(15);
  });

  it('D-89: the steps come from your settings', () => {
    db.update(userSettings).set({ doseStep: 500, yieldStep: 200, timeStep: 500 }).run();
    expect(ready(loadShotForm(db, ids.userId)).steps).toEqual({
      dose: 500,
      yield: 200,
      time: 500
    });
  });

  it('D-51, D-76: routines are offered as they are now, with step names and units', () => {
    const [routine] = ready(loadShotForm(db, ids.userId)).routines;
    expect(routine.name).toBe('Daily routine');
    expect(routine.routine.steps.map((s) => [s.name, s.unit ?? null, s.value])).toEqual([
      ['WDT', 's', 20000],
      ['Distributor', null, null],
      ['Tamp', 'kg', 15000],
      ['Puck screen', null, null]
    ]);
  });

  it('D-88: without My setup, there is nothing to brew with yet', () => {
    db.update(userSettings).set({ defaultMachineId: null }).run();
    expect(loadShotForm(db, ids.userId)).toEqual({ state: 'empty', missing: 'setup' });
  });

  it('D-88: without an open bean, there is nothing to brew yet', () => {
    db.update(appState).set({ currentBeanId: null }).run();
    db.update(bean).set({ status: 'finished' }).run();
    expect(loadShotForm(db, ids.userId)).toEqual({ state: 'empty', missing: 'bean' });
    expect(db.select().from(shot).all()).toHaveLength(0);
  });
});

const noTaste = { score: null, balance: null, body: null, sweetness: null, aftertaste: null };

describe('loadEditShotForm', () => {
  const rated = { score: 7, balance: -2, body: 6, sweetness: null, aftertaste: null };

  it('D-113, D-153: a shot keeps its own grinder in the list, even when archived since', () => {
    const { shotId } = save({}, 1);
    db.update(gear).set({ archivedAt: T0 }).where(eq(gear.id, ids.grinderId)).run();
    const form = loadEditShotForm(db, ids.userId, shotId)!;
    expect(form.grinders.map((g) => g.id)).toEqual([ids.grinderId]);
    expect(form.machines.map((m) => m.id)).toEqual([ids.machineId]);
  });

  it('D-57: starts from the shot itself: its values, taste, flavor notes and notes', () => {
    const berry = db.select().from(tag).where(eq(tag.name, 'Berry')).get()!;
    const { shotId } = save(
      { grind: 1500, yield: 38500, time: 25500, taste: rated, tagIds: [berry.id], notes: 'thin' },
      1
    );
    const form = ready(loadEditShotForm(db, ids.userId, shotId)!);
    expect(form.prefill).toMatchObject({ grind: 1500, dose: 18000, yield: 38500, time: 25500 });
    expect(form.edit).toEqual({ shotId, taste: rated, tagIds: [berry.id], notes: 'thin' });
    expect(form.bean.id).toBe(ids.beanId);
  });

  it('D-113: compares with the bean’s shot before this one, and counts only earlier shots', () => {
    save({ yield: 36000 }, 1);
    const second = save({ yield: 37000, taste: rated }, 2).shotId;
    save({ yield: 39000 }, 3); // later: not seen when editing the second
    const form = ready(loadEditShotForm(db, ids.userId, second)!);
    expect(form.lastShot?.yield).toBe(36000);
    expect(form.recipes).toHaveLength(1);
    expect(form.recipes[0]).toMatchObject({ shotCount: 1, lastScore: null });
  });

  it('D-113: the first shot of a bean has nothing before it', () => {
    const first = save({}, 1).shotId;
    save({}, 2);
    const form = ready(loadEditShotForm(db, ids.userId, first)!);
    expect(form.lastShot).toBeNull();
    expect(form.recipes.every((r) => r.shotCount === 0)).toBe(true);
  });

  it('D-113: another open bean can be chosen; it is compared with its own shots before this one', () => {
    const shotId = save({}, 5).shotId;
    const other = newId(T0);
    db.insert(bean)
      .values({
        id: other,
        ownerId: ids.userId,
        name: 'Kiambu AA',
        roastDate: '2026-10-01',
        status: 'open',
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    save({ beanId: other, grind: 1800 }, 3);
    save({ beanId: other, grind: 1900 }, 7); // after the edited shot
    const form = ready(loadEditShotForm(db, ids.userId, shotId, other)!);
    expect(form.bean.name).toBe('Kiambu AA');
    expect(form.lastShot?.recipe.grind).toBe(1800);
    expect(form.prefill.grind).toBe(1600); // the values stay the shot's
  });

  it('D-122: a finished own bean is not offered, but the shot keeps it until another is picked', () => {
    const shotId = save({}, 1).shotId;
    db.update(bean).set({ status: 'finished' }).where(eq(bean.id, ids.beanId)).run();
    const form = ready(loadEditShotForm(db, ids.userId, shotId)!);
    expect(form.openBeans.some((b) => b.id === ids.beanId)).toBe(false);
    expect(form.bean.id).toBe(ids.beanId);
  });

  it('D-60: another user’s shot is not found', () => {
    const shotId = save({}, 1).shotId;
    expect(loadEditShotForm(db, 'someone-else', shotId)).toBeNull();
  });
});
