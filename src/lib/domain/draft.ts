// The shot form's draft (D-226): what is being entered is kept on the phone, so a reload or closing the
// app never loses it; opening the form again restores it. Save and Back end it. Pure: the form keeps the
// list in the phone's storage (shot-draft.ts).
import type { ShotState } from '../components/shot-state';

export type Draft = {
  ownerId: string;
  /** Which form: a new shot, or one shot's form (a saved shot's edit, or a shot waiting on the phone). */
  form: string;
  /** What a new shot started from: its bean and prefill. Another one starts the form again. */
  basis: string;
  shot: ShotState;
  /** What the form opened with when the draft began; a shot's form that now opens otherwise drops it. */
  start: ShotState;
};

export function draftForm(shotId: string | null): string {
  return shotId === null ? 'new' : `shot:${shotId}`;
}

const same = (d: Draft, ownerId: string, form: string) => d.ownerId === ownerId && d.form === form;
const sameValues = (a: ShotState, b: ShotState) =>
  JSON.stringify({ ...a, id: '' }) === JSON.stringify({ ...b, id: '' });

/**
 * The values to open the form with, and the drafts after opening it. A new shot's draft from another
 * bean (D-94) or another prefill ("Use last shot recipe", D-43) is dropped: the form starts again. A
 * shot's own draft keeps its values with another bean (D-113), but only while the shot opens as it did
 * when the draft began: a change that waits for it since (a score given offline, D-239), or the shot
 * sent and saved meanwhile, starts the form from that instead. A new shot's draft opens with a new id
 * (`newId`): its Save may have reached the server just before the app closed, and the server keeps a
 * shot's id once (D-61), so the values entered again are saved as a shot of their own, never dropped.
 */
export function restoreDraft(
  drafts: readonly Draft[],
  ownerId: string,
  form: string,
  basis: string,
  start: ShotState,
  newId: () => string
): { shot: ShotState | null; drafts: Draft[] } {
  const draft = drafts.find((d) => same(d, ownerId, form));
  if (draft && form !== 'new' && sameValues(draft.start, start))
    return { shot: structuredClone(draft.shot), drafts: [...drafts] };
  if (draft && form === 'new' && draft.basis === basis)
    return { shot: { ...structuredClone(draft.shot), id: newId() }, drafts: [...drafts] };
  return { shot: null, drafts: drafts.filter((d) => d !== draft) };
}

/** Keeps the form's values; a form as it opened (a new shot's id aside) keeps none. */
export function keepDraft(
  drafts: readonly Draft[],
  ownerId: string,
  form: string,
  basis: string,
  shot: ShotState,
  start: ShotState
): Draft[] {
  const rest = drafts.filter((d) => !same(d, ownerId, form));
  if (sameValues(shot, start)) return rest;
  return [
    ...rest,
    { ownerId, form, basis, shot: structuredClone(shot), start: structuredClone(start) }
  ];
}

/** Save and Back end the draft (D-226). */
export function endDraft(drafts: readonly Draft[], ownerId: string, form: string): Draft[] {
  return drafts.filter((d) => !same(d, ownerId, form));
}

/** D-225: signing out leaves nothing of the account on the phone. */
export function clearDrafts(drafts: readonly Draft[], ownerId: string): Draft[] {
  return drafts.filter((d) => d.ownerId !== ownerId);
}

/**
 * Whether a restored draft still has the form's shape: a draft kept by an earlier version of the app,
 * with other values, is not restored.
 */
export function fitsForm(shot: ShotState, start: ShotState): boolean {
  const keys = (o: object | null) =>
    o && typeof o === 'object' ? Object.keys(o).sort().join() : '';
  return (
    keys(shot) === keys(start) &&
    keys(shot.taste) === keys(start.taste) &&
    keys(shot.setup) === keys(start.setup) &&
    Array.isArray(shot.tagIds) &&
    Array.isArray(shot.newTagNames)
  );
}
