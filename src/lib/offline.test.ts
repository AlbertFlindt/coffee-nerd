import { describe, expect, it } from 'vitest';
import { dataUrl, isKeptPage, pageKey, pagePath, NO_CHANGE_ACTION_DATA } from './offline';

describe('offline page keys', () => {
  it('D-219: a page and its data are kept under one key whatever the order of the query', () => {
    expect(pageKey(new URL('https://x/shot/new?from=journal&bean=b1'))).toBe(
      '/shot/new?bean=b1&from=journal'
    );
    expect(pageKey(new URL('https://x/shot/new?bean=b1&from=journal'))).toBe(
      '/shot/new?bean=b1&from=journal'
    );
  });

  it("D-219: SvelteKit's own query parameters are left out of the key", () => {
    expect(
      pageKey(new URL('https://x/journal/__data.json?bean=b1&x-sveltekit-invalidated=01'))
    ).toBe('/journal/__data.json?bean=b1');
    expect(pageKey(new URL('https://x/__data.json?x-sveltekit-trailing-slash=1'))).toBe(
      '/__data.json'
    );
  });

  it('D-219: the data of a page sits at its __data.json address', () => {
    expect(dataUrl('/')).toBe('/__data.json');
    expect(dataUrl('/journal')).toBe('/journal/__data.json');
    expect(dataUrl('/shot/new?bean=b1&from=journal')).toBe(
      '/shot/new/__data.json?bean=b1&from=journal'
    );
  });

  it('D-219: the page an address belongs to, from its data or itself', () => {
    expect(
      pagePath(new URL('https://x/journal/__data.json?x-sveltekit-invalidated=01&bean=b1'))
    ).toBe('/journal?bean=b1');
    expect(pagePath(new URL('https://x/__data.json'))).toBe('/');
    expect(pagePath(new URL('https://x/library/gear'))).toBe('/library/gear');
  });

  it('D-219: Home, the Journal and the shot form are kept by the service worker only', () => {
    expect(isKeptPage('/')).toBe(true);
    expect(isKeptPage('/__data.json')).toBe(true);
    expect(isKeptPage('/journal')).toBe(true);
    expect(isKeptPage('/journal/__data.json')).toBe(true);
    expect(isKeptPage('/shot/new/__data.json')).toBe(true);
    expect(isKeptPage('/journal/abc')).toBe(false);
    expect(isKeptPage('/insights/__data.json')).toBe(false);
  });

  it('D-219: a change made offline answers as a failed form without problems of its own', () => {
    expect(JSON.parse(NO_CHANGE_ACTION_DATA)).toEqual([{}]);
  });
});
