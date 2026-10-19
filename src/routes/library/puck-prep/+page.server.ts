import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadPuckPrep } from '#lib/server/db/puck-prep.ts';
import { addStepAction, removeStepAction, saveStepAction } from '#lib/server/puck-prep-form.ts';
import type { Actions, PageServerLoad } from './$types';

// Puck prep (screen 18, D-51): routines and your steps. The step sheet (screen 20, D-52) adds, changes
// and removes a step (D-168, D-169).
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  return { page: loadPuckPrep(getDb(), locals.user.id) };
};

export const actions: Actions = {
  addStep: ({ locals, request }) => {
    if (!locals.user) error(401);
    return addStepAction(getDb(), locals.user.id, request);
  },
  saveStep: ({ locals, request }) => {
    if (!locals.user) error(401);
    return saveStepAction(getDb(), locals.user.id, request);
  },
  removeStep: ({ locals, request }) => {
    if (!locals.user) error(401);
    return removeStepAction(getDb(), locals.user.id, request);
  }
};
