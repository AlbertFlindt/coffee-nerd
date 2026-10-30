import { describe, expect, it } from 'vitest';
import {
  dataUrl,
  isDownload,
  isKeptPage,
  pageKey,
  pagePath,
  NO_CHANGE_ACTION_DATA,
  waitsOffline
} from './offline';

describe('offline page keys', () => {
  it('a page and its data are kept under one key whatever the order of the query', () => {
    expect(pageKey(new URL('https://x/shot/new?from=journal&bean=b1'))).toBe(
      '/shot/new?bean=b1&from=journal'
    );
    expect(pageKey(new URL('https://x/shot/new?bean=b1&from=journal'))).toBe(
      '/shot/new?bean=b1&from=journal'
    );
  });

  it("SvelteKit's own query parameters are left out of the key", () => {
    expect(
      pageKey(new URL('https://x/journal/__data.json?bean=b1&x-sveltekit-invalidated=01'))
    ).toBe('/journal/__data.json?bean=b1');
    expect(pageKey(new URL('https://x/__data.json?x-sveltekit-trailing-slash=1'))).toBe(
      '/__data.json'
    );
  });

  it('the data of a page sits at its __data.json address', () => {
    expect(dataUrl('/')).toBe('/__data.json');
    expect(dataUrl('/journal')).toBe('/journal/__data.json');
    expect(dataUrl('/shot/new?bean=b1&from=journal')).toBe(
      '/shot/new/__data.json?bean=b1&from=journal'
    );
  });

  it('the page an address belongs to, from its data or itself', () => {
    expect(
      pagePath(new URL('https://x/journal/__data.json?x-sveltekit-invalidated=01&bean=b1'))
    ).toBe('/journal?bean=b1');
    expect(pagePath(new URL('https://x/__data.json'))).toBe('/');
    expect(pagePath(new URL('https://x/library/gear'))).toBe('/library/gear');
  });

  it('Home, the Journal and the shot form are kept by the service worker only', () => {
    expect(isKeptPage('/')).toBe(true);
    expect(isKeptPage('/__data.json')).toBe(true);
    expect(isKeptPage('/journal')).toBe(true);
    expect(isKeptPage('/journal/__data.json')).toBe(true);
    expect(isKeptPage('/shot/new/__data.json')).toBe(true);
    expect(isKeptPage('/journal/abc')).toBe(false);
    expect(isKeptPage('/insights/__data.json')).toBe(false);
  });

  it('a change made offline answers as a failed form without problems of its own', () => {
    expect(JSON.parse(NO_CHANGE_ACTION_DATA)).toEqual([{}]);
  });
});

describe('waitsOffline', () => {
  const waits = (address: string) => waitsOffline(new URL(address, 'https://x'));

  it('saving a shot, new or edited, and a score wait on the phone', () => {
    expect(waits('/shot/new?/save')).toBe(true);
    expect(waits('/journal/0199/edit?/save')).toBe(true);
    expect(waits('/?/rate')).toBe(true);
    expect(waits('/journal?/rate')).toBe(true);
    expect(waits('/queue')).toBe(true);
  });

  it('every other change needs a connection', () => {
    expect(waits('/shot/new?/useLastShot')).toBe(false);
    expect(waits('/journal/0199/edit?/delete')).toBe(false);
    expect(waits('/library/beans/new?/save')).toBe(false);
    expect(waits('/logout')).toBe(false);
  });
});

describe('isDownload', () => {
  it('the backup and the exports are downloads, which need a connection and change nothing', () => {
    const at = (path: string) => new URL(path, 'https://cn.example');
    expect(isDownload(at('/settings/backup'))).toBe(true);
    expect(isDownload(at('/settings/export-shots'))).toBe(true);
    expect(isDownload(at('/settings/export-everything'))).toBe(true);
    expect(isDownload(at('/settings?/steps'))).toBe(false);
    expect(waitsOffline(at('/settings/backup'))).toBe(false);
  });
});
