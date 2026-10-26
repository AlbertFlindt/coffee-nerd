// The shots waiting on the phone (D-61, D-220 to D-224): kept in the browser's database (IndexedDB),
// shown by the pages at once, and sent in the order they were brewed whenever the server can be reached.
// The server saves each one once, however often it is sent.
import type { ActionResult } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import {
  afterSend,
  applyChange,
  queueRequest,
  sendOrder,
  type SendResult,
  type WaitingChange,
  type WaitingEntry
} from './domain/waiting';
import type { Flash } from './server/flash';

const DATABASE = 'coffee-nerd';
const STORE = 'waiting-shots';
// While shots wait and the phone seems online, the server is tried again this often.
const RETRY_EVERY = 30_000;
const TIME_LIMIT = 4_000;

/** The entries as the pages show them; filled once the layout has read the phone's database. */
export const waiting = $state({ entries: [] as WaitingEntry[], loaded: false });

let opening: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> {
  opening ??= new Promise((done, fail) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'shotId' });
    request.onsuccess = () => done(request.result);
    request.onerror = () => fail(request.error);
  });
  opening.catch(() => (opening = null));
  return opening;
}

/** Runs `change` on every entry in one transaction and returns the entries after it. */
async function update(
  change: (entries: WaitingEntry[]) => WaitingEntry[] = (entries) => entries
): Promise<WaitingEntry[]> {
  const db = await database();
  return new Promise((done, fail) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const read = store.getAll();
    let after: WaitingEntry[] = [];
    read.onsuccess = () => {
      const before = read.result as WaitingEntry[];
      after = change(before);
      const kept = new Set(after.map((e) => e.shotId));
      for (const entry of before) if (!kept.has(entry.shotId)) store.delete(entry.shotId);
      for (const entry of after) store.put($state.snapshot(entry));
    };
    transaction.oncomplete = () => {
      waiting.entries = after;
      done(after);
    };
    transaction.onerror = () => fail(transaction.error);
  });
}

/** Reads the phone's database into `waiting`. */
export async function loadWaiting(): Promise<void> {
  try {
    await update();
  } catch {
    // No database here (a private window that refuses it): nothing waits.
  }
  waiting.loaded = true;
}

/** Keeps a shot, an edit or a score on the phone, then tries to send it at once. */
export async function keepWaiting(change: WaitingChange, ownerId: string): Promise<void> {
  await update((entries) => applyChange(entries, $state.snapshot(change), ownerId, Date.now()));
  void keepStorage();
  void sendWaiting(ownerId);
}

/**
 * Shots not yet sent are kept even when the phone runs short of space and clears what sites stored.
 * Asked once a shot waits, and only until granted: some browsers ask the person.
 */
async function keepStorage() {
  try {
    if (navigator.storage && !(await navigator.storage.persisted()))
      await navigator.storage.persist();
  } catch {
    // Not offered here: the browser decides.
  }
}

/** D-224, D-231: deletes a shot that is not on the server. */
export async function deleteWaiting(shotId: string): Promise<void> {
  const removed = await locked(async () => {
    const kept = (await update()).some((e) => e.shotId === shotId);
    if (kept) await update((entries) => entries.filter((e) => e.shotId !== shotId));
    return kept;
  });
  // Sent meanwhile: the server has it now, so it is deleted there (D-116).
  if (!removed)
    await fetch(`/journal/${encodeURIComponent(shotId)}/edit?/delete`, {
      method: 'POST',
      headers: { 'x-sveltekit-action': 'true' },
      body: new FormData()
    }).catch(() => {});
}

/**
 * A change saved online replaces what waited for the same shot: the latest change wins (D-223). Also
 * "Discard change" (D-238). Waits for a send in progress, so the waiting change never arrives after it
 * (D-239).
 */
export async function dropWaiting(shotId: string): Promise<WaitingEntry | null> {
  let dropped: WaitingEntry | null = null;
  await locked(() =>
    update((entries) => {
      dropped = entries.find((e) => e.shotId === shotId) ?? null;
      return entries.filter((e) => e.shotId !== shotId);
    })
  );
  return dropped;
}

/** A change dropped for an online save the server did not take waits again as it was (D-239). */
export async function putBackWaiting(entry: WaitingEntry): Promise<void> {
  await update((entries) =>
    entries.some((e) => e.shotId === entry.shotId) ? entries : [...entries, entry]
  );
}

