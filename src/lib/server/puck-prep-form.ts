// The puck prep pages' actions (D-51, D-52, D-167, D-168, D-175): the posted JSON, saved, or the problems
// in plain words. Shared by the Puck prep page and the routine builder, which both offer "New step".
import { fail } from '@sveltejs/kit';
import {
  addStep,
  removeStep,
  RoutineRejected,
  saveStep,
  StepRejected,
  type RoutineInput,
  type StepInput
} from '#lib/server/db/puck-prep.ts';
import type { Db } from '#lib/server/db/client.ts';

const GENERAL = 'Something on this page is not right';

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
  [/^step: not found/, 'This step could not be found'],
  [/^steps: none/, 'Add a step first'],
  [/^steps: not found/, 'One of the steps could not be found'],
  [/^steps\.\d+: out_of_range/, 'A step value is outside its range'],
  [/^steps\.\d+: value_missing/, 'A step is missing its value'],
  [/^routine: not found/, 'This routine could not be found']
];

export function words(problems: string[]): string[] {
  return [
    ...new Set(
      problems.map((p) =>
        // D-175: a routine a step change would break comes already in words.
        p.startsWith('routine: ') && !p.startsWith('routine: not found')
          ? p.slice('routine: '.length)
          : (PROBLEM.find(([pattern]) => pattern.test(p))?.[1] ?? GENERAL)
      )
    )
  ];
}

async function readPayload<T>(request: Request): Promise<{ id: string; input: T | null }> {
  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  try {
    return { id, input: JSON.parse(String(form.get('payload') ?? '')) as T };
  } catch {
    return { id, input: null };
  }
}

/** Runs a save; a rejection becomes the page's problems. */
export function attempt<T>(save: () => T) {
  try {
    return { saved: true, result: save() };
  } catch (err) {
    if (!(err instanceof StepRejected) && !(err instanceof RoutineRejected)) throw err;
    return fail(400, { problems: words(err.problems) });
  }
}

/** "New step" (D-52); the new step's id comes back so the builder can insert it (D-164). */
export async function addStepAction(db: Db, ownerId: string, request: Request) {
  const { input } = await readPayload<StepInput>(request);
  if (!input) return fail(400, { problems: [GENERAL] });
  const done = attempt(() => addStep(db, ownerId, input, Date.now()));
  return 'result' in done ? { saved: true, stepId: done.result } : done;
}

export async function saveStepAction(db: Db, ownerId: string, request: Request) {
  const { id, input } = await readPayload<StepInput>(request);
  if (!input) return fail(400, { problems: [GENERAL] });
  const done = attempt(() => saveStep(db, ownerId, id, input, Date.now()));
  return 'result' in done ? { saved: true } : done;
}

/** D-168, D-169: deleted when unused, archived when a shot used it, refused while in a routine. */
export async function removeStepAction(db: Db, ownerId: string, request: Request) {
  const id = String((await request.formData()).get('id') ?? '');
  const result = removeStep(db, ownerId, id, Date.now());
  if (result === null) return fail(404, { problems: ['This step could not be found'] });
  if (result === 'in_routine')
    return fail(409, { problems: ['Take it out of its routines first'] });
  return { saved: true };
}

/** The builder's payload: the routine as typed. */
export async function readRoutine(request: Request): Promise<RoutineInput | null> {
  return (await readPayload<RoutineInput>(request)).input;
}

export { GENERAL };
