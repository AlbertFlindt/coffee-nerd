import { describe, expect, it } from 'vitest';
import {
  describeChange,
  recipeFingerprint,
  recipeTagText,
  sameDose,
  type RecipeIdentity
} from './fingerprint';

const GRINDER = '0199f3a2-0000-7000-8000-00000000a001';
const OTHER_GRINDER = '0199f3a2-0000-7000-8000-00000000a002';
const BASKET = '0199f3a2-0000-7000-8000-00000000b001';
const ROUTINE = '0199f3a2-0000-7000-8000-00000000c001';
const MACHINE = '0199f3a2-0000-7000-8000-00000000d001';
const WDT = '0199f3a2-0000-7000-8000-00000000e001';
const TAMP = '0199f3a2-0000-7000-8000-00000000e002';
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
      preinfusion: { label: 'Preinfusion', on: true, value: 4000, pressure: 2000 },
      low_bar_start: { label: 'Low bar start', on: false },
      [PADDLE]: { label: 'Paddle position', on: true, choice: 'mid' }
    },
    routine: {
      name: 'Daily routine',
      steps: [
        { stepId: WDT, name: 'WDT', unit: 's', value: 20000 },
        { stepId: TAMP, name: 'Tamp', unit: 'kg', value: 15000 }
      ]
    }
  }
};

type Features = RecipeIdentity['setup']['features'];
const withFeatures = (features: Features): RecipeIdentity => ({
  ...base,
  setup: { ...base.setup, features: { ...base.setup.features, ...features } }
});

