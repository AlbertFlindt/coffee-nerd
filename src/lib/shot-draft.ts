// The shot form's draft on the phone (D-226), in the browser's own storage: kept at once on every change,
// so it is there however the page ends. Without storage (a private window that refuses it) there is none.
import type { ShotState } from './components/shot-state';
import { clearDrafts, endDraft, keepDraft, restoreDraft, type Draft } from './domain/draft';

const KEY = 'coffee-nerd-drafts';

function read(): Draft[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function write(drafts: Draft[]) {
  try {
    if (drafts.length) localStorage.setItem(KEY, JSON.stringify(drafts));
    else localStorage.removeItem(KEY);
  } catch {
    // Full or refused: the form still works, without a draft.
  }
}

export function openDraft(ownerId: string, form: string, basis: string): ShotState | null {
  const { shot, drafts } = restoreDraft(read(), ownerId, form, basis);
  write(drafts);
  return shot;
}

export function saveDraft(
  ownerId: string,
  form: string,
  basis: string,
  shot: ShotState,
  start: ShotState
): void {
  write(keepDraft(read(), ownerId, form, basis, shot, start));
}

export function dropDraft(ownerId: string, form: string): void {
  write(endDraft(read(), ownerId, form));
}

export function forgetDrafts(ownerId: string): void {
  write(clearDrafts(read(), ownerId));
}
