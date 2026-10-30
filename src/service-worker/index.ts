// The service worker: makes the app installable and keeps on the phone what it needs to open offline.
// Changes still need the server; a shot saved offline waits on the phone until it can be sent.
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';
import {
  dataUrl,
  isDownload,
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
// A server that has not answered by then counts as offline.
const TIME_LIMIT = 4_000;

sw.addEventListener('install', (event) => {
  // No skipWaiting. A new version waits until every window of the app is closed, so it never
  // takes over a page that is in the middle of a shot.
  // Fetched past the browser's own cache, so an updated icon or manifest is never kept from an old copy.
  // An update keeps fresh copies of the pages from the start, while it waits.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([...ASSETS].map((path) => new Request(path, { cache: 'reload' })))
      )
      .then(() => sw.registration.active && keep(true).catch(() => {}))
  );
});

sw.addEventListener('activate', (event) => {
  // The new version is in charge: the files and pages of earlier versions are no longer needed. It
  // also takes the open page on the first visit, so the app is ready offline at once; on an update no
  // window is open by now, so this never takes over a shot in progress.
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

// Signed out, nothing of the account stays on the phone, also in the copies of a version
// that waits. A copy fetched before signing out and arriving after it is not kept.
let signOuts = 0;
async function forget() {
  signOuts += 1;
  newer()?.postMessage({ type: 'forget' });
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((key) => key.startsWith('pages-')).map((key) => caches.delete(key))
  );
}

/** The newer version waiting to take over, when this version is the one in charge. */
function newer(): ServiceWorker | null {
  return sw.serviceWorker?.state === 'activated' ? sw.registration.waiting : null;
}

/**
 * The copy the phone kept of a page or its data. While an update waits there are two sets of copies,
 * this version's and the newer one's: the latest copy opens.
 */
async function keptCopy(url: URL): Promise<Response | undefined> {
  const key = pageKey(url);
  let latest: Response | undefined;
  for (const name of (await caches.keys()).filter((k) => k.startsWith('pages-'))) {
    const kept = await (await caches.open(name)).match(key);
    if (kept && (!latest || takenAt(kept) > takenAt(latest))) latest = kept;
  }
  return latest;
}

function takenAt(response: Response) {
  return Date.parse(response.headers.get('date') ?? '') || 0;
}

/** The server's answer, or a failure once it has taken too long. */
function inTime(answer: Promise<Response>): Promise<Response> {
  return new Promise((done, fail) => {
    const timer = setTimeout(
      () => fail(new Error('The server did not answer in time.')),
      TIME_LIMIT
    );
    answer.then(done, fail).finally(() => clearTimeout(timer));
  });
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
async function store(address: string, response: Response, since: number): Promise<boolean> {
  if (!response.ok || response.redirected) return false;
  const text = await response.clone().text();
  const header = response.headers.get(VERSION_HEADER);
  if (
    header
      ? header !== version
      : !address.endsWith('/__data.json') && !text.includes(`version: ${JSON.stringify(version)}`)
  )
    return false;
  if (/^\{"type":"redirect"|\{"type":"(skip|error)"/.test(text)) return false;
  if (since !== signOuts) return false;
  await (await caches.open(PAGES)).put(pageKey(new URL(address, sw.location.origin)), response);
  return true;
}

/**
 * Keeps a page and its data, fetched as copies that change nothing. The shot form as the
 * Journal opens it keeps only its data: it is only ever opened from inside the app.
 */
async function copy(path: string, since = signOuts) {
  const addresses = path.includes('from=journal') ? [dataUrl(path)] : [path, dataUrl(path)];
  for (const address of addresses) {
    const response = await fetch(address, { headers: { [OFFLINE_COPY_HEADER]: '1' } });
    await store(address, response, since);
  }
}

/** Keeps a page as it was opened, and fetches the other half, its page or its data, as a copy. */
async function keepOpened(url: URL, response: Response, since: number) {
  const path = pagePath(url);
  const opened = url.pathname.endsWith('/__data.json') ? dataUrl(path) : path;
  // Data loaded when moving between pages usually leaves out the parts already on screen: not whole.
  if (!(await store(opened, response, since))) return copy(path, since);
  const other = opened === path ? dataUrl(path) : path;
  await store(other, await fetch(other, { headers: { [OFFLINE_COPY_HEADER]: '1' } }), since);
}

/** A page or its data: from the server when it answers, else as the phone kept it. */
async function page(event: FetchEvent, url: URL): Promise<Response> {
  const { request } = event;
  const answer = fetch(request);
  answer.catch(() => {});
  try {
    const response = await answeredInTime(answer, url);
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
      event.waitUntil(keepOpened(url, response.clone(), signOuts).catch(() => {}));
    return response;
  } catch (failure) {
    reached(false);
    const kept = await keptCopy(url);
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

/** A slow server counts as offline when the phone has a copy; without one, the page waits. */
async function answeredInTime(answer: Promise<Response>, url: URL): Promise<Response> {
  try {
    return await inTime(answer);
  } catch (failure) {
    if (await keptCopy(url)) throw failure;
    return answer;
  }
}

/**
 * A change: it needs the server; without one, nothing changes and the page says so, or the page
 * keeps a shot waiting.
 */
async function change(event: FetchEvent, url: URL): Promise<Response> {
  const { request } = event;
  const enhanced = request.headers.has('x-sveltekit-action');
  // A shot, an edit or a score waits on the phone once the server is slow; other changes wait
  // for it, since a slow server may still make them. The shots on their way time out on their own.
  const answer = fetch(request);
  answer.catch(() => {});
  try {
    const response = await (waitsOffline(url) && url.pathname !== '/queue'
      ? inTime(answer)
      : answer);
    reached(true);
    if (url.pathname === '/logout') await forget();
    // The kept pages follow the change at once, also when the page does not move (a score given).
    else if (!isDownload(url)) event.waitUntil(keep(true).catch(() => {}));
    return response;
  } catch (failure) {
    reached(false);
    // A shot, an edit or a score waits on the phone instead: the page keeps it.
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
let keeping: Promise<void> | null = null;
let askedAgain = false;
let forcedAgain = false;
/**
 * Keeps Home, the Journal and the shot form for every open bean ready for offline use, one
 * round at a time. Asked during a round, it keeps again after it when the round was not enough: a change
 * came in, or the round found the phone signed out (on the first visit, signing in may finish while the
 * round still sees the sign-in page).
 */
function keep(force: boolean): Promise<void> {
  if (keeping) {
    askedAgain = true;
    forcedAgain ||= force;
    return keeping;
  }
  if (!force && Date.now() - keptAt < KEEP_EVERY) return Promise.resolve();
  keeping = (async () => {
    do {
      askedAgain = forcedAgain = false;
      await keepOnce(force).catch(() => {});
      force = forcedAgain || (askedAgain && keptAt === 0);
    } while (force);
  })().finally(() => (keeping = null));
  return keeping;
}

async function keepOnce(force: boolean) {
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
  // A newer version waiting to take over keeps its own copies, which this version cannot.
  newer()?.postMessage({ type: 'keep', force });
}

sw.addEventListener('message', (event) => {
  const message = event.data as { type?: string; force?: boolean } | null;
  if (message?.type === 'keep') event.waitUntil(keep(!!message.force).catch(() => {}));
  if (message?.type === 'forget') event.waitUntil(forget());
  if (message?.type === 'status') event.source?.postMessage({ type: 'network', online });
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;
  if (request.method === 'GET') {
    // The scripts of a newer version that waits are on the phone too: a page it kept may need them
    // offline.
    if (ASSETS.has(url.pathname) || url.pathname.startsWith('/_app/immutable/'))
      event.respondWith(
        caches
          .open(CACHE)
          .then((cache) => cache.match(url.pathname))
          .then((cached) => cached ?? caches.match(url.pathname))
          .then((cached) => cached ?? fetch(request))
      );
    else if (isPage(request, url)) event.respondWith(page(event, url));
  } else if (request.method === 'POST') event.respondWith(change(event, url));
});
