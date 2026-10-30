// Insight definitions (docs/SPEC.md §5): each card is a query, a chart, the data it needs
// and its wording for every outcome. A new insight is a new entry here.
import {
  careText,
  count,
  scoreAxis,
  decimalText,
  sigmaAxis,
  statText,
  timeAxis,
  timeBins,
  weeklyAxis,
  type BarRow,
  type BoxRow,
  type DotRow,
  type InsightCard,
  type Topic,
  type WeekPoint
} from '../../domain/insights';
import {
  mean,
  pooledStandardDeviation,
  quartiles,
  range,
  standardDeviation
} from '../../domain/statistics';
import type { ShotFact } from './facts';
import { runQuery, type InsightQuery, type QueryGroup } from './query';
import type { DimensionContext } from './registry';

/** What cards need beyond the shots: the weeks to draw and the bean on Home with its best recipe. */
export type InsightContext = {
  /** The Mondays of the last 12 weeks, oldest first, ending with this week. */
  weeks: string[];
  /** The bean on Home; null when there is none. */
  homeBean: { id: string; name: string } | null;
  /** Its best recipe, titled as on Home ("Grind 1.6 · 18.0 g → 36.0 g"); null without a rated shot. */
  bestRecipe: { id: string; title: string } | null;
};

export type InsightDefinition = {
  id: string;
  topic: Topic;
  query: InsightQuery | ((context: InsightContext) => InsightQuery);
  evaluate: (groups: QueryGroup[], context: InsightContext) => Omit<InsightCard, 'id' | 'topic'>;
};

/** Score by process and by origin need 2 groups with 5 rated shots each. */
const GROUP_MINIMUM = 5;
const GROUPS_NEEDED = 2;
/** Medians (process) and averages (origin) within 0.5 points are "no clear difference". */
const CLEAR_POINTS = 0.5;
/** A σ within 0.2 (seconds for routines, points for beans) is "no clear difference". */
const CLEAR_SIGMA = 0.2;

/** "Naturals are your thing": a process as people say it about their coffees. */
const PROCESS_PLURAL: Record<string, string> = {
  Natural: 'Naturals',
  Washed: 'Washed coffees',
  Honey: 'Honey coffees',
  Anaerobic: 'Anaerobic coffees',
  Other: 'Other processes'
};

/**
 * What a card says while it lacks data: with one group ready, how many more rated shots
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
    // Amber marks a winner only when there is one.
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

/** The weekly line needs 4 weeks with 2 rated shots each; a thinner week is a gap. */
const WEEKS_NEEDED = 4;
const WEEK_MINIMUM = 2;

const weeklyScore: InsightDefinition = {
  id: 'weekly-score',
  topic: 'progress',
  query: { measure: 'score', groupBy: 'week', filters: { ratedOnly: true } },
  evaluate(groups, { weeks }) {
    const byWeek = new Map(groups.map((g) => [g.key, g.values]));
    const points: WeekPoint[] = weeks.map((week) => {
      const values = byWeek.get(week) ?? [];
      if (values.length < WEEK_MINIMUM) return { week, stats: null };
      return {
        week,
        stats: { mean: mean(values)!, sigma: standardDeviation(values)!, n: values.length }
      };
    });
    const drawn = points.flatMap((p, i) => (p.stats ? [{ i, ...p.stats }] : []));
    if (drawn.length < WEEKS_NEEDED) {
      const more = WEEKS_NEEDED - drawn.length;
      return {
        title: 'Weekly average score',
        sentence: `Rate ${WEEK_MINIMUM} shots a week for ${count(more, 'more week')} to see your progress.`,
        chart: null,
        basis: null
      };
    }
    const first = drawn[0];
    const last = drawn[drawn.length - 1];
    const span = last.i - first.i + 1;
    const change = last.mean - first.mean;
    const up = change > CLEAR_POINTS;
    const down = change < -CLEAR_POINTS;
    const steadier = last.sigma < first.sigma - CLEAR_SIGMA;
    const wider = last.sigma > first.sigma + CLEAR_SIGMA;
    const points_ = (v: number) => `${statText(v)} ${statText(v) === '1' ? 'point' : 'points'}`;
    const level = up
      ? `Up ${points_(change)} in ${span} weeks`
      : down
        ? `Down ${points_(-change)} in ${span} weeks`
        : `About the same score over ${span} weeks`;
    const sigmas = `σ went from ${statText(first.sigma)} to ${statText(last.sigma)}`;
    const spread = steadier
      ? `, and your spread ${last.sigma <= first.sigma / 2 ? 'halved' : 'narrowed'}: ${sigmas}.`
      : wider
        ? `, and your spread widened: ${sigmas}.`
        : `, and your spread stayed about the same.`;
    return {
      title: up
        ? steadier
          ? 'Better and steadier'
          : 'Getting better'
        : down
          ? 'Scores are slipping'
          : steadier
            ? 'Steadier, not higher'
            : 'Holding steady',
      sentence: level + spread,
      chart: {
        kind: 'weekly',
        measure: 'Score',
        points,
        axis: weeklyAxis(Math.min(...drawn.map((p) => p.mean - p.sigma))),
        first: `${weeks.length} weeks ago`,
        last: 'This week'
      },
      basis: 'Weekly average score · shaded band = ± 1 standard deviation'
    };
  }
};

