import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { journalFilters, journalWithFilters, rememberJournalFilters } from './journal-filters';

function jar(initial: Record<string, string> = {}): Cookies {
  const values = new Map(Object.entries(initial));
  return {
    get: (name: string) => values.get(name),
    set: (name: string, value: string) => void values.set(name, value),
    delete: (name: string) => void values.delete(name)
  } as unknown as Cookies;
}

const request = new Request('http://localhost/journal');

describe('journal filters', () => {
  it('D-117: the Journal’s filters in effect are remembered for Back and after deleting', () => {
    const cookies = jar();
    rememberJournalFilters(cookies, { beanId: 'b1', recipeId: 'r1', unrated: true }, request);
    expect(journalFilters(cookies)).toBe('bean=b1&recipe=r1&unrated=1');
    expect(journalWithFilters(cookies)).toBe('/journal?bean=b1&recipe=r1&unrated=1');
  });

  it('D-117: without filters, the plain Journal', () => {
    const cookies = jar();
    rememberJournalFilters(cookies, { beanId: null, recipeId: null, unrated: false }, request);
    expect(journalWithFilters(cookies)).toBe('/journal');
    expect(journalWithFilters(jar())).toBe('/journal');
  });

  it('D-117: anything else in the cookie is dropped, and values are re-encoded', () => {
    const cookies = jar({ 'journal-filters': 'bean=a%26b&next=https://evil.example&unrated=1' });
    expect(journalWithFilters(cookies)).toBe('/journal?bean=a%26b&unrated=1');
  });
});
