import { error, fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import {
  addStep,
  loadPuckPrep,
  removeStep,
  saveStep,
  StepRejected,
  type StepInput
} from '#lib/server/db/puck-prep.ts';
import type { Actions, PageServerLoad } from './$types';

// Puck prep (screen 18, D-51): routines and your steps. The step sheet (screen 20, D-52) adds, changes
// and removes a step (D-168, D-169).
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  return { page: loadPuckPrep(getDb(), locals.user.id) };
};

/** Plain words for the problems (D-20); anything else gets a general line. */
const PROBLEM: [RegExp, string][] = [
  [/^name/, 'Name is required'],
  [
    /^setting: used/,
    'A step that shots have used keeps its kind of setting, its unit and its options'
  ],
  [/^setting\.startsAt/, 'Starts at must be within the range'],
  [/^setting\.options/, 'Give at least two options a name'],
  [/^setting\.(min|max)|^setting\.: The range/, 'The range must run from low to high'],
  [/^step: not found/, 'This step could not be found']
];

function words(problems: string[]): string[] {
  return [
    ...new Set(
      problems.map((p) =>
        // D-175: a routine the change would break comes already in words.
        p.startsWith('routine: ')
          ? p.slice('routine: '.length)
          : (PROBLEM.find(([pattern]) => pattern.test(p))?.[1] ??
            'Something on this page is not right')
      )
    )
  ];
}

async function readStep(request: Request): Promise<{ id: string; input: StepInput | null }> {
  const form = await request.formData();
  try {
    return {
      id: String(form.get('id') ?? ''),
      input: JSON.parse(String(form.get('payload') ?? '')) as StepInput
    };
  } catch {
    return { id: String(form.get('id') ?? ''), input: null };
  }
}

function attempt(save: () => void) {
  try {
    save();
  } catch (err) {
    if (!(err instanceof StepRejected)) throw err;
    return fail(400, { problems: words(err.problems) });
  }
  return { saved: true };
}

export const actions: Actions = {
  addStep: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const ownerId = locals.user.id;
    const { input } = await readStep(request);
    if (!input) return fail(400, { problems: ['Something on this page is not right'] });
    return attempt(() => addStep(getDb(), ownerId, input, Date.now()));
  },
  saveStep: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const ownerId = locals.user.id;
    const { id, input } = await readStep(request);
    if (!input) return fail(400, { problems: ['Something on this page is not right'] });
    return attempt(() => saveStep(getDb(), ownerId, id, input, Date.now()));
  },
  // D-168, D-169: deleted when unused, archived when a shot used it, refused while in a routine.
  removeStep: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const id = String((await request.formData()).get('id') ?? '');
    const result = removeStep(getDb(), locals.user.id, id, Date.now());
    if (result === null) return fail(404, { problems: ['This step could not be found'] });
    if (result === 'in_routine')
      return fail(409, { problems: ['Take it out of its routines first'] });
    return { saved: true };
  }
};
