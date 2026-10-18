import { describe, expect, it } from 'vitest';
import { recipeFingerprint, recipeTagText, type RecipeIdentity } from './fingerprint';
import type { FeatureDefinition } from './schemas';
import {
  coreChanges,
  matchRecipe,
  setupChanges,
  setupDetail,
  setupParts,
  setupSummary,
  type KnownRecipe
} from './shot-form';

const MACHINE = '0199f3a2-0000-7000-8000-00000000d001';
const OTHER_MACHINE = '0199f3a2-0000-7000-8000-00000000d002';
const GRINDER = '0199f3a2-0000-7000-8000-00000000a001';
const BASKET = '0199f3a2-0000-7000-8000-00000000b001';
const OTHER_BASKET = '0199f3a2-0000-7000-8000-00000000b002';
const ROUTINE = '0199f3a2-0000-7000-8000-00000000c001';
const WDT = '0199f3a2-0000-7000-8000-00000000e001';
const PADDLE = 'custom-0199f3a2-7c1e-7d2a-9b4f-3a6c1e2d4f5a';

const base: RecipeIdentity = {
  machineId: MACHINE,
  grinderId: GRINDER,
  basketId: BASKET,
  routineId: ROUTINE,
  grind: 1600,
  dose: 18000,
  setup: {
    features: {
      temperature: { label: 'Temperature', unit: '°C', on: true, value: 93000 },
      flat_pressure: { label: 'Flat pressure', unit: 'bar', on: true, value: 9000 },
      preinfusion: { label: 'Preinfusion', on: true, value: 4000 },
      low_bar_start: { label: 'Low bar start', on: true, value: 5000, pressure: 2000 },
      low_bar_end: { label: 'Low bar end', on: false }
    },
    routine: {
      name: 'Daily routine',
      steps: [{ stepId: WDT, name: 'WDT', unit: 's', value: 20000 }]
    }
  }
};

type Features = RecipeIdentity['setup']['features'];
const withFeatures = (features: Features): RecipeIdentity => ({
  ...base,
  setup: { ...base.setup, features: { ...base.setup.features, ...features } }
});

const known = (recipe: RecipeIdentity, extra: Partial<KnownRecipe> = {}): KnownRecipe => ({
  id: 'r1',
  machineId: recipe.machineId,
  fingerprint: recipeFingerprint(recipe),
  shotCount: 2,
  lastScore: 8,
  ...extra
});

describe('matchRecipe', () => {
  it('D-16, D-12: the same recipe is reused, with its shot count and its last score', () => {
    const match = matchRecipe(base, [known(base)], base);
    expect(match).toEqual({ kind: 'reused', recipeId: 'r1', shotCount: 2, lastScore: 8 });
    expect(recipeTagText(match)).toBe('Recipe reused 2x');
  });

  it('D-16: returning to an earlier grind finds that recipe, not only the last one', () => {
    const at15 = { ...base, grind: 1500 };
    const match = matchRecipe(base, [known(base), known(at15, { id: 'r2' })], at15);
    expect(match).toMatchObject({ kind: 'reused', recipeId: 'r1' });
  });

  it('D-12: a reused recipe without a rated shot has no earlier score', () => {
    const match = matchRecipe(base, [known(base, { lastScore: null })], base);
    expect(match).toMatchObject({ kind: 'reused', lastScore: null });
  });

  it('D-16, D-81: a new recipe names what changed against the bean’s last shot', () => {
    const match = matchRecipe({ ...base, grind: 1500 }, [known(base)], base);
    expect(match).toEqual({ kind: 'new', changes: ['grind'] });
    expect(recipeTagText(match)).toBe('New recipe · grind changed');
  });

  it('D-71, D-77: several changes are named in order, the first two and a count', () => {
    const changed = { ...withFeatures({ preinfusion: { label: 'Preinfusion', on: false } }) };
    const match = matchRecipe({ ...changed, dose: 18500, grind: 1500 }, [], base);
    expect(recipeTagText(match)).toBe('New recipe · grind, dose and 1 more changed');
  });

  it('D-77: a bean’s first shot is a plain "New recipe"', () => {
    const match = matchRecipe(base, [], null);
    expect(recipeTagText(match)).toBe('New recipe');
  });

  it('D-16: a recipe on another machine is not this recipe (bean and machine are the scope)', () => {
    const match = matchRecipe(base, [known(base, { machineId: OTHER_MACHINE })], null);
    expect(match.kind).toBe('new');
  });

  it('D-104: a recipe kept only by its Brew next mark (no shots) has not been brewed: new', () => {
    const match = matchRecipe(base, [known(base, { shotCount: 0 })], null);
    expect(match.kind).toBe('new');
  });
});

