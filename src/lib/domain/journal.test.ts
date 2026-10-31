import { describe, expect, it } from 'vitest';
import {
  clockTime,
  compareWithRecipe,
  recipeFilterLabel,
  setupDifferences,
  comparisonText,
  coreValuesText,
  dayLabel,
  groupByDay,
  groupRecipes,
  journalTasteText,
  roastAgeText,
  shotsThisWeek
} from './journal';

const copenhagen = 'Europe/Copenhagen';
// Saturday 17 Oct 2026, 09:00 in Copenhagen.
const now = Date.UTC(2026, 9, 17, 7, 0);
const at = (day: number, hour: number, minute = 0, month = 9, year = 2026) =>
  Date.UTC(year, month, day, hour, minute);

describe('dayLabel and clockTime', () => {
  it('shots are grouped under Today, Yesterday, then dates', () => {
    expect(dayLabel(at(17, 5, 42), now, copenhagen)).toBe('Today');
    expect(dayLabel(at(16, 17, 5), now, copenhagen)).toBe('Yesterday');
    expect(dayLabel(at(13, 5, 38), now, copenhagen)).toBe('Tue 13 Oct');
  });

  it('the day follows the user’s time zone, not the server’s', () => {
    // 23:30 UTC on 16 Oct is already 17 Oct in Copenhagen.
    expect(dayLabel(at(16, 22, 30), now, copenhagen)).toBe('Today');
    expect(dayLabel(at(16, 22, 30), now, 'UTC')).toBe('Yesterday');
  });

  it('a date in another year names the year', () => {
    expect(dayLabel(at(30, 8, 0, 11, 2025), now, copenhagen)).toBe('Tue 30 Dec 2025');
  });

  it('the time of a shot is a 24-hour clock in the user’s time zone', () => {
    expect(clockTime(at(17, 5, 42), copenhagen)).toBe('07:42');
    expect(clockTime(at(16, 17, 5), copenhagen)).toBe('19:05');
  });
});

describe('groupByDay', () => {
  it('keeps the order it is given (newest first) and starts a group per day', () => {
    const shots = [
      { id: 'a', brewedAt: at(17, 5, 42) },
      { id: 'b', brewedAt: at(17, 5, 31) },
      { id: 'c', brewedAt: at(16, 17, 5) },
      { id: 'd', brewedAt: at(13, 5, 38) }
    ];
    expect(
      groupByDay(shots, now, copenhagen).map((g) => [g.label, g.shots.map((s) => s.id)])
    ).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['Tue 13 Oct', ['d']]
    ]);
  });

  it('no shots, no groups', () => {
    expect(groupByDay([], now, copenhagen)).toEqual([]);
  });
});

describe('shotsThisWeek', () => {
  it('counts the shots since Monday of this week, in the user’s time zone (docs/SPEC.md §1.8)', () => {
    const brewed = [
      at(17, 5), // Saturday
      at(12, 6), // Monday 08:00 local
      at(11, 22, 30), // Monday 00:30 local, still this week
      at(11, 21, 30) // Sunday 23:30 local, last week
    ];
    expect(shotsThisWeek(brewed, now, copenhagen)).toBe(3);
  });

  it('on a Monday the week has just begun', () => {
    const monday = at(19, 6);
    expect(shotsThisWeek([at(19, 5), at(18, 9)], monday, copenhagen)).toBe(1);
  });
});

describe('coreValuesText', () => {
  const steps = { grind: 100, dose: 100, yield: 100, time: 1000 };

  it('grind · dose → yield · time, as on the row', () => {
    expect(coreValuesText({ grind: 1600, dose: 18000, yield: 38500, time: 25500 }, steps)).toBe(
      '1.6 · 18.0 → 38.5 g · 25.5 s'
    );
  });

  it('dose, yield and time keep at least one decimal; grind follows its dial', () => {
    expect(
      coreValuesText(
        { grind: 15000, dose: 18000, yield: 36000, time: 28000 },
        { ...steps, grind: 1000 }
      )
    ).toBe('15 · 18.0 → 36.0 g · 28.0 s');
  });

  it('a missing yield or time is left out', () => {
    expect(coreValuesText({ grind: 1600, dose: 18000, yield: null, time: 25500 }, steps)).toBe(
      '1.6 · 18.0 g · 25.5 s'
    );
    expect(coreValuesText({ grind: 1600, dose: 18000, yield: 38500, time: null }, steps)).toBe(
      '1.6 · 18.0 → 38.5 g'
    );
  });
});

describe('journalTasteText', () => {
  it('the balance in words', () => {
    expect(journalTasteText(7, -2)).toBe('Slightly sour');
    expect(journalTasteText(8, 0)).toBe('Balanced');
  });

  it('an unrated shot without a balance says "Not rated"', () => {
    expect(journalTasteText(null, null)).toBe('Not rated');
  });

  it('a rated shot without a balance shows nothing', () => {
    expect(journalTasteText(7, null)).toBe('');
  });
});

describe('roastAgeText', () => {
  it('roast age at the time of the shot', () => {
    expect(roastAgeText('2026-10-05', at(17, 5, 42), copenhagen)).toBe('12 days since roast');
    expect(roastAgeText('2026-10-16', at(17, 5, 42), copenhagen)).toBe('1 day since roast');
    expect(roastAgeText('2026-10-17', at(17, 5, 42), copenhagen)).toBe('0 days since roast');
  });
});

