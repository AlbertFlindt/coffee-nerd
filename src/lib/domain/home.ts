// Home: the numbers and short texts on its cards, for the bean on Home. Pure, like the rest of the domain.
import type { BestRecipe } from './best-recipe';
import { bestScoreText } from './bean';
import { isThisWeek } from './journal';
import { mean } from './statistics';
import { tasteWords } from './taste';
import { decimalsFor, formatQuantity, formatRatio, type Thousandths } from './units';

export type Week = { shots: number; rated: number; average: number | null };

/** This bean's shots since Monday, their average score and how many are rated. */
export function thisWeek(
  shots: readonly { brewedAt: number; score: number | null }[],
  now: number,
  timeZone: string
): Week {
  const week = shots.filter((s) => isThisWeek(s.brewedAt, now, timeZone));
  const scores = week.flatMap((s) => (s.score === null ? [] : [s.score]));
  return { shots: week.length, rated: scores.length, average: mean(scores) };
}

/** "9 shots" over "avg 7.2 · 8 of 9 rated"; no average without a rated shot, no line without shots. */
export function thisWeekText(week: Week): { value: string; detail: string | null } {
  const value = `${week.shots} ${week.shots === 1 ? 'shot' : 'shots'}`;
  if (week.shots === 0) return { value, detail: null };
  const rated = `${week.rated} of ${week.shots} rated`;
  return {
    value,
    detail: week.average === null ? rated : `avg ${week.average.toFixed(1)} · ${rated}`
  };
}

/** The best recipe's score as on the Beans pages: "7.7 / 10" or "8 / 10". */
export function bestScoreOutOfTen(best: BestRecipe): string {
  return `${bestScoreText(best)} / 10`;
}

/** Under the roast age: "since roast", with grams left when the bean has a bag weight. */
export function freshnessDetail(gramsLeft: string | null): string {
  return gramsLeft === null ? 'since roast' : `since roast · ${gramsLeft}`;
}

/**
 * The last shot's values in two fixed columns: Grind, In, Ratio on the left; Time, Out, Taste on
 * the right. A missing yield, time or balance is left out, and so is the ratio without a
 * yield; the rest of its column closes up.
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
): { left: ShotValue[]; right: ShotValue[] } {
  const shown = (value: Thousandths, step: Thousandths, unit?: string, atLeast = 1) =>
    formatQuantity(value, { decimals: Math.max(atLeast, decimalsFor(value, step)), unit });
  const present = (values: (ShotValue | null)[]) => values.filter((v) => v !== null);
  return {
    left: present([
      { label: 'Grind', value: shown(shot.grind, steps.grind, undefined, 0) },
      { label: 'In', value: shown(shot.dose, steps.dose, 'g') },
      shot.yield === null ? null : { label: 'Ratio', value: formatRatio(shot.yield, shot.dose)! }
    ]),
    right: present([
      shot.time === null ? null : { label: 'Time', value: shown(shot.time, steps.time, 's') },
      shot.yield === null ? null : { label: 'Out', value: shown(shot.yield, steps.yield, 'g') },
      shot.balance === null ? null : { label: 'Taste', value: tasteWords('balance', shot.balance) }
    ])
  };
}

export type ShotValue = { label: string; value: string };

const DIAL_IN_SHOTS = 12;

export type DialInGraph = {
  /** Oldest first; `newRecipe` marks the first shot drawn of a recipe that differs from the one before. */
  points: { shotId: string; score: number; newRecipe: boolean }[];
  /** Three whole-number grid lines, low to high, within 0–10. */
  ticks: [number, number, number];
};

/**
 * Dial-in progress: the score of the bean's last 12 rated shots, oldest first. Unrated shots are
 * left out, never drawn as 0. A recipe change is marked on a shot whose recipe differs from the
 * shot drawn before it. Fewer than 2 rated shots give no graph.
 */
export function dialInProgress(
  newestFirst: readonly { shotId: string; score: number | null; recipeId: string }[]
): DialInGraph | null {
  const rated = newestFirst
    .flatMap((s) =>
      s.score === null ? [] : [{ shotId: s.shotId, score: s.score, recipeId: s.recipeId }]
    )
    .slice(0, DIAL_IN_SHOTS)
    .reverse();
  if (rated.length < 2) return null;
  const scores = rated.map((s) => s.score);
  const low = Math.min(...scores);
  const step = Math.max(1, Math.ceil((Math.max(...scores) - low) / 2));
  // Starts at the lowest score, moved down so the top line stays within the 0–10 scale.
  const start = Math.max(0, Math.min(low, 10 - 2 * step));
  return {
    points: rated.map((s, i) => ({
      shotId: s.shotId,
      score: s.score,
      newRecipe: i > 0 && s.recipeId !== rated[i - 1].recipeId
    })),
    ticks: [start, start + step, start + 2 * step]
  };
}
