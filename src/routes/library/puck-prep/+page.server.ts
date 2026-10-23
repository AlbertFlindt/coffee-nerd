import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadPuckPrep, useForNewShots } from '#lib/server/db/puck-prep.ts';
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
  },
  // D-187: "Use it for new shots?" answered yes.
  useForNewShots: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const id = String((await request.formData()).get('id') ?? '');
    if (!useForNewShots(getDb(), locals.user.id, id, Date.now())) return fail(404);
    redirect(303, '/library/puck-prep');
  }
};