describe('recipeFingerprint', () => {
  it('D-63: the same setup always gives the same fingerprint (a SHA-256 hex digest)', () => {
    const fingerprint = recipeFingerprint(base);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(recipeFingerprint(structuredClone(base))).toBe(fingerprint);
  });

  it('D-16: returning to an earlier grind gives that recipe’s fingerprint again', () => {
    const finer = recipeFingerprint({ ...base, grind: 1500 });
    expect(finer).not.toBe(recipeFingerprint(base));
    expect(recipeFingerprint({ ...base, grind: 1600 })).toBe(recipeFingerprint(base));
  });

  it('D-65: renaming a feature, a step, the routine or changing a unit keeps the recipe', () => {
    const renamed: RecipeIdentity = {
      ...base,
      setup: {
        features: {
          ...base.setup.features,
          temperature: { label: 'Brew temperature', unit: '°F', on: true, value: 93000 },
          [PADDLE]: { label: 'Paddle', on: true, choice: 'mid' }
        },
        routine: {
          name: 'Morning routine',
          steps: [
            { stepId: WDT, name: 'Needle stir', unit: 'seconds', value: 20000 },
            { stepId: TAMP, name: 'Tamp', value: 15000 }
          ]
        }
      }
    };
    expect(recipeFingerprint(renamed)).toBe(recipeFingerprint(base));
  });

  it('D-65: a switched-off feature counts only as off, whatever value it had', () => {
    const offWithOldValue = withFeatures({
      low_bar_start: { label: 'Low bar start', on: false, value: 5000, pressure: 2000 }
    });
    expect(recipeFingerprint(offWithOldValue)).toBe(recipeFingerprint(base));
  });

  it('D-16: switching a feature on or off makes a new recipe', () => {
    const switchedOn = withFeatures({
      low_bar_start: { label: 'Low bar start', on: true, value: 5000, pressure: 2000 }
    });
    expect(recipeFingerprint(switchedOn)).not.toBe(recipeFingerprint(base));
  });

  it('D-24: a phase’s pressure and a list choice are part of the recipe', () => {
    expect(
      recipeFingerprint(
        withFeatures({
          preinfusion: { label: 'Preinfusion', on: true, value: 4000, pressure: 2500 }
        })
      )
    ).not.toBe(recipeFingerprint(base));
    expect(
      recipeFingerprint(
        withFeatures({ [PADDLE]: { label: 'Paddle position', on: true, choice: 'low' } })
      )
    ).not.toBe(recipeFingerprint(base));
  });

  it('D-63: feature order does not matter, step order does', () => {
    const reordered: RecipeIdentity = {
      ...base,
      setup: {
        ...base.setup,
        features: Object.fromEntries(Object.entries(base.setup.features).reverse())
      }
    };
    expect(recipeFingerprint(reordered)).toBe(recipeFingerprint(base));

    const swappedSteps: RecipeIdentity = {
      ...base,
      setup: {
        ...base.setup,
        routine: { ...base.setup.routine!, steps: [...base.setup.routine!.steps].reverse() }
      }
    };
    expect(recipeFingerprint(swappedSteps)).not.toBe(recipeFingerprint(base));
  });

  it('D-63, D-186: grinder, basket, routine and step values are each part of the recipe', () => {
    const fingerprints = new Set([
      recipeFingerprint(base),
      recipeFingerprint({ ...base, grinderId: OTHER_GRINDER }),
      recipeFingerprint({ ...base, basketId: null }),
      recipeFingerprint({ ...base, routineId: null, setup: { ...base.setup, routine: null } }),
      recipeFingerprint({
        ...base,
        setup: {
          ...base.setup,
          routine: {
            ...base.setup.routine!,
            steps: [{ ...base.setup.routine!.steps[0], value: 25000 }, base.setup.routine!.steps[1]]
          }
        }
      })
    ]);
    expect(fingerprints.size).toBe(5);
  });

  it('D-186: the dose is left out; recipes are told apart by a dose more than 0.2 g away', () => {
    expect(recipeFingerprint({ ...base, dose: 18500 })).toBe(recipeFingerprint(base));
    expect(sameDose(18000, 18200)).toBe(true);
    expect(sameDose(18000, 17800)).toBe(true);
    expect(sameDose(18000, 18300)).toBe(false);
  });

  it('D-63: an empty field and a missing field give the same fingerprint', () => {
    const explicit = withFeatures({
      low_bar_start: { label: 'Low bar start', on: false, value: undefined, pressure: undefined }
    });
    expect(recipeFingerprint(explicit)).toBe(recipeFingerprint(base));
    const toggle = { label: 'Bloom', on: true };
    const key = 'custom-0199f3a2-7c1e-7d2a-9b4f-000000000002';
    expect(recipeFingerprint(withFeatures({ [key]: toggle }))).toBe(
      recipeFingerprint(withFeatures({ [key]: { ...toggle, value: undefined, choice: undefined } }))
    );
  });

  it('D-63: a step value of 20000 and the text "20000" are different recipes', () => {
    const steps = base.setup.routine!.steps;
    const asText: RecipeIdentity = {
      ...base,
      setup: {
        ...base.setup,
        routine: { ...base.setup.routine!, steps: [{ ...steps[0], value: '20000' }, steps[1]] }
      }
    };
    expect(recipeFingerprint(asText)).not.toBe(recipeFingerprint(base));
  });

  it('D-16: the machine is the matching scope, not part of the fingerprint', () => {
    expect(recipeFingerprint({ ...base, machineId: '0199f3a2-0000-7000-8000-00000000d002' })).toBe(
      recipeFingerprint(base)
    );
  });
});

