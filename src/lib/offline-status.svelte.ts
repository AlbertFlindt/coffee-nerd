// The pages' side of offline use: whether the server can be reached, the "Offline" line, and
// asking the service worker to keep Home, the Journal and the shot form ready.
import { NEEDS_CONNECTION } from './offline';

export const network = $state({ offline: false, message: null as string | null });

let changedAt = 0;

// Also to a service worker that does not control this page yet: on the first visit a page opened while
// it was taking over stays without one until the next, but the pages can still be kept for offline use.
function post(message: unknown) {
  const controller = navigator.serviceWorker?.controller;
  if (controller) return controller.postMessage(message);
  void navigator.serviceWorker?.ready.then((registration) =>
    registration.active?.postMessage(message)
  );
}

/** Called once by the layout. */
export function watchNetwork(): void {
  addEventListener('offline', () => (network.offline = true));
  addEventListener('online', () => {
    network.offline = false;
    network.message = null;
    keepForOffline();
  });
  if (!navigator.onLine) network.offline = true;
  // The service worker took over this page (the first visit): it keeps the offline pages at once.
  navigator.serviceWorker?.addEventListener('controllerchange', () =>
    post({ type: 'keep', force: true })
  );
  navigator.serviceWorker?.addEventListener('message', (event) => {
    const data = event.data as { type?: string; online?: boolean } | null;
    if (data?.type === 'network') {
      network.offline = !data.online;
      if (data.online) network.message = null;
    }
    if (data?.type === 'needs-connection') {
      network.offline = true;
      network.message = NEEDS_CONNECTION;
    }
  });
  // A change needs the server: offline, the form is not sent and nothing changes.
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target as HTMLFormElement;
      const method = (event.submitter?.getAttribute('formmethod') ?? form.method).toLowerCase();
      // A shot, an edit or a score waits on the phone instead.
      if (method !== 'post' || form.hasAttribute('data-waits')) return;
      // Only when the phone itself has no network: a server that did not answer once may answer now,
      // and the service worker answers a change that cannot be sent (nothing changes either way).
      if (!navigator.onLine) {
        event.preventDefault();
        event.stopImmediatePropagation();
        network.message = NEEDS_CONNECTION;
        return;
      }
      changedAt = Date.now();
    },
    true
  );
}

/** After each page: keep the offline pages up to date, at once after a change. */
export function keepForOffline(): void {
  post({ type: 'keep', force: Date.now() - changedAt < 10_000 });
  post({ type: 'status' });
}
