// Insights (screens 23–25, D-55, D-56): what a card shows, as data the server fills and the components
// draw. Pure: the wording helpers here are shared by every insight definition.
import { histogram } from './statistics';

export type Topic = 'like' | 'progress' | 'dial-in' | 'comparisons';

/** The topic chips in their order (D-55); Insights opens on the first (D-208). */
export const TOPICS: readonly { id: Topic; label: string }[] = [
  { id: 'like', label: 'What I like' },
  { id: 'progress', label: 'Progress' },
  { id: 'dial-in', label: 'Dial-in' },
  { id: 'comparisons', label: 'Comparisons' }
];

/** One row of a box plot: the middle half as the box, the median, the full range as whiskers (D-56). */
export type BoxRow = {
  label: string;
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
};

/** One row of an average ± 1 σ dot plot (D-56); `top`, the clear winner, is amber, the rest cream (D-55). */
export type DotRow = { label: string; n: number; mean: number; sigma: number; top: boolean };

/** One bar of σ per group (D-56, screen 25): lower is steadier; `top` is the steadiest, in amber. */
export type BarRow = { label: string; n: number; sigma: number; top: boolean };

/** One week of the weekly line (D-212): its Monday, and no stats when too few rated shots, a gap. */
export type WeekStats = { mean: number; sigma: number; n: number };
export type WeekPoint = { week: string; stats: WeekStats | null };

/** One bar of a histogram: the values from `from` up to `to`. */
export type HistogramBin = { from: number; to: number; count: number };

/** The value axis: its range and the labelled ticks, all in the measure's own units ("24 s"). */
export type Axis = { from: number; to: number; ticks: number[]; unit?: string };

export type Chart =
  | { kind: 'box'; measure: string; rows: BoxRow[]; axis: Axis }
  | { kind: 'mean-sigma'; measure: string; unit?: string; rows: DotRow[]; axis: Axis }
  | {
      kind: 'weekly';
      measure: string;
      /** Oldest week first, ending with this week (D-212). */
      points: WeekPoint[];
      axis: Axis;
      /** The labels under the first and the last week ("12 weeks ago", "This week"). */
      first: string;
      last: string;
    }
  | {
      kind: 'bell';
      measure: string;
      unit: string;
      bins: HistogramBin[];
      mean: number;
      sigma: number;
      n: number;
      axis: Axis;
    }
  | { kind: 'sigma-bars'; measure: string; rows: BarRow[]; axis: Axis };

/**
 * A card: one finding as a title and a sentence, its chart and its basis (D-55). Without enough data
 * the chart is left out and the sentence says what is missing (D-203, D-207).
 */
export type InsightCard = {
  id: string;
  topic: Topic;
  title: string;
  sentence: string;
  chart: Chart | null;
  basis: string | null;
};

/** "8", "7.5", "−0.3": a statistic with at most one decimal, as on screens 23–25. */
export function statText(value: number): string {
  // Half away from zero, as everywhere else (units.ts).
  const rounded = (Math.sign(value) * Math.round(Math.abs(value) * 10)) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return text.replace('-', '−');
}

/** "27.9", "28.0", "1.0": always one decimal, for seconds and σ as on screens 24 and 25. */
export function decimalText(value: number): string {
  return ((Math.sign(value) * Math.round(Math.abs(value) * 10)) / 10).toFixed(1);
}

/** "1 shot", "38 shots". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Brazil", "Brazil and Kenya", "Brazil, Honey and Kenya". */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** D-203: the basis line names each group with fewer than 10 shots, to treat with care (screen 25). */
export const CARE_BELOW = 10;

export function careText(rows: readonly { label: string; n: number }[]): string | null {
  const few = rows.filter((r) => r.n < CARE_BELOW).map((r) => r.label);
  if (few.length === 0) return null;
  return `${listText(few)} ${few.length === 1 ? 'has' : 'have'} few shots, so treat with care`;
}

/**
 * A score axis to 10 with a tick at each even number above its start (D-56: honest axes on scores).
 * Box plots start at 0; dot plots start 2 points below their lowest whisker, rounded down, so the
 * whiskers have room (screen 23: 3 to 10 for whiskers from 5.7).
 */
export function scoreAxis(lowest: number | null = null): Axis {
  const from = lowest === null ? 0 : Math.max(0, Math.floor(lowest - 2));
  const ticks: number[] = [];
  for (let t = Math.floor(from / 2) * 2 + 2; t <= 10; t += 2) ticks.push(t);
  return { from, to: 10, ticks };
}

/**
 * The weekly line's score axis (screen 24): from the lowest band edge, rounded down, to 10, with a tick
 * every 2 points from one above the start (5, 7, 9 for a band from 4.8).
 */
export function weeklyAxis(lowest: number): Axis {
  const from = Math.max(0, Math.floor(lowest));
  const ticks: number[] = [];
  for (let t = from + 1; t < 10; t += 2) ticks.push(t);
  return { from, to: 10, ticks };
}

/**
 * A time axis around averages ± 1 σ (screen 25: 24 to 32 s for 26.5 to 30.5 s): a second beyond the
 * outermost whiskers, out to even seconds, with a tick every 2 seconds.
 */
export function timeAxis(lowest: number, highest: number): Axis {
  const from = Math.max(0, Math.floor((lowest - 1) / 2) * 2);
  const to = Math.ceil((highest + 1) / 2) * 2;
  const ticks: number[] = [];
  for (let t = from; t <= to; t += 2) ticks.push(t);
  return { from, to, ticks, unit: 's' };
}

/** A σ axis from 0 (bars start at zero, D-56) to at least 2, with a tick every half point (screen 25). */
export function sigmaAxis(highest: number): Axis {
  const to = Math.max(2, Math.ceil(highest * 2) / 2);
  const ticks: number[] = [];
  for (let t = 0; t <= to + 1e-9; t += 0.5) ticks.push(t);
  return { from: 0, to, ticks };
}

/**
 * The bell curve's bins and axis (screen 24): one bin per second, centred on whole seconds, half a
 * second of room at each end, and a label every 2 seconds from the first bin.
 */
export function timeBins(values: readonly number[]): { bins: HistogramBin[]; axis: Axis } {
  // Shifted by half a second, the histogram's whole-second bins are centred on whole seconds.
  const bins = histogram(
    values.map((v) => v + 0.5),
    { binWidth: 1 }
  ).map((b) => ({ from: b.from - 0.5, to: b.to - 0.5, count: b.count }));
  const first = bins[0].from + 0.5;
  const last = bins[bins.length - 1].from + 0.5;
  const step = last - first > 14 ? 4 : 2;
  const ticks: number[] = [];
  for (let t = first; t <= last; t += step) ticks.push(t);
  return { bins, axis: { from: first - 1, to: last + 1, ticks, unit: 's' } };
}
