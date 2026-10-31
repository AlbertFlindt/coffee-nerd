import { describe, expect, it } from 'vitest';
import {
  bestScoreOutOfTen,
  dialInProgress,
  freshnessDetail,
  lastShotValues,
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
