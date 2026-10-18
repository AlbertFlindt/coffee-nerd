import { describe, expect, it } from 'vitest';
import { countryName } from './countries';

describe('countryName', () => {
  it('D-41: a two-letter country code by its English name', () => {
    expect(countryName('ET')).toBe('Ethiopia');
    expect(countryName('CO')).toBe('Colombia');
  });

  it('D-41: an unknown code gives null', () => {
    expect(countryName('ZZ')).toBeNull();
    expect(countryName('nope')).toBeNull();
  });
});
