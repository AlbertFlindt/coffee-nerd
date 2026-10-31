import { describe, expect, it } from 'vitest';
import {
  altitudeText,
  bestScoreText,
  beanIdentity,
  gramsLeft,
  gramsLeftText,
  localDate,
  originLine,
  parseAltitude,
  ratio,
  roastDateText,
  roastAgeDays,
  shouldAutoFinish
} from './bean';

describe('ratio', () => {
  it('yield divided by dose, in thousandths', () => {
    expect(ratio(38500, 18000)).toBe(2139);
    expect(ratio(36000, 18000)).toBe(2000);
  });

  it('no ratio without a dose or a yield', () => {
    expect(ratio(36000, 0)).toBeNull();
    expect(ratio(null, 18000)).toBeNull();
  });
});

describe('localDate and roastAgeDays', () => {
  const copenhagen = 'Europe/Copenhagen';

  it('the calendar day depends on the user’s time zone', () => {
    const lateEvening = Date.UTC(2026, 9, 16, 22, 30); // 00:30 on 17 Oct in Copenhagen
    expect(localDate(lateEvening, copenhagen)).toBe('2026-10-17');
    expect(localDate(lateEvening, 'UTC')).toBe('2026-10-16');
  });

  it('roast age counts calendar days since roasting; roast day is day 0', () => {
    expect(roastAgeDays('2026-10-04', Date.UTC(2026, 9, 16, 6, 0), copenhagen)).toBe(12);
    expect(roastAgeDays('2026-10-16', Date.UTC(2026, 9, 16, 6, 0), copenhagen)).toBe(0);
  });

  it('a shot just after local midnight already counts the new day', () => {
    expect(roastAgeDays('2026-10-04', Date.UTC(2026, 9, 16, 22, 30), copenhagen)).toBe(13);
  });

  it('daylight saving changes do not shift the count', () => {
    // Clocks go back in Copenhagen on 25 Oct 2026.
    expect(roastAgeDays('2026-10-20', Date.UTC(2026, 9, 30, 8, 0), copenhagen)).toBe(10);
  });
});

describe('gramsLeft and shouldAutoFinish', () => {
  it('grams left is the bag weight minus every shot’s dose', () => {
    expect(gramsLeft(250000, [18000, 18000, 18500])).toBe(195500);
  });

  it('without a bag weight, grams are not shown', () => {
    expect(gramsLeft(null, [18000])).toBeNull();
  });

  it('grams left never shows below zero', () => {
    expect(gramsLeft(30000, [18000, 18000])).toBe(0);
  });

  it('the bean finishes automatically when a shot makes the doses reach the bag weight', () => {
    expect(shouldAutoFinish(36000, [18000], 18000)).toBe(true);
    expect(shouldAutoFinish(36000, [18000], 18500)).toBe(true);
    expect(shouldAutoFinish(36000, [], 18000)).toBe(false);
  });

  it('after an undo or reopening, the next shot does not finish the bean again', () => {
    expect(shouldAutoFinish(36000, [18000, 18000], 18000)).toBe(false);
  });

  it('never automatically without a bag weight, or with a bag weight of 0', () => {
    expect(shouldAutoFinish(null, [18000], 18000)).toBe(false);
    expect(shouldAutoFinish(0, [], 18000)).toBe(false);
  });
});

describe('bestScoreText', () => {
  it('the best recipe’s average with one decimal once it has 3 rated shots', () => {
    expect(bestScoreText({ recipeId: 'r', basis: 'average', score: 23 / 3, ratedShots: 3 })).toBe(
      '7.7'
    );
    expect(bestScoreText({ recipeId: 'r', basis: 'average', score: 8, ratedShots: 4 })).toBe('8.0');
  });

  it('otherwise its highest single score, a whole number', () => {
    expect(bestScoreText({ recipeId: 'r', basis: 'single', score: 8, ratedShots: 1 })).toBe('8');
  });

  it('no rated shot, no best score', () => {
    expect(bestScoreText(null)).toBeNull();
  });
});

describe('gramsLeftText', () => {
  it('grams left in whole grams', () => {
    expect(gramsLeftText(120000)).toBe('120 g left');
    expect(gramsLeftText(0)).toBe('0 g left');
  });

  it('nothing without a bag weight', () => {
    expect(gramsLeftText(null)).toBeNull();
  });
});

describe('originLine', () => {
  it('roaster · country · process, leaving out what is not set', () => {
    expect(originLine({ roaster: 'Nordlys Roasters', countryCode: 'ET', process: 'natural' })).toBe(
      'Nordlys Roasters · Ethiopia · Natural'
    );
    expect(originLine({ roaster: null, countryCode: null, process: 'washed' })).toBe('Washed');
    expect(originLine({ roaster: null, countryCode: null, process: null })).toBe('');
  });
});

describe('parseAltitude', () => {
  it('a range in metres, with or without thousands separators and unit', () => {
    expect(parseAltitude('1,900–2,100 m')).toEqual({ min: 1900, max: 2100 });
    expect(parseAltitude('1900-2100')).toEqual({ min: 1900, max: 2100 });
  });

  it('one value fills both', () => {
    expect(parseAltitude('1850 m')).toEqual({ min: 1850, max: 1850 });
  });

  it('empty is not set; anything else is a problem', () => {
    expect(parseAltitude('  ')).toBeNull();
    expect(parseAltitude('high')).toBe('invalid');
    expect(parseAltitude('2100–1900')).toBe('invalid');
    expect(parseAltitude('0')).toBe('invalid');
  });
});

describe('altitudeText', () => {
  it('a range or a single height, with thousands separators', () => {
    expect(altitudeText(1900, 2100)).toBe('1,900–2,100 m');
    expect(altitudeText(1850, 1850)).toBe('1,850 m');
    expect(altitudeText(null, null)).toBeNull();
  });
});

describe('roastDateText', () => {
  it('the date and how long ago it was', () => {
    expect(roastDateText('2026-10-14', '2026-10-16')).toEqual({
      date: '14 Oct',
      ago: '2 days ago'
    });
    expect(roastDateText('2026-10-15', '2026-10-16')).toEqual({ date: '15 Oct', ago: 'Yesterday' });
    expect(roastDateText('2026-10-16', '2026-10-16')).toEqual({ date: '16 Oct', ago: 'Today' });
  });

  it('a date in another year names the year', () => {
    expect(roastDateText('2025-12-30', '2026-01-02').date).toBe('30 Dec 2025');
  });
});

describe('beanIdentity', () => {
  it('bags with the same name and roaster are one bean, ignoring case and spaces', () => {
    expect(beanIdentity('Guji Hambela', 'Nordlys Roasters')).toBe(
      beanIdentity(' guji hambela', 'NORDLYS ROASTERS ')
    );
    expect(beanIdentity('Guji Hambela', null)).toBe(beanIdentity('Guji Hambela', null));
  });

  it('another roaster, or none, makes another bean', () => {
    expect(beanIdentity('Guji Hambela', 'Nordlys Roasters')).not.toBe(
      beanIdentity('Guji Hambela', 'Prolog')
    );
    expect(beanIdentity('Guji Hambela', 'Nordlys Roasters')).not.toBe(
      beanIdentity('Guji Hambela', null)
    );
    expect(beanIdentity('Guji Hambela', '')).toBe(beanIdentity('Guji Hambela', null));
  });
});
