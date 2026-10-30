import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { finishBean } from './beans';
import { openDatabase, type Db } from './client';
import { chooseHomeBean, loadHome } from './home';
import { newId } from './ids';
import { appState, bean, user, userSettings } from './schema';
import { REFERENCE, seedReferenceSetup, type SeededIds } from './seed';
import { saveShot, type ShotInput } from './shots';
import { loadShotForm } from './shot-form';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-home-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Saturday 17 Oct 2026, 08:00 in Copenhagen (the seed's time zone).
const T0 = Date.UTC(2026, 9, 17, 6, 0);
const MINUTE = 60_000;
const DAY = 86_400_000;
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `home-${counter++}.db`));
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
const taste = (score: number | null, balance: number | null = 0) => ({
  score,
  balance,
  body: null,
  sweetness: null,
  aftertaste: null
});

function secondBean(createdAt = T0): string {
  const id = newId(createdAt);
  db.insert(bean)
    .values({
      id,
      ownerId: ids.userId,
      name: 'Kiambu AA',
      process: 'washed',
      roastDate: '2026-10-01',
      status: 'open',
      createdAt,
      updatedAt: createdAt
    })
    .run();
  return id;
}

function ready() {
  const home = loadHome(db, ids.userId, T0);
  if (home.state !== 'ready') throw new Error('Home has no bean');
  return home;
}

