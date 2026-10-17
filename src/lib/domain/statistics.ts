// Statistics for Insights and shot detail (D-56, D-57), on plain numbers (convert from thousandths first).
// Conventions:
// - σ is the sample standard deviation, divided by n − 1.
// - Quantiles use linear interpolation between order statistics: the "R-7" method, R's default and
//   Excel's QUARTILE.INC. For sorted values x[0..n−1] and probability p, h = (n − 1)·p and the result is
//   x[⌊h⌋] + (h − ⌊h⌋)·(x[⌊h⌋+1] − x[⌊h⌋]).
// - Too few values give null, never a made-up number.

export function count(values: readonly number[]): number {
  return values.length;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Sample standard deviation (n − 1). Needs at least two values. */
export function standardDeviation(values: readonly number[]): number | null {
  const variance = sampleVariance(values);
  return variance === null ? null : Math.sqrt(variance);
}

function sampleVariance(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
}

export function range(values: readonly number[]): { min: number; max: number } | null {
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** The p-quantile (0 ≤ p ≤ 1) by linear interpolation (R-7). */
export function quantile(values: readonly number[], p: number): number | null {
  if (p < 0 || p > 1 || Number.isNaN(p)) throw new RangeError(`Probability outside 0–1: ${p}`);
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) * p;
  const low = Math.floor(h);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low] + (h - low) * (sorted[high] - sorted[low]);
}

export function median(values: readonly number[]): number | null {
  return quantile(values, 0.5);
}

export function quartiles(
  values: readonly number[]
): { q1: number; median: number; q3: number } | null {
  if (values.length === 0) return null;
  return {
    q1: quantile(values, 0.25)!,
    median: quantile(values, 0.5)!,
    q3: quantile(values, 0.75)!
  };
}

export type Bin = { from: number; to: number; count: number };

/**
 * Counts values into equal-width bins, aligned to multiples of the width. A value on an edge goes to the
 * higher bin. Without a width, the Freedman–Diaconis rule (2·IQR / ∛n) picks one; when the IQR is 0 the
 * values' range is split by Sturges' rule; identical values get one bin of width 1.
 */
export function histogram(values: readonly number[], options: { binWidth?: number } = {}): Bin[] {
  const extent = range(values);
  if (!extent) return [];
  const width = options.binWidth ?? defaultBinWidth(values, extent);
  if (!(width > 0)) throw new RangeError(`Bin width must be positive: ${width}`);

  const start = binIndex(extent.min, width);
  const binCount = binIndex(extent.max, width) - start + 1;
  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => ({
    from: (start + i) * width,
    to: (start + i + 1) * width,
    count: 0
  }));
  for (const value of values) bins[binIndex(value, width) - start].count += 1;
  return bins;
}

/** Bin of a value; the tolerance keeps values on an edge (0.3 with width 0.1) out of the bin below. */
function binIndex(value: number, width: number): number {
  return Math.floor(value / width + 1e-9);
}

function defaultBinWidth(values: readonly number[], { min, max }: { min: number; max: number }) {
  if (min === max) return 1;
  const iqr = quantile(values, 0.75)! - quantile(values, 0.25)!;
  if (iqr > 0) return (2 * iqr) / Math.cbrt(values.length);
  return (max - min) / (Math.ceil(Math.log2(values.length)) + 1);
}

/**
 * Points of the normal curve with this mean and σ, evenly spaced from `from` to `to`. `scale` multiplies
 * the density, e.g. n · bin width to draw it over a histogram of counts. No spread gives no curve.
 */
export function normalCurve(
  mu: number,
  sigma: number,
  { from, to, points, scale = 1 }: { from: number; to: number; points: number; scale?: number }
): { x: number; y: number }[] {
  if (!(sigma > 0) || points < 1) return [];
  const factor = scale / (sigma * Math.sqrt(2 * Math.PI));
  return Array.from({ length: points }, (_, i) => {
    const x = points === 1 ? from : from + ((to - from) * i) / (points - 1);
    return { x, y: factor * Math.exp(-(((x - mu) / sigma) ** 2) / 2) };
  });
}

/** How many σ `value` lies from the mean of `values` (negative = below). Null without a spread (D-57). */
export function sigmaDistance(value: number, values: readonly number[]): number | null {
  const sigma = standardDeviation(values);
  if (sigma === null || sigma === 0) return null;
  return (value - mean(values)!) / sigma;
}

/**
 * σ within groups, pooled: √(Σ (nᵢ − 1)·sᵢ² / Σ (nᵢ − 1)). Used to compare fairly while holding something
 * constant (D-55). Groups with fewer than two values add nothing.
 */
export function pooledStandardDeviation(groups: readonly (readonly number[])[]): number | null {
  let sumSquares = 0;
  let degreesOfFreedom = 0;
  for (const group of groups) {
    const variance = sampleVariance(group);
    if (variance === null) continue;
    sumSquares += (group.length - 1) * variance;
    degreesOfFreedom += group.length - 1;
  }
  return degreesOfFreedom === 0 ? null : Math.sqrt(sumSquares / degreesOfFreedom);
}
