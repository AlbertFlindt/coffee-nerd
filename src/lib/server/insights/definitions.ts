// Insight definitions (data-model §5, D-64): each card is a query, a chart, the data it needs (D-203)
// and its wording for every outcome (D-206, D-214). A new insight is a new entry here.
import {
  careText,
  count,
  scoreAxis,
  statText,
  type BoxRow,
  type DotRow,
  type InsightCard,
  type Topic
} from '../../domain/insights';
import { mean, quartiles, range, standardDeviation } from '../../domain/statistics';
import type { ShotFact } from './facts';
import { runQuery, type InsightQuery, type QueryGroup } from './query';
import type { DimensionContext } from './registry';

export type InsightDefinition = {
  id: string;
  topic: Topic;
  query: InsightQuery;
  evaluate: (groups: QueryGroup[]) => Omit<InsightCard, 'id' | 'topic'>;
};

/** D-203: score by process and by origin need 2 groups with 5 rated shots each. */
const GROUP_MINIMUM = 5;
const GROUPS_NEEDED = 2;
/** D-214: medians (process) and averages (origin) within 0.5 points are "no clear difference". */
const CLEAR_POINTS = 0.5;

/** "Naturals are your thing": a process as people say it about their coffees. */
const PROCESS_PLURAL: Record<string, string> = {
  Natural: 'Naturals',
  Washed: 'Washed coffees',
  Honey: 'Honey coffees',
  Anaerobic: 'Anaerobic coffees',
  Other: 'Other processes'
};

/**
 * What a card says while it lacks data (D-203, D-207): with one group ready, how many more rated shots
 * the next group needs, else that two groups are needed. `shots(n, group)` words "3 more washed shots".
 */
function missing(
  groups: QueryGroup[],
  {
    kinds,
    another,
    shots
  }: { kinds: string; another: string; shots: (n: number, label: string) => string }
): string {
  const ready = qualifying(groups);
  if (ready.length === 0) return `Rate ${GROUP_MINIMUM} shots each from two ${kinds} to compare.`;
  const next = groups
    .filter((g) => g.values.length < GROUP_MINIMUM)
    .sort((a, b) => b.values.length - a.values.length)[0];
  if (!next) return `Rate ${GROUP_MINIMUM} shots ${another} to compare.`;
  return `Rate ${shots(GROUP_MINIMUM - next.values.length, next.label)} to compare.`;
}

const qualifying = (groups: QueryGroup[]) => groups.filter((g) => g.values.length >= GROUP_MINIMUM);

const scoreByProcess: InsightDefinition = {
  id: 'score-by-process',
  topic: 'like',
  query: { measure: 'score', groupBy: 'process' },
  evaluate(groups) {
    const shown = qualifying(groups);
    if (shown.length < GROUPS_NEEDED)
      return {
        title: 'Score by process',
        sentence: missing(groups, {
          kinds: 'processes',
          another: 'of another process',
          shots: (n, label) => `${n} more ${label.toLowerCase()} ${n === 1 ? 'shot' : 'shots'}`
        }),
        chart: null,
        basis: null
      };
    // Highest median first; on a tie, the higher average, then the more shots.
    const rows: BoxRow[] = shown
      .map((g) => ({
        row: {
          label: g.label,
          n: g.values.length,
          ...quartiles(g.values)!,
          ...range(g.values)!
        },
        average: mean(g.values)!
      }))
      .sort((a, b) => b.row.median - a.row.median || b.average - a.average || b.row.n - a.row.n)
      .map((r) => r.row);
    const [top, second] = rows;
    const bottom = rows[rows.length - 1];
    const plural = (label: string) => PROCESS_PLURAL[label] ?? `${label} coffees`;
    // Spread is the full range, the whiskers (screen 23: washed 4–9 spreads wider than natural 6–10).
    const spread = (r: BoxRow) => r.max - r.min;
    const clear = top.median - second.median > CLEAR_POINTS;
    return {
      title: clear ? `${plural(top.label)} are your thing` : 'No clear favorite process',
      sentence: clear
        ? `Half of your ${top.label.toLowerCase()} shots score ${statText(top.median)} or more. ` +
          `${plural(bottom.label)} ${spread(bottom) > spread(top) ? 'spread wider and sit lower' : 'sit lower'}.`
        : `Your processes score about the same: their medians are within half a point.`,
      chart: { kind: 'box', measure: 'Score', rows, axis: scoreAxis() },
      basis: [
        'Score by process · box = middle 50% · amber line = median · whiskers = full range',
        careText(rows)
      ]
        .filter((p) => p !== null)
        .join(' · ')
    };
  }
};

const scoreByOrigin: InsightDefinition = {
  id: 'score-by-origin',
  topic: 'like',
  query: { measure: 'score', groupBy: 'country' },
  evaluate(groups) {
    const shown = qualifying(groups);
    if (shown.length < GROUPS_NEEDED)
      return {
        title: 'Score by origin',
        sentence: missing(groups, {
          kinds: 'origins',
          another: 'from another origin',
          shots: (n, label) => `${count(n, 'more shot')} from ${label}`
        }),
        chart: null,
        basis: null
      };
    const rows: DotRow[] = shown
      .map((g) => ({
        label: g.label,
        n: g.values.length,
        mean: mean(g.values)!,
        sigma: standardDeviation(g.values)!,
        top: false
      }))
      .sort((a, b) => b.mean - a.mean || b.n - a.n);
    const [top, second] = rows;
    const clear = top.mean - second.mean > CLEAR_POINTS;
    // D-206: amber marks a winner only when there is one.
    top.top = clear;
    const tightest = rows.every((r) => r.sigma >= top.sigma);
    const shots = rows.reduce((sum, r) => sum + r.n, 0);
    return {
      title: clear ? `${top.label} leads your origins` : 'No clear favorite origin',
      sentence: clear
        ? tightest
          ? `Highest average, and the tightest spread: you rarely miss with coffees from ${top.label}.`
          : `Highest average: ${statText(top.mean)} against ${statText(second.mean)} for ${second.label}.`
        : `Your top origins average within half a point of each other.`,
      chart: {
        kind: 'mean-sigma',
        measure: 'Score',
        rows,
        axis: scoreAxis(Math.min(...rows.map((r) => r.mean - r.sigma)))
      },
      basis: [
        `Average score ± 1 standard deviation · ${count(shots, 'rated shot')}`,
        careText(rows)
      ]
        .filter((p) => p !== null)
        .join(' · ')
    };
  }
};

export const INSIGHTS: readonly InsightDefinition[] = [scoreByProcess, scoreByOrigin];

/** Every card, in the order of the registry above, from the owner's shot facts. */
export function evaluateInsights(
  facts: readonly ShotFact[],
  context: DimensionContext,
  definitions: readonly InsightDefinition[] = INSIGHTS
): InsightCard[] {
  return definitions.map((d) => ({
    id: d.id,
    topic: d.topic,
    ...d.evaluate(runQuery(facts, d.query, context))
  }));
}
