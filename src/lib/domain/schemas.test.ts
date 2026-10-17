import { describe, expect, it } from 'vitest';
import {
  basketSpecSchema,
  featureDefinitionSchema,
  gearSchema,
  grinderSpecSchema,
  machineSpecSchema,
  prepStepSettingSchema,
  routineStepsSchema,
  setupSnapshotSchema,
  tasteSchema,
  validateSetupAgainstMachine,
  valueDefinitionSchema,
  type FeatureDefinition,
  type MachineSpec,
  type SetupSnapshot
} from './schemas';

const CUSTOM_KEY = 'custom-0199f3a2-7c1e-7d2a-9b4f-3a6c1e2d4f5a';

// The reference machine: Lelit Bianca with the five built-in features (D-44).
const temperature: FeatureDefinition = {
  key: 'temperature',
  label: 'Temperature',
  builtIn: true,
  enabled: true,
  switchable: false,
  value: { kind: 'number', unit: '°C', step: 1000, min: 80000, max: 100000 }
};
const flatPressure: FeatureDefinition = {
  key: 'flat_pressure',
  label: 'Flat pressure',
  builtIn: true,
  enabled: true,
  switchable: false,
  value: { kind: 'number', unit: 'bar', step: 500, min: 0, max: 12000 }
};
const preinfusion: FeatureDefinition = {
  key: 'preinfusion',
  label: 'Preinfusion',
  builtIn: true,
  enabled: true,
  switchable: true,
  value: { kind: 'phase', step: 1000, pressure: { step: 500, min: 0, max: 9000 } }
};
const lowBarEnd: FeatureDefinition = {
  key: 'low_bar_end',
  label: 'Low bar end',
  builtIn: true,
  enabled: false,
  switchable: true,
  value: { kind: 'phase', step: 1000, pressure: { step: 500, min: 0, max: 9000 } }
};
const paddle: FeatureDefinition = {
  key: CUSTOM_KEY,
  label: 'Paddle position',
  builtIn: false,
  enabled: true,
  switchable: true,
  value: {
    kind: 'choice',
    options: [
      { id: 'low', label: 'Low' },
      { id: 'mid', label: 'Mid' }
    ]
  }
};
const bianca: MachineSpec = {
  type: 'semi_auto',
  groupSizeMm: 58,
  features: [temperature, flatPressure, preinfusion, lowBarEnd, paddle]
};

const setup: SetupSnapshot = {
  features: {
    temperature: { label: 'Temperature', unit: '°C', on: true, value: 93000 },
    flat_pressure: { label: 'Flat pressure', unit: 'bar', on: true, value: 9000 },
    preinfusion: { label: 'Preinfusion', on: true, value: 4000, pressure: 2000 },
    [CUSTOM_KEY]: { label: 'Paddle position', on: true, choice: 'mid' }
  },
  routine: {
    name: 'Daily routine',
    steps: [
      {
        stepId: '0199f3a2-0000-7000-8000-000000000001',
        name: 'WDT',
        unit: 's',
        value: 20000
      },
      { stepId: '0199f3a2-0000-7000-8000-000000000002', name: 'Distributor', value: null }
    ]
  }
};

describe('value definitions', () => {
  it('D-46: a custom feature can be a number with unit, seconds, on/off or a list', () => {
    for (const value of [
      { kind: 'number', unit: 'g', step: 100 },
      { kind: 'seconds', step: 1000, min: 0, max: 60000 },
      { kind: 'toggle' },
      { kind: 'choice', options: [{ id: 'a', label: 'A' }] }
    ]) {
      expect(valueDefinitionSchema.safeParse(value).success, JSON.stringify(value)).toBe(true);
    }
  });

  it('D-24: a phase has seconds and an optional pressure in bar', () => {
    expect(valueDefinitionSchema.safeParse(preinfusion.value).success).toBe(true);
    expect(valueDefinitionSchema.safeParse({ kind: 'phase', step: 1000 }).success).toBe(true);
  });

  it('D-07: a step is a positive whole number of thousandths', () => {
    for (const step of [0, -100, 0.5]) {
      expect(valueDefinitionSchema.safeParse({ kind: 'seconds', step }).success).toBe(false);
    }
  });

  it('D-46: a range runs from low to high', () => {
    expect(
      valueDefinitionSchema.safeParse({ kind: 'seconds', step: 1000, min: 5000, max: 1000 }).success
    ).toBe(false);
  });

  it('D-46: a number needs its unit and a list needs options with distinct ids', () => {
    expect(valueDefinitionSchema.safeParse({ kind: 'number', step: 100 }).success).toBe(false);
    expect(valueDefinitionSchema.safeParse({ kind: 'choice', options: [] }).success).toBe(false);
    expect(
      valueDefinitionSchema.safeParse({
        kind: 'choice',
        options: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'B' }
        ]
      }).success
    ).toBe(false);
  });
});

