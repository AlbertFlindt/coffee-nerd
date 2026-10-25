import { describe, expect, it } from 'vitest';
import { pooledStandardDeviation, standardDeviation } from '../../domain/statistics';
import type { ShotFact } from './facts';
import { recipesApartFromRoutine, runQuery } from './query';
import { dimension } from './registry';
import { builtInFeatures } from '../../domain/gear';

let counter = 0;

/** A shot fact with the reference values; ids and times count up so facts stay oldest first. */
function fact(overrides: Partial<ShotFact> = {}): ShotFact {
  counter += 1;
  return {
    shotId: `shot-${String(counter).padStart(4, '0')}`,
    recipeId: 'recipe-a',
    beanId: 'bean-guji',
    beanName: 'Guji Hambela',
    machineId: 'machine',
    grinderId: 'grinder',
    grinderName: 'Timemore 064S',
    grindStep: 100,
    basketId: 'basket',
    basketName: 'VST · 18 g',
    routineId: 'routine-daily',
    routineName: 'Daily routine',
    brewedAt: counter * 60_000,
    localDay: '2026-10-17',
    week: '2026-10-12',
    roastAgeDays: 12,
    score: 8,
    balance: 0,
    body: null,
    sweetness: null,
    aftertaste: null,
    dose: 18000,
    yield: 36000,
    time: 28000,
    ratio: 2000,
    grind: 1600,
    recipeDose: 18000,
    process: 'natural',
    countryCode: 'ET',
    roaster: 'Nordlys Roasters',
    roastLevel: 'light',
    recipeShots: 1,
    setup: {
      features: {
        temperature: { label: 'Temperature', unit: '°C', on: true, value: 93000 },
        preinfusion: { label: 'Preinfusion', on: true, value: 4000, pressure: 2000 },
        low_bar_end: { label: 'Low bar end', on: false }
      },
      routine: {
        name: 'Daily routine',
        steps: [
          { stepId: 'step-wdt', name: 'WDT', unit: 's', value: 20000 },
          { stepId: 'step-screen', name: 'Puck screen type', value: 'metal' },
          { stepId: 'step-distributor', name: 'Distributor', value: null }
        ]
      }
    },
    ...overrides
  };
}

