import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addBean as addBeanFromForm,
  BeanRejected,
  loadBeanForm,
  rebuyChoices,
  rebuyFields,
  updateBean
} from './beans';
import { loadBeans } from './beans';
import { openDatabase, type Db } from './client';
import { newId } from './ids';
import type { BeanInput } from '../../domain/schemas';
import { appState, bean } from './schema';
import { REFERENCE, seedReferenceSetup, type SeededIds } from './seed';
import { saveShot, type ShotInput } from './shots';

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

function shot(brewedAt: number, overrides: Partial<ShotInput> = {}): void {
  saveShot(
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
  it('D-37: an open bean with its roast age, origin, best score, recipes and shots', () => {
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

  it('D-135: the best score is the best recipe’s average once it has 3 rated shots', () => {
    for (const [i, score] of [8, 8, 7].entries()) shot(T0 - (5 - i) * DAY, { taste: taste(score) });
    shot(T0 - DAY, { taste: taste(9), grind: 1500 });
    expect(loadBeans(db, ids.userId, T0).open[0].best).toBe('7.7');
  });

  it('D-37: a bean without a rated shot has no best score', () => {
    shot(T0 - DAY, { taste: taste(null) });
    expect(loadBeans(db, ids.userId, T0).open[0].best).toBeNull();
  });

  it('D-132: grams left with a bag weight', () => {
    db.update(bean).set({ bagWeight: 250000 }).where(eq(bean.id, ids.beanId)).run();
    shot(T0 - DAY);
    expect(loadBeans(db, ids.userId, T0).open[0].gramsLeft).toBe('232 g left');
  });

  it('D-137: open beans newest first; finished beans below, most recently finished first', () => {
    const kiambu = addBean({ name: 'Kiambu AA', createdAt: T0 });
    addBean({ name: 'Huila', status: 'finished', finishedAt: T0 - 9 * DAY });
    addBean({ name: 'Cerrado', status: 'finished', finishedAt: T0 - 2 * DAY });
    const { open, finished } = loadBeans(db, ids.userId, T0);
    expect(open.map((b) => b.id)).toEqual([kiambu, ids.beanId]);
    expect(open[0]).toMatchObject({ roastAgeDays: 4, recipes: 0, shots: 0, best: null });
    expect(finished.map((b) => b.name)).toEqual(['Cerrado', 'Huila']);
  });

  it('D-60: another user’s beans are not listed', () => {
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
  it('D-41: saves an open bean with what was entered', () => {
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

  it('D-138: a roast date after today is refused', () => {
    // T0 is 17 Oct 2026, 06:00 UTC.
    expect(() => addBeanFromForm(db, ids.userId, input({ roastDate: '2026-10-18' }), T0)).toThrow(
      BeanRejected
    );
    expect(() =>
      addBeanFromForm(db, ids.userId, input({ roastDate: '2026-10-17' }), T0)
    ).not.toThrow();
  });

  it('D-41, D-60: a re-buy links to an earlier bag of yours only', () => {
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

  it('D-140: adding a bean does not change the current bean', () => {
    const before = db.select().from(appState).get()?.currentBeanId;
    addBeanFromForm(db, ids.userId, input(), T0);
    expect(db.select().from(appState).get()?.currentBeanId).toBe(before);
  });
});

describe('rebuyChoices', () => {
  it('D-126: every earlier bean once, as its latest bag, newest first', () => {
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

  it('D-60: only your own beans', () => {
    expect(rebuyChoices(db, 'someone-else')).toEqual([]);
  });
});

describe('rebuyFields', () => {
  it('D-41, D-139: everything but roast date and bag weight, linked to that bag', () => {
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
  it('D-130: the form starts from the bean, and saving changes it but keeps its re-buy link', () => {
    const id = addBeanFromForm(db, ids.userId, input({ rebuyOfId: ids.beanId }), T0);
    const form = loadBeanForm(db, ids.userId, id)!;
    expect(form).toMatchObject({ name: 'Kiambu AA', roastDate: '2026-10-13', bagWeight: 250000 });
    updateBean(db, ids.userId, id, input({ name: 'Kiambu AA Peaberry', rebuyOfId: null }), T0);
    expect(db.select().from(bean).where(eq(bean.id, id)).get()).toMatchObject({
      name: 'Kiambu AA Peaberry',
      rebuyOfId: ids.beanId
    });
  });

  it('D-60: another user’s bean is not found', () => {
    expect(loadBeanForm(db, 'someone-else', ids.beanId)).toBeNull();
    expect(() => updateBean(db, 'someone-else', ids.beanId, input(), T0)).toThrow(BeanRejected);
  });
});