describe('feature definitions', () => {
  it('D-44: the five built-in features and custom features are valid', () => {
    for (const feature of bianca.features) {
      expect(featureDefinitionSchema.safeParse(feature).success, feature.key).toBe(true);
    }
  });

  it('D-65: a custom feature has a stable custom-<uuid> key', () => {
    expect(featureDefinitionSchema.safeParse({ ...paddle, key: 'paddle' }).success).toBe(false);
  });

  it('D-44: only the five known keys are built in', () => {
    expect(featureDefinitionSchema.safeParse({ ...paddle, builtIn: true }).success).toBe(false);
    expect(featureDefinitionSchema.safeParse({ ...temperature, builtIn: false }).success).toBe(
      false
    );
  });

  it('D-46: a feature needs a name', () => {
    expect(featureDefinitionSchema.safeParse({ ...paddle, label: ' ' }).success).toBe(false);
  });
});

describe('gear specs (D-68: one table, a spec per kind)', () => {
  it('D-44: a machine lists its features once each', () => {
    expect(machineSpecSchema.safeParse(bianca).success).toBe(true);
    expect(
      machineSpecSchema.safeParse({ ...bianca, features: [temperature, temperature] }).success
    ).toBe(false);
  });

  it('D-48: a grinder describes how its dial works', () => {
    const sculptor = {
      type: 'electric',
      burrs: 'flat',
      burrSizeMm: 64,
      dial: { mode: 'stepless', step: 100, finest: 0, coarsest: 16000 }
    };
    expect(grinderSpecSchema.safeParse(sculptor).success).toBe(true);
    expect(
      grinderSpecSchema.safeParse({
        ...sculptor,
        dial: { ...sculptor.dial, finest: 16000, coarsest: 16000 }
      }).success
    ).toBe(false);
  });

  it('D-49: a basket has an optional dose range from low to high', () => {
    const vst = { type: 'precision', shotSize: 'double', diameterMm: 58 };
    expect(basketSpecSchema.safeParse(vst).success).toBe(true);
    expect(
      basketSpecSchema.safeParse({ ...vst, doseRange: { from: 17000, to: 19000 } }).success
    ).toBe(true);
    expect(
      basketSpecSchema.safeParse({ ...vst, doseRange: { from: 19000, to: 17000 } }).success
    ).toBe(false);
  });

  it('D-68: the spec is checked against the gear kind', () => {
    expect(
      gearSchema.safeParse({ kind: 'machine', name: 'Lelit Bianca', spec: bianca }).success
    ).toBe(true);
    expect(
      gearSchema.safeParse({ kind: 'grinder', name: 'Lelit Bianca', spec: bianca }).success
    ).toBe(false);
  });
});

describe('puck prep', () => {
  it('D-52: a step has no setting, or a number, seconds or list setting with a starting value', () => {
    for (const setting of [
      { kind: 'none' },
      { kind: 'seconds', step: 1000, startsAt: 20000 },
      { kind: 'number', unit: 'kg', step: 500, startsAt: 15000 },
      {
        kind: 'choice',
        options: [
          { id: 'one', label: 'One spray' },
          { id: 'two', label: 'Two sprays' }
        ],
        startsAt: 'two'
      }
    ]) {
      expect(prepStepSettingSchema.safeParse(setting).success, JSON.stringify(setting)).toBe(true);
    }
  });

  it('D-52: a list setting starts at one of its options, and numbers start inside their range', () => {
    expect(
      prepStepSettingSchema.safeParse({
        kind: 'choice',
        options: [{ id: 'one', label: 'One' }],
        startsAt: 'three'
      }).success
    ).toBe(false);
    expect(
      prepStepSettingSchema.safeParse({ kind: 'seconds', step: 1000, max: 10000, startsAt: 20000 })
        .success
    ).toBe(false);
  });

  it('D-52: steps have no on/off and no phases', () => {
    expect(prepStepSettingSchema.safeParse({ kind: 'toggle', startsAt: 0 }).success).toBe(false);
  });

  it('D-51: a routine is an ordered list of steps with their values', () => {
    expect(
      routineStepsSchema.safeParse([
        { stepId: '0199f3a2-0000-7000-8000-000000000001', value: 20000 },
        { stepId: '0199f3a2-0000-7000-8000-000000000002', value: null },
        { stepId: '0199f3a2-0000-7000-8000-000000000003', value: 'two' }
      ]).success
    ).toBe(true);
  });
});

