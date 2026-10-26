// The service worker: makes the app installable and keeps on the phone what it needs to open offline
// (D-61, D-217, D-219). Changes still need the server; a shot saved offline waits on the phone later (M10).
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';
import {
  dataUrl,
  isKeptPage,
  NO_CHANGE_ACTION_DATA,
  OFFLINE_COPY_HEADER,
  pageKey,
  pagePath,
  waitsOffline
} from '#lib/offline.ts';

// The version a page or its data was made by, as the app itself names it.
const VERSION_HEADER = 'x-sveltekit-version';
const CACHE = `app-${version}`;
// Pages and their data, per version: a page refers to the scripts of the version that made it.
const PAGES = `pages-${version}`;
// The built scripts and styles, the icons and the manifest.
const ASSETS = new Set([...immutable, ...assets].map(({ path }) => `/${path}`));
// Pages that are never kept: signing in and out, and the service worker's own list.
const NEVER_KEPT = new Set(['/login', '/welcome', '/logout', '/health', '/offline']);
// Keeping the pages again at most this often while moving around; always after a change.
const KEEP_EVERY = 60_000;

sw.addEventListener('install', (event) => {
  // D-227: no skipWaiting. A new version waits until every window of the app is closed, so it never
  // takes over a page that is in the middle of a shot.
  // Fetched past the browser's own cache, so an updated icon or manifest is never kept from an old copy.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([...ASSETS].map((path) => new Request(path, { cache: 'reload' })))
      )
  );
});

sw.addEventListener('activate', (event) => {
  // The new version is in charge: the files and pages of earlier versions are no longer needed. It
  // also takes the open page on the first visit, so the app is ready offline at once; on an update no
  // window is open by now (D-229), so this never takes over a shot in progress.
  event.waitUntil(
    sw.clients
      .claim()
      .then(() => caches.keys())
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && key !== PAGES)
            .filter((key) => key.startsWith('app-') || key.startsWith('pages-'))
            .map((key) => caches.delete(key))
        )
      )
  );
});

// Whether the server answered the last request: the pages show an "Offline" line when it did not.
let online = true;
function reached(now: boolean) {
  if (now === online) return;
  online = now;
  void tell({ type: 'network', online });
}

async function tell(message: unknown) {
  for (const client of await sw.clients.matchAll({ type: 'window' })) client.postMessage(message);
}

// D-225: signed out, nothing of the account stays on the phone. A copy fetched before signing out
// and arriving after it is not kept.
let signOuts = 0;
function forget() {
  signOuts += 1;
  return caches.delete(PAGES);
}

function isPage(request: Request, url: URL) {
  if (NEVER_KEPT.has(url.pathname) || url.pathname.startsWith('/_app/')) return false;
  return request.mode === 'navigate' || url.pathname.endsWith('/__data.json');
}

