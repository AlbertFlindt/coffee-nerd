import { describe, expect, it } from 'vitest';
import { duplicatePairs, keptKey, looksAlike, matchesSearch } from './tags';

describe('looksAlike', () => {
  it('the same name ignoring case, spaces and accents', () => {
    expect(looksAlike('Tea', 'tea')).toBe(true);
    expect(looksAlike('Stone fruit', 'Stonefruit')).toBe(true);
    expect(looksAlike('Café', 'cafe')).toBe(true);
  });

  it('one or two letters different, for names of five letters or longer', () => {
    expect(looksAlike('Dark choclate', 'Dark chocolate')).toBe(true);
    expect(looksAlike('Carmel', 'Caramel')).toBe(true);
    expect(looksAlike('Jasmine', 'Jasmin')).toBe(true);
    expect(looksAlike('Almond', 'Almnod')).toBe(true);
  });

  it('three letters different is a different note', () => {
    expect(looksAlike('Caramel', 'Carmine')).toBe(false);
  });

  it('one or two letters different only counts with the same first letter', () => {
    expect(looksAlike('Honey', 'Winey')).toBe(false);
    expect(looksAlike('Berry', 'Cherry')).toBe(false);
    expect(looksAlike('Toasted', 'Roasted')).toBe(false);
    expect(looksAlike('Émile', 'emile')).toBe(true);
  });

  it('short names must match exactly', () => {
    expect(looksAlike('Fig', 'Fog')).toBe(false);
    expect(looksAlike('Plum', 'Plums')).toBe(false);
  });

  it('a note is compared by name only', () => {
    expect(looksAlike('Berry', 'Berry')).toBe(true);
  });
});

describe('duplicatePairs', () => {
  const tags = [
    { id: 'a', name: 'Dark chocolate', count: 9 },
    { id: 'b', name: 'Berry', count: 2 },
    { id: 'c', name: 'Dark choclate', count: 1 }
  ];

  it('suggests merging into the more used note', () => {
    expect(duplicatePairs(tags, new Set())).toEqual([{ keep: tags[0], merge: tags[2] }]);
    const swapped = [tags[2], tags[1], tags[0]];
    expect(duplicatePairs(swapped, new Set())).toEqual([{ keep: tags[0], merge: tags[2] }]);
  });

  it('on equal use, the note listed first is kept (open item: not decided)', () => {
    const even = [
      { id: 'x', name: 'Caramel', count: 1 },
      { id: 'y', name: 'Carmel', count: 1 }
    ];
    expect(duplicatePairs(even, new Set())).toEqual([{ keep: even[0], merge: even[1] }]);
  });

  it('a pair after "Keep both" is not suggested again', () => {
    expect(duplicatePairs(tags, new Set([keptKey('c', 'a')]))).toEqual([]);
  });

  it('keptKey puts the lower id first, as tag_pair_kept stores it', () => {
    expect(keptKey('c', 'a')).toBe(keptKey('a', 'c'));
    expect(keptKey('c', 'a')).toBe('a c');
  });
});

describe('matchesSearch', () => {
  it('the name contains the search, ignoring case, accents and surrounding spaces', () => {
    expect(matchesSearch('Dark chocolate', ' CHOC ')).toBe(true);
    expect(matchesSearch('Crème brûlée', 'creme')).toBe(true);
    expect(matchesSearch('Berry', 'cherry')).toBe(false);
    expect(matchesSearch('Berry', '')).toBe(true);
  });
});
