import { describe, expect, it } from 'vitest';
import {
  bestScoreOutOfTen,
  dialInProgress,
  freshnessDetail,
  HOME_GRAPHS,
  homeGraphId,
  lastShotValues,
  recipeConsistency,
  ROAST_AGE_RANGES,
  scoreByRoastAge,
  timeVsYield,
  thisWeek,
  thisWeekText
} from './home';

const copenhagen = 'Europe/Copenhagen';
// Saturday 17 Oct 2026, 09:00 in Copenhagen.
const now = Date.UTC(2026, 9, 17, 7, 0);
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour, minute);

describe('thisWeek', () => {
  it('counts the shots since Monday in the user’s time zone, their average and how many are rated', () => {
    const shots = [
      { brewedAt: at(17, 5), score: 8 },
      { brewedAt: at(15, 6), score: null },
      { brewedAt: at(11, 22, 30), score: 7 }, // Monday 00:30 local, still this week
      { brewedAt: at(11, 21, 30), score: 2 } // Sunday 23:30 local, last week
    ];
    expect(thisWeek(shots, now, copenhagen)).toEqual({ shots: 3, rated: 2, average: 7.5 });
  });

  it('no rated shot gives no average, never 0', () => {
    expect(thisWeek([{ brewedAt: at(17, 5), score: null }], now, copenhagen)).toEqual({
      shots: 1,
      rated: 0,
      average: null
    });
  });
});

describe('thisWeekText', () => {
  it('"9 shots" with "avg 7.2 · 8 of 9 rated"', () => {
    expect(thisWeekText({ shots: 9, rated: 8, average: 7.24 })).toEqual({
      value: '9 shots',
      detail: 'avg 7.2 · 8 of 9 rated'
    });
  });

  it('without a rated shot there is no average', () => {
    expect(thisWeekText({ shots: 1, rated: 0, average: null })).toEqual({
      value: '1 shot',
      detail: '0 of 1 rated'
    });
  });

  it('a week without shots says only "0 shots"', () => {
    expect(thisWeekText({ shots: 0, rated: 0, average: null })).toEqual({
      value: '0 shots',
      detail: null
    });
  });
});

describe('bestScoreOutOfTen', () => {
  it('the average with one decimal', () => {
    expect(bestScoreOutOfTen({ recipeId: 'r', score: 23 / 3, ratedShots: 3 })).toBe('7.7 / 10');
  });

  it('with one rated shot, its score', () => {
    expect(bestScoreOutOfTen({ recipeId: 'r', score: 8, ratedShots: 1 })).toBe('8 / 10');
  });
});

describe('freshnessDetail', () => {
  it('"since roast"', () => {
    expect(freshnessDetail(null)).toBe('since roast');
  });

  it('grams left only when a bag weight was entered', () => {
    expect(freshnessDetail('120 g left')).toBe('since roast · 120 g left');
  });
});

describe('lastShotValues', () => {
  const steps = { grind: 100, dose: 100, yield: 100, time: 1000 };
  const shot = { grind: 1600, dose: 18000, yield: 38500, time: 25500, balance: -2 };
  const labels = (v: ReturnType<typeof lastShotValues>) => ({
    left: v.left.map((x) => x.label),
    right: v.right.map((x) => x.label)
  });

  it('grind, in and ratio on the left; time, out and taste on the right', () => {
    expect(lastShotValues(shot, steps)).toEqual({
      left: [
        { label: 'Grind', value: '1.6' },
        { label: 'In', value: '18.0 g' },
        { label: 'Ratio', value: '1 : 2.1' }
      ],
      right: [
        { label: 'Time', value: '25.5 s' },
        { label: 'Out', value: '38.5 g' },
        { label: 'Taste', value: 'Slightly sour' }
      ]
    });
  });

  it('without a time, the right column closes up and the left one stays', () => {
    expect(labels(lastShotValues({ ...shot, time: null }, steps))).toEqual({
      left: ['Grind', 'In', 'Ratio'],
      right: ['Out', 'Taste']
    });
  });

  it('a missing yield, time or balance is left out', () => {
    expect(
      labels(lastShotValues({ ...shot, yield: null, time: null, balance: null }, steps))
    ).toEqual({ left: ['Grind', 'In'], right: [] });
  });
});

