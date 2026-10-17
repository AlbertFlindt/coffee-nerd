// Values about a bean and its shots that are always calculated, never stored (data-model §3).
import type { Thousandths } from './units';

/** Yield per gram of dose, in thousandths (38.5 g from 18.0 g → 2139, shown "1 : 2.1"). */
export function ratio(
  yieldAmount: Thousandths | null,
  dose: Thousandths | null
): Thousandths | null {
  if (yieldAmount === null || dose === null || dose <= 0) return null;
  return Math.round((yieldAmount * 1000) / dose);
}

/** The calendar date ("2026-10-17") of a UTC time in the user's time zone (data-model §1.8). */
export function localDate(utcMilliseconds: number, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(utcMilliseconds);
}

/** Whole calendar days from the roast date to the day of brewing, in the user's time zone. Roast day is 0. */
export function roastAgeDays(roastDate: string, brewedAt: number, timeZone: string): number {
  return dayNumber(localDate(brewedAt, timeZone)) - dayNumber(roastDate);
}

function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** Bag weight minus every shot's dose, never below 0; null when the bean has no bag weight (D-35). */
export function gramsLeft(
  bagWeight: Thousandths | null,
  doses: readonly Thousandths[]
): Thousandths | null {
  if (bagWeight === null) return null;
  return Math.max(0, bagWeight - doses.reduce((sum, d) => sum + d, 0));
}

/** True when the bean has a bag weight and its shots' doses have used it up (D-40). */
export function shouldAutoFinish(
  bagWeight: Thousandths | null,
  doses: readonly Thousandths[]
): boolean {
  return bagWeight !== null && doses.reduce((sum, d) => sum + d, 0) >= bagWeight;
}