describe('runQuery', () => {
  it('D-11: unrated shots are left out of a score, never counted as 0', () => {
    const facts = [fact({ score: 7 }), fact({ score: null }), fact({ score: 9 })];
    expect(runQuery(facts, { measure: 'score' })).toEqual([
      { key: 'all', label: 'All shots', values: [7, 9], held: [] }
    ]);
  });

  it('D-11: rated shots only also applies to other measures', () => {
    const facts = [fact({ time: 27000 }), fact({ score: null, time: 31000 }), fact({ time: null })];
    expect(runQuery(facts, { measure: 'time' })[0].values).toEqual([27, 31]);
    expect(runQuery(facts, { measure: 'time', filters: { ratedOnly: true } })[0].values).toEqual([
      27
    ]);
  });

  it('D-64: measures read plain numbers from thousandths', () => {
    const facts = [fact({ time: 25500, yield: 38500, dose: 18100, ratio: 2127, grind: 1650 })];
    const one = (measure: Parameters<typeof runQuery>[1]['measure']) =>
      runQuery(facts, { measure })[0].values[0];
    expect(one('time')).toBe(25.5);
    expect(one('yield')).toBe(38.5);
    expect(one('dose')).toBe(18.1);
    expect(one('ratio')).toBe(2.127);
    expect(one('grind')).toBe(1.65);
    expect(one('balance')).toBe(0);
  });

  it('D-55: groups by a dimension in the order of their first shot, with the words shown', () => {
    const facts = [
      fact({ process: 'washed', score: 6 }),
      fact({ process: 'natural', score: 8 }),
      fact({ process: 'washed', score: 7 }),
      fact({ process: null, score: 9 })
    ];
    expect(
      runQuery(facts, { measure: 'score', groupBy: 'process' }).map(({ label, values }) => ({
        label,
        values
      }))
    ).toEqual([
      { label: 'Washed', values: [6, 7] },
      { label: 'Natural', values: [8] }
    ]);
  });

  it('D-203: reused recipes only keeps recipes brewed more than once', () => {
    const facts = [
      fact({ recipeId: 'once', recipeShots: 1, score: 3 }),
      fact({ recipeId: 'twice', recipeShots: 2, score: 8 }),
      fact({ recipeId: 'twice', recipeShots: 2, score: 7 })
    ];
    expect(
      runQuery(facts, { measure: 'score', filters: { reusedRecipesOnly: true } })[0].values
    ).toEqual([8, 7]);
  });

  it('D-205, D-210: filters by bean', () => {
    const facts = [fact({ beanId: 'a', score: 5 }), fact({ beanId: 'b', score: 6 })];
    expect(runQuery(facts, { measure: 'score', filters: { beanId: 'b' } })[0].values).toEqual([6]);
  });

  it('D-211: holding the recipe constant splits each group for a pooled σ', () => {
    const facts = [
      fact({ beanId: 'guji', beanName: 'Guji', recipeId: 'r1', score: 7 }),
      fact({ beanId: 'guji', beanName: 'Guji', recipeId: 'r1', score: 8 }),
      fact({ beanId: 'guji', beanName: 'Guji', recipeId: 'r2', score: 4 }),
      fact({ beanId: 'guji', beanName: 'Guji', recipeId: 'r2', score: 5 })
    ];
    const [guji] = runQuery(facts, { measure: 'score', groupBy: 'bean', holdConstant: 'recipe' });
    expect(guji.held).toEqual([
      [7, 8],
      [4, 5]
    ]);
    // Moving between recipes is not spread: within each recipe the scores differ by one point.
    expect(pooledStandardDeviation(guji.held)).toBeCloseTo(Math.SQRT1_2, 10);
    expect(standardDeviation(guji.values)!).toBeGreaterThan(1.5);
  });

  it('D-55: holding the bean constant splits by bean', () => {
    const facts = [
      fact({ beanId: 'a', routineId: 'daily', score: 7 }),
      fact({ beanId: 'b', routineId: 'daily', score: 5 })
    ];
    expect(
      runQuery(facts, { measure: 'score', groupBy: 'routine', holdConstant: 'bean' })[0].held
    ).toEqual([[7], [5]]);
  });

  it('D-204: routines are compared within recipes equal apart from the routine', () => {
    const daily = { routineId: 'daily', routineName: 'Daily' };
    const light = { routineId: 'light', routineName: 'Light roast' };
    const facts = [
      fact({ ...daily, recipeId: 'd1', time: 27000 }),
      fact({ ...light, recipeId: 'l1', time: 30000 }),
      fact({ ...daily, recipeId: 'd2', grind: 1700, time: 25000 })
    ];
    const groups = runQuery(facts, {
      measure: 'time',
      groupBy: 'routine',
      holdConstant: 'recipe-apart-from-routine'
    });
    const keys = recipesApartFromRoutine(facts);
    expect(keys.get('d1')).toBe(keys.get('l1'));
    expect(keys.get('d2')).not.toBe(keys.get('d1')); // another grind is another comparison
    expect(groups.map((g) => [g.label, g.held])).toEqual([
      ['Daily', [[27], [25]]],
      ['Light roast', [[30]]]
    ]);
  });

  it('D-204: the machine, grinder, basket and setup are held equal too', () => {
    const base = { routineId: 'x', recipeShots: 1 };
    const facts = [
      fact({ ...base, recipeId: 'base' }),
      fact({ ...base, recipeId: 'machine', machineId: 'other' }),
      fact({ ...base, recipeId: 'grinder', grinderId: 'other' }),
      fact({ ...base, recipeId: 'basket', basketId: null }),
      fact({ ...base, recipeId: 'bean', beanId: 'other' }),
      fact({
        ...base,
        recipeId: 'setup',
        setup: { features: { temperature: { label: 'T', on: true, value: 94000 } }, routine: null }
      })
    ];
    expect(new Set(recipesApartFromRoutine(facts).values()).size).toBe(6);
  });

  it('D-215: a dose joins the closest anchor within 0.2 g, taken from the most brewed', () => {
    const facts = [
      fact({ recipeId: 'most', recipeDose: 18000, recipeShots: 9 }),
      fact({ recipeId: 'next', recipeDose: 18300, recipeShots: 5 }),
      fact({ recipeId: 'between', recipeDose: 18200, recipeShots: 1 })
    ];
    const keys = recipesApartFromRoutine(facts);
    // 18.3 g is out of 18.0 g's reach and starts its own; 18.2 g reaches both and joins the closer.
    expect(keys.get('next')).not.toBe(keys.get('most'));
    expect(keys.get('between')).toBe(keys.get('next'));
  });

  it('D-215: on equal shot counts the first brewed recipe anchors', () => {
    const facts = [
      fact({ recipeId: 'zz-first', recipeDose: 18000, recipeShots: 2 }),
      fact({ recipeId: 'aa-second', recipeDose: 18200, recipeShots: 2 }),
      fact({ recipeId: 'aa-third', recipeDose: 18400, recipeShots: 2 })
    ];
    const keys = recipesApartFromRoutine(facts);
    expect(keys.get('aa-second')).toBe(keys.get('zz-first'));
    expect(keys.get('aa-third')).not.toBe(keys.get('zz-first'));
  });

  it('D-215, D-186: doses join the most-brewed recipe within 0.2 g, which is not transitive', () => {
    const facts = [
      fact({ recipeId: 'a', recipeDose: 18200, recipeShots: 3 }),
      fact({ recipeId: 'b', recipeDose: 18000, recipeShots: 9 }),
      fact({ recipeId: 'c', recipeDose: 18400, recipeShots: 2 }),
      fact({ recipeId: 'd', recipeDose: 17800, recipeShots: 1 })
    ];
    const keys = recipesApartFromRoutine(facts);
    // 18.0 g is brewed most: 18.2 g and 17.8 g join it; 18.4 g is 0.4 g away and starts its own.
    expect(keys.get('a')).toBe(keys.get('b'));
    expect(keys.get('d')).toBe(keys.get('b'));
    expect(keys.get('c')).not.toBe(keys.get('b'));
  });
});

