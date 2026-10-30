// What the shot form shows about the values being entered. Pure, so it
// runs in the browser on every change and works offline.
import { trimmed } from './gear';
import { describeChange, recipeFingerprint, sameDose, type RecipeIdentity } from './fingerprint';
import type { FeatureDefinition, FeatureValue, SetupSnapshot } from './schemas';
import { decimalsFor, formatQuantity, type Thousandths } from './units';

/** A recipe of the current bean, as the form needs it for matching (docs/SPEC.md §4.1). */
export type KnownRecipe = {
  id: string;
  machineId: string;
  fingerprint: string;
  /** The recipe's dose; a form dose within 0.2 g of it is this recipe. */
  dose: Thousandths;
  /** When its latest shot was brewed: equally close doses go to the most recent. */
  lastBrewedAt?: number | null;
  shotCount: number;
  /** Score of the recipe's latest rated shot; null when none is rated. */
  lastScore: number | null;
};

export type FormMatch =
  | { kind: 'reused'; recipeId: string; shotCount: number; lastScore: number | null }
  | { kind: 'new'; changes: string[] };

/**
 * The recipe these values make: an earlier recipe of this bean on this machine with the same
 * fingerprint and a dose within 0.2 g, the closest dose winning, or a new one whose changes are named against the bean's last shot. A
 * recipe without shots (kept only by its Brew next mark) has not been brewed, so it counts as new.
 */
export function matchRecipe(
  form: RecipeIdentity,
  recipes: readonly KnownRecipe[],
  lastShotRecipe: RecipeIdentity | null
): FormMatch {
  const fingerprint = recipeFingerprint(form);
  // Chosen among all of them, as the server does; one without shots is then still new.
  const found = closestDose(
    form.dose,
    recipes.filter((r) => r.machineId === form.machineId && r.fingerprint === fingerprint)
  );
  if (found && found.shotCount > 0)
    return {
      kind: 'reused',
      recipeId: found.id,
      shotCount: found.shotCount,
      lastScore: found.lastScore
    };
  return { kind: 'new', changes: lastShotRecipe ? describeChange(form, lastShotRecipe) : [] };
}

/**
 * Of recipes with the same fingerprint, the one whose dose is within reach and closest; equally close,
 * the one brewed most recently, then the first given.
 */
export function closestDose<T extends { dose: Thousandths; lastBrewedAt?: number | null }>(
  dose: Thousandths,
  recipes: readonly T[]
): T | undefined {
  let best: T | undefined;
  for (const r of recipes) {
    if (!sameDose(r.dose, dose)) continue;
    const distance = Math.abs(r.dose - dose);
    const bestDistance = best ? Math.abs(best.dose - dose) : Infinity;
    if (
      distance < bestDistance ||
      (distance === bestDistance && (r.lastBrewedAt ?? -1) > (best!.lastBrewedAt ?? -1))
    )
      best = r;
  }
  return best;
}

export type CoreValues = {
  grind: Thousandths;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
};

/** Changed since the last shot: the delta to show, or null when one side is empty (no number to show). */
export type Change = { delta: Thousandths | null } | null;

/** Which core values differ from the bean's last shot, with their deltas. */
export function coreChanges(
  now: CoreValues,
  last: CoreValues | null
): Record<keyof CoreValues, Change> {
  const change = (a: Thousandths | null, b: Thousandths | null | undefined): Change => {
    if (last === null || a === b) return null;
    return { delta: a !== null && b !== null && b !== undefined ? a - b : null };
  };
  return {
    grind: change(now.grind, last?.grind),
    dose: change(now.dose, last?.dose),
    yield: change(now.yield, last?.yield),
    time: change(now.time, last?.time)
  };
}

export type FeatureChange = {
  delta: Thousandths | null;
  pressureDelta: Thousandths | null;
  /** Switched on or off since the last shot. */
  switched: 'On' | 'Off' | null;
};

/** A routine step whose value changed since the last shot; `delta` for numbers, null for a list. */
export type StepChange = { delta: Thousandths | null } | null;

export type SetupChanges = {
  /** Only the features that changed. */
  features: Record<string, FeatureChange>;
  basket: boolean;
  routine: boolean;
  /** Per step of this shot's routine, when it is the last shot's routine too. */
  steps: StepChange[];
};

/** What differs on the Setup tab from the bean's last shot. */
export function setupChanges(now: RecipeIdentity, last: RecipeIdentity | null): SetupChanges {
  const result: SetupChanges = { features: {}, basket: false, routine: false, steps: [] };
  if (last === null) return result;
  result.basket = now.basketId !== last.basketId;
  const stepValues = (r: RecipeIdentity) =>
    JSON.stringify((r.setup.routine?.steps ?? []).map((s) => [s.stepId, s.value]));
  result.routine = now.routineId !== last.routineId || stepValues(now) !== stepValues(last);
  if (now.routineId !== null && now.routineId === last.routineId) {
    const before = last.setup.routine?.steps ?? [];
    result.steps = (now.setup.routine?.steps ?? []).map((step, i) => {
      const old = before[i];
      if (!old || old.stepId !== step.stepId || old.value === step.value) return null;
      return {
        delta:
          typeof step.value === 'number' && typeof old.value === 'number'
            ? step.value - old.value
            : null
      };
    });
    if (result.steps.every((c) => c === null)) result.steps = [];
  }

  for (const [key, feature] of Object.entries(now.setup.features)) {
    // A feature the machine did not have at the last shot counts as switched off then.
    const before = last.setup.features[key] ?? { label: feature.label, on: false };
    const change = featureChange(feature, before);
    if (change) result.features[key] = change;
  }
  return result;
}

