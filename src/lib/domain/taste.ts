// Taste values as words next to their sliders. The stored numbers stay whole numbers.

export type TasteScale = 'balance' | 'body' | 'sweetness' | 'aftertaste';

/** Words for the five bands of a 0–10 scale: 0–2, 3–4, 5, 6–7, 8–10. */
const BANDS: Record<Exclude<TasteScale, 'balance'>, readonly string[]> = {
  body: ['Light', 'Medium-light', 'Medium', 'Medium-heavy', 'Heavy'],
  sweetness: ['Low', 'Medium-low', 'Medium', 'Medium-high', 'High'],
  aftertaste: ['Short', 'Medium-short', 'Medium', 'Medium-long', 'Long']
};

/** "Slightly sour", "Medium-heavy"; "Not set" when empty. */
export function tasteWords(scale: TasteScale, value: number | null): string {
  if (value === null) return 'Not set';
  if (scale === 'balance') {
    if (value === 0) return 'Balanced';
    const side = value < 0 ? 'sour' : 'bitter';
    const size = Math.abs(value);
    if (size <= 3) return `Slightly ${side}`;
    if (size <= 6) return side.charAt(0).toUpperCase() + side.slice(1);
    return `Very ${side}`;
  }
  const band = value <= 2 ? 0 : value <= 4 ? 1 : value === 5 ? 2 : value <= 7 ? 3 : 4;
  return BANDS[scale][band];
}
