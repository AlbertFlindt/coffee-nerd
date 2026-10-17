import { describe, expect, it } from 'vitest';
import {
  clockTime,
  coreValuesText,
  dayLabel,
  groupByDay,
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
  it('D-54: shots are grouped under Today, Yesterday, then dates', () => {
    expect(dayLabel(at(17, 5, 42), now, copenhagen)).toBe('Today');
    expect(dayLabel(at(16, 17, 5), now, copenhagen)).toBe('Yesterday');
    expect(dayLabel(at(13, 5, 38), now, copenhagen)).toBe('Tue 13 Oct');
  });

  it('D-54: the day follows the user’s time zone, not the server’s', () => {
    // 23:30 UTC on 16 Oct is already 17 Oct in Copenhagen.
    expect(dayLabel(at(16, 22, 30), now, copenhagen)).toBe('Today');
    expect(dayLabel(at(16, 22, 30), now, 'UTC')).toBe('Yesterday');
  });

  it('D-54: a date in another year names the year', () => {
    expect(dayLabel(at(30, 8, 0, 11, 2025), now, copenhagen)).toBe('Tue 30 Dec 2025');
  });

  it('D-54: the time of a shot is a 24-hour clock in the user’s time zone', () => {
    expect(clockTime(at(17, 5, 42), copenhagen)).toBe('07:42');
    expect(clockTime(at(16, 17, 5), copenhagen)).toBe('19:05');
  });
});

describe('groupByDay', () => {
  it('D-54: keeps the order it is given (newest first) and starts a group per day', () => {
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

  it('D-54: no shots, no groups', () => {
    expect(groupByDay([], now, copenhagen)).toEqual([]);
  });
});

describe('shotsThisWeek', () => {
  it('D-54: counts the shots since Monday of this week, in the user’s time zone (data-model §1.8)', () => {
    const brewed = [
      at(17, 5), // Saturday
      at(12, 6), // Monday 08:00 local
      at(11, 22, 30), // Monday 00:30 local, still this week
      at(11, 21, 30) // Sunday 23:30 local, last week
    ];
    expect(shotsThisWeek(brewed, now, copenhagen)).toBe(3);
  });

  it('D-54: on a Monday the week has just begun', () => {
    const monday = at(19, 6);
    expect(shotsThisWeek([at(19, 5), at(18, 9)], monday, copenhagen)).toBe(1);
  });
});

describe('coreValuesText', () => {
  const steps = { grind: 100, dose: 100, yield: 100, time: 1000 };

  it('D-54: grind · dose → yield · time, as on the row', () => {
    expect(coreValuesText({ grind: 1600, dose: 18000, yield: 38500, time: 25500 }, steps)).toBe(
      '1.6 · 18.0 → 38.5 g · 25.5 s'
    );
  });

  it('D-07: dose, yield and time keep at least one decimal; grind follows its dial', () => {
    expect(
      coreValuesText(
        { grind: 15000, dose: 18000, yield: 36000, time: 28000 },
        { ...steps, grind: 1000 }
      )
    ).toBe('15 · 18.0 → 36.0 g · 28.0 s');
  });

  it('D-91: a missing yield or time is left out', () => {
    expect(coreValuesText({ grind: 1600, dose: 18000, yield: null, time: 25500 }, steps)).toBe(
      '1.6 · 18.0 g · 25.5 s'
    );
    expect(coreValuesText({ grind: 1600, dose: 18000, yield: 38500, time: null }, steps)).toBe(
      '1.6 · 18.0 → 38.5 g'
    );
  });
});

describe('journalTasteText', () => {
  it('D-54, D-96: the balance in words', () => {
    expect(journalTasteText(7, -2)).toBe('Slightly sour');
    expect(journalTasteText(8, 0)).toBe('Balanced');
  });

  it('D-11: an unrated shot without a balance says "Not rated"', () => {
    expect(journalTasteText(null, null)).toBe('Not rated');
  });

  it('D-11: a rated shot without a balance shows nothing', () => {
    expect(journalTasteText(7, null)).toBe('');
  });
});

describe('roastAgeText', () => {
  it('D-57: roast age at the time of the shot', () => {
    expect(roastAgeText('2026-10-05', at(17, 5, 42), copenhagen)).toBe('12 days since roast');
    expect(roastAgeText('2026-10-16', at(17, 5, 42), copenhagen)).toBe('1 day since roast');
    expect(roastAgeText('2026-10-17', at(17, 5, 42), copenhagen)).toBe('0 days since roast');
  });
});
