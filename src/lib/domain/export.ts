// Backup and export (D-251, D-252): the file names, the shots as CSV and the decimals the exports use.
// Pure, so it is tested without a database; the server gathers the rows (src/lib/server/db/export.ts).
import { localDate } from './bean';
import { clockTime } from './journal';
import { formatRatio, fromThousandths, type Thousandths } from './units';

/** One saved shot as the CSV has it: names as the shot detail shows them (D-57), quantities in thousandths. */
export type ShotExportRow = {
  brewedAt: number;
  beanName: string;
  roaster: string | null;
  roastDate: string;
  machine: string;
  grinder: string;
  basket: string | null;
  routine: string | null;
  /** The setup line of the shot detail: "93 °C · Flat 9.0 bar · Preinfusion 4 s". */
  setup: string;
  grind: Thousandths;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
  score: number | null;
  balance: number | null;
  body: number | null;
  sweetness: number | null;
  aftertaste: number | null;
  flavors: string[];
  notes: string | null;
};

export const SHOT_COLUMNS = [
  'Date',
  'Time of day',
  'Bean',
  'Roaster',
  'Roast date',
  'Machine',
  'Grinder',
  'Basket',
  'Puck prep',
  'Setup',
  'Grind',
  'Dose (g)',
  'Yield (g)',
  'Time (s)',
  'Ratio (1 : x)',
  'Score',
  'Balance (sour −10 to bitter +10)',
  'Body',
  'Sweetness',
  'Aftertaste',
  'Flavor notes',
  'Notes'
] as const;

/**
 * Thousandths as a plain decimal with a point and as many decimals as it has ("18", "36.5"); empty when
 * not set (D-11). The division is exact for the three decimals a stored value can have.
 */
export function decimal(value: Thousandths | null): string {
  return value === null ? '' : String(fromThousandths(value));
}

/** Every number in a stored JSON value (a spec, setup or step setting) as a decimal: all are thousandths. */
export function decimalsDeep(value: unknown): unknown {
  if (typeof value === 'number') return fromThousandths(value);
  if (Array.isArray(value)) return value.map(decimalsDeep);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, decimalsDeep(v)]));
  return value;
}

/** A CSV field (RFC 4180): quoted when it holds a comma, a quote or a line break, quotes doubled. */
export function csvField(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Rows as a CSV file: CRLF line ends, and a byte order mark so spreadsheets read it as UTF-8. */
export function csvText(rows: readonly (readonly string[])[]): string {
  return '\uFEFF' + rows.map((r) => r.map(csvField).join(',') + '\r\n').join('');
}

const whole = (value: number | null) => (value === null ? '' : String(value));

/** D-252: the shots, oldest first as given, one row each, dates and times in the account's time zone. */
export function shotsCsv(shots: readonly ShotExportRow[], timeZone: string): string {
  return csvText([
    SHOT_COLUMNS,
    ...shots.map((s) => [
      localDate(s.brewedAt, timeZone),
      clockTime(s.brewedAt, timeZone),
      s.beanName,
      s.roaster ?? '',
      s.roastDate,
      s.machine,
      s.grinder,
      s.basket ?? '',
      s.routine ?? '',
      s.setup,
      decimal(s.grind),
      decimal(s.dose),
      decimal(s.yield),
      decimal(s.time),
      formatRatio(s.yield, s.dose)?.replace('1 : ', '') ?? '',
      whole(s.score),
      whole(s.balance),
      whole(s.body),
      whole(s.sweetness),
      whole(s.aftertaste),
      s.flavors.join('; '),
      s.notes ?? ''
    ])
  ]);
}

const EXTENSIONS = { backup: 'db', shots: 'csv', everything: 'json' } as const;

/** D-251, D-252: "coffee-nerd-backup-2026-10-30.db", named by the day in the account's time zone. */
export function exportFileName(
  kind: keyof typeof EXTENSIONS,
  now: number,
  timeZone: string
): string {
  return `coffee-nerd-${kind}-${localDate(now, timeZone)}.${EXTENSIONS[kind]}`;
}
