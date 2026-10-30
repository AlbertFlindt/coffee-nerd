// The Journal and the shot detail: days, times and the short texts on a shot's row.
import { localDate, roastAgeDays } from './bean';
import { mean, standardDeviation } from './statistics';
import { tasteWords } from './taste';
import { decimalsFor, formatQuantity, type Thousandths } from './units';

/** "Today", "Yesterday", then "Tue 13 Oct"; a date in another year names the year. */
export function dayLabel(brewedAt: number, now: number, timeZone: string): string {
  const day = dayNumber(localDate(brewedAt, timeZone));
  const today = dayNumber(localDate(now, timeZone));
  if (day === today) return 'Today';
  if (day === today - 1) return 'Yesterday';
  const sameYear =
    localDate(brewedAt, timeZone).slice(0, 4) === localDate(now, timeZone).slice(0, 4);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' })
  })
    .format(brewedAt)
    .replace(',', '');
}

/** "07:42": a 24-hour clock in the user's time zone. */
export function clockTime(brewedAt: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(brewedAt);
}

/** Shots in the order given (newest first), one group per calendar day. */
export function groupByDay<T extends { brewedAt: number }>(
  shots: readonly T[],
  now: number,
  timeZone: string
): { label: string; shots: T[] }[] {
  const groups: { day: string; label: string; shots: T[] }[] = [];
  for (const shot of shots) {
    const day = localDate(shot.brewedAt, timeZone);
    const last = groups.at(-1);
    if (last?.day === day) last.shots.push(shot);
    else groups.push({ day, label: dayLabel(shot.brewedAt, now, timeZone), shots: [shot] });
  }
  return groups.map(({ label, shots }) => ({ label, shots }));
}

/** How many shots were brewed since Monday of this week; weeks start on Monday (docs/SPEC.md §1.8). */
export function shotsThisWeek(brewedAts: readonly number[], now: number, timeZone: string): number {
  return brewedAts.filter((b) => isThisWeek(b, now, timeZone)).length;
}

/** Brewed since Monday of this week, in the user's time zone (docs/SPEC.md §1.8). */
export function isThisWeek(brewedAt: number, now: number, timeZone: string): boolean {
  const today = dayNumber(localDate(now, timeZone));
  // Day 0 (1 Jan 1970) was a Thursday: Monday is 0 after shifting by 3.
  const monday = today - ((today + 3) % 7);
  const day = dayNumber(localDate(brewedAt, timeZone));
  return day >= monday && day <= today;
}

export type CoreValues = {
  grind: Thousandths;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
};

/**
 * "1.6 · 18.0 → 38.5 g · 25.5 s". Decimals as on the shot form: the grind follows its dial, dose,
 * yield and time keep at least one. A missing yield or time is left out.
 */
export function coreValuesText(
  values: CoreValues,
  steps: { grind: Thousandths; dose: Thousandths; yield: Thousandths; time: Thousandths }
): string {
  const shown = (value: Thousandths, step: Thousandths, unit?: string, atLeast = 1) =>
    formatQuantity(value, { decimals: Math.max(atLeast, decimalsFor(value, step)), unit });
  const grind = shown(values.grind, steps.grind, undefined, 0);
  const brew =
    values.yield === null
      ? shown(values.dose, steps.dose, 'g')
      : `${shown(values.dose, steps.dose)} → ${shown(values.yield, steps.yield, 'g')}`;
  const parts = [grind, brew];
  if (values.time !== null) parts.push(shown(values.time, steps.time, 's'));
  return parts.join(' · ');
}

/** The taste on a Journal row: the balance in words, "Not rated" for an unrated shot without one. */
export function journalTasteText(score: number | null, balance: number | null): string {
  if (balance !== null) return tasteWords('balance', balance);
  return score === null ? 'Not rated' : '';
}

/** "12 days since roast": the roast age on the day of the shot. */
export function roastAgeText(roastDate: string, brewedAt: number, timeZone: string): string {
  const days = roastAgeDays(roastDate, brewedAt, timeZone);
  return `${days} ${days === 1 ? 'day' : 'days'} since roast`;
}

export type RecipeComparison =
  | { kind: 'no-value' }
  | { kind: 'not-enough' }
  /** `sigmas`: how many σ this shot lies from the others' average; null when the others do not vary. */
  | { kind: 'compared'; mean: number; sigmas: number | null };

/**
 * "Compared with this recipe": this shot's value against the recipe's other shots, never
 * itself. Needs two other shots with a value; σ is the sample standard deviation (n − 1).
 */
export function compareWithRecipe(
  value: number | null,
  others: readonly (number | null)[]
): RecipeComparison {
  if (value === null) return { kind: 'no-value' };
  const values = others.filter((v): v is number => v !== null);
  if (values.length < 2) return { kind: 'not-enough' };
  const average = mean(values)!;
  const sigma = standardDeviation(values)!;
  return {
    kind: 'compared',
    mean: average,
    sigmas: sigma === 0 ? null : (value - average) / sigma
  };
}

/** "Within normal range" within one σ; further away "1.7σ faster than usual" and the like. */
export function comparisonText(measure: 'time' | 'score', sigmas: number | null): string | null {
  if (sigmas === null) return null;
  // Compared as shown, to one decimal, so a sentence never reads "1.0σ faster than usual".
  const shown = Math.round(Math.abs(sigmas) * 10) / 10;
  if (shown <= 1) return 'Within normal range';
  const words =
    measure === 'time' ? (sigmas < 0 ? 'faster' : 'slower') : sigmas < 0 ? 'lower' : 'higher';
  return `${shown.toFixed(1)}σ ${words} than usual`;
}

/** A recipe in the Journal's recipe filter: "1.6 · 18.0 g · Daily routine · 3 shots". */
export function recipeFilterLabel(
  recipe: {
    grind: Thousandths;
    dose: Thousandths;
    routine: string | null;
    shotCount: number;
    /** Setup values that tell it apart from a recipe with the same values. */
    differences?: readonly string[];
  },
  steps: { grind: Thousandths; dose: Thousandths }
): string {
  const parts = [
    formatQuantity(recipe.grind, { decimals: decimalsFor(recipe.grind, steps.grind) }),
    formatQuantity(recipe.dose, {
      decimals: Math.max(1, decimalsFor(recipe.dose, steps.dose)),
      unit: 'g'
    })
  ];
  if (recipe.routine) parts.push(recipe.routine);
  parts.push(...(recipe.differences ?? []));
  parts.push(`${recipe.shotCount} ${recipe.shotCount === 1 ? 'shot' : 'shots'}`);
  return parts.join(' · ');
}

/**
 * For each recipe, the setup values in which it differs from the recipes with the same `values`
 * (grind, dose and routine), in the order given; empty when no other recipe has its values.
 */
export function setupDifferences(
  recipes: readonly { values: string; setup: readonly { key: string; text: string }[] }[]
): string[][] {
  return recipes.map((recipe) => {
    const group = recipes.filter((r) => r.values === recipe.values);
    if (group.length < 2) return [];
    const textOf = (r: (typeof recipes)[number], key: string) =>
      r.setup.find((part) => part.key === key)?.text ?? null;
    return recipe.setup
      .filter((part) => group.some((other) => textOf(other, part.key) !== part.text))
      .map((part) => part.text);
  });
}

function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}