describe('dimensions', () => {
  const group = (name: Parameters<typeof dimension>[0], f: ShotFact) =>
    dimension(name, {
      stepOptions: { 'step-screen': { metal: 'Metal' } },
      machineFeatures: {
        machine: builtInFeatures({
          temperature: true,
          flat_pressure: true,
          preinfusion: true,
          low_bar_start: true,
          low_bar_end: true
        })
      }
    }).group(f);

  it('D-55: bean facts read as on screen', () => {
    const f = fact({ roastLevel: 'medium_light' });
    expect(group('country', f)).toEqual({ key: 'ET', label: 'Ethiopia' });
    expect(group('process', f)).toEqual({ key: 'natural', label: 'Natural' });
    expect(group('roaster', f)).toEqual({ key: 'Nordlys Roasters', label: 'Nordlys Roasters' });
    expect(group('roastLevel', f)).toEqual({ key: 'medium_light', label: 'Med-light' });
    expect(group('bean', f)).toEqual({ key: 'bean-guji', label: 'Guji Hambela' });
  });

  it('D-112: a recipe reads as its grind and dose', () => {
    expect(group('recipe', fact({ grind: 1600, recipeDose: 18000 }))).toEqual({
      key: 'recipe-a',
      label: '1.6 · 18.0 g'
    });
  });

  it('D-55, D-204: gear and routines read by name; without a basket or routine there is no group', () => {
    expect(group('grinder', fact())).toEqual({ key: 'grinder', label: 'Timemore 064S' });
    expect(group('basket', fact())).toEqual({ key: 'basket', label: 'VST · 18 g' });
    expect(group('routine', fact())).toEqual({ key: 'routine-daily', label: 'Daily routine' });
    expect(group('basket', fact({ basketId: null }))).toBeNull();
    expect(group('routine', fact({ routineId: null }))).toBeNull();
  });

  it('D-208: a week is named by its Monday', () => {
    expect(group('week', fact({ week: '2026-10-12' }))).toEqual({
      key: '2026-10-12',
      label: '2026-10-12'
    });
  });

  it('D-46: any machine feature, as set on the recipe', () => {
    expect(group('feature:temperature', fact())?.label).toBe('93 °C');
    expect(group('feature:preinfusion', fact())?.label).toBe('Preinfusion 4 s');
    expect(group('feature:temperature', fact({ machineId: 'unknown' }))?.label).toBe('Temperature');
    expect(group('feature:low_bar_end', fact())).toEqual({ key: 'off', label: 'Off' });
    expect(group('feature:missing', fact())).toBeNull();
  });

  it('D-51: any puck prep step, with list options by name', () => {
    expect(group('step:step-wdt', fact())).toEqual({ key: 'value:20000', label: '20 s' });
    expect(group('step:step-screen', fact())).toEqual({ key: 'option:metal', label: 'Metal' });
    expect(group('step:step-distributor', fact())).toBeNull();
    expect(group('step:not-in-routine', fact())).toBeNull();
  });

  it('D-64: refuses a dimension that is not in the registry', () => {
    expect(() => dimension('colour' as never)).toThrow('Unknown dimension');
  });
});
