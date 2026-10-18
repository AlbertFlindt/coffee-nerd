import { describe, expect, it } from 'vitest';
import { countryName, searchCountries } from './countries';

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

describe('searchCountries', () => {
  it('D-133: every country A to Z without a search', () => {
    const all = searchCountries('');
    expect(all.length).toBeGreaterThan(240);
    expect(all[0]).toEqual({ code: 'AF', name: 'Afghanistan' });
  });

  it('D-133: matches any part of the name, ignoring case and accents', () => {
    expect(searchCountries('ethi')).toEqual([{ code: 'ET', name: 'Ethiopia' }]);
    expect(searchCountries('cote').map((c) => c.code)).toContain('CI');
  });
});