function featureChange(now: FeatureValue, before: FeatureValue): FeatureChange | null {
  if (now.on !== before.on)
    return { delta: null, pressureDelta: null, switched: now.on ? 'On' : 'Off' };
  if (!now.on) return null;
  const diff = (a?: number, b?: number) =>
    a !== undefined && b !== undefined && a !== b ? a - b : null;
  const delta = diff(now.value, before.value);
  const pressureDelta = diff(now.pressure, before.pressure);
  const choiceChanged = now.choice !== before.choice;
  if (delta === null && pressureDelta === null && !choiceChanged) return null;
  return { delta, pressureDelta, switched: null };
}

const SUMMARY_LAST = 'temperature';
const SUMMARY_LEFT_OUT = new Set(['flat_pressure']);

/**
 * The setup line on the bean card: each switched-on phase and custom feature with its value, in
 * the machine's order, then the temperature. Flat pressure and the basket are left out; a feature still
 * waiting for its value too.
 */
export function setupSummary(
  setup: SetupSnapshot,
  features: readonly FeatureDefinition[],
  { temperature: withTemperature = true }: { temperature?: boolean } = {}
): string {
  const parts: string[] = [];
  let temperature: string | null = null;
  for (const definition of features) {
    const value = setup.features[definition.key];
    if (!value?.on || SUMMARY_LEFT_OUT.has(definition.key)) continue;
    const text = featureText(definition, value);
    if (text === null) continue;
    if (definition.key === SUMMARY_LAST) temperature = text;
    else parts.push(text);
  }
  // The bean page leaves it out when all of a bean's recipes share it.
  if (temperature && withTemperature) parts.push(temperature);
  return parts.join(' · ');
}

/**
 * The setup line on the shot detail: the whole pressure profile, so temperature, then flat pressure,
 * then every other switched-on feature in the machine's order, phases with their pressure. A feature still
 * waiting for its value is left out.
 */
export function setupDetail(setup: SetupSnapshot, features: readonly FeatureDefinition[]): string {
  return setupParts(setup, features)
    .filter((part) => setup.features[part.key]?.on)
    .map((part) => part.text)
    .join(' · ');
}

/**
 * Each routine step that has a value, as "WDT 30 s" or "Filter Metal", for telling recipes apart.
 * `label` names a list option. A step used twice gets its own key per occurrence.
 */
export function routineParts(
  routine: SetupSnapshot['routine'],
  label: (stepId: string, optionId: string) => string
): { key: string; text: string }[] {
  const seen = new Map<string, number>();
  const parts: { key: string; text: string }[] = [];
  for (const step of routine?.steps ?? []) {
    const n = seen.get(step.stepId) ?? 0;
    seen.set(step.stepId, n + 1);
    if (step.value === null) continue;
    const value =
      typeof step.value === 'string'
        ? label(step.stepId, step.value)
        : trimmed(step.value, step.unit);
    parts.push({ key: `step:${step.stepId}:${n}`, text: `${step.name} ${value}` });
  }
  return parts;
}

/**
 * Each feature of a setup in the shot detail's order, switched-off ones as "Preinfusion off", for
 * telling recipes apart. A feature still waiting for its value is left out.
 */
export function setupParts(
  setup: SetupSnapshot,
  features: readonly FeatureDefinition[]
): { key: string; text: string }[] {
  const first = ['temperature', 'flat_pressure'];
  const ordered = [
    ...first.flatMap((key) => features.filter((f) => f.key === key)),
    ...features.filter((f) => !first.includes(f.key))
  ];
  const parts: { key: string; text: string }[] = [];
  for (const definition of ordered) {
    const value = setup.features[definition.key];
    if (!value) continue;
    const text = value.on ? featureText(definition, value, true) : `${definition.label} off`;
    if (text !== null) parts.push({ key: definition.key, text });
  }
  return parts;
}

/**
 * "Preinfusion 4 s", "93 °C" (temperature without its label), "Paddle Middle"; null without a value. In
 * `detail`, flat pressure reads "Flat 9.0 bar" and a phase adds its pressure: "Low bar start 5 s at 2.0 bar".
 */
function featureText(
  definition: FeatureDefinition,
  value: FeatureValue,
  detail = false
): string | null {
  const kind = definition.value;
  const quantity = (unit: string, step: number) =>
    value.value === undefined
      ? null
      : formatQuantity(value.value, { decimals: decimalsFor(value.value, step), unit });
  switch (kind.kind) {
    case 'toggle':
      return definition.label;
    case 'choice': {
      const option = kind.options.find((o) => o.id === value.choice);
      return option ? `${definition.label} ${option.label}` : null;
    }
    case 'number': {
      const text = quantity(kind.unit, kind.step);
      if (text === null) return null;
      if (definition.key === SUMMARY_LAST) return text;
      if (detail && definition.key === 'flat_pressure') return `Flat ${text}`;
      return `${definition.label} ${text}`;
    }
    case 'seconds':
      return quantity('s', kind.step) === null
        ? null
        : `${definition.label} ${quantity('s', kind.step)}`;
    case 'phase': {
      const text = quantity('s', kind.step);
      if (text === null) return null;
      const pressure = value.pressure;
      if (!detail || !kind.pressure || pressure === undefined) return `${definition.label} ${text}`;
      const bar = formatQuantity(pressure, {
        decimals: decimalsFor(pressure, kind.pressure.step),
        unit: 'bar'
      });
      return `${definition.label} ${text} at ${bar}`;
    }
  }
}
