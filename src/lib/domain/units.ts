// Quantities are stored as whole thousandths (18.0 g → 18000, data-model §1.4).
// This is the only place that converts between thousandths and what people type or see.
// All arithmetic here is on integers; rounding happens once, half away from zero.

/** A decimal quantity in whole thousandths. */
export type Thousandths = number;

const MINUS = '−';
const DECIMAL = /^([+\-−]?)(\d*)(?:[.,](\d*))?$/;

/** Reads a typed or calculated decimal into thousandths. Throws on anything that is not a plain number. */
export function toThousandths(value: number | string): Thousandths {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError(`Not a finite number: ${value}`);
    // toFixed drops binary drift (0.1 + 0.2 → "0.300000000") before the exact decimal parse below.
    return toThousandths(value.toFixed(9));
  }
  const match = DECIMAL.exec(value.trim());
  const [, sign = '', whole = '', fraction = ''] = match ?? [];
  if (!match || (whole === '' && fraction === '')) throw new RangeError(`Not a number: "${value}"`);

  const digits = fraction.padEnd(4, '0');
  let result = Number(whole || '0') * 1000 + Number(digits.slice(0, 3));
  if (Number(digits[3]) >= 5) result += 1;
  if (!Number.isSafeInteger(result)) throw new RangeError(`Too large to store exactly: "${value}"`);
  return sign === '' || sign === '+' || result === 0 ? result : -result;
}

/** Thousandths as a plain number, for display maths and charts only; never store the result. */
export function fromThousandths(value: Thousandths): number {
  return value / 1000;
}

/** How many decimals a value with this step shows: 0.1 → 1, 0.5 → 1, 1 → 0, 0.05 → 2. */
export function decimalsForStep(step: Thousandths): number {
  if (step % 1000 === 0) return 0;
  if (step % 100 === 0) return 1;
  if (step % 10 === 0) return 2;
  return 3;
}

/**
 * Decimals to show a value with: as many as its step, or more when the value was typed off the step grid
 * (93.5 °C with a 1 °C step), so two different recipes never look the same (D-07, D-16).
 */
export function decimalsFor(value: Thousandths, step: Thousandths): number {
  return Math.max(decimalsForStep(step), decimalsForStep(value));
}

/** Thousandths as text with a fixed number of decimals (0–3) and a real minus sign. */
export function formatNumber(value: Thousandths, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 3)
    throw new RangeError(`Decimals must be 0–3: ${decimals}`);
  const unit = 10 ** (3 - decimals);
  const magnitude = Math.floor((Math.abs(value) + unit / 2) / unit); // half away from zero
  const text = String(magnitude).padStart(decimals + 1, '0');
  const formatted = decimals === 0 ? text : `${text.slice(0, -decimals)}.${text.slice(-decimals)}`;
  return value < 0 && magnitude !== 0 ? MINUS + formatted : formatted;
}

/** "18.0 g", "93 °C", "1.6" (D-07). */
export function formatQuantity(
  value: Thousandths,
  { decimals, unit }: { decimals: number; unit?: string }
): string {
  const number = formatNumber(value, decimals);
  return unit ? `${number} ${unit}` : number;
}

/** A change since the last shot: "+2.5", "−0.1"; no sign when it rounds to zero (D-15). */
export function formatDelta(change: Thousandths, decimals: number): string {
  const text = formatNumber(change, decimals);
  return change > 0 && /[1-9]/.test(text) ? `+${text}` : text;
}

/**
 * The ratio of yield to dose as "1 : 2.1" (D-03), rounded once to one decimal straight from the two
 * quantities, so it never rounds twice. Null without a yield or a dose.
 */
export function formatRatio(
  yieldAmount: Thousandths | null,
  dose: Thousandths | null
): string | null {
  if (yieldAmount === null || dose === null || dose <= 0) return null;
  // Tenths, rounded half up, in whole numbers: ⌊(20·yield + dose) / (2·dose)⌋.
  const tenths = Math.floor((20 * yieldAmount + dose) / (2 * dose));
  return `1 : ${formatNumber(tenths * 100, 1)}`;
}

/** The label on a −/+ button: "+ 0.1 g", "− 1 s", "+ 0.1" (D-07). */
export function stepLabel(direction: '+' | '-', step: Thousandths, unit?: string): string {
  const sign = direction === '+' ? '+' : MINUS;
  return `${sign} ${formatQuantity(step, { decimals: decimalsForStep(step), unit })}`;
}

/**
 * One tap on −/+: moves by exactly one step and stays inside the range (D-07). An empty value counts
 * from 0 (D-80): the first + gives one step.
 */
export function applyStep(
  value: Thousandths | null,
  step: Thousandths,
  direction: '+' | '-',
  range: { min?: Thousandths; max?: Thousandths } = {}
): Thousandths {
  const { min, max } = range;
  const from = value ?? 0;
  const next = direction === '+' ? from + step : from - step;
  if (min !== undefined && next < min) return min;
  if (max !== undefined && next > max) return max;
  return next;
}
