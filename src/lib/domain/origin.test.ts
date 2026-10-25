import { describe, expect, it } from 'vitest';
import { originOf } from './origin';

describe('originOf', () => {
  it('D-200: "+" pressed on the Journal returns to the Journal', () => {
    expect(originOf('journal')).toBe('journal');
  });

  it('D-200: anything else returns to Home', () => {
    expect(originOf(null)).toBe('home');
    expect(originOf('')).toBe('home');
    expect(originOf('/elsewhere')).toBe('home');
  });
});