/** Whether anything of this shot waits on the phone: a score for it then waits with it (D-223). */
export function isWaiting(shotId: string): boolean {
  return waiting.entries.some((e) => e.shotId === shotId);
}

const LOCK = 'coffee-nerd-waiting-shots';

/** One window sends or deletes at a time, so a shot is never deleted on the phone while it is sent. */
function locked<T>(run: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request(LOCK, run) : run();
}

/** D-225: signing out leaves no shot of that account on the phone. */
export async function clearWaiting(ownerId: string): Promise<void> {
  await update((entries) => entries.filter((e) => e.ownerId !== ownerId));
}

/** What the server's answer means for an entry; null: no answer from the app, so try again later. */
async function resultOf(response: Response): Promise<SendResult | null> {
  if (!response.headers.get('content-type')?.includes('json')) return null;
  const body = (await response.json()) as { outcome?: string; problems?: string[] };
  if (body.outcome === 'saved' || body.outcome === 'gone') return { kind: 'sent' };
  if (body.outcome === 'refused') return { kind: 'refused', problems: body.problems ?? [] };
  // D-237: an error of the app itself. A proxy's page while the server restarts is not one.
  if (response.status >= 500) return { kind: 'failed' };
  return null;
}

let sending: Promise<void> | null = null;
let again = false;
let signedIn: string | null = null;

/** Sends the waiting shots of this account, oldest brew first; stops at the first one that cannot go. */
export function sendWaiting(ownerId: string | null): Promise<void> {
  if (!ownerId) return Promise.resolve();
  if (sending) {
    // A shot kept while sending goes out right after.
    again = true;
    return sending;
  }
  sending = (async () => {
    do {
      again = false;
      await send(ownerId);
    } while (again);
  })().finally(() => (sending = null));
  return sending;
}

async function send(ownerId: string) {
  // One window sends at a time (the server would save a shot once anyway).
  const run = async () => {
    let entries: WaitingEntry[];
    try {
      entries = sendOrder(await update(), ownerId);
    } catch {
      return false;
    }
    let changed = false;
    for (const entry of entries) {
      let result: SendResult | null;
      try {
        const response = await fetch('/queue', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(queueRequest(entry)),
          // D-235: a server this slow counts as offline; the server saves each change once anyway.
          signal: AbortSignal.timeout(TIME_LIMIT)
        });
        result = await resultOf(response);
      } catch {
        // No connection, or no answer in time: everything waits for the next try.
        break;
      }
      // Signed out, another account, or no answer from the app: try again later.
      if (!result) break;
      let stop = false;
      await update((all) => {
        const after = afterSend(all, entry, result);
        stop = after.stop;
        return after.entries;
      });
      if (result.kind !== 'failed') changed = true;
      if (stop) break;
    }
    return changed;
  };
  const changed = await locked(run);
  // The pages show what the server has now.
  if (changed) await invalidateAll();
}

/** Called once by the layout: reads what waits and sends it whenever the server may be reachable. */
export function watchWaiting(ownerId: () => string | undefined): () => void {
  // Only the pages that show waiting shots name the account; in between, the last one named holds.
  const tryAgain = () => {
    signedIn = ownerId() ?? signedIn;
    if (navigator.onLine && waiting.entries.some((e) => e.status === 'waiting'))
      void sendWaiting(signedIn);
  };
  void loadWaiting().then(tryAgain);
  addEventListener('online', tryAgain);
  const timer = setInterval(tryAgain, RETRY_EVERY);
  return () => {
    removeEventListener('online', tryAgain);
    clearInterval(timer);
  };
}

/**
 * Whether a form's change did not reach the server: the service worker answers for it (503), or there is
 * no connection at all. A change the server refused is not this: it says so on the form, as online.
 */
export function unreached(result: ActionResult): boolean {
  if (result.type === 'failure') return result.status === 503;
  return result.type === 'error' && result.status === undefined;
}

let savedOnPhone: Flash | null = null;

/** D-232: a shot kept on the phone shows the usual "Shot saved" bar on the page it returns to. */
export function showSavedOnPhone(): void {
  savedOnPhone = { kind: 'saved' };
}

/** The "Shot saved" bar of a shot just kept on the phone, once. */
export function takeSavedOnPhone(): Flash | null {
  const flash = savedOnPhone;
  savedOnPhone = null;
  return flash;
}