describe('dialInProgress', () => {
  let n = 0;
  const shot = (score: number | null, recipeId = 'a') => ({
    shotId: `shot-${++n}`,
    score,
    recipeId
  });

  it('the last 12 rated shots, oldest first; unrated shots are left out, never 0', () => {
    const newestFirst = [
      shot(7),
      shot(null),
      ...Array.from({ length: 12 }, (_, i) => shot(i % 2 === 0 ? 6 : 8))
    ];
    const graph = dialInProgress(newestFirst)!;
    expect(graph.points).toHaveLength(12);
    expect(graph.points.at(-1)!.score).toBe(7);
    expect(graph.points.every((p) => p.score > 0)).toBe(true);
  });

  it('a recipe change is marked on the first shot drawn of the new recipe', () => {
    const graph = dialInProgress([shot(8, 'b'), shot(7, 'b'), shot(6, 'a'), shot(5, 'a')])!;
    expect(graph.points.map((p) => p.newRecipe)).toEqual([false, false, true, false]);
  });

  it('compared with the shot drawn before it, so an unrated shot of another recipe in between marks nothing', () => {
    const graph = dialInProgress([shot(8, 'a'), shot(null, 'b'), shot(6, 'a')])!;
    expect(graph.points.map((p) => p.newRecipe)).toEqual([false, false]);
  });

  it('each point knows its shot, so tapping it can open that shot', () => {
    const newestFirst = [shot(8), shot(null), shot(6)];
    const graph = dialInProgress(newestFirst)!;
    expect(graph.points.map((p) => p.shotId)).toEqual([
      newestFirst[2].shotId,
      newestFirst[0].shotId
    ]);
  });

  it('fewer than 2 rated shots give no graph', () => {
    expect(dialInProgress([shot(8), shot(null)])).toBeNull();
  });

  it('three whole-number grid lines around the scores, within 0 to 10', () => {
    expect(dialInProgress([shot(8), shot(5)])!.ticks).toEqual([5, 7, 9]);
    expect(dialInProgress([shot(10), shot(10)])!.ticks).toEqual([8, 9, 10]);
    expect(dialInProgress([shot(10), shot(1)])!.ticks).toEqual([0, 5, 10]);
  });
});

describe('homeGraphId', () => {
  it('the four graphs in the order of the chip row', () => {
    expect(HOME_GRAPHS.map((g) => g.label)).toEqual([
      'Dial-in',
      'Time vs. yield',
      'Roast age',
      'Consistency'
    ]);
  });

  it('opens on the graph chosen last, and on Dial-in when none or an unknown one is stored', () => {
    expect(homeGraphId('roast-age')).toBe('roast-age');
    expect(homeGraphId(null)).toBe('dial-in');
    expect(homeGraphId('pie')).toBe('dial-in');
  });
});

describe('timeVsYield', () => {
  let n = 0;
  const shot = (time: number | null, yieldG: number | null, score: number | null = null) => ({
    shotId: `shot-${++n}`,
    time: time === null ? null : time * 1000,
    yield: yieldG === null ? null : yieldG * 1000,
    score
  });

  it('the last 30 shots with a time and a yield, oldest first, in seconds and grams', () => {
    const newestFirst = [
      shot(28.5, 36.2),
      shot(null, 36),
      shot(27, null),
      ...Array.from({ length: 40 }, () => shot(25, 40))
    ];
    const graph = timeVsYield(newestFirst)!;
    expect(graph.points).toHaveLength(30);
    expect(graph.points.at(-1)).toMatchObject({ time: 28.5, yield: 36.2 });
  });

  it('shots scored 8 or more are the liked ones; unrated shots are not', () => {
    const graph = timeVsYield([shot(28, 36, 8), shot(27, 35, 7), shot(26, 34, null)])!;
    expect(graph.points.map((p) => p.liked)).toEqual([false, false, true]);
  });

  it('each point knows its shot, so tapping it can open that shot', () => {
    const newestFirst = [shot(28, 36), shot(27, 35)];
    expect(timeVsYield(newestFirst)!.points.map((p) => p.shotId)).toEqual([
      newestFirst[1].shotId,
      newestFirst[0].shotId
    ]);
  });

  it('fewer than 2 shots with a time and a yield give no graph', () => {
    expect(timeVsYield([shot(28, 36), shot(null, 36)])).toBeNull();
  });

  it('axes on round numbers around the values, with at most 7 labels each', () => {
    const graph = timeVsYield([shot(24.5, 33), shot(31, 41.5)])!;
    expect(graph.time).toEqual({ from: 24, to: 32, ticks: [24, 26, 28, 30, 32], unit: 's' });
    expect(graph.yield).toEqual({ from: 32, to: 42, ticks: [32, 34, 36, 38, 40, 42], unit: 'g' });
  });

  it('an axis has room even when every shot has the same value', () => {
    const graph = timeVsYield([shot(28, 36), shot(28, 36)])!;
    expect(graph.time.from).toBeLessThan(28);
    expect(graph.time.to).toBeGreaterThan(28);
  });
});

