import { describe, expect, it } from 'vitest';
import { prefill, type PrefillContext, type RecipeValues } from './prefill';
import type { FeatureDefinition, MachineSpec } from './schemas';

const BIANCA = 'machine-bianca';
const GRINDER = 'grinder-064s';
const BASKET = 'basket-vst18';
const ROUTINE = 'routine-daily';
const BEAN = 'bean-current';
const EARLIER_BAG = 'bean-earlier';
const OLDEST_BAG = 'bean-oldest';

const feature = (
  key: string,
  label: string,
  enabled: boolean,
  switchable: boolean,
  value: FeatureDefinition['value']
): FeatureDefinition => ({
  key,
  label,
  builtIn: !key.startsWith('custom-'),
  enabled,
  switchable,
  value
});

const phase = { kind: 'phase', step: 1000, pressure: { step: 500, min: 0, max: 9000 } } as const;

/** The Bianca as it is configured now. */
function biancaSpec(overrides: Partial<Record<string, boolean>> = {}): MachineSpec {
  const on = (key: string, fallback: boolean) => overrides[key] ?? fallback;
  return {
    type: 'semi_auto',
    features: [
      feature('temperature', 'Temperature', on('temperature', true), false, {
        kind: 'number',
        unit: '°C',
        step: 1000
      }),
      feature('flat_pressure', 'Flat pressure', on('flat_pressure', true), false, {
        kind: 'number',
        unit: 'bar',
        step: 500
      }),
      feature('preinfusion', 'Preinfusion', on('preinfusion', true), true, phase),
      feature('low_bar_start', 'Low bar start', on('low_bar_start', false), true, phase),
      feature('low_bar_end', 'Low bar end', on('low_bar_end', false), true, phase)
    ]
  };
}

const routineSnapshot = {
  name: 'Daily routine',
  steps: [{ stepId: '0199f3a2-0000-7000-8000-00000000e001', name: 'WDT', unit: 's', value: 20000 }]
};

const recipe = (overrides: Partial<RecipeValues> = {}): RecipeValues => ({
  beanId: BEAN,
  machineId: BIANCA,
  grinderId: GRINDER,
  basketId: BASKET,
  routineId: ROUTINE,
  grind: 1600,
  dose: 18000,
  setup: {
    features: {
      temperature: { label: 'Temperature', unit: '°C', on: true, value: 93000 },
      flat_pressure: { label: 'Flat pressure', unit: 'bar', on: true, value: 9000 },
      preinfusion: { label: 'Preinfusion', on: true, value: 4000, pressure: 2000 }
    },
    routine: routineSnapshot
  },
  ...overrides
});

const mySetup: PrefillContext['mySetup'] = {
  machineId: BIANCA,
  grinderId: GRINDER,
  basketId: BASKET,
  routineId: ROUTINE,
  grind: 2000,
  dose: 18000,
  yield: 36000,
  features: {
    temperature: { label: 'Temperature', unit: '°C', on: true, value: 94000 },
    flat_pressure: { label: 'Flat pressure', unit: 'bar', on: true, value: 9000 },
    preinfusion: { label: 'Preinfusion', on: true, value: 5000, pressure: 2500 },
    low_bar_start: { label: 'Low bar start', on: true, value: 6000, pressure: 2000 }
  },
  routine: routineSnapshot
};

const context = (overrides: Partial<PrefillContext> = {}): PrefillContext => ({
  beanId: BEAN,
  brewNext: null,
  latestShotOfBean: null,
  rebuyChain: [],
  mySetup,
  machines: { [BIANCA]: biancaSpec() },
  ...overrides
});

const emptyTaste = { score: null, balance: null, body: null, sweetness: null, aftertaste: null };

