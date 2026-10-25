// The registry of measures and dimensions (data-model §5, D-64). Each one reads a shot fact; a new kind of
// data becomes usable by every insight by adding one entry here. Measures give plain numbers for the
// statistics module; dimensions give a group key and the words the chart shows for it.
import { PROCESS_LABEL, ROAST_LEVEL_LABEL } from '../../domain/bean';
import { countryName } from '../../domain/countries';
import type { FeatureDefinition } from '../../domain/schemas';
import { setupDetail } from '../../domain/shot-form';
import { decimalsFor, formatQuantity, fromThousandths, type Thousandths } from '../../domain/units';
import type { ShotFact } from './facts';

export type Measure = {
  label: string;
  /** Shown after a value ("s", "g"); none for scores and ratios. */
  unit?: string;
  /** Null when the shot has no value: it is left out, never counted as 0 (D-11). */
  value: (fact: ShotFact) => number | null;
};

const thousandths = (v: Thousandths | null) => (v === null ? null : fromThousandths(v));

export const MEASURES = {
  score: { label: 'Score', value: (f) => f.score },
  time: { label: 'Shot time', unit: 's', value: (f) => thousandths(f.time) },
  yield: { label: 'Yield', unit: 'g', value: (f) => thousandths(f.yield) },
  dose: { label: 'Dose', unit: 'g', value: (f) => thousandths(f.dose) },
  ratio: { label: 'Ratio', value: (f) => thousandths(f.ratio) },
  grind: { label: 'Grind', value: (f) => thousandths(f.grind) },
  balance: { label: 'Balance', value: (f) => f.balance },
  body: { label: 'Body', value: (f) => f.body },
  sweetness: { label: 'Sweetness', value: (f) => f.sweetness },
  aftertaste: { label: 'Aftertaste', value: (f) => f.aftertaste }
} satisfies Record<string, Measure>;

export type MeasureName = keyof typeof MEASURES;

/** A group: its key, and the words shown for it. Null when the shot has nothing to group by. */
export type Group = { key: string; label: string };

export type Dimension = { label: string; group: (fact: ShotFact) => Group | null };

/**
 * What some groups need to be worded: list step options by step id then option id (`step:<id>`), and
 * each machine's feature definitions by machine id (`feature:<key>`).
 */
export type DimensionContext = {
  stepOptions: Record<string, Record<string, string>>;
  machineFeatures: Record<string, FeatureDefinition[]>;
};

const same = (key: string | null): Group | null => (key === null ? null : { key, label: key });

const FIXED_DIMENSIONS = {
  process: {
    label: 'Process',
    group: (f) => (f.process ? { key: f.process, label: PROCESS_LABEL[f.process] } : null)
  },
  country: {
    label: 'Origin',
    group: (f) =>
      f.countryCode
        ? { key: f.countryCode, label: countryName(f.countryCode) ?? f.countryCode }
        : null
  },
  roaster: { label: 'Roaster', group: (f) => same(f.roaster) },
  roastLevel: {
    label: 'Roast level',
    group: (f) =>
      f.roastLevel ? { key: f.roastLevel, label: ROAST_LEVEL_LABEL[f.roastLevel] } : null
  },
  bean: { label: 'Bean', group: (f) => ({ key: f.beanId, label: f.beanName }) },
  recipe: { label: 'Recipe', group: (f) => ({ key: f.recipeId, label: recipeLabel(f) }) },
  routine: {
    label: 'Puck prep',
    group: (f) => (f.routineId ? { key: f.routineId, label: f.routineName ?? 'Routine' } : null)
  },
  grinder: { label: 'Grinder', group: (f) => ({ key: f.grinderId, label: f.grinderName }) },
  basket: {
    label: 'Basket',
    group: (f) => (f.basketId ? { key: f.basketId, label: f.basketName ?? 'Basket' } : null)
  },
  week: { label: 'Week', group: (f) => same(f.week) }
} satisfies Record<string, Dimension>;

/** A fixed dimension, any machine feature (`feature:temperature`) or any puck prep step (`step:<id>`). */
export type DimensionName = keyof typeof FIXED_DIMENSIONS | `feature:${string}` | `step:${string}`;

export function dimension(name: DimensionName, context?: DimensionContext): Dimension {
  if (name in FIXED_DIMENSIONS) return FIXED_DIMENSIONS[name as keyof typeof FIXED_DIMENSIONS];
  if (name.startsWith('feature:'))
    return featureDimension(name.slice('feature:'.length), context?.machineFeatures ?? {});
  if (name.startsWith('step:')) {
    const stepId = name.slice('step:'.length);
    return stepDimension(stepId, context?.stepOptions[stepId] ?? {});
  }
  throw new Error(`Unknown dimension: ${name}`);
}

/** "1.6 · 18.0 g": grind and dose tell a bean's recipes apart (D-112). */
function recipeLabel(f: ShotFact): string {
  const grind = formatQuantity(f.grind, { decimals: decimalsFor(f.grind, f.grindStep) });
  const dose = formatQuantity(f.recipeDose, { decimals: 1, unit: 'g' });
  return `${grind} · ${dose}`;
}

/** "20 s", "15 kg": the decimals the value needs, at least none. */
function amountText(value: Thousandths, unit?: string): string {
  return formatQuantity(value, { decimals: decimalsFor(value, 1000), unit });
}

/**
 * A machine feature as set on the shot's recipe (D-46, D-65), worded as on the shot detail
 * ("Temperature 93 °C", "Preinfusion 4 s at 2 bar") by the machine's feature definitions; "Off" when off.
 */
function featureDimension(key: string, machines: DimensionContext['machineFeatures']): Dimension {
  return {
    label: key,
    group: (f) => {
      const feature = f.setup.features[key];
      if (!feature) return null;
      if (!feature.on) return { key: 'off', label: 'Off' };
      const identity = JSON.stringify([feature.value, feature.pressure, feature.choice]);
      const text = setupDetail(
        { features: { [key]: feature }, routine: null },
        machines[f.machineId] ?? []
      );
      return { key: `on:${identity}`, label: text || feature.label };
    }
  };
}

/** A puck prep step's value on the shot's recipe (D-51, D-65); shots whose routine lacks it are left out. */
function stepDimension(stepId: string, options: Record<string, string>): Dimension {
  return {
    label: stepId,
    group: (f) => {
      const step = f.setup.routine?.steps.find((s) => s.stepId === stepId);
      if (!step) return null;
      if (step.value === null) return null; // a step without a setting has nothing to compare
      if (typeof step.value === 'string')
        return { key: `option:${step.value}`, label: options[step.value] ?? step.value };
      return { key: `value:${step.value}`, label: amountText(step.value, step.unit) };
    }
  };
}
