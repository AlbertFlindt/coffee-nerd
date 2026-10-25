// Where "+" was pressed, so that "Save shot" and "Back" return there (D-95, D-200). Home unless it was the
// Journal; the shot detail's Back keeps "from Home" through Edit the same way (D-197).
export type Origin = 'home' | 'journal';

/** Reads a `from` query value or form field; anything else is Home. */
export function originOf(value: string | null | undefined): Origin {
  return value === 'journal' ? 'journal' : 'home';
}