describe('prefill', () => {
  it('D-03: a new shot copies the bean’s latest shot: its recipe, yield and time', () => {
    const latest = recipe({ grind: 1700 });
    const result = prefill(
      context({ latestShotOfBean: { recipe: latest, shot: { yield: 38500, time: 25500 } } })
    );
    expect(result).toMatchObject({
      source: 'last_shot',
      beanId: BEAN,
      machineId: BIANCA,
      grinderId: GRINDER,
      basketId: BASKET,
      routineId: ROUTINE,
      grind: 1700,
      dose: 18000,
      yield: 38500,
      time: 25500
    });
    expect(result.setup).toEqual(latest.setup);
  });

  it('D-11: taste is never prefilled, whatever the source', () => {
    for (const ctx of [
      context(),
      context({ latestShotOfBean: { recipe: recipe(), shot: { yield: 36000, time: 28000 } } }),
      context({ brewNext: { recipe: recipe(), latestShot: { yield: 36000, time: 28000 } } })
    ]) {
      expect(prefill(ctx).taste).toEqual(emptyTaste);
    }
  });

  it('D-11: changing one prefill’s taste never leaks into the next prefill', () => {
    const first = prefill(context());
    first.taste.score = 9;
    first.setup.routine!.steps[0].value = 99000;
    const second = prefill(context());
    expect(second.taste).toEqual(emptyTaste);
    expect(second.setup.routine).toEqual(routineSnapshot);
    expect(routineSnapshot.steps[0].value).toBe(20000);
  });

  it('D-43: Brew next comes first: that recipe’s bean, values and setup; yield and time from its latest shot', () => {
    const chosen = recipe({ beanId: 'bean-other', grind: 1400, dose: 18500 });
    const result = prefill(
      context({
        brewNext: { recipe: chosen, latestShot: { yield: 40000, time: 27000 } },
        latestShotOfBean: { recipe: recipe(), shot: { yield: 36000, time: 28000 } }
      })
    );
    expect(result).toMatchObject({
      source: 'brew_next',
      beanId: 'bean-other',
      grind: 1400,
      dose: 18500,
      yield: 40000,
      time: 27000
    });
  });

  it('D-43: a Brew next recipe without shots starts with empty yield and time', () => {
    const result = prefill(context({ brewNext: { recipe: recipe(), latestShot: null } }));
    expect(result).toMatchObject({ source: 'brew_next', yield: null, time: null });
  });

  it('D-41, D-73: a re-buy starts from the earlier bag’s best recipe, as a recipe for this bag', () => {
    const earlierBest = recipe({ beanId: EARLIER_BAG, grind: 1500 });
    const result = prefill(
      context({
        rebuyChain: [
          {
            beanId: EARLIER_BAG,
            best: { recipe: earlierBest, latestShot: { yield: 37000, time: 29000 } }
          }
        ]
      })
    );
    expect(result).toMatchObject({
      source: 'rebuy',
      beanId: BEAN,
      grind: 1500,
      yield: 37000,
      time: 29000
    });
  });

  it('D-73: a re-buy follows the chain back to the nearest earlier bag with shots', () => {
    const oldestBest = recipe({ beanId: OLDEST_BAG, grind: 1300 });
    const result = prefill(
      context({
        rebuyChain: [
          { beanId: EARLIER_BAG, best: null },
          {
            beanId: OLDEST_BAG,
            best: { recipe: oldestBest, latestShot: { yield: 36500, time: 30000 } }
          }
        ]
      })
    );
    expect(result).toMatchObject({ source: 'rebuy', beanId: BEAN, grind: 1300, yield: 36500 });
  });

  it('D-73: a re-buy whose earlier bags have no shots starts from My setup', () => {
    const result = prefill(context({ rebuyChain: [{ beanId: EARLIER_BAG, best: null }] }));
    expect(result.source).toBe('my_setup');
  });

  it('D-03: the bean’s own shots win over the re-buy', () => {
    const result = prefill(
      context({
        latestShotOfBean: { recipe: recipe({ grind: 1800 }), shot: { yield: 36000, time: 28000 } },
        rebuyChain: [
          {
            beanId: EARLIER_BAG,
            best: { recipe: recipe({ beanId: EARLIER_BAG }), latestShot: null }
          }
        ]
      })
    );
    expect(result).toMatchObject({ source: 'last_shot', grind: 1800 });
  });

  it('D-38, D-72: no shots yet: My setup’s gear and values, with the current bean and an empty time', () => {
    const result = prefill(context());
    expect(result).toMatchObject({
      source: 'my_setup',
      beanId: BEAN,
      machineId: BIANCA,
      grinderId: GRINDER,
      basketId: BASKET,
      routineId: ROUTINE,
      grind: 2000,
      dose: 18000,
      yield: 36000,
      time: null
    });
    expect(result.setup.routine).toEqual(routineSnapshot);
  });

  it('D-38, D-44: My setup’s features follow the machine: only enabled ones, missing ones switched off', () => {
    const result = prefill(
      context({ machines: { [BIANCA]: biancaSpec({ low_bar_start: false, low_bar_end: true }) } })
    );
    expect(result.setup.features).toEqual({
      temperature: { label: 'Temperature', unit: '°C', on: true, value: 94000 },
      flat_pressure: { label: 'Flat pressure', unit: 'bar', on: true, value: 9000 },
      preinfusion: { label: 'Preinfusion', on: true, value: 5000, pressure: 2500 },
      low_bar_end: { label: 'Low bar end', on: false }
    });
  });

  it('D-03, D-38: a feature switched on since the copied shot starts from My setup', () => {
    const result = prefill(
      context({
        latestShotOfBean: { recipe: recipe(), shot: { yield: 36000, time: 28000 } },
        machines: { [BIANCA]: biancaSpec({ low_bar_start: true }) }
      })
    );
    expect(result.setup.features.low_bar_start).toEqual({
      label: 'Low bar start',
      on: true,
      value: 6000,
      pressure: 2000
    });
  });

  it('D-03, D-38: a feature switched on since, without a My setup value, starts switched off', () => {
    const result = prefill(
      context({
        latestShotOfBean: { recipe: recipe(), shot: { yield: 36000, time: 28000 } },
        machines: { [BIANCA]: biancaSpec({ low_bar_end: true }) }
      })
    );
    expect(result.setup.features.low_bar_end).toEqual({ label: 'Low bar end', on: false });
  });

  it('D-02, D-44: a feature since switched off on the machine is left out', () => {
    const result = prefill(
      context({
        latestShotOfBean: { recipe: recipe(), shot: { yield: 36000, time: 28000 } },
        machines: { [BIANCA]: biancaSpec({ preinfusion: false }) }
      })
    );
    expect(result.setup.features).not.toHaveProperty('preinfusion');
  });

  it('D-65: copied values take the feature’s current label and unit', () => {
    const renamed = biancaSpec();
    renamed.features[0] = { ...renamed.features[0], label: 'Brew temperature' };
    const result = prefill(
      context({
        latestShotOfBean: { recipe: recipe(), shot: { yield: 36000, time: 28000 } },
        machines: { [BIANCA]: renamed }
      })
    );
    expect(result.setup.features.temperature).toEqual({
      label: 'Brew temperature',
      unit: '°C',
      on: true,
      value: 93000
    });
  });

  it('D-24: a feature without an off switch and without a value starts on, waiting for a value', () => {
    const result = prefill(
      context({ mySetup: { ...mySetup, features: {} }, machines: { [BIANCA]: biancaSpec() } })
    );
    expect(result.setup.features.temperature).toEqual({
      label: 'Temperature',
      unit: '°C',
      on: true
    });
  });

  it('D-02: fails clearly when the machine is unknown', () => {
    expect(() => prefill(context({ machines: {} }))).toThrow(/machine/);
  });
});
