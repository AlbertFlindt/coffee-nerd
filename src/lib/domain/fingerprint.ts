// Recipe identity: the fingerprint decides whether two shots share a recipe.
// It runs in the browser while the form changes and again on the server on save (docs/SPEC.md §4.1).
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { FeatureValue, SetupSnapshot } from './schemas';
import type { Thousandths } from './units';

/** Everything that makes a recipe what it is, plus the machine (the matching scope) for describing changes. */
export type RecipeIdentity = {
  machineId: string;
  grinderId: string;
  basketId: string | null;
  routineId: string | null;
  grind: Thousandths;
  dose: Thousandths;
  setup: SetupSnapshot;
};

/** A dose this close to a recipe's dose is that recipe's dose: 0.2 g. */
export const DOSE_REACH: Thousandths = 200;

/** True when two doses count as the same recipe. */
export function sameDose(a: Thousandths, b: Thousandths): boolean {
  return Math.abs(a - b) <= DOSE_REACH;
}

/**
 * SHA-256 of a canonical list of grinder, basket, routine, grind, each feature's key with its
 * on/value/pressure/choice (sorted by key), and each routine step's id and value in order. Labels, units
 * and names are left out; a switched-off feature counts only as "off". Bean and machine are the
 * matching scope and are not included. The dose is left out too: a recipe is its fingerprint plus a
 * dose, matched within 0.2 g. Changing what goes in here changes recipe identity.
 */
export function recipeFingerprint(recipe: RecipeIdentity): string {
  const features = Object.keys(recipe.setup.features)
    .sort()
    .map((key) => [key, featureIdentity(recipe.setup.features[key])]);
  const canonical = [
    ['grinder', recipe.grinderId],
    ['basket', recipe.basketId],
    ['routine', recipe.routineId],
    ['grind', recipe.grind],
    ['features', features],
    ['steps', stepIdentity(recipe)]
  ];
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(canonical))));
}

function featureIdentity(feature: FeatureValue): unknown[] {
  if (!feature.on) return ['off'];
  return ['on', feature.value ?? null, feature.pressure ?? null, feature.choice ?? null];
}

function stepIdentity(recipe: RecipeIdentity): unknown[] {
  return (recipe.setup.routine?.steps ?? []).map((step) => [step.stepId, step.value]);
}

/**
 * What differs between this recipe and the last shot's recipe, as words for the recipe tag, in a
 * fixed order: grind, dose, machine, grinder, basket, routine, then features by their current label.
 */
export function describeChange(current: RecipeIdentity, last: RecipeIdentity): string[] {
  const changes: string[] = [];
  if (current.grind !== last.grind) changes.push('grind');
  if (!sameDose(current.dose, last.dose)) changes.push('dose');
  if (current.machineId !== last.machineId) changes.push('machine');
  if (current.grinderId !== last.grinderId) changes.push('grinder');
  if (current.basketId !== last.basketId) changes.push('basket');
  if (
    current.routineId !== last.routineId ||
    JSON.stringify(stepIdentity(current)) !== JSON.stringify(stepIdentity(last))
  )
    changes.push('routine');

  const keys = [
    ...Object.keys(current.setup.features),
    ...Object.keys(last.setup.features).filter((key) => !(key in current.setup.features))
  ];
  for (const key of keys) {
    const now = current.setup.features[key];
    const before = last.setup.features[key];
    const same =
      now &&
      before &&
      JSON.stringify(featureIdentity(now)) === JSON.stringify(featureIdentity(before));
    if (!same) changes.push(lowercaseLabel((now ?? before).label));
  }
  return changes;
}

/** "Preinfusion" → "preinfusion", "Low bar start" → "low bar start"; all-capital words stay ("RPM"). */
function lowercaseLabel(label: string): string {
  const [first] = label.split(' ');
  if (first.length > 1 && first === first.toUpperCase()) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export type RecipeMatch =
  { kind: 'reused'; shotCount: number } | { kind: 'new'; changes: string[] };

/** The recipe tag on the bean card. */
export function recipeTagText(match: RecipeMatch): string {
  if (match.kind === 'reused') return `Recipe reused ${match.shotCount}x`;
  const { changes } = match;
  if (changes.length === 0) return 'New recipe';
  if (changes.length === 1) return `New recipe · ${changes[0]} changed`;
  if (changes.length === 2) return `New recipe · ${changes[0]} and ${changes[1]} changed`;
  return `New recipe · ${changes[0]}, ${changes[1]} and ${changes.length - 2} more changed`;
}
