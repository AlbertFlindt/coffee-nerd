import { describe, expect, it } from 'vitest';
import { decimalsDeep } from './export';
import { recipeFingerprint } from './fingerprint';
import { NOT_AN_EXPORT, readImport, thousandthsDeep } from './import';

const MACHINE = '019a0000-0000-7000-8000-000000000001';
const GRINDER = '019a0000-0000-7000-8000-000000000002';
const BEAN = '019a0000-0000-7000-8000-000000000003';
const STEP = '019a0000-0000-7000-8000-000000000004';
const ROUTINE = '019a0000-0000-7000-8000-000000000005';
const TAG = '019a0000-0000-7000-8000-000000000006';
const RECIPE = '019a0000-0000-7000-8000-000000000007';
const SHOT = '019a0000-0000-7000-8000-000000000008';
const REBUY = '019a0000-0000-7000-8000-000000000009';
const AT = '2026-10-30T06:00:00.000Z';
const times = { createdAt: AT, updatedAt: AT };
const library = { shared: false, archivedAt: null };

/** A small "Export everything" file, as export.ts writes it. */
function file() {
  return {
    app: 'Coffee Nerd',
    exportedAt: AT,
    units: 'Weights in grams, times in seconds, temperatures in degrees Celsius, pressures in bar.',
    account: { name: 'Demo' },
    mySetup: {
      machineId: MACHINE,
      grinderId: GRINDER,
      basketId: null,
      routineId: ROUTINE,
      grind: 1.6,
      dose: 18,
      yield: 36,
      features: { temperature: { label: 'Temperature', unit: '°C', on: true, value: 93 } },
      timeZone: 'Europe/Copenhagen',
      steps: { dose: 0.1, yield: 0.1, time: 1 }
    },
    brewNextRecipeId: RECIPE,
    gear: [
      {
        id: MACHINE,
        kind: 'machine',
        name: 'Lelit Bianca',
        spec: { type: 'semi_auto', groupSizeMm: 58.5, features: [] },
        ...library,
        ...times
      },
      {
        id: GRINDER,
        kind: 'grinder',
        name: 'Niche Zero',
        spec: {
          type: 'electric',
          burrs: 'conical',
          dial: { mode: 'stepless', step: 0.1, finest: 0, coarsest: 50 }
        },
        ...library,
        ...times
      }
    ],
    beans: [
      {
        id: BEAN,
        name: 'Guji Hambela',
        roaster: 'Nordlys',
        countryCode: 'ET',
        region: null,
        variety: null,
        process: 'natural',
        altitudeMinMetres: 1900,
        altitudeMaxMetres: 2200,
        roastLevel: 'light',
        roastDate: '2026-10-20',
        bagWeight: 250,
        status: 'finished',
        finishedAt: AT,
        finishedAutomatically: true,
        rebuyOfId: null,
        shared: false,
        ...times
      },
      {
        id: REBUY,
        name: 'Guji Hambela',
        roaster: 'Nordlys',
        countryCode: 'ET',
        region: null,
        variety: null,
        process: 'natural',
        altitudeMinMetres: null,
        altitudeMaxMetres: null,
        roastLevel: null,
        roastDate: '2026-10-28',
        bagWeight: null,
        status: 'open',
        finishedAt: null,
        finishedAutomatically: false,
        rebuyOfId: BEAN,
        shared: false,
        ...times
      }
    ],
    puckPrepSteps: [
      {
        id: STEP,
        name: 'WDT',
        setting: { kind: 'seconds', step: 5, min: 0, max: 60, startsAt: 20 },
        ...library,
        ...times
      }
    ],
    routines: [
      {
        id: ROUTINE,
        name: 'Daily routine',
        steps: [{ stepId: STEP, value: 20 }],
        ...library,
        ...times
      }
    ],
    flavorNotes: [
      { id: TAG, name: 'Blueberry', family: 'fruity', builtIn: true, ...library, ...times }
    ],
    recipes: [
      {
        id: RECIPE,
        method: 'espresso',
        beanId: BEAN,
        machineId: MACHINE,
        grinderId: GRINDER,
        basketId: null,
        routineId: ROUTINE,
        grind: 1.6,
        dose: 18,
        setup: {
          features: { temperature: { label: 'Temperature', unit: '°C', on: true, value: 93 } },
          routine: {
            name: 'Daily routine',
            steps: [{ stepId: STEP, name: 'WDT', unit: 's', value: 20 }]
          }
        },
        ...times
      }
    ],
    shots: [
      {
        id: SHOT,
        recipeId: RECIPE,
        brewedAt: AT,
        dose: 18.1,
        yield: 36.5,
        time: 28,
        score: 8,
        balance: -1,
        body: 6,
        sweetness: null,
        aftertaste: null,
        flavorNoteIds: [TAG],
        notes: 'Bright',
        ...times
      }
    ]
  };
}

