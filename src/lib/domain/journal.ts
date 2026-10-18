// The Journal and the shot detail (D-54, D-57): days, times and the short texts on a shot's row.
import { localDate, roastAgeDays } from './bean';
import { mean, standardDeviation } from './statistics';
import { tasteWords } from './taste';
import { decimalsFor, formatQuantity, type Thousandths } from './units';

/** "Today", "Yesterday", then "Tue 13 Oct"; a date in another year names the year (D-54). */
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

/** Shots in the order given (newest first), one group per calendar day (D-54). */
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

/** How many shots were brewed since Monday of this week; weeks start on Monday (data-model §1.8). */
export function shotsThisWeek(brewedAts: readonly number[], now: number, timeZone: string): number {
  const today = dayNumber(localDate(now, timeZone));
  // Day 0 (1 Jan 1970) was a Thursday: Monday is 0 after shifting by 3.
  const monday = today - ((today + 3) % 7);
  return brewedAts.filter((b) => {
    const day = dayNumber(localDate(b, timeZone));
    return day >= monday && day <= today;
  }).length;
}

export type CoreValues = {
  grind: Thousandths;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
};

/**
 * "1.6 · 18.0 → 38.5 g · 25.5 s" (D-54). Decimals as on the shot form: the grind follows its dial, dose,
 * yield and time keep at least one (D-07). A missing yield or time is left out (D-91).
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

/** The taste on a Journal row: the balance in words, "Not rated" for an unrated shot without one (D-11, D-54). */
export function journalTasteText(score: number | null, balance: number | null): string {
  if (balance !== null) return tasteWords('balance', balance);
  return score === null ? 'Not rated' : '';
}

/** "12 days since roast": the roast age on the day of the shot (D-17, D-57). */
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
 * "Compared with this recipe" (D-57, D-109): this shot's value against the recipe's other shots, never
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

/** "Within normal range" within one σ; further away "1.7σ faster than usual" and the like (D-110). */
export function comparisonText(measure: 'time' | 'score', sigmas: number | null): string | null {
  if (sigmas === null) return null;
  if (Math.abs(sigmas) <= 1) return 'Within normal range';
  const words =
    measure === 'time' ? (sigmas < 0 ? 'faster' : 'slower') : sigmas < 0 ? 'lower' : 'higher';
  return `${Math.abs(sigmas).toFixed(1)}σ ${words} than usual`;
}

function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}
