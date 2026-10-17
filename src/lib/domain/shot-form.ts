// What the shot form shows about the values being entered (D-12, D-15, D-16, D-90, D-100). Pure, so it
// runs in the browser on every change and works offline (D-61).
import { describeChange, recipeFingerprint, type RecipeIdentity } from './fingerprint';
import type { FeatureDefinition, FeatureValue, SetupSnapshot } from './schemas';
import { decimalsFor, formatQuantity, type Thousandths } from './units';

/** A recipe of the current bean, as the form needs it for matching (data-model §4.1). */
export type KnownRecipe = {
  id: string;
  machineId: string;
  fingerprint: string;
  shotCount: number;
  /** Score of the recipe's latest rated shot (D-12); null when none is rated. */
  lastScore: number | null;
};

export type FormMatch =
  | { kind: 'reused'; recipeId: string; shotCount: number; lastScore: number | null }
  | { kind: 'new'; changes: string[] };

/**
 * The recipe these values make (D-16): an earlier recipe of this bean on this machine with the same
 * fingerprint, or a new one whose changes are named against the bean's last shot (D-71, D-77, D-81). A
 * recipe without shots (kept only by its Brew next mark) has not been brewed, so it counts as new (D-104).
 */
export function matchRecipe(
  form: RecipeIdentity,
  recipes: readonly KnownRecipe[],
  lastShotRecipe: RecipeIdentity | null
): FormMatch {
  const fingerprint = recipeFingerprint(form);
  const found = recipes.find(
    (r) => r.machineId === form.machineId && r.fingerprint === fingerprint && r.shotCount > 0
  );
  if (found)
    return {
      kind: 'reused',
      recipeId: found.id,
      shotCount: found.shotCount,
      lastScore: found.lastScore
    };
  return { kind: 'new', changes: lastShotRecipe ? describeChange(form, lastShotRecipe) : [] };
}

export type CoreValues = {
  grind: Thousandths;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
};

/** Changed since the last shot: the delta to show, or null when one side is empty (no number to show). */
export type Change = { delta: Thousandths | null } | null;

/** Which core values differ from the bean's last shot, with their deltas (D-15, D-81). */
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
  /** Switched on or off since the last shot (D-90). */
  switched: 'On' | 'Off' | null;
};

export type SetupChanges = {
  /** Only the features that changed. */
  features: Record<string, FeatureChange>;
  basket: boolean;
  routine: boolean;
};

/** What differs on the Setup tab from the bean's last shot (D-90). */
export function setupChanges(now: RecipeIdentity, last: RecipeIdentity | null): SetupChanges {
  const result: SetupChanges = { features: {}, basket: false, routine: false };
  if (last === null) return result;
  result.basket = now.basketId !== last.basketId;
  const stepValues = (r: RecipeIdentity) =>
    JSON.stringify((r.setup.routine?.steps ?? []).map((s) => [s.stepId, s.value]));
  result.routine = now.routineId !== last.routineId || stepValues(now) !== stepValues(last);

  for (const [key, feature] of Object.entries(now.setup.features)) {
    // A feature the machine did not have at the last shot counts as switched off then (D-78, D-90).
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
 * The setup line on the bean card (D-100): each switched-on phase and custom feature with its value, in
 * the machine's order, then the temperature. Flat pressure and the basket are left out; a feature still
 * waiting for its value (D-78) too.
 */
export function setupSummary(setup: SetupSnapshot, features: readonly FeatureDefinition[]): string {
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
  if (temperature) parts.push(temperature);
  return parts.join(' · ');
}

/** "Preinfusion 4 s", "93 °C" (temperature without its label), "Paddle Middle"; null without a value. */
function featureText(definition: FeatureDefinition, value: FeatureValue): string | null {
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
      return definition.key === SUMMARY_LAST ? text : `${definition.label} ${text}`;
    }
    case 'seconds':
    case 'phase': {
      const text = quantity('s', kind.step);
      return text === null ? null : `${definition.label} ${text}`;
    }
  }
}