/** The bell curve needs 10 shots with a time on the recipe. */
const TIMED_MINIMUM = 10;
/** Up to this σ a recipe's shot time counts as under control (a drafted number for the card titles). */
const STEADY_SECONDS = 1.5;

const shotTimeBell: InsightDefinition = {
  id: 'shot-time',
  topic: 'dial-in',
  // Without a best recipe no shot matches, and the card says what it needs.
  query: ({ bestRecipe }) => ({ measure: 'time', filters: { recipeId: bestRecipe?.id ?? '' } }),
  evaluate(groups, { homeBean, bestRecipe }) {
    const values = groups[0]?.values ?? [];
    const needs = (sentence: string) => ({
      title: 'Shot time',
      sentence,
      chart: null,
      basis: null
    });
    if (!homeBean) return needs('Add a bean on Home to see the shot times of its best recipe.');
    if (!bestRecipe)
      return needs(`Rate a shot of ${homeBean.name} to find its best recipe and its shot times.`);
    if (values.length < TIMED_MINIMUM)
      return needs(
        `Brew ${count(TIMED_MINIMUM - values.length, 'more shot')} of your best ${homeBean.name} recipe ` +
          'to see its shot times.'
      );
    const mu = mean(values)!;
    const sigma = standardDeviation(values)!;
    return {
      title: sigma <= STEADY_SECONDS ? 'Your shot time is under control' : 'Your shot time wanders',
      sentence:
        `On your best ${homeBean.name} recipe, 2 in 3 shots land between ` +
        `${decimalText(mu - sigma)} and ${decimalText(mu + sigma)} s.`,
      chart: {
        kind: 'bell',
        measure: 'Shot time',
        unit: 's',
        mean: mu,
        sigma,
        n: values.length,
        ...timeBins(values)
      },
      basis: [
        'Shot time',
        homeBean.name,
        bestRecipe.title,
        count(values.length, 'shot'),
        `μ ${decimalText(mu)} s`,
        `σ ${decimalText(sigma)} s`
      ].join(' · ')
    };
  }
};

/** "Daily routine", "Light roast routine": a routine's name as said in a sentence. */
const routineName = (name: string) => (/routine$/i.test(name) ? name : `${name} routine`);

const routineTime: InsightDefinition = {
  id: 'routine-time',
  topic: 'comparisons',
  query: ({ homeBean }) => ({
    measure: 'time',
    groupBy: 'routine',
    filters: { beanId: homeBean?.id ?? '' },
    holdConstant: 'recipe-apart-from-routine'
  }),
  evaluate(groups, { homeBean }) {
    // Only recipes brewed with more than one of the compared routines hold everything else
    // equal. A routine with too few such shots drops out, which can leave others with too few:
    // repeat until the routines compared stay the same. The first round says what is missing.
    const comparedAmong = (active: ReadonlySet<string>) => {
      const routinesPer = new Map<string, number>();
      for (const g of groups)
        if (active.has(g.key))
          for (const key of g.heldKeys) routinesPer.set(key, (routinesPer.get(key) ?? 0) + 1);
      return groups.map((g) => {
        const strata = g.held.filter((_, i) => {
          const routines = routinesPer.get(g.heldKeys[i]) ?? 0;
          return (active.has(g.key) ? routines - 1 : routines) > 0;
        });
        return { key: g.key, label: g.label, strata, values: strata.flat() };
      });
    };
    const compared = comparedAmong(new Set(groups.map((g) => g.key)));
    let ready = compared.filter((g) => g.values.length >= GROUP_MINIMUM);
    for (;;) {
      const again = comparedAmong(new Set(ready.map((g) => g.key))).filter(
        (g) => ready.some((r) => r.key === g.key) && g.values.length >= GROUP_MINIMUM
      );
      const settled = again.length === ready.length;
      ready = again;
      if (settled) break;
    }
    if (!homeBean || ready.length < GROUPS_NEEDED) {
      const next = compared
        .filter((g) => g.values.length < GROUP_MINIMUM)
        .sort((a, b) => b.values.length - a.values.length)[0];
      const need = GROUP_MINIMUM - (next?.values.length ?? 0);
      return {
        title: 'Shot time by routine',
        sentence: !homeBean
          ? 'Add a bean on Home to compare your routines on it.'
          : compared.every((g) => g.values.length < GROUP_MINIMUM)
            ? `Brew ${GROUP_MINIMUM} shots of ${homeBean.name} with each of two routines, the rest of the recipe the same, to compare.`
            : `Brew ${count(need, 'more shot')} of ${homeBean.name} with another routine, the rest of the recipe the same, to compare.`,
        chart: null,
        basis: null
      };
    }
    const rows: DotRow[] = ready
      .map((g) => ({
        label: g.label,
        n: g.values.length,
        mean: mean(g.values)!,
        sigma: pooledStandardDeviation(g.strata)!,
        top: false
      }))
      .sort((a, b) => a.sigma - b.sigma || b.n - a.n);
    const [top, second] = rows;
    const clear = second.sigma - top.sigma > CLEAR_SIGMA;
    top.top = clear;
    return {
      title: clear
        ? `${routineName(top.label)} is ${rows.length === 2 ? 'more' : 'the most'} repeatable`
        : 'No clear difference between routines',
      sentence: clear
        ? `Same bean, same recipe: your shot time wanders less with the ${routineName(top.label)}.`
        : 'Same bean, same recipe: your shot time wanders about as much with each routine.',
      chart: {
        kind: 'mean-sigma',
        measure: 'Shot time',
        unit: 's',
        rows,
        axis: timeAxis(
          Math.min(...rows.map((r) => r.mean - r.sigma)),
          Math.max(...rows.map((r) => r.mean + r.sigma))
        )
      },
      basis: [`${homeBean.name} only · average shot time ± 1 standard deviation`, careText(rows)]
        .filter((p) => p !== null)
        .join(' · ')
    };
  }
};

