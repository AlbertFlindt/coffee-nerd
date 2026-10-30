import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import {
  archiveRoutine,
  deleteRoutine,
  loadPuckPrep,
  loadRoutine,
  saveRoutine
} from '#lib/server/db/puck-prep.ts';
import { addStepAction, attempt, GENERAL, readRoutine } from '#lib/server/puck-prep-form.ts';
import type { Actions, PageServerLoad } from './$types';

const IN_MY_SETUP = 'Used in My setup · choose another default first';

// A routine in the builder (screen 19).
export const load: PageServerLoad = ({ locals, params }) => {
  if (!locals.user) error(401);
  const db = getDb();
  const routine = loadRoutine(db, locals.user.id, params.id);
  if (!routine) error(404);
  return { routine, steps: loadPuckPrep(db, locals.user.id).steps };
};

export const actions: Actions = {
  save: async ({ locals, request, params }) => {
    if (!locals.user) error(401);
    const ownerId = locals.user.id;
    const input = await readRoutine(request);
    if (!input) return fail(400, { problems: [GENERAL] });
    const done = attempt(() => saveRoutine(getDb(), ownerId, params.id, input, Date.now()));
    if (!('result' in done)) return done;
    redirect(303, '/library/puck-prep');
  },
  // Archived with a confirmation; not My setup's.
  archive: ({ locals, params }) => {
    if (!locals.user) error(401);
    const result = archiveRoutine(getDb(), locals.user.id, params.id, Date.now());
    if (result === null) error(404);
    if (result === 'in_my_setup') return fail(409, { problems: [IN_MY_SETUP] });
    redirect(303, '/library/puck-prep');
  },
  // A routine no shot used can be deleted instead.
  delete: ({ locals, params }) => {
    if (!locals.user) error(401);
    const result = deleteRoutine(getDb(), locals.user.id, params.id);
    if (result === null) error(404);
    if (result === 'in_my_setup') return fail(409, { problems: [IN_MY_SETUP] });
    if (result === 'used')
      return fail(409, { problems: ['A routine that shots have used is archived instead'] });
    redirect(303, '/library/puck-prep');
  },
  addStep: ({ locals, request }) => {
    if (!locals.user) error(401);
    return addStepAction(getDb(), locals.user.id, request);
  }
};
