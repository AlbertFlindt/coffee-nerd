// Shared by the pages and the service worker: how pages are kept for offline use (D-61, D-219).

/** Sent by the service worker when it keeps a copy: the server then takes no flash and sets no cookie. */
export const OFFLINE_COPY_HEADER = 'x-coffee-nerd-offline-copy';

/** What a change says when it cannot reach the server (D-219). */
export const NEEDS_CONNECTION = 'You are offline. This needs a connection, so nothing was changed.';

/**
 * A change that cannot reach the server answers as a form that failed without problems of its own, in
 * the form SvelteKit sends an action's data (devalue): the "Offline" line says why (D-219).
 */
export const NO_CHANGE_ACTION_DATA = JSON.stringify([{}]);

const DATA_SUFFIX = '/__data.json';

/** The cache key of a page or its data: the path and its query in a fixed order, without SvelteKit's own. */
export function pageKey(url: URL): string {
  const query = [...url.searchParams].filter(([key]) => !key.startsWith('x-sveltekit-'));
  query.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const search = new URLSearchParams(query).toString();
  return search ? `${url.pathname}?${search}` : url.pathname;
}

/** The address of a page's data, as SvelteKit loads it when moving between pages. */
export function dataUrl(page: string): string {
  const [path, search] = page.split('?');
  const data = `${path.replace(/\/$/, '')}${DATA_SUFFIX}`;
  return search ? `${data}?${search}` : data;
}

/** The page an address belongs to, its data or itself: "/journal/__data.json?bean=b1" → "/journal?bean=b1". */
export function pagePath(url: URL): string {
  const key = pageKey(url);
  const [path, search] = key.split('?');
  const page = path.endsWith(DATA_SUFFIX) ? path.slice(0, -DATA_SUFFIX.length) || '/' : path;
  return search ? `${page}?${search}` : page;
}

/**
 * Home, the Journal and the shot form are kept by the service worker itself, from copies without a
 * "Shot saved" bar (D-219); other pages are kept as they are opened.
 */
export function isKeptPage(pathname: string): boolean {
  const path = pathname.endsWith(DATA_SUFFIX)
    ? pathname.slice(0, -DATA_SUFFIX.length) || '/'
    : pathname;
  return path === '/' || path === '/journal' || path === '/shot/new';
}

/**
 * A change that waits on the phone when it cannot reach the server (D-61, D-223): saving a shot, new or
 * edited, a score from the Rate sheet, and the waiting shots themselves on their way to the server.
 */
export function waitsOffline(url: URL): boolean {
  if (url.pathname === '/queue') return true;
  if (url.search === '?/save')
    return url.pathname === '/shot/new' || /^\/journal\/[^/]+\/edit$/.test(url.pathname);
  if (url.search === '?/rate') return url.pathname === '/' || url.pathname === '/journal';
  return false;
}
