import { describe, expect, it } from 'vitest';
import { countryName, searchCountries } from './countries';

describe('countryName', () => {
  it('a two-letter country code by its English name', () => {
    expect(countryName('ET')).toBe('Ethiopia');
    expect(countryName('CO')).toBe('Colombia');
  });

  it('an unknown code gives null', () => {
    expect(countryName('ZZ')).toBeNull();
    expect(countryName('nope')).toBeNull();
  });
});

describe('searchCountries', () => {
  it('every country A to Z without a search', () => {
    const all = searchCountries('');
    expect(all.length).toBeGreaterThan(240);
    expect(all[0]).toEqual({ code: 'AF', name: 'Afghanistan' });
  });

  it('matches any part of the name, ignoring case and accents', () => {
    expect(searchCountries('ethi')).toEqual([{ code: 'ET', name: 'Ethiopia' }]);
    expect(searchCountries('kenya')).toEqual([{ code: 'KE', name: 'Kenya' }]);
    expect(searchCountries('cote').map((c) => c.code)).toContain('CI');
  });

  it('names that start with the search come first', () => {
    expect(searchCountries('eth').map((c) => c.name)).toEqual([
      'Ethiopia',
      'Caribbean Netherlands',
      'Netherlands'
    ]);
  });
});
