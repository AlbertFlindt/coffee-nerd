import { describe, expect, it } from 'vitest';
import {
  count,
  histogram,
  mean,
  median,
  normalCurve,
  pooledStandardDeviation,
  quantile,
  quartiles,
  range,
  sigmaDistance,
  standardDeviation
} from './statistics';

const times = [25.5, 27, 28, 28, 29.5, 31]; // shot times on one recipe

describe('count, mean, range', () => {
  it('D-56: basic summaries of a set of values', () => {
    expect(count(times)).toBe(6);
    expect(mean(times)).toBeCloseTo(28.1667, 4);
    expect(range(times)).toEqual({ min: 25.5, max: 31 });
  });

  it('D-56: no values gives no mean or range, never zero', () => {
    expect(count([])).toBe(0);
    expect(mean([])).toBeNull();
    expect(range([])).toBeNull();
  });
});

describe('standardDeviation', () => {
  it('D-56: σ is the sample standard deviation, divided by n − 1', () => {
    // Σ(x − 5)² = 32 over n − 1 = 7 → √(32/7)
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(32 / 7), 12);
  });

  it('D-56: σ needs at least two values', () => {
    expect(standardDeviation([7])).toBeNull();
    expect(standardDeviation([])).toBeNull();
  });

  it('D-56: identical values have σ 0', () => {
    expect(standardDeviation([8, 8, 8])).toBe(0);
  });

  it('D-56: identical decimal values have σ exactly 0, despite floating-point error', () => {
    expect(standardDeviation(Array(7).fill(1.6))).toBe(0);
    expect(standardDeviation([28.2, 28.2, 28.2])).toBe(0);
  });
});

describe('quantile, median and quartiles (linear interpolation, R-7)', () => {
  it('D-56: the median is the middle value, or the mean of the two middle values', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('D-56: quartiles interpolate between ranks, matching R and Excel QUARTILE.INC', () => {
    // R: quantile(c(1,2,3,4,5,6,7,8,9,10)) → 3.25, 5.5, 7.75
    expect(quartiles([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])).toEqual({ q1: 3.25, median: 5.5, q3: 7.75 });
    expect(quantile([1, 2, 3, 4], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4], 1)).toBe(4);
  });

  it('D-56: one value is its own median and quartiles; none gives null', () => {
    expect(quartiles([7])).toEqual({ q1: 7, median: 7, q3: 7 });
    expect(quartiles([])).toBeNull();
    expect(median([])).toBeNull();
  });

  it('D-56: does not reorder the caller’s values', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });

  it('D-56: rejects a probability outside 0–1', () => {
    expect(() => quantile([1, 2], 1.5)).toThrow();
  });
});

describe('histogram', () => {
  it('D-56: counts values into bins of the given width, aligned to multiples of it', () => {
    expect(histogram(times, { binWidth: 2 })).toEqual([
      { from: 24, to: 26, count: 1 },
      { from: 26, to: 28, count: 1 },
      { from: 28, to: 30, count: 3 },
      { from: 30, to: 32, count: 1 }
    ]);
  });

  it('D-56: a value on a bin edge belongs to the higher bin', () => {
    expect(histogram([1, 2, 3], { binWidth: 1 })).toEqual([
      { from: 1, to: 2, count: 1 },
      { from: 2, to: 3, count: 1 },
      { from: 3, to: 4, count: 1 }
    ]);
  });

  it('D-56: decimal widths put values on an edge in the right bin despite floating-point error', () => {
    const [bin] = histogram([0.3], { binWidth: 0.1 });
    expect(bin.from).toBeCloseTo(0.3, 12);
    expect(bin.count).toBe(1);
  });

  it('D-56: without a width, bins follow the Freedman–Diaconis rule and cover every value', () => {
    const bins = histogram(times);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(times.length);
    expect(bins[0].from).toBeLessThanOrEqual(25.5);
    expect(bins.at(-1)!.to).toBeGreaterThan(31);
  });

  it('D-56: identical values give one bin; no values give none', () => {
    expect(histogram([28, 28, 28])).toEqual([{ from: 28, to: 29, count: 3 }]);
    expect(histogram([])).toEqual([]);
  });

  it('D-56: one far-off value does not explode the default histogram into hundreds of bins', () => {
    const bins = histogram([27, 27.5, 28, 28, 28.5, 29, 120]);
    expect(bins.length).toBeLessThanOrEqual(20);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(7);
  });

  it('D-56: when the middle half has no spread, the range is split by Sturges’ rule', () => {
    // n = 8 → ⌈log2 8⌉ + 1 = 4 bins over 20–36, width 4
    const bins = histogram([20, 28, 28, 28, 28, 28, 28, 36]);
    expect(bins.map((b) => b.from)).toEqual([20, 24, 28, 32, 36]);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(8);
  });
});

describe('normalCurve', () => {
  it('D-56: the fitted bell curve peaks at the mean', () => {
    const curve = normalCurve(28, 1.4, { from: 24, to: 32, points: 81 });
    expect(curve).toHaveLength(81);
    const peak = curve.reduce((best, p) => (p.y > best.y ? p : best));
    expect(peak.x).toBeCloseTo(28, 10);
    expect(peak.y).toBeCloseTo(1 / (1.4 * Math.sqrt(2 * Math.PI)), 10);
  });

  it('D-56: the curve can be scaled to sit on a histogram of counts', () => {
    const [point] = normalCurve(0, 1, { from: 0, to: 0, points: 1, scale: 20 });
    expect(point.y).toBeCloseTo(20 / Math.sqrt(2 * Math.PI), 10);
  });

  it('D-56: no curve without a spread', () => {
    expect(normalCurve(28, 0, { from: 24, to: 32, points: 10 })).toEqual([]);
  });
});

describe('sigmaDistance', () => {
  it('D-57: how many σ a shot is from its recipe’s average ("1.7σ faster than usual")', () => {
    const history = [26.5, 28, 29.3, 27.4, 28.2];
    const distance = sigmaDistance(25.5, history)!;
    expect(distance).toBeCloseTo((25.5 - mean(history)!) / standardDeviation(history)!, 12);
    expect(distance).toBeLessThan(0);
  });

  it('D-57: no comparison with fewer than two earlier values or no spread', () => {
    expect(sigmaDistance(25.5, [28])).toBeNull();
    expect(sigmaDistance(25.5, [28, 28, 28])).toBeNull();
    expect(sigmaDistance(27.9, Array(7).fill(28.2))).toBeNull();
  });
});

describe('pooledStandardDeviation', () => {
  it('D-55, D-56: σ within groups, weighted by each group’s n − 1', () => {
    const a = [7, 8, 9]; // variance 1, n − 1 = 2
    const b = [5, 7, 9, 11]; // variance 20/3, n − 1 = 3
    expect(pooledStandardDeviation([a, b])).toBeCloseTo(Math.sqrt((2 * 1 + 3 * (20 / 3)) / 5), 12);
  });

  it('D-56: groups with one value add nothing; too little data gives null', () => {
    expect(pooledStandardDeviation([[7, 9], [5]])).toBeCloseTo(standardDeviation([7, 9])!, 12);
    expect(pooledStandardDeviation([[7], [5]])).toBeNull();
    expect(pooledStandardDeviation([])).toBeNull();
    expect(pooledStandardDeviation([[0.1, 0.1, 0.1]])).toBe(0);
  });
});
