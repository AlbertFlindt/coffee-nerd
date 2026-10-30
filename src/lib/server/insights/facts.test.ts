import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../db/client';
import { newId } from '../db/ids';
import { addStep } from '../db/puck-prep';
import { bean, gear, recipe, shot, user } from '../db/schema';
import { REFERENCE, seedReferenceSetup, type SeededIds } from '../db/seed';
import { saveShot, type ShotInput } from '../db/shots';
import { loadDimensionContext, loadShotFacts, mondayOf } from './facts';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-facts-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Saturday 17 Oct 2026, 08:00 in Copenhagen (the seed's time zone, UTC+2 until 25 Oct).
const T0 = Date.UTC(2026, 9, 17, 6, 0);
const HOUR = 3_600_000;
const DAY = 86_400_000;
const ZONE = 'Europe/Copenhagen';
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  // Seeded 30 days before T0: the bean was roasted on 5 Sep 2026.
  db = openDatabase(join(dir, `facts-${counter++}.db`));
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

describe('loadShotFacts', () => {
  it('one row per shot with its recipe, bean and gear', () => {
    const first = save(shotAt(T0 - DAY));
    const second = save(shotAt(T0, { yield: 38500, time: null, dose: 18100 }));
    const facts = loadShotFacts(db, ids.userId, ZONE);
    expect(facts.map((f) => f.shotId)).toEqual([first, second]);
    expect(facts[1]).toMatchObject({
      beanId: ids.beanId,
      beanName: 'Guji Hambela',
      grinderName: REFERENCE.grinder.name,
      grindStep: REFERENCE.grinder.spec.dial.step,
      basketName: REFERENCE.basket.name,
      routineName: 'Daily routine',
      grind: 1600,
      dose: 18100,
      recipeDose: 18000,
      yield: 38500,
      time: null,
      ratio: 2127, // 38.5 g from 18.1 g
      score: 8,
      process: 'natural',
      countryCode: 'ET',
      roaster: 'Nordlys Roasters',
      roastLevel: 'light',
      recipeShots: 2 // both shots share the recipe: 18.1 g is within 0.2 g of 18.0 g (D-186)
    });
    expect(facts[1].setup.features.temperature).toMatchObject({ on: true, value: 93000 });
  });

  it('the local day, the week from Monday and the roast age follow the user’s time zone', () => {
    // Sunday 18 Oct, 23:30 in Copenhagen, and half past midnight on Monday 19 Oct.
    save(shotAt(Date.UTC(2026, 9, 18, 21, 30)));
    save(shotAt(Date.UTC(2026, 9, 18, 22, 30)));
    const [sunday, monday] = loadShotFacts(db, ids.userId, ZONE);
    expect(sunday).toMatchObject({ localDay: '2026-10-18', week: '2026-10-12', roastAgeDays: 43 });
    expect(monday).toMatchObject({ localDay: '2026-10-19', week: '2026-10-19', roastAgeDays: 44 });
  });

  it('a shot without a score stays null, never 0', () => {
    save(
      shotAt(T0, {
        taste: { score: null, balance: null, body: null, sweetness: null, aftertaste: null }
      })
    );
    expect(loadShotFacts(db, ids.userId, ZONE)[0]).toMatchObject({ score: null, balance: null });
  });

  it('shots on archived gear still count', () => {
    const id = save(shotAt(T0));
    db.update(gear).set({ archivedAt: T0 }).where(eq(gear.id, ids.basketId)).run();
    expect(loadShotFacts(db, ids.userId, ZONE).map((f) => f.shotId)).toEqual([id]);
  });

  it('another account’s shots never appear', () => {
    const mine = save(shotAt(T0));
    const otherUser = newId(T0);
    const otherBean = newId(T0);
    const otherRecipe = newId(T0);
    db.insert(user)
      .values({ id: otherUser, name: 'Other', passwordHash: 'x', createdAt: T0, updatedAt: T0 })
      .run();
    db.insert(bean)
      .values({
        id: otherBean,
        ownerId: otherUser,
        name: 'Other bean',
        roastDate: '2026-10-01',
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    db.insert(recipe)
      .values({
        id: otherRecipe,
        ownerId: otherUser,
        beanId: otherBean,
        machineId: ids.machineId,
        grinderId: ids.grinderId,
        grind: 1600,
        dose: 18000,
        setup: { features: {}, routine: null },
        fingerprint: 'other',
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    db.insert(shot)
      .values({
        id: newId(T0),
        ownerId: otherUser,
        recipeId: otherRecipe,
        brewedAt: T0,
        dose: 18000,
        score: 3,
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    expect(loadShotFacts(db, ids.userId, ZONE).map((f) => f.shotId)).toEqual([mine]);
    expect(loadShotFacts(db, otherUser, ZONE)).toHaveLength(1);
  });

  it('filters by bean, recipe and time', () => {
    const early = save(shotAt(T0 - 2 * DAY));
    const late = save(shotAt(T0, { grind: 1700 }));
    const all = loadShotFacts(db, ids.userId, ZONE);
    expect(loadShotFacts(db, ids.userId, ZONE, { from: T0 - HOUR }).map((f) => f.shotId)).toEqual([
      late
    ]);
    expect(loadShotFacts(db, ids.userId, ZONE, { to: T0 - HOUR }).map((f) => f.shotId)).toEqual([
      early
    ]);
    expect(
      loadShotFacts(db, ids.userId, ZONE, { recipeId: all[1].recipeId }).map((f) => f.shotId)
    ).toEqual([late]);
    expect(loadShotFacts(db, ids.userId, ZONE, { beanId: 'none' })).toEqual([]);
  });
});

describe('mondayOf', () => {
  it('weeks start on Monday', () => {
    expect(mondayOf('2026-10-19')).toBe('2026-10-19'); // Monday
    expect(mondayOf('2026-10-25')).toBe('2026-10-19'); // Sunday
    expect(mondayOf('2027-01-01')).toBe('2026-12-28'); // across the year
  });
});

describe('loadDimensionContext', () => {
  it('names list step options, and only those, and each machine’s features', () => {
    const screen = addStep(
      db,
      ids.userId,
      {
        name: 'Puck screen type',
        setting: {
          kind: 'choice',
          options: [
            { id: 'metal', label: 'Metal' },
            { id: 'paper', label: 'Paper' }
          ],
          startsAt: 'metal'
        }
      },
      T0
    );
    const context = loadDimensionContext(db, ids.userId);
    expect(Object.keys(context.machineFeatures)).toEqual([ids.machineId]);
    expect(context.stepOptions).toEqual({
      [screen]: { metal: 'Metal', paper: 'Paper' }
    });
  });
});
