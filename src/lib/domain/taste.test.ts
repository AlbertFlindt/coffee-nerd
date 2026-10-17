import { describe, expect, it } from 'vitest';
import { tasteWords } from './taste';

describe('tasteWords', () => {
  it('D-96: balance reads in seven bands from very sour to very bitter', () => {
    const words = [-10, -7, -6, -4, -3, -1, 0, 1, 3, 4, 6, 7, 10].map((v) =>
      tasteWords('balance', v)
    );
    expect(words).toEqual([
      'Very sour',
      'Very sour',
      'Sour',
      'Sour',
      'Slightly sour',
      'Slightly sour',
      'Balanced',
      'Slightly bitter',
      'Slightly bitter',
      'Bitter',
      'Bitter',
      'Very bitter',
      'Very bitter'
    ]);
  });

  it('D-96: body, sweetness and aftertaste read in five bands 0–2, 3–4, 5, 6–7, 8–10', () => {
    const body = [0, 2, 3, 4, 5, 6, 7, 8, 10].map((v) => tasteWords('body', v));
    expect(body).toEqual([
      'Light',
      'Light',
      'Medium-light',
      'Medium-light',
      'Medium',
      'Medium-heavy',
      'Medium-heavy',
      'Heavy',
      'Heavy'
    ]);
    expect([1, 3, 5, 6, 9].map((v) => tasteWords('sweetness', v))).toEqual([
      'Low',
      'Medium-low',
      'Medium',
      'Medium-high',
      'High'
    ]);
    expect([1, 3, 5, 6, 9].map((v) => tasteWords('aftertaste', v))).toEqual([
      'Short',
      'Medium-short',
      'Medium',
      'Medium-long',
      'Long'
    ]);
  });

  it('D-11, D-96: an empty slider is "Not set", never a band', () => {
    expect(tasteWords('balance', null)).toBe('Not set');
    expect(tasteWords('body', null)).toBe('Not set');
  });
});
