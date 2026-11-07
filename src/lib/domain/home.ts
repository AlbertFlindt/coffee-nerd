// Home: the numbers and short texts on its cards, for the bean on Home. Pure, like the rest of the domain.
import type { BestRecipe } from './best-recipe';
import { bestScoreText } from './bean';
import { isThisWeek } from './journal';
import { CLEAR_POINTS, scoreAxis, timeAxis, type Axis, type DotRow } from './insights';
import { mean, standardDeviation } from './statistics';
import { tasteWords } from './taste';
import {
  decimalsFor,
  formatQuantity,
  formatRatio,
  fromThousandths,
  type Thousandths
} from './units';

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

export type HomeGraphId = 'dial-in' | 'time-yield' | 'roast-age' | 'consistency';

/** The graph chips on Home (screen 6), in their order; Home opens on the one chosen last. */
export const HOME_GRAPHS: readonly { id: HomeGraphId; label: string }[] = [
  { id: 'dial-in', label: 'Dial-in' },
  { id: 'time-yield', label: 'Time vs. yield' },
  { id: 'roast-age', label: 'Roast age' },
  { id: 'consistency', label: 'Consistency' }
];

/** The stored choice (`app_state.home_graph`) as a graph; Dial-in without one. */
export function homeGraphId(stored: string | null | undefined): HomeGraphId {
  return HOME_GRAPHS.find((g) => g.id === stored)?.id ?? 'dial-in';
}

const TIME_YIELD_SHOTS = 30;
/** A score of 8 or more is a shot you liked: amber on Time vs. yield. */
export const LIKED_SCORE = 8;

export type TimeYieldPoint = {
  shotId: string;
  /** Seconds and grams. */
  time: number;
  yield: number;
  score: number | null;
  liked: boolean;
};

export type TimeYieldGraph = { points: TimeYieldPoint[]; time: Axis; yield: Axis };

/**
 * Time vs. yield: the bean's last 30 shots with a time and a yield, oldest first, time across
 * and yield up. Shots scored 8 or more are the liked ones. Fewer than 2 such shots give no graph.
 */
export function timeVsYield(
  newestFirst: readonly {
    shotId: string;
    time: Thousandths | null;
    yield: Thousandths | null;
    score: number | null;
  }[]
): TimeYieldGraph | null {
  const points = newestFirst
    .flatMap((s) =>
      s.time === null || s.yield === null
        ? []
        : [
            {
              shotId: s.shotId,
              time: fromThousandths(s.time),
              yield: fromThousandths(s.yield),
              score: s.score,
              liked: s.score !== null && s.score >= LIKED_SCORE
            }
          ]
    )
    .slice(0, TIME_YIELD_SHOTS)
    .reverse();
  if (points.length < 2) return null;
  return {
    points,
    time: roundAxis(
      points.map((p) => p.time),
      's'
    ),
    yield: roundAxis(
      points.map((p) => p.yield),
      'g'
    )
  };
}

/**
 * An axis on round numbers around the values: the smallest step of 1, 2, 5, 10 or 20 that needs
 * at most 6 steps, a label at each. Values all alike still get a step either side.
 */
function roundAxis(values: readonly number[], unit: string): Axis {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const bounds = (step: number) => {
    let from = Math.floor(low / step) * step;
    let to = Math.ceil(high / step) * step;
    if (from === to) {
      from -= step;
      to += step;
    }
    return { from: Math.max(0, from), to };
  };
  const step = [1, 2, 5, 10, 20].find((s) => {
    const { from, to } = bounds(s);
    return (to - from) / s <= 6;
  })!;
  const { from, to } = bounds(step);
  const ticks: number[] = [];
  for (let t = from; t <= to; t += step) ticks.push(t);
  return { from, to, ticks, unit };
}

/** Roast age in whole weeks since roast; shots after four weeks are one range. */
export const ROAST_AGE_RANGES: readonly { from: number; to: number | null; label: string }[] = [
  { from: 0, to: 6, label: '0–6 days' },
  { from: 7, to: 13, label: '7–13 days' },
  { from: 14, to: 20, label: '14–20 days' },
  { from: 21, to: 27, label: '21–27 days' },
  { from: 28, to: null, label: '28+ days' }
];

/** Each roast age range needs this many rated shots for an average and a spread. */
const RANGE_MINIMUM = 2;

/**
 * Roast age: the average score ± 1 σ per range of days since roast, in range order. A range needs
 * 2 rated shots, and the chart 2 ranges to compare. The best range is amber when it leads the next
 * by more than half a point.
 */
export function scoreByRoastAge(
  shots: readonly { roastAgeDays: number; score: number | null }[]
): { rows: DotRow[]; axis: Axis } | null {
  const rows = ROAST_AGE_RANGES.flatMap(({ from, to, label }) => {
    const scores = shots.flatMap((s) =>
      s.score !== null && s.roastAgeDays >= from && (to === null || s.roastAgeDays <= to)
        ? [s.score]
        : []
    );
    if (scores.length < RANGE_MINIMUM) return [];
    return [
      {
        label,
        n: scores.length,
        mean: mean(scores)!,
        sigma: standardDeviation(scores)!,
        top: false
      }
    ];
  });
  if (rows.length < 2) return null;
  markClearBest(rows);
  return { rows, axis: scoreAxis(Math.min(...rows.map((r) => r.mean - r.sigma))) };
}

/** The highest average is the top row when it leads the next by more than CLEAR_POINTS. */
function markClearBest(rows: DotRow[]) {
  const [first, second] = [...rows].sort((a, b) => b.mean - a.mean);
  if (first.mean - second.mean > CLEAR_POINTS) first.top = true;
}

/** A recipe needs this many shots with a time to show how steady it is. */
export const CONSISTENCY_MINIMUM = 3;
const CONSISTENCY_ROWS = 4;

/**
 * Consistency: the shot time ± 1 σ of each recipe brewed 3 times or more with a time, the 4 with
 * the most shots, most first, in the order given on a tie. The best recipe is amber. Recipes that read the same get a number,
 * "1.6 · 18.0 g (2)", so each row has its own name. None to show gives no chart.
 */
export function recipeConsistency(
  recipes: readonly { label: string; times: readonly Thousandths[]; best: boolean }[]
): { rows: DotRow[]; axis: Axis } | null {
  const steady = recipes
    .filter((r) => r.times.length >= CONSISTENCY_MINIMUM)
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => b.times.length - a.times.length || a.i - b.i)
    .slice(0, CONSISTENCY_ROWS);
  if (steady.length === 0) return null;
  const seen = new Map<string, number>();
  const rows = steady.map((r) => {
    const seconds = r.times.map(fromThousandths);
    const nth = (seen.get(r.label) ?? 0) + 1;
    seen.set(r.label, nth);
    return {
      label: nth === 1 ? r.label : `${r.label} (${nth})`,
      n: seconds.length,
      mean: mean(seconds)!,
      sigma: standardDeviation(seconds)!,
      top: r.best
    };
  });
  return {
    rows,
    axis: timeAxis(
      Math.min(...rows.map((r) => r.mean - r.sigma)),
      Math.max(...rows.map((r) => r.mean + r.sigma))
    )
  };
}
