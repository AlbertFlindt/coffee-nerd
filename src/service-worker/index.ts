// The service worker that makes the app installable and keeps its own files on the phone (D-61, D-217).
// Pages and data still come from the server; keeping them for offline use comes next (D-219).
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';

const CACHE = `app-${version}`;
// The built scripts and styles, the icons and the manifest. Only GET requests for these are answered
// from the cache; everything else goes to the server as before.
const ASSETS = new Set([...immutable, ...assets].map(({ path }) => `/${path}`));

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
  // The new version is in charge: the files of earlier versions are no longer needed.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith('app-') && key !== CACHE).map((k) => caches.delete(k))
        )
      )
  );
});

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== sw.location.origin) return;
  if (!ASSETS.has(url.pathname)) return;
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(url.pathname))
      .then((cached) => cached ?? fetch(event.request))
  );
});