/** Whether a page's data answers with a redirect to signing in, or a page did. */
async function signedOut(response: Response) {
  if (response.redirected) return ['/login', '/welcome'].includes(new URL(response.url).pathname);
  if (!response.headers.get('content-type')?.includes('json')) return false;
  const text = await response.clone().text();
  return /^\{"type":"redirect","location":"\/(login|welcome)"/.test(text);
}

/**
 * Keeps a copy when it is a whole page of this version: not a redirect, an error or data with parts
 * left out, and not a page of a newer version whose scripts this version does not have. Streamed
 * data (text/sveltekit-data, for loads that return promises) is not used by the app.
 */
async function store(address: string, response: Response, since: number) {
  if (!response.ok || response.redirected) return;
  const text = await response.clone().text();
  const header = response.headers.get(VERSION_HEADER);
  if (
    header
      ? header !== version
      : !address.endsWith('/__data.json') && !text.includes(`version: ${JSON.stringify(version)}`)
  )
    return;
  if (/^\{"type":"redirect"|\{"type":"(skip|error)"/.test(text)) return;
  if (since !== signOuts) return;
  await (await caches.open(PAGES)).put(pageKey(new URL(address, sw.location.origin)), response);
}

/** Keeps a page and its data, fetched as copies that change nothing (D-219). */
async function copy(path: string) {
  const since = signOuts;
  for (const address of [path, dataUrl(path)]) {
    const response = await fetch(address, { headers: { [OFFLINE_COPY_HEADER]: '1' } });
    await store(address, response, since);
  }
}

/** A page or its data: from the server when it answers, else as the phone kept it (D-219). */
async function page(event: FetchEvent, url: URL): Promise<Response> {
  const { request } = event;
  try {
    const response = await fetch(request);
    reached(true);
    if (response.type === 'opaqueredirect') {
      // A redirect the page cannot read: keeping the pages finds out whether it was to signing in.
      event.waitUntil(keep(true).catch(() => {}));
      return response;
    }
    if (await signedOut(response)) {
      await forget();
      return response;
    }
    // Home, the Journal and the shot form are kept by keep(). Another page is kept as it is opened,
    // the page and its data both, so it opens offline from inside the app and from outside it.
    if (response.ok && !isKeptPage(url.pathname))
      event.waitUntil(copy(pagePath(url)).catch(() => {}));
    return response;
  } catch (failure) {
    reached(false);
    const kept = await caches.match(pageKey(url), { cacheName: PAGES });
    if (kept) return kept;
    if (request.mode === 'navigate') {
      // A page the phone does not have: Home, which it always has, opens instead.
      if (url.pathname !== '/') return Response.redirect('/', 302);
      throw failure;
    }
    // Moving to a page the phone does not have: the error page says so, in the shape the app expects
    // of a load that failed, with this version's name (without it the app reloads the whole page).
    return Response.json(
      { message: 'This page is not on the phone yet. Open it once with a connection to keep it.' },
      { status: 503, headers: { [VERSION_HEADER]: version } }
    );
  }
}

/**
 * A change: it needs the server (D-219); without one, nothing changes and the page says so, or the page
 * keeps a shot waiting (D-61).
 */
async function change(event: FetchEvent, url: URL): Promise<Response> {
  const { request } = event;
  const enhanced = request.headers.has('x-sveltekit-action');
  try {
    const response = await fetch(request);
    reached(true);
    if (url.pathname === '/logout') await forget();
    // The kept pages follow the change at once, also when the page does not move (a score given).
    else event.waitUntil(keep(true).catch(() => {}));
    return response;
  } catch (failure) {
    reached(false);
    // A shot, an edit or a score waits on the phone instead (D-61, D-223): the page keeps it.
    if (url.pathname === '/queue') throw failure;
    if (!waitsOffline(url)) void tell({ type: 'needs-connection' });
    // The page stays as it is, and its "Offline" line says why.
    if (enhanced)
      return Response.json(
        { type: 'failure', status: 503, data: NO_CHANGE_ACTION_DATA },
        { status: 503 }
      );
    return new Response(null, { status: 204 });
  }
}

let keptAt = 0;
/** Keeps Home, the Journal and the shot form for every open bean ready for offline use (D-219). */
async function keep(force: boolean) {
  if (!force && Date.now() - keptAt < KEEP_EVERY) return;
  keptAt = Date.now();
  let list: Response;
  try {
    list = await fetch('/offline', { headers: { [OFFLINE_COPY_HEADER]: '1' } });
  } catch {
    keptAt = 0;
    reached(false);
    return;
  }
  reached(true);
  // Not signed in (the first visit opens on signing in): the pages are kept as soon as it is.
  if (await signedOut(list)) {
    keptAt = 0;
    return forget();
  }
  if (!list.ok) {
    keptAt = 0;
    return;
  }
  for (const path of (await list.json()) as string[]) await copy(path);
}

sw.addEventListener('message', (event) => {
  const message = event.data as { type?: string; force?: boolean } | null;
  if (message?.type === 'keep') event.waitUntil(keep(!!message.force).catch(() => {}));
  if (message?.type === 'status') event.source?.postMessage({ type: 'network', online });
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;
  if (request.method === 'GET') {
    if (ASSETS.has(url.pathname))
      event.respondWith(
        caches
          .open(CACHE)
          .then((cache) => cache.match(url.pathname))
          .then((cached) => cached ?? fetch(request))
      );
    else if (isPage(request, url)) event.respondWith(page(event, url));
  } else if (request.method === 'POST') event.respondWith(change(event, url));
});
