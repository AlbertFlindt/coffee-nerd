// Flavor notes: the duplicate finder of the Tags page.

/** Lower case, without accents. */
function plain(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** A name as the duplicate finder compares it: lower case, without spaces and accents. */
function bare(name: string): string {
  return plain(name).replace(/\s+/g, '');
}

/** The Tags page search: the name contains the typed text, ignoring case and accents. */
export function matchesSearch(name: string, query: string): boolean {
  return plain(name).includes(plain(query.trim()));
}

/** How many letters must be added, removed or swapped to turn `a` into `b` (Levenshtein distance). */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++)
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    previous = row;
  }
  return previous[b.length];
}

/**
 * Two notes look alike when their names are the same ignoring case, spaces and accents, or
 * differ in one or two letters while both are five letters or longer and start with the
 * same letter.
 */
export function looksAlike(a: string, b: string): boolean {
  const x = bare(a);
  const y = bare(b);
  if (x === y) return true;
  return Math.min(x.length, y.length) >= 5 && x[0] === y[0] && distance(x, y) <= 2;
}

/** The key of a pair kept after "Keep both": the lower id first, as `tag_pair_kept` stores it. */
export function keptKey(a: string, b: string): string {
  return a < b ? `${a} ${b}` : `${b} ${a}`;
}

export interface NoteUse {
  id: string;
  name: string;
  count: number;
}

/**
 * The pairs the "Same tag twice?" card suggests, in list order: each merges into the more used note,
 * the one listed first on equal use. Pairs kept with "Keep both" are left out.
 */
export function duplicatePairs<T extends NoteUse>(
  notes: readonly T[],
  kept: ReadonlySet<string>
): { keep: T; merge: T }[] {
  const pairs: { keep: T; merge: T }[] = [];
  notes.forEach((a, i) => {
    for (const b of notes.slice(i + 1)) {
      if (kept.has(keptKey(a.id, b.id)) || !looksAlike(a.name, b.name)) continue;
      pairs.push(b.count > a.count ? { keep: b, merge: a } : { keep: a, merge: b });
    }
  });
  return pairs;
}

/** The five fixed flavor families, in the Tags page's order. */
export const FAMILIES = [
  { family: 'fruity', label: 'Fruity' },
  { family: 'sweet', label: 'Sweet' },
  { family: 'floral', label: 'Floral' },
  { family: 'nutty_roasty', label: 'Nutty & roasty' },
  { family: 'other', label: 'Other' }
] as const;

export type Family = (typeof FAMILIES)[number]['family'];