describe('scoreByRoastAge', () => {
  const shots = (days: number, ...scores: (number | null)[]) =>
    scores.map((score) => ({ roastAgeDays: days, score }));

  it('ranges of whole weeks since roast, the last one open', () => {
    expect(ROAST_AGE_RANGES.map((r) => r.label)).toEqual([
      '0–6 days',
      '7–13 days',
      '14–20 days',
      '21–27 days',
      '28+ days'
    ]);
  });

  it('average score ± 1 standard deviation per range, in range order', () => {
    const chart = scoreByRoastAge([...shots(9, 8, 6), ...shots(3, 5, 7), ...shots(30, 6, 8, 7)])!;
    expect(chart.rows.map((r) => [r.label, r.n, r.mean])).toEqual([
      ['0–6 days', 2, 6],
      ['7–13 days', 2, 7],
      ['28+ days', 3, 7]
    ]);
    expect(chart.rows[0].sigma).toBeCloseTo(Math.SQRT2);
  });

  it('a range needs 2 rated shots; unrated shots count for nothing, never as 0', () => {
    const chart = scoreByRoastAge([...shots(2, 7, null), ...shots(8, 6, 7), ...shots(15, 8, 9)])!;
    expect(chart.rows.map((r) => r.label)).toEqual(['7–13 days', '14–20 days']);
  });

  it('fewer than 2 ranges to compare give no chart', () => {
    expect(scoreByRoastAge([...shots(8, 6, 7), ...shots(15, 8)])).toBeNull();
  });

  it('the best range is amber only when it leads by more than half a point', () => {
    const clear = scoreByRoastAge([...shots(8, 6, 7), ...shots(15, 8, 9)])!;
    expect(clear.rows.map((r) => r.top)).toEqual([false, true]);
    const close = scoreByRoastAge([...shots(8, 8, 8), ...shots(15, 8, 9)])!;
    expect(close.rows.map((r) => r.top)).toEqual([false, false]);
  });

  it('a score axis to 10 with room for the whiskers', () => {
    const chart = scoreByRoastAge([...shots(8, 6, 7), ...shots(15, 8, 9)])!;
    expect(chart.axis.to).toBe(10);
    expect(chart.axis.from).toBeLessThanOrEqual(6.5 - Math.SQRT1_2);
  });
});

describe('recipeConsistency', () => {
  const recipe = (label: string, seconds: number[], best = false) => ({
    label,
    times: seconds.map((s) => s * 1000),
    best
  });

  it('shot time ± 1 standard deviation per recipe brewed 3 times or more', () => {
    const chart = recipeConsistency([
      recipe('1.6 · 18.0 g', [27, 28, 29]),
      recipe('1.8 · 18.0 g', [30, 31])
    ])!;
    expect(chart.rows).toEqual([{ label: '1.6 · 18.0 g', n: 3, mean: 28, sigma: 1, top: false }]);
    expect(chart.axis.unit).toBe('s');
  });

  it('the 4 recipes with the most shots, most first; the best recipe is amber', () => {
    const chart = recipeConsistency([
      recipe('a', [28, 28, 29]),
      recipe('b', [28, 28, 29, 30, 30], true),
      recipe('c', [28, 28, 29, 30]),
      recipe('d', [28, 28, 29, 30]),
      recipe('e', [28, 28, 29, 30, 30, 31])
    ])!;
    expect(chart.rows.map((r) => r.label)).toEqual(['e', 'b', 'c', 'd']);
    expect(chart.rows.map((r) => r.top)).toEqual([false, true, false, false]);
  });

  it('recipes that read the same are told apart, so each row has its own name', () => {
    const chart = recipeConsistency([
      recipe('1.6 · 18.0 g', [27, 28, 29]),
      recipe('1.6 · 18.0 g', [27, 28, 29])
    ])!;
    expect(chart.rows.map((r) => r.label)).toEqual(['1.6 · 18.0 g', '1.6 · 18.0 g (2)']);
  });

  it('no recipe brewed 3 times with a time gives no chart', () => {
    expect(recipeConsistency([recipe('a', [27, 28])])).toBeNull();
  });
});