describe('coreChanges', () => {
  const last = { grind: 1600, dose: 18000, yield: 36000, time: 28000 };

  it('D-15: changed values carry their delta; unchanged ones none', () => {
    expect(coreChanges({ grind: 1600, dose: 18000, yield: 38500, time: 25500 }, last)).toEqual({
      grind: null,
      dose: null,
      yield: { delta: 2500 },
      time: { delta: -2500 }
    });
  });

  it('D-15: a value set now but empty last time is changed, without a number to show', () => {
    expect(
      coreChanges({ grind: 1600, dose: 18000, yield: 36000, time: 28000 }, { ...last, time: null })
        .time
    ).toEqual({ delta: null });
  });

  it('D-81: a bean’s first shot has nothing to compare with, so nothing is changed', () => {
    expect(coreChanges({ grind: 1500, dose: 18000, yield: null, time: null }, null)).toEqual({
      grind: null,
      dose: null,
      yield: null,
      time: null
    });
  });
});

describe('setupChanges', () => {
  it('D-90: a changed setup value carries its delta', () => {
    const now = withFeatures({
      temperature: { label: 'Temperature', unit: '°C', on: true, value: 94000 },
      low_bar_start: { label: 'Low bar start', on: true, value: 5000, pressure: 2500 }
    });
    const changes = setupChanges(now, base);
    expect(changes.features.temperature).toEqual({
      delta: 1000,
      pressureDelta: null,
      switched: null
    });
    expect(changes.features.low_bar_start).toEqual({
      delta: null,
      pressureDelta: 500,
      switched: null
    });
    expect(changes.features.preinfusion).toBeUndefined();
  });

  it('D-90: a feature switched on or off since the last shot shows "On" or "Off"', () => {
    const now = withFeatures({
      preinfusion: { label: 'Preinfusion', on: false },
      low_bar_end: { label: 'Low bar end', on: true, value: 3000, pressure: 2000 }
    });
    const changes = setupChanges(now, base);
    expect(changes.features.preinfusion).toEqual({
      delta: null,
      pressureDelta: null,
      switched: 'Off'
    });
    expect(changes.features.low_bar_end?.switched).toBe('On');
  });

  it('D-90, D-78: a feature added to the machine since the last shot and switched on shows "On"', () => {
    const earlier = { ...base.setup.features };
    delete earlier.low_bar_end;
    const last = { ...base, setup: { ...base.setup, features: earlier } };
    const now = withFeatures({
      low_bar_end: { label: 'Low bar end', on: true, value: 3000, pressure: 2000 }
    });
    expect(setupChanges(now, last).features.low_bar_end?.switched).toBe('On');
    expect(setupChanges(base, last).features.low_bar_end).toBeUndefined();
  });

  it('D-90: a different basket or routine values count as changed', () => {
    const now: RecipeIdentity = {
      ...base,
      basketId: OTHER_BASKET,
      setup: {
        ...base.setup,
        routine: { name: 'Daily routine', steps: [{ stepId: WDT, name: 'WDT', value: 25000 }] }
      }
    };
    expect(setupChanges(now, base)).toMatchObject({ basket: true, routine: true });
    expect(setupChanges(base, base)).toEqual({ features: {}, basket: false, routine: false });
  });

  it('D-81: without a last shot nothing is changed', () => {
    expect(setupChanges(base, null)).toEqual({ features: {}, basket: false, routine: false });
  });
});