describe('setup snapshot', () => {
  it('D-65: a recipe keeps values together with the labels and units of the time', () => {
    expect(setupSnapshotSchema.safeParse(setup).success).toBe(true);
  });

  it('D-65: a recipe without puck prep has no routine', () => {
    expect(setupSnapshotSchema.safeParse({ ...setup, routine: null }).success).toBe(true);
  });

  it('data-model §1.4: values are whole thousandths, never fractions', () => {
    expect(
      setupSnapshotSchema.safeParse({
        ...setup,
        features: { temperature: { label: 'Temperature', on: true, value: 93.5 } }
      }).success
    ).toBe(false);
  });
});

describe('validateSetupAgainstMachine', () => {
  it('D-02: a setup with every enabled feature of the machine is valid', () => {
    expect(validateSetupAgainstMachine(setup, bianca)).toEqual([]);
  });

  it('D-02: an enabled feature missing from the setup is reported', () => {
    const rest = Object.fromEntries(
      Object.entries(setup.features).filter(([key]) => key !== 'temperature')
    );
    expect(validateSetupAgainstMachine({ ...setup, features: rest }, bianca)).toEqual([
      'Temperature: missing'
    ]);
  });

  it('D-44: a feature that is switched off on the machine must not be in the setup', () => {
    const features = { ...setup.features, low_bar_end: { label: 'Low bar end', on: false } };
    expect(validateSetupAgainstMachine({ ...setup, features }, bianca)).toEqual([
      'low_bar_end: not a feature of this machine'
    ]);
  });

  it('D-24: temperature and flat pressure have no off switch', () => {
    const features = {
      ...setup.features,
      temperature: { label: 'Temperature', on: false }
    };
    expect(validateSetupAgainstMachine({ ...setup, features }, bianca)).toEqual([
      'Temperature: cannot be switched off'
    ]);
  });

  it('D-46: values must fit the range, and a list value must be one of its options', () => {
    const features = {
      ...setup.features,
      temperature: { label: 'Temperature', on: true, value: 120000 },
      preinfusion: { label: 'Preinfusion', on: true, value: 4000, pressure: 10000 },
      [CUSTOM_KEY]: { label: 'Paddle position', on: true, choice: 'high' }
    };
    expect(validateSetupAgainstMachine({ ...setup, features }, bianca)).toEqual([
      'Temperature: 120000 is outside 80000–100000',
      'Preinfusion: pressure 10000 is outside 0–9000',
      'Paddle position: "high" is not an option'
    ]);
  });

  it('D-46: a switched-on feature needs its value', () => {
    const features = {
      ...setup.features,
      preinfusion: { label: 'Preinfusion', on: true }
    };
    expect(validateSetupAgainstMachine({ ...setup, features }, bianca)).toEqual([
      'Preinfusion: value missing'
    ]);
  });

  it('D-07: typed values off the step grid are allowed (tap-to-type for exact values)', () => {
    const features = {
      ...setup.features,
      temperature: { label: 'Temperature', unit: '°C', on: true, value: 93500 }
    };
    expect(validateSetupAgainstMachine({ ...setup, features }, bianca)).toEqual([]);
  });
});

describe('taste', () => {
  it('D-11: every taste value can be empty (not rated, not set)', () => {
    expect(
      tasteSchema.safeParse({
        score: null,
        balance: null,
        body: null,
        sweetness: null,
        aftertaste: null
      }).success
    ).toBe(true);
  });

  it('D-09, D-67: scores are 1–10, balance −10…10, the rest 0–10, whole numbers only', () => {
    const ok = { score: 7, balance: -3, body: 0, sweetness: 10, aftertaste: 5 };
    expect(tasteSchema.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...ok, score: 0 },
      { ...ok, score: 11 },
      { ...ok, score: 7.5 },
      { ...ok, balance: -11 },
      { ...ok, body: -1 },
      { ...ok, aftertaste: 11 }
    ]) {
      expect(tasteSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