/** Screen 25 draws the four steadiest beans. */
const BEANS_SHOWN = 4;

const consistentBeans: InsightDefinition = {
  id: 'consistent-beans',
  topic: 'comparisons',
  query: {
    measure: 'score',
    groupBy: 'bean',
    filters: { ratedOnly: true, reusedRecipesOnly: true },
    holdConstant: 'recipe'
  },
  evaluate(groups) {
    const scored = groups
      .map((g) => ({ label: g.label, n: g.values.length, sigma: pooledStandardDeviation(g.held) }))
      .filter((g) => g.n >= GROUP_MINIMUM && g.sigma !== null);
    if (scored.length < GROUPS_NEEDED) {
      const next = groups
        .filter((g) => g.values.length < GROUP_MINIMUM)
        .sort((a, b) => b.values.length - a.values.length)[0];
      return {
        title: 'Most consistent beans',
        sentence:
          scored.length === 0 || !next
            ? `Rate ${GROUP_MINIMUM} shots each of two beans on recipes you reuse to compare.`
            : `Rate ${count(GROUP_MINIMUM - next.values.length, 'more shot')} of ${next.label} on a recipe you reuse to compare.`,
        chart: null,
        basis: null
      };
    }
    const rows: BarRow[] = scored
      .map((g) => ({ label: g.label, n: g.n, sigma: g.sigma!, top: false }))
      .sort((a, b) => a.sigma - b.sigma || b.n - a.n)
      .slice(0, BEANS_SHOWN);
    const [top, second] = rows;
    const clear = second.sigma - top.sigma > CLEAR_SIGMA;
    top.top = clear;
    return {
      title: clear ? 'Most consistent beans' : 'No bean is clearly steadier',
      sentence: clear
        ? 'Lower is steadier. Spread of scores once you found a recipe you reused.'
        : 'Lower is steadier. Your steadiest beans are within 0.2 points of each other.',
      chart: {
        kind: 'sigma-bars',
        measure: 'Score',
        rows,
        axis: sigmaAxis(Math.max(...rows.map((r) => r.sigma)))
      },
      basis: ['Standard deviation of score · reused recipes only', careText(rows)]
        .filter((p) => p !== null)
        .join(' · ')
    };
  }
};

export const INSIGHTS: readonly InsightDefinition[] = [
  scoreByProcess,
  scoreByOrigin,
  weeklyScore,
  shotTimeBell,
  routineTime,
  consistentBeans
];

/** Every card, in the order of the registry above, from the account's shot facts. */
export function evaluateInsights(
  facts: readonly ShotFact[],
  dimensions: DimensionContext,
  context: InsightContext,
  definitions: readonly InsightDefinition[] = INSIGHTS
): InsightCard[] {
  return definitions.map((d) => ({
    id: d.id,
    topic: d.topic,
    ...d.evaluate(
      runQuery(facts, typeof d.query === 'function' ? d.query(context) : d.query, dimensions),
      context
    )
  }));
}
