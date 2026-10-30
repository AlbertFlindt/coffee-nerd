import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { addRoutine, loadPuckPrep } from '#lib/server/db/puck-prep.ts';
import { addStepAction, attempt, GENERAL, readRoutine } from '#lib/server/puck-prep-form.ts';
import type { Actions, PageServerLoad } from './$types';

// New routine (screen 19): the builder, empty.
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  return { steps: loadPuckPrep(getDb(), locals.user.id).steps };
};

export const actions: Actions = {
  save: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const ownerId = locals.user.id;
    const input = await readRoutine(request);
    if (!input) return fail(400, { problems: [GENERAL] });
    const done = attempt(() => addRoutine(getDb(), ownerId, input, Date.now()));
    if (!('result' in done)) return done;
    // The Puck prep page asks whether to use it for new shots.
    redirect(303, `/library/puck-prep?ask=${done.result}`);
  },
  // "New step" from the insert sheet.
  addStep: ({ locals, request }) => {
    if (!locals.user) error(401);
    return addStepAction(getDb(), locals.user.id, request);
  }
};