describe('compareWithRecipe', () => {
  it('compares with the recipe’s other shots, not this one', () => {
    // Others: 28.0, 29.0, 26.7 s → μ 27.9 s, σ √1.33 ≈ 1.153 s.
    const result = compareWithRecipe(25500, [28000, 29000, 26700]);
    expect(result.kind).toBe('compared');
    if (result.kind !== 'compared') return;
    expect(result.mean).toBeCloseTo(27900, 6);
    expect(result.sigmas).toBeCloseTo((25500 - 27900) / Math.sqrt(1_330_000), 6);
  });

  it('needs at least two other shots with a value', () => {
    expect(compareWithRecipe(25500, [28000])).toEqual({ kind: 'not-enough' });
    expect(compareWithRecipe(25500, [28000, null])).toEqual({ kind: 'not-enough' });
    expect(compareWithRecipe(25500, [])).toEqual({ kind: 'not-enough' });
  });

  it('a shot without the value has nothing to compare', () => {
    expect(compareWithRecipe(null, [28000, 29000])).toEqual({ kind: 'no-value' });
  });

  it('other shots without spread give an average but no σ', () => {
    expect(compareWithRecipe(25500, [28000, 28000])).toEqual({
      kind: 'compared',
      mean: 28000,
      sigmas: null
    });
  });
});

describe('comparisonText', () => {
  it('within one σ is "Within normal range"', () => {
    expect(comparisonText('time', 0.4)).toBe('Within normal range');
    expect(comparisonText('score', -1)).toBe('Within normal range');
  });

  it('just over one σ, shown as 1.0σ, is still within normal range', () => {
    expect(comparisonText('time', -1.04)).toBe('Within normal range');
    expect(comparisonText('score', 1.05)).toBe('1.1σ higher than usual');
  });

  it('further away, time is faster or slower than usual', () => {
    expect(comparisonText('time', -1.71)).toBe('1.7σ faster than usual');
    expect(comparisonText('time', 2.04)).toBe('2.0σ slower than usual');
  });

  it('further away, score is higher or lower than usual', () => {
    expect(comparisonText('score', 1.25)).toBe('1.3σ higher than usual');
    expect(comparisonText('score', -3)).toBe('3.0σ lower than usual');
  });

  it('without a σ, no sentence', () => {
    expect(comparisonText('time', null)).toBeNull();
  });
});

describe('recipeFilterLabel', () => {
  it('a recipe by its values: grind · dose · routine · shots', () => {
    expect(
      recipeFilterLabel(
        { grind: 1600, dose: 18000, routine: 'Daily routine', shotCount: 3 },
        { grind: 100, dose: 100 }
      )
    ).toBe('1.6 · 18.0 g · Daily routine · 3 shots');
  });

  it('without a routine, and with one shot', () => {
    expect(
      recipeFilterLabel(
        { grind: 15000, dose: 18500, routine: null, shotCount: 1 },
        { grind: 1000, dose: 100 }
      )
    ).toBe('15 · 18.5 g · 1 shot');
  });

  it('the setup values that tell two recipes apart come before the shots', () => {
    expect(
      recipeFilterLabel(
        { grind: 1600, dose: 18000, routine: null, shotCount: 3, differences: ['94 °C'] },
        { grind: 100, dose: 100 }
      )
    ).toBe('1.6 · 18.0 g · 94 °C · 3 shots');
  });
});

describe('setupDifferences', () => {
  const temp = (text: string) => ({ key: 'temperature', text });
  const flat = { key: 'flat_pressure', text: 'Flat 9.0 bar' };

  it('recipes with the same values get the setup values in which they differ', () => {
    expect(
      setupDifferences([
        { values: 'a', setup: [temp('93 °C'), flat] },
        { values: 'a', setup: [temp('94 °C'), flat] },
        { values: 'b', setup: [temp('95 °C'), flat] }
      ])
    ).toEqual([['93 °C'], ['94 °C'], []]);
  });

  it('every differing value, in order; one a recipe lacks is left out for it', () => {
    const paddle = { key: 'paddle', text: 'Paddle Low' };
    expect(
      setupDifferences([
        { values: 'a', setup: [temp('93 °C'), flat, paddle] },
        { values: 'a', setup: [temp('94 °C'), flat] }
      ])
    ).toEqual([['93 °C', 'Paddle Low'], ['94 °C']]);
  });

  it('recipes whose labels differ anyway get nothing added', () => {
    expect(
      setupDifferences([
        { values: 'a', setup: [temp('93 °C')] },
        { values: 'b', setup: [temp('94 °C')] }
      ])
    ).toEqual([[], []]);
  });
});

describe('groupRecipes', () => {
  const r = (id: string, fingerprint: string, dose: number, machineId = 'm1') => ({
    id,
    machineId,
    fingerprint,
    dose
  });

  it('recipes of different bags of one bean with the same setup and dose are one', () => {
    expect(groupRecipes([r('new', 'f1', 18000), r('old', 'f1', 18100)])).toEqual([
      { id: 'new', ids: ['new', 'old'] }
    ]);
  });

  it('another setup, machine or dose further than 0.2 g apart stays apart, in the order given', () => {
    expect(
      groupRecipes([
        r('a', 'f1', 18000),
        r('b', 'f2', 18000),
        r('c', 'f1', 18000, 'm2'),
        r('d', 'f1', 18300),
        r('e', 'f1', 17900)
      ])
    ).toEqual([
      { id: 'a', ids: ['a', 'e'] },
      { id: 'b', ids: ['b'] },
      { id: 'c', ids: ['c'] },
      { id: 'd', ids: ['d'] }
    ]);
  });
});
