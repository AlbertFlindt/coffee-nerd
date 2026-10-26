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
};

export function draftForm(shotId: string | null): string {
  return shotId === null ? 'new' : `shot:${shotId}`;
}

const same = (d: Draft, ownerId: string, form: string) => d.ownerId === ownerId && d.form === form;

/**
 * The values to open the form with, and the drafts after opening it. A new shot's draft from another
 * bean (D-94) or another prefill ("Use last shot recipe", D-43) is dropped: the form starts again. A
 * shot's own draft keeps its values with another bean (D-113).
 */
export function restoreDraft(
  drafts: readonly Draft[],
  ownerId: string,
  form: string,
  basis: string
): { shot: ShotState | null; drafts: Draft[] } {
  const draft = drafts.find((d) => same(d, ownerId, form));
  if (draft && (form !== 'new' || draft.basis === basis))
    return { shot: structuredClone(draft.shot), drafts: [...drafts] };
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
  if (JSON.stringify({ ...shot, id: '' }) === JSON.stringify({ ...start, id: '' })) return rest;
  return [...rest, { ownerId, form, basis, shot: structuredClone(shot) }];
}

/** Save and Back end the draft (D-226). */
export function endDraft(drafts: readonly Draft[], ownerId: string, form: string): Draft[] {
  return drafts.filter((d) => !same(d, ownerId, form));
}

/** D-225: signing out leaves nothing of the account on the phone. */
export function clearDrafts(drafts: readonly Draft[], ownerId: string): Draft[] {
  return drafts.filter((d) => d.ownerId !== ownerId);
}