describe('loadHome', () => {
  it('with no open bean, Home has nothing to show for one', () => {
    finishBean(db, ids.userId, ids.beanId, T0);
    expect(loadHome(db, ids.userId, T0)).toEqual({ state: 'no-bean' });
  });

  it('a bean without shots shows its freshness and nothing else yet', () => {
    const home = ready();
    expect(home.bean).toMatchObject({ name: 'Guji Hambela', roastAgeDays: 42, gramsLeft: null });
    expect(home.lastShot).toBeNull();
    expect(home.best).toBeNull();
    expect(home.week).toEqual({ shots: 0, rated: 0, average: null });
  });

  it('the last shot of this bean, with its values, taste and recipe tag', () => {
    save(shotAt(T0 - 2 * DAY));
    const id = save(shotAt(T0 - 10 * MINUTE, { yield: 38500, time: 25500, taste: taste(7, -2) }));
    const { lastShot } = ready();
    expect(lastShot).toMatchObject({
      id,
      score: 7,
      previousScore: 8,
      recipeTag: { kind: 'reused', shotCount: 1 }
    });
    const text = (vs: { label: string; value: string }[]) => vs.map((v) => `${v.label} ${v.value}`);
    expect(text(lastShot!.values.left)).toEqual(['Grind 1.6', 'In 18.0 g', 'Ratio 1 : 2.1']);
    expect(text(lastShot!.values.right)).toEqual([
      'Time 25.5 s',
      'Out 38.5 g',
      'Taste Slightly sour'
    ]);
  });

  it('this week counts only this bean’s shots since Monday', () => {
    const other = secondBean();
    // Saved first: saving a shot makes its bean Home's bean (docs/SPEC.md §4.4).
    save(shotAt(T0 - 30 * MINUTE, { beanId: other, taste: taste(3) }));
    save(shotAt(T0 - 10 * MINUTE, { taste: taste(8) }));
    save(shotAt(T0 - 20 * MINUTE, { taste: taste(null) }));
    save(shotAt(T0 - 6 * DAY, { taste: taste(2) })); // Sunday of last week
    expect(ready().week).toEqual({ shots: 2, rated: 1, average: 8 });
  });

  it('the best recipe with its score, values, setup line and reuse', () => {
    for (const [i, score] of [7, 8, 8].entries())
      save(shotAt(T0 - (i + 1) * DAY, { taste: taste(score) }));
    save(shotAt(T0 - 5 * MINUTE, { grind: 1500, taste: taste(9) }));
    expect(ready().best).toEqual({
      score: '7.7 / 10',
      title: 'Grind 1.6 · 18.0 g → 36.0 g · 28.0 s',
      detail: 'Preinfusion 4 s · Low bar start 5 s · 93 °C · Reused 2x'
    });
  });

  it('until a recipe has 3 rated shots, the highest single score', () => {
    save(shotAt(T0 - DAY, { taste: taste(6) }));
    save(shotAt(T0 - 5 * MINUTE, { grind: 1500, taste: taste(9), time: null }));
    expect(ready().best).toMatchObject({ score: '9 / 10', title: 'Grind 1.5 · 18.0 g → 36.0 g' });
  });

  it('shots without a rating give no best recipe', () => {
    save(shotAt(T0 - DAY, { taste: taste(null) }));
    expect(ready().best).toBeNull();
  });

  it('Dial-in progress plots this bean’s rated shots, oldest first, with recipe changes', () => {
    const first = save(shotAt(T0 - 3 * DAY, { taste: taste(6) }));
    save(shotAt(T0 - 2 * DAY, { taste: taste(null) }));
    const last = save(shotAt(T0 - DAY, { grind: 1500, taste: taste(8) }));
    expect(ready().graph).toEqual({
      points: [
        { shotId: first, score: 6, newRecipe: false },
        { shotId: last, score: 8, newRecipe: true }
      ],
      ticks: [6, 7, 8]
    });
  });

  it('with fewer than 2 rated shots there is no graph', () => {
    save(shotAt(T0 - 2 * DAY, { taste: taste(null) }));
    save(shotAt(T0 - DAY, { taste: taste(6) }));
    expect(ready()).toMatchObject({ graph: null, ratedShots: 1 });
  });

  it('grams left when the bean has a bag weight', () => {
    db.update(bean).set({ bagWeight: 250000 }).where(eq(bean.id, ids.beanId)).run();
    save(shotAt(T0 - DAY));
    expect(ready().bean.gramsLeft).toBe('232 g left');
  });

  it('the current bean while it is open, otherwise the newest open bean', () => {
    const other = secondBean(T0 - DAY);
    expect(ready().bean.id).toBe(ids.beanId);
    expect(ready().openBeans.map((b) => `${b.name} · ${b.detail}`)).toEqual([
      'Kiambu AA · Washed · 16 days',
      'Guji Hambela · Natural · 42 days'
    ]);
    finishBean(db, ids.userId, ids.beanId, T0);
    expect(ready().bean.id).toBe(other);
  });

  it('shows nothing of another user', () => {
    const otherUser = newId(T0);
    db.insert(user)
      .values({ id: otherUser, name: 'Other', passwordHash: 'x', createdAt: T0, updatedAt: T0 })
      .run();
    db.insert(userSettings)
      .values({ userId: otherUser, timeZone: 'Europe/Copenhagen', createdAt: T0, updatedAt: T0 })
      .run();
    save(shotAt(T0 - DAY));
    expect(loadHome(db, otherUser, T0)).toEqual({ state: 'no-bean' });
  });
});

describe('chooseHomeBean', () => {
  it('the chosen bean is the one Home shows and "+" starts from', () => {
    const other = secondBean();
    expect(chooseHomeBean(db, ids.userId, other, T0)).toBe(true);
    expect(ready().bean.id).toBe(other);
    const form = loadShotForm(db, ids.userId, undefined, T0);
    expect(form.state === 'ready' && form.bean.id).toBe(other);
  });

  it('a finished bean or another user’s bean cannot be chosen', () => {
    const other = secondBean();
    finishBean(db, ids.userId, other, T0);
    expect(chooseHomeBean(db, ids.userId, other, T0)).toBe(false);
    expect(chooseHomeBean(db, ids.userId, 'not-a-bean', T0)).toBe(false);
    expect(db.select().from(appState).get()?.currentBeanId).toBe(ids.beanId);
  });
});
