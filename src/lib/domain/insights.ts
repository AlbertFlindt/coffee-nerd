// Insights (screens 23–25, D-55, D-56): what a card shows, as data the server fills and the components
// draw. Pure: the wording helpers here are shared by every insight definition.

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

/** One row of an average ± 1 σ dot plot (D-56); `top` is drawn in amber, the rest in cream (D-55). */
export type DotRow = { label: string; n: number; mean: number; sigma: number; top: boolean };

/** The value axis: its range and the labelled ticks, all in the measure's own units. */
export type Axis = { from: number; to: number; ticks: number[] };

export type Chart =
  | { kind: 'box'; measure: string; rows: BoxRow[]; axis: Axis }
  | { kind: 'mean-sigma'; measure: string; unit?: string; rows: DotRow[]; axis: Axis };

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
