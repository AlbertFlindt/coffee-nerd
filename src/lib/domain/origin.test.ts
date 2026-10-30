import { describe, expect, it } from 'vitest';
import { originOf } from './origin';

describe('originOf', () => {
  it('"+" pressed on the Journal returns to the Journal', () => {
    expect(originOf('journal')).toBe('journal');
  });

  it('anything else returns to Home', () => {
    expect(originOf(null)).toBe('home');
    expect(originOf('')).toBe('home');
    expect(originOf('/elsewhere')).toBe('home');
  });
});
