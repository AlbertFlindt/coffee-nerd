// The phone's back gesture closes what lies on top of a page (a sheet, a dialog, a view inside a
// sheet) instead of leaving the page. Opening one adds a copy of the page's history entry, marked
// with its key; going back to the entry below closes it, and closing it any other way goes back
// again, so the copy is gone. Both entries carry SvelteKit's own data for the same page, so its
// router sees no navigation between them and forms sent meanwhile carry on as before. (SvelteKit's
// shallow routing counts each open and close as a navigation: it would end the shot form's draft,
// and going back would stop a sheet's form from reloading the page's data.)
import { randomId } from './domain/id.ts';

const MARK = 'coffee-nerd:open';

/** What is open now, with how to close it. */
const open = new Map<string, () => void>();
let scheduled = false;
/** A step back taken that has not landed yet. */
let going = false;
let landed: (() => void)[] = [];

function keysOf(state: unknown): string[] {
  const keys = (state as Record<string, unknown> | null)?.[MARK];
  return Array.isArray(keys) ? (keys as string[]) : [];
}

/** Whether the entry's top belongs to something no longer open: a copy that only shows the page again. */
const stale = (keys: string[]) => keys.length > 0 && !open.has(keys[keys.length - 1]);

/**
 * Goes back past the entries of what closed, from the top down to the first one still open. One
 * closed under something still open (a sheet that opens the next as it slides out) keeps its entry
 * until then, and back skips it.
 */
function goBack() {
  scheduled = false;
  const keys = keysOf(history.state);
  let steps = 0;
  while (steps < keys.length && !open.has(keys[keys.length - 1 - steps])) steps++;
  if (steps === 0) return;
  going = true;
  history.go(-steps);
}

function onpopstate(event: PopStateEvent) {
  const keys = keysOf(event.state);
  for (const [key, close] of [...open].reverse()) {
    if (!keys.includes(key)) {
      open.delete(key);
      close();
    }
  }
  // Left from something no longer open: the page moved on with a sheet open, or was reloaded.
  if (stale(keys)) {
    history.back();
    return;
  }
  going = false;
  for (const resolve of landed) resolve();
  landed = [];
}

/** Called once by the layout. */
export function watchBack(): () => void {
  addEventListener('popstate', onpopstate);
  // Reloaded with a sheet open: the sheet is gone, so is its entry.
  if (stale(keysOf(history.state))) history.back();
  return () => removeEventListener('popstate', onpopstate);
}

/**
 * Lets back close something while it is open: call it when it opens, and the function it returns
 * once it has closed. `onclose` is called when the phone goes back.
 */
export function closeOnBack(onclose: () => void): () => void {
  const key = randomId();
  open.set(key, onclose);
  const state = history.state as Record<string, unknown> | null;
  history.pushState({ ...state, [MARK]: [...keysOf(state), key] }, '', location.href);
  return () => {
    // Already closed by going back, or the page moved on and left the copy behind.
    if (!open.delete(key) || !keysOf(history.state).includes(key)) return;
    // A sheet and the view inside it close together: one step back for both.
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(goBack);
    }
  };
}

/**
 * Closes everything open and resolves once its entries are gone: before a navigation that replaces
 * the page's entry, which would otherwise replace the copy instead.
 */
export function closeAll(): Promise<void> {
  for (const [key, close] of [...open].reverse()) {
    open.delete(key);
    close();
  }
  goBack();
  return going ? new Promise((resolve) => landed.push(resolve)) : Promise.resolve();
}
