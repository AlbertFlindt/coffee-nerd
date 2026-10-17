import { describe, expect, it } from 'vitest';
import {
  applyStep,
  decimalsFor,
  decimalsForStep,
  formatDelta,
  formatNumber,
  formatQuantity,
  formatRatio,
  fromThousandths,
  stepLabel,
  toThousandths
} from './units';

describe('toThousandths', () => {
  it('D-63: decimal quantities become whole thousandths, so equal recipes match exactly (18.0 g → 18000)', () => {
    expect(toThousandths(18)).toBe(18000);
    expect(toThousandths(1.6)).toBe(1600);
    expect(toThousandths('38.5')).toBe(38500);
    expect(toThousandths('0.125')).toBe(125);
  });

  it('D-63: floating-point drift never reaches a stored value', () => {
    expect(toThousandths(0.1 + 0.2)).toBe(300);
    expect(toThousandths(1.1 * 3)).toBe(3300);
  });

  it('D-07: typed text with a comma or spaces is read as a decimal', () => {
    expect(toThousandths('18,5')).toBe(18500);
    expect(toThousandths(' 93 ')).toBe(93000);
    expect(toThousandths('-2.5')).toBe(-2500);
    expect(toThousandths('−2.5')).toBe(-2500);
  });

  it('D-63: more than three decimals round once, half away from zero', () => {
    expect(toThousandths('1.0005')).toBe(1001);
    expect(toThousandths('-1.0005')).toBe(-1001);
    expect(toThousandths(2.0004)).toBe(2000);
  });

  it('D-07: rejects typed text that is not a number', () => {
    for (const bad of ['', 'abc', '1.2.3', '1e3', 'NaN']) {
      expect(() => toThousandths(bad), bad).toThrow();
    }
    expect(() => toThousandths(Number.NaN)).toThrow();
    expect(() => toThousandths(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('D-63: rejects numbers too large to store exactly', () => {
    expect(() => toThousandths('99999999999999.9')).toThrow();
  });
});

describe('fromThousandths', () => {
  it('D-56: converts back for display and charts', () => {
    expect(fromThousandths(18000)).toBe(18);
    expect(fromThousandths(1600)).toBe(1.6);
  });
});

describe('decimalsForStep', () => {
  it('D-07: the step decides how many decimals a value shows', () => {
    expect(decimalsForStep(100)).toBe(1); // 0.1
    expect(decimalsForStep(500)).toBe(1); // 0.5 bar
    expect(decimalsForStep(1000)).toBe(0); // 1 s, 1 °C
    expect(decimalsForStep(50)).toBe(2); // 0.05
    expect(decimalsForStep(1)).toBe(3);
    expect(decimalsForStep(2500)).toBe(1); // 2.5
  });
});

describe('decimalsFor', () => {
  it('D-07, D-16: a value typed off the step grid shows its own decimals, so different recipes never look alike', () => {
    expect(decimalsFor(93500, 1000)).toBe(1); // 93.5 °C with a 1 °C step
    expect(decimalsFor(93000, 1000)).toBe(0);
    expect(decimalsFor(1650, 100)).toBe(2);
    expect(decimalsFor(1600, 100)).toBe(1);
  });
});

describe('formatNumber and formatQuantity', () => {
  it('D-07: decimals must be a whole number from 0 to 3', () => {
    expect(() => formatNumber(1000, 4)).toThrow(RangeError);
    expect(() => formatNumber(1000, -1)).toThrow(RangeError);
    expect(() => formatNumber(1000, 1.5)).toThrow(RangeError);
  });

  it('D-07: values show the same decimals as their step, with the unit after a space', () => {
    expect(formatQuantity(18000, { decimals: 1, unit: 'g' })).toBe('18.0 g');
    expect(formatQuantity(93000, { decimals: 0, unit: '°C' })).toBe('93 °C');
    expect(formatQuantity(9000, { decimals: 1, unit: 'bar' })).toBe('9.0 bar');
    expect(formatQuantity(4000, { decimals: 0, unit: 's' })).toBe('4 s');
    expect(formatQuantity(1600, { decimals: 1 })).toBe('1.6');
  });

  it('D-07: rounds half away from zero when showing fewer decimals', () => {
    expect(formatNumber(25550, 1)).toBe('25.6');
    expect(formatNumber(25549, 1)).toBe('25.5');
    expect(formatNumber(-25550, 1)).toBe('−25.6');
    expect(formatNumber(999, 0)).toBe('1');
    expect(formatNumber(0, 1)).toBe('0.0');
  });

  it('D-15: negative numbers use a real minus sign', () => {
    expect(formatNumber(-500, 1)).toBe('−0.5');
    expect(formatNumber(-400, 0)).toBe('0');
  });
});

describe('formatDelta', () => {
  it('D-15: a change since the last shot shows its sign', () => {
    expect(formatDelta(2500, 1)).toBe('+2.5');
    expect(formatDelta(-100, 1)).toBe('−0.1');
    expect(formatDelta(3000, 1)).toBe('+3.0');
  });

  it('D-15: no change shows no sign', () => {
    expect(formatDelta(0, 1)).toBe('0.0');
    expect(formatDelta(-20, 1)).toBe('0.0');
  });
});

describe('formatRatio', () => {
  it('D-03: the ratio reads "1 : 2.1" with one decimal', () => {
    expect(formatRatio(2139)).toBe('1 : 2.1');
    expect(formatRatio(2000)).toBe('1 : 2.0');
    expect(formatRatio(2050)).toBe('1 : 2.1');
  });
});

describe('stepLabel', () => {
  it('D-07: every −/+ shows its step with the unit', () => {
    expect(stepLabel('+', 100, 'g')).toBe('+ 0.1 g');
    expect(stepLabel('-', 100, 'g')).toBe('− 0.1 g');
    expect(stepLabel('-', 1000, 's')).toBe('− 1 s');
    expect(stepLabel('+', 100)).toBe('+ 0.1');
    expect(stepLabel('+', 500, 'bar')).toBe('+ 0.5 bar');
  });
});

describe('applyStep', () => {
  it('D-07: one tap moves the value by exactly one step', () => {
    expect(applyStep(1600, 100, '+')).toBe(1700);
    expect(applyStep(1600, 100, '-')).toBe(1500);
  });

  it('D-07: a value stays inside its range', () => {
    expect(applyStep(0, 100, '-', { min: 0, max: 16000 })).toBe(0);
    expect(applyStep(16000, 100, '+', { min: 0, max: 16000 })).toBe(16000);
    expect(applyStep(15950, 100, '+', { max: 16000 })).toBe(16000);
  });
});
