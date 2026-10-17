import { describe, expect, it } from 'vitest';
import { gramsLeft, localDate, ratio, roastAgeDays, shouldAutoFinish } from './bean';

describe('ratio', () => {
  it('D-03: yield divided by dose, in thousandths', () => {
    expect(ratio(38500, 18000)).toBe(2139);
    expect(ratio(36000, 18000)).toBe(2000);
  });

  it('D-03: no ratio without a dose or a yield', () => {
    expect(ratio(36000, 0)).toBeNull();
    expect(ratio(null, 18000)).toBeNull();
  });
});

describe('localDate and roastAgeDays', () => {
  const copenhagen = 'Europe/Copenhagen';

  it('D-54: the calendar day depends on the user’s time zone', () => {
    const lateEvening = Date.UTC(2026, 9, 16, 22, 30); // 00:30 on 17 Oct in Copenhagen
    expect(localDate(lateEvening, copenhagen)).toBe('2026-10-17');
    expect(localDate(lateEvening, 'UTC')).toBe('2026-10-16');
  });

  it('D-17: roast age counts calendar days since roasting; roast day is day 0', () => {
    expect(roastAgeDays('2026-10-04', Date.UTC(2026, 9, 16, 6, 0), copenhagen)).toBe(12);
    expect(roastAgeDays('2026-10-16', Date.UTC(2026, 9, 16, 6, 0), copenhagen)).toBe(0);
  });

  it('D-17: a shot just after local midnight already counts the new day', () => {
    expect(roastAgeDays('2026-10-04', Date.UTC(2026, 9, 16, 22, 30), copenhagen)).toBe(13);
  });

  it('D-17: daylight saving changes do not shift the count', () => {
    // Clocks go back in Copenhagen on 25 Oct 2026.
    expect(roastAgeDays('2026-10-20', Date.UTC(2026, 9, 30, 8, 0), copenhagen)).toBe(10);
  });
});

describe('gramsLeft and shouldAutoFinish', () => {
  it('D-35: grams left is the bag weight minus every shot’s dose', () => {
    expect(gramsLeft(250000, [18000, 18000, 18500])).toBe(195500);
  });

  it('D-35: without a bag weight, grams are not shown', () => {
    expect(gramsLeft(null, [18000])).toBeNull();
  });

  it('D-35: grams left never shows below zero', () => {
    expect(gramsLeft(30000, [18000, 18000])).toBe(0);
  });

  it('D-40: the bean finishes automatically when the doses reach the bag weight', () => {
    expect(shouldAutoFinish(36000, [18000, 18000])).toBe(true);
    expect(shouldAutoFinish(36000, [18000, 18500])).toBe(true);
    expect(shouldAutoFinish(36000, [18000])).toBe(false);
  });

  it('D-40: never automatically without a bag weight', () => {
    expect(shouldAutoFinish(null, [18000, 18000])).toBe(false);
  });
});