const features: FeatureDefinition[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    builtIn: true,
    enabled: true,
    switchable: false,
    value: { kind: 'number', unit: '°C', step: 1000 }
  },
  {
    key: 'flat_pressure',
    label: 'Flat pressure',
    builtIn: true,
    enabled: true,
    switchable: false,
    value: { kind: 'number', unit: 'bar', step: 500 }
  },
  {
    key: 'preinfusion',
    label: 'Preinfusion',
    builtIn: true,
    enabled: true,
    switchable: true,
    value: { kind: 'phase', step: 1000 }
  },
  {
    key: 'low_bar_start',
    label: 'Low bar start',
    builtIn: true,
    enabled: true,
    switchable: true,
    value: { kind: 'phase', step: 1000, pressure: { step: 500, min: 0, max: 12000 } }
  },
  {
    key: 'low_bar_end',
    label: 'Low bar end',
    builtIn: true,
    enabled: true,
    switchable: true,
    value: { kind: 'phase', step: 1000 }
  },
  {
    key: PADDLE,
    label: 'Paddle',
    builtIn: false,
    enabled: true,
    switchable: true,
    value: {
      kind: 'choice',
      options: [
        { id: 'low', label: 'Low' },
        { id: 'mid', label: 'Middle' }
      ]
    }
  }
];

describe('setupSummary', () => {
  it('D-100: switched-on phases and custom features, then temperature; no flat pressure', () => {
    expect(setupSummary(base.setup, features)).toBe('Preinfusion 4 s · Low bar start 5 s · 93 °C');
    const withPaddle = withFeatures({ [PADDLE]: { label: 'Paddle', on: true, choice: 'mid' } });
    expect(setupSummary(withPaddle.setup, features)).toBe(
      'Preinfusion 4 s · Low bar start 5 s · Paddle Middle · 93 °C'
    );
  });

  it('D-07, D-100: values typed off the step grid keep their decimals', () => {
    const typed = withFeatures({
      temperature: { label: 'Temperature', unit: '°C', on: true, value: 93500 },
      preinfusion: { label: 'Preinfusion', on: false },
      low_bar_start: { label: 'Low bar start', on: false }
    });
    expect(setupSummary(typed.setup, features)).toBe('93.5 °C');
  });

  it('D-78: a feature waiting for its value is left out until it has one', () => {
    const waiting = withFeatures({ temperature: { label: 'Temperature', unit: '°C', on: true } });
    expect(setupSummary(waiting.setup, features)).toBe('Preinfusion 4 s · Low bar start 5 s');
  });
});

describe('setupDetail', () => {
  it('D-57: the whole pressure profile: temperature, flat pressure, then each phase with its pressure', () => {
    expect(setupDetail(base.setup, features)).toBe(
      '93 °C · Flat 9.0 bar · Preinfusion 4 s · Low bar start 5 s at 2.0 bar'
    );
  });

  it('D-57: custom features follow in the machine’s order; switched-off ones are left out', () => {
    const withPaddle = withFeatures({
      [PADDLE]: { label: 'Paddle', on: true, choice: 'mid' },
      preinfusion: { label: 'Preinfusion', on: false }
    });
    expect(setupDetail(withPaddle.setup, features)).toBe(
      '93 °C · Flat 9.0 bar · Low bar start 5 s at 2.0 bar · Paddle Middle'
    );
  });

  it('D-78: a feature without a value is left out', () => {
    const waiting = withFeatures({ temperature: { label: 'Temperature', unit: '°C', on: true } });
    expect(setupDetail(waiting.setup, features)).toBe(
      'Flat 9.0 bar · Preinfusion 4 s · Low bar start 5 s at 2.0 bar'
    );
  });
});

describe('setupParts', () => {
  it('D-121: each feature in the shot detail’s order, switched-off ones as off', () => {
    const withPaddle = withFeatures({
      [PADDLE]: { label: 'Paddle', on: true, choice: 'mid' },
      preinfusion: { label: 'Preinfusion', on: false }
    });
    expect(setupParts(withPaddle.setup, features)).toEqual([
      { key: 'temperature', text: '93 °C' },
      { key: 'flat_pressure', text: 'Flat 9.0 bar' },
      { key: 'preinfusion', text: 'Preinfusion off' },
      { key: 'low_bar_start', text: 'Low bar start 5 s at 2.0 bar' },
      { key: 'low_bar_end', text: 'Low bar end off' },
      { key: PADDLE, text: 'Paddle Middle' }
    ]);
  });
});
