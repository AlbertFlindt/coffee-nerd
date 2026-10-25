import { describe, expect, it } from 'vitest';
import { bestScoreOutOfTen, freshnessDetail, lastShotValues, thisWeek, thisWeekText } from './home';

const copenhagen = 'Europe/Copenhagen';
// Saturday 17 Oct 2026, 09:00 in Copenhagen.
const now = Date.UTC(2026, 9, 17, 7, 0);
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour, minute);

describe('thisWeek', () => {
  it('D-194: counts the shots since Monday in the user’s time zone, their average and how many are rated', () => {
    const shots = [
      { brewedAt: at(17, 5), score: 8 },
      { brewedAt: at(15, 6), score: null },
      { brewedAt: at(11, 22, 30), score: 7 }, // Monday 00:30 local, still this week
      { brewedAt: at(11, 21, 30), score: 2 } // Sunday 23:30 local, last week
    ];
    expect(thisWeek(shots, now, copenhagen)).toEqual({ shots: 3, rated: 2, average: 7.5 });
  });

  it('D-11: no rated shot gives no average, never 0', () => {
    expect(thisWeek([{ brewedAt: at(17, 5), score: null }], now, copenhagen)).toEqual({
      shots: 1,
      rated: 0,
      average: null
    });
  });
});

describe('thisWeekText', () => {
  it('D-32: "9 shots" with "avg 7.2 · 8 of 9 rated"', () => {
    expect(thisWeekText({ shots: 9, rated: 8, average: 7.24 })).toEqual({
      value: '9 shots',
      detail: 'avg 7.2 · 8 of 9 rated'
    });
  });

  it('D-11: without a rated shot there is no average', () => {
    expect(thisWeekText({ shots: 1, rated: 0, average: null })).toEqual({
      value: '1 shot',
      detail: '0 of 1 rated'
    });
  });

  it('D-198: a week without shots says only "0 shots"', () => {
    expect(thisWeekText({ shots: 0, rated: 0, average: null })).toEqual({
      value: '0 shots',
      detail: null
    });
  });
});

describe('bestScoreOutOfTen', () => {
  it('D-197, D-135: the average with one decimal once the recipe has 3 rated shots', () => {
    expect(
      bestScoreOutOfTen({ recipeId: 'r', basis: 'average', score: 23 / 3, ratedShots: 3 })
    ).toBe('7.7 / 10');
  });

  it('D-197, D-135: otherwise the highest single score', () => {
    expect(bestScoreOutOfTen({ recipeId: 'r', basis: 'single', score: 8, ratedShots: 2 })).toBe(
      '8 / 10'
    );
  });
});

describe('freshnessDetail', () => {
  it('D-32: "since roast"', () => {
    expect(freshnessDetail(null)).toBe('since roast');
  });

  it('D-35: grams left only when a bag weight was entered', () => {
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

  it('D-32: grind, in and ratio on the left; time, out and taste on the right', () => {
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

  it('D-91: without a time, the right column closes up and the left one stays', () => {
    expect(labels(lastShotValues({ ...shot, time: null }, steps))).toEqual({
      left: ['Grind', 'In', 'Ratio'],
      right: ['Out', 'Taste']
    });
  });

  it('D-91, D-11: a missing yield, time or balance is left out', () => {
    expect(
      labels(lastShotValues({ ...shot, yield: null, time: null, balance: null }, steps))
    ).toEqual({ left: ['Grind', 'In'], right: [] });
  });
});