const read = (value: unknown) => readImport(JSON.stringify(value));

describe('thousandthsDeep', () => {
  it('undoes decimalsDeep for every number in a stored JSON value', () => {
    const stored = { a: 93000, b: [58500, { c: 1600 }], d: 'mid', e: null, f: true };
    expect(thousandthsDeep(decimalsDeep(stored))).toEqual(stored);
  });
});

describe('readImport', () => {
  it('turns decimals into thousandths and times into UTC milliseconds', () => {
    const result = read(file());
    if (!result.ok) throw new Error(result.problem);
    const { data } = result;
    expect(data.shots[0]).toMatchObject({
      brewedAt: Date.parse(AT),
      dose: 18100,
      yield: 36500,
      time: 28000,
      score: 8,
      balance: -1,
      sweetness: null
    });
    expect(data.gear[0].spec).toEqual({ type: 'semi_auto', groupSizeMm: 58500, features: [] });
    expect(data.beans[0]).toMatchObject({ altitudeMinM: 1900, bagWeight: 250000 });
    expect(data.mySetup).toMatchObject({ defaultGrind: 1600, doseStep: 100, timeStep: 1000 });
    expect(data.routines[0].steps).toEqual([{ stepId: STEP, value: 20000 }]);
  });

  it('keeps every id, so re-buys, Brew next and My setup still point to the same rows', () => {
    const result = read(file());
    if (!result.ok) throw new Error(result.problem);
    expect(result.data.beans[1].rebuyOfId).toBe(BEAN);
    expect(result.data.brewNextRecipeId).toBe(RECIPE);
    expect(result.data.mySetup?.defaultRoutineId).toBe(ROUTINE);
    expect(result.data.shotTags).toEqual([{ shotId: SHOT, tagId: TAG }]);
  });

  it("works out each recipe's fingerprint again, as saving a shot would", () => {
    const result = read(file());
    if (!result.ok) throw new Error(result.problem);
    const recipe = result.data.recipes[0];
    expect(recipe.fingerprint).toBe(recipeFingerprint(recipe));
    expect(recipe.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a file that is not JSON, or not an export, is refused in plain words', () => {
    expect(readImport('not json')).toEqual({ ok: false, problem: NOT_AN_EXPORT });
    expect(read({ hello: 'world' })).toEqual({ ok: false, problem: NOT_AN_EXPORT });
    expect(read({ ...file(), app: 'Other app' })).toEqual({ ok: false, problem: NOT_AN_EXPORT });
  });

  it('a value the app would not save is refused, like a score of 11 or a broken grinder dial', () => {
    const scored = file();
    scored.shots[0].score = 11;
    expect(read(scored).ok).toBe(false);
    const grinder = file();
    grinder.gear[1].spec.dial = { mode: 'stepless', step: 0.1, finest: 5, coarsest: 5 };
    expect(read(grinder).ok).toBe(false);
  });

  it('a link to a row that is not in the file is refused', () => {
    const shot = file();
    shot.shots[0].recipeId = SHOT;
    expect(read(shot).ok).toBe(false);
    const tagged = file();
    tagged.shots[0].flavorNoteIds = [BEAN];
    expect(read(tagged).ok).toBe(false);
    const step = file();
    step.routines[0].steps = [{ stepId: ROUTINE, value: 20 }];
    expect(read(step).ok).toBe(false);
    const brewNext = file();
    brewNext.brewNextRecipeId = BEAN;
    expect(read(brewNext).ok).toBe(false);
  });

  it('a recipe whose grinder is a machine is refused', () => {
    const swapped = file();
    swapped.recipes[0].grinderId = MACHINE;
    expect(read(swapped).ok).toBe(false);
  });

  it('two flavor notes with the same name, ignoring case, are refused', () => {
    const twice = file();
    twice.flavorNotes.push({
      ...twice.flavorNotes[0],
      id: SHOT.replace('8', '9'),
      name: 'blueberry'
    });
    expect(read(twice).ok).toBe(false);
  });

  it('a file without My setup yet is read, with My setup left empty', () => {
    const result = read({ ...file(), mySetup: null });
    expect(result.ok && result.data.mySetup).toBe(null);
  });
});