describe('describeChange', () => {
  it('D-16: names what changed since the last shot’s recipe', () => {
    expect(describeChange({ ...base, grind: 1500 }, base)).toEqual(['grind']);
  });

  it('D-186: a dose within 0.2 g is not named as a change; one further away is', () => {
    expect(describeChange({ ...base, grind: 1500, dose: 18100 }, base)).toEqual(['grind']);
    expect(describeChange({ ...base, dose: 18300 }, base)).toEqual(['dose']);
  });

  it('D-16, D-71: lists changes in a fixed order: grind, dose, gear, routine, then features', () => {
    const changed: RecipeIdentity = {
      ...withFeatures({
        preinfusion: { label: 'Preinfusion', on: false },
        [PADDLE]: { label: 'Paddle position', on: true, choice: 'low' }
      }),
      grind: 1700,
      dose: 18500,
      basketId: null,
      grinderId: OTHER_GRINDER,
      routineId: null,
      setup: {
        features: {
          ...base.setup.features,
          preinfusion: { label: 'Preinfusion', on: false },
          [PADDLE]: { label: 'Paddle position', on: true, choice: 'low' }
        },
        routine: null
      }
    };
    expect(describeChange(changed, base)).toEqual([
      'grind',
      'dose',
      'grinder',
      'basket',
      'routine',
      'preinfusion',
      'paddle position'
    ]);
  });

  it('D-16: a changed step value in the same routine counts as a routine change', () => {
    const steps = base.setup.routine!.steps;
    const longerWdt: RecipeIdentity = {
      ...base,
      setup: {
        ...base.setup,
        routine: { ...base.setup.routine!, steps: [{ ...steps[0], value: 30000 }, steps[1]] }
      }
    };
    expect(describeChange(longerWdt, base)).toEqual(['routine']);
  });

  it('D-16: another machine is named as a change', () => {
    expect(
      describeChange({ ...base, machineId: '0199f3a2-0000-7000-8000-00000000d002' }, base)
    ).toEqual(['machine']);
  });

  it('D-65: renaming alone is no change; a switched-off feature’s old value is ignored', () => {
    const renamedAndStale = withFeatures({
      temperature: { label: 'Brew temperature', unit: '°C', on: true, value: 93000 },
      low_bar_start: { label: 'Low bar start', on: false, value: 9000 }
    });
    expect(describeChange(renamedAndStale, base)).toEqual([]);
  });

  it('D-16: a feature only in one of the two setups counts as changed, named by its current label', () => {
    const { [PADDLE]: paddle, ...withoutPaddle } = base.setup.features;
    expect(paddle).toBeDefined();
    const last: RecipeIdentity = { ...base, setup: { ...base.setup, features: withoutPaddle } };
    expect(describeChange(base, last)).toEqual(['paddle position']);
    expect(describeChange(last, base)).toEqual(['paddle position']);
  });

  it('D-16: keeps all-capital words such as "RPM" as they are', () => {
    const rpm = 'custom-0199f3a2-7c1e-7d2a-9b4f-000000000001';
    const current = withFeatures({ [rpm]: { label: 'RPM', unit: 'rpm', on: true, value: 1000 } });
    const last = withFeatures({ [rpm]: { label: 'RPM', unit: 'rpm', on: true, value: 1200 } });
    expect(describeChange(current, last)).toEqual(['RPM']);
  });
});

describe('recipeTagText', () => {
  it('D-16: a recipe brewed before shows how often', () => {
    expect(recipeTagText({ kind: 'reused', shotCount: 2 })).toBe('Recipe reused 2x');
    expect(recipeTagText({ kind: 'reused', shotCount: 1 })).toBe('Recipe reused 1x');
  });

  it('D-16, D-71: a new recipe names up to two changes and counts the rest', () => {
    expect(recipeTagText({ kind: 'new', changes: ['grind'] })).toBe('New recipe · grind changed');
    expect(recipeTagText({ kind: 'new', changes: ['grind', 'dose'] })).toBe(
      'New recipe · grind and dose changed'
    );
    expect(recipeTagText({ kind: 'new', changes: ['grind', 'dose', 'basket'] })).toBe(
      'New recipe · grind, dose and 1 more changed'
    );
    expect(recipeTagText({ kind: 'new', changes: ['grind', 'dose', 'basket', 'routine'] })).toBe(
      'New recipe · grind, dose and 2 more changed'
    );
  });

  it('D-16: a new recipe with nothing to compare against (a bean’s first shot) says only "New recipe"', () => {
    expect(recipeTagText({ kind: 'new', changes: [] })).toBe('New recipe');
  });
});
