// Home (D-32): the numbers and short texts on its cards, for the bean on Home. Pure, like the rest of the domain.
import type { BestRecipe } from './best-recipe';
import { bestScoreText } from './bean';
import { isThisWeek } from './journal';
import { mean } from './statistics';
import { tasteWords } from './taste';
import { decimalsFor, formatQuantity, formatRatio, type Thousandths } from './units';

export type Week = { shots: number; rated: number; average: number | null };

/** This bean's shots since Monday, their average score and how many are rated (D-194). */
export function thisWeek(
  shots: readonly { brewedAt: number; score: number | null }[],
  now: number,
  timeZone: string
): Week {
  const week = shots.filter((s) => isThisWeek(s.brewedAt, now, timeZone));
  const scores = week.flatMap((s) => (s.score === null ? [] : [s.score]));
  return { shots: week.length, rated: scores.length, average: mean(scores) };
}

/** "9 shots" over "avg 7.2 · 8 of 9 rated"; no average without a rated shot (D-11), no line without shots. */
export function thisWeekText(week: Week): { value: string; detail: string | null } {
  const value = `${week.shots} ${week.shots === 1 ? 'shot' : 'shots'}`;
  if (week.shots === 0) return { value, detail: null };
  const rated = `${week.rated} of ${week.shots} rated`;
  return {
    value,
    detail: week.average === null ? rated : `avg ${week.average.toFixed(1)} · ${rated}`
  };
}

/** The best recipe's score as on the Beans pages (D-135, D-197): "7.7 / 10" or "8 / 10". */
export function bestScoreOutOfTen(best: BestRecipe): string {
  return `${bestScoreText(best)} / 10`;
}

/** Under the roast age: "since roast", with grams left when the bean has a bag weight (D-35). */
export function freshnessDetail(gramsLeft: string | null): string {
  return gramsLeft === null ? 'since roast' : `since roast · ${gramsLeft}`;
}

/**
 * The last shot's values in two columns, row by row (D-32): Grind, Time, In, Out, Ratio, Taste. A missing
 * yield, time or balance is left out (D-91, D-11), and so is the ratio without a yield.
 */
export function lastShotValues(
  shot: {
    grind: Thousandths;
    dose: Thousandths;
    yield: Thousandths | null;
    time: Thousandths | null;
    balance: number | null;
  },
  steps: { grind: Thousandths; dose: Thousandths; yield: Thousandths; time: Thousandths }
): { label: string; value: string }[] {
  const shown = (value: Thousandths, step: Thousandths, unit?: string, atLeast = 1) =>
    formatQuantity(value, { decimals: Math.max(atLeast, decimalsFor(value, step)), unit });
  const values: ({ label: string; value: string } | null)[] = [
    { label: 'Grind', value: shown(shot.grind, steps.grind, undefined, 0) },
    shot.time === null ? null : { label: 'Time', value: shown(shot.time, steps.time, 's') },
    { label: 'In', value: shown(shot.dose, steps.dose, 'g') },
    shot.yield === null ? null : { label: 'Out', value: shown(shot.yield, steps.yield, 'g') },
    shot.yield === null ? null : { label: 'Ratio', value: formatRatio(shot.yield, shot.dose)! },
    shot.balance === null ? null : { label: 'Taste', value: tasteWords('balance', shot.balance) }
  ];
  return values.filter((v) => v !== null);
}
