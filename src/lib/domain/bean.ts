// Values about a bean and its shots that are always calculated, never stored (docs/SPEC.md §3).
import type { BestRecipe } from './best-recipe';
import { countryName } from './countries';
import { formatQuantity, type Thousandths } from './units';

/** Yield per gram of dose, in thousandths (38.5 g from 18.0 g → 2139), for statistics and charts. Display uses `formatRatio`. */
export function ratio(
  yieldAmount: Thousandths | null,
  dose: Thousandths | null
): Thousandths | null {
  if (yieldAmount === null || dose === null || dose <= 0) return null;
  return Math.round((yieldAmount * 1000) / dose);
}

/** The calendar date ("2026-10-17") of a UTC time in the user's time zone (docs/SPEC.md §1.8). */
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

/** Bag weight minus every shot's dose, never below 0; null when the bean has no bag weight. */
export function gramsLeft(
  bagWeight: Thousandths | null,
  doses: readonly Thousandths[]
): Thousandths | null {
  if (bagWeight === null) return null;
  return Math.max(0, bagWeight - doses.reduce((sum, d) => sum + d, 0));
}

/**
 * True when this shot makes the doses reach the bag weight: the doses before it were below the bag
 * weight and with it they are not. So after an undo or reopening, later shots do not finish the bean
 * again. Never without a bag weight.
 */
export function shouldAutoFinish(
  bagWeight: Thousandths | null,
  earlierDoses: readonly Thousandths[],
  dose: Thousandths
): boolean {
  if (bagWeight === null) return false;
  const before = earlierDoses.reduce((sum, d) => sum + d, 0);
  return before < bagWeight && before + dose >= bagWeight;
}

export type Process = 'washed' | 'natural' | 'honey' | 'anaerobic' | 'other';

/** How a process is written on screen. */
export const PROCESS_LABEL: Record<Process, string> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
  other: 'Other'
};

/** How a roast level is written on screen. */
export const ROAST_LEVEL_LABEL = {
  light: 'Light',
  medium_light: 'Med-light',
  medium: 'Medium',
  dark: 'Dark'
} as const;

/**
 * A bean's best score: its best recipe's average with one decimal ("7.7") once that recipe has
 * 3 rated shots, otherwise the highest single score ("8"). Null without a rated shot ("Not rated yet").
 */
export function bestScoreText(best: BestRecipe | null): string | null {
  if (best === null) return null;
  return best.basis === 'average' ? best.score.toFixed(1) : String(best.score);
}

/** "120 g left" in whole grams; null without a bag weight. */
export function gramsLeftText(grams: Thousandths | null): string | null {
  return grams === null ? null : `${formatQuantity(grams, { decimals: 0, unit: 'g' })} left`;
}

/** "Nordlys Roasters · Ethiopia · Natural", leaving out what is not set. */
export function originLine(bean: {
  roaster: string | null;
  countryCode: string | null;
  process: Process | null;
}): string {
  return [
    bean.roaster,
    bean.countryCode ? countryName(bean.countryCode) : null,
    bean.process ? PROCESS_LABEL[bean.process] : null
  ]
    .filter((part) => part)
    .join(' · ');
}

/**
 * Altitude as typed on the Add bean form: "1,900–2,100 m", "1900-2100" or one height, which fills
 * both. Null when empty; "invalid" when it is not one or two whole metres from low to high.
 */
export function parseAltitude(text: string): { min: number; max: number } | null | 'invalid' {
  const cleaned = text.replace(/\s|m$/gi, '');
  if (cleaned === '') return null;
  // Commas only between groups of three digits.
  const height = String.raw`(\d{1,3}(?:,\d{3})?|\d{1,5})`;
  const match = new RegExp(`^${height}(?:[-–]${height})?$`).exec(cleaned);
  if (!match) return 'invalid';
  const min = Number(match[1].replace(',', ''));
  const max = match[2] === undefined ? min : Number(match[2].replace(',', ''));
  return min > 0 && min <= max ? { min, max } : 'invalid';
}

/** "1,900–2,100 m", or "1,850 m" when both ends are the same; null when not set. */
export function altitudeText(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  const metres = (n: number) => n.toLocaleString('en-US');
  const low = min ?? max!;
  const high = max ?? min!;
  return low === high ? `${metres(low)} m` : `${metres(low)}–${metres(high)} m`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The roast date as shown on the form: "14 Oct" and "2 days ago"; another year names the year. */
export function roastDateText(roastDate: string, today: string): { date: string; ago: string } {
  const [year, month, day] = roastDate.split('-').map(Number);
  const sameYear = today.slice(0, 4) === roastDate.slice(0, 4);
  const days = dayNumber(today) - dayNumber(roastDate);
  return {
    date: `${day} ${MONTHS[month - 1]}${sameYear ? '' : ` ${year}`}`,
    ago: days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
  };
}
