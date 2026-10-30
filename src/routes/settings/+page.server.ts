import { error, fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadSettings, saveStep } from '#lib/server/db/settings.ts';
import type { StepName } from '#lib/domain/settings.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings behind the gear on Home (D-30, D-34, D-248): the steps, your data, Sign out and the version.
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  // D-225: signing out clears this account's waiting shots, and asks first.
  return { userId: locals.user.id, steps: loadSettings(getDb(), locals.user.id).steps };
};

const NAMES: readonly StepName[] = ['dose', 'yield', 'time'];

export const actions: Actions = {
  // D-249: a tapped step is saved at once.
  steps: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const data = await request.formData();
    const name = String(data.get('name') ?? '') as StepName;
    const step = Number(data.get('step'));
    if (!NAMES.includes(name) || !saveStep(getDb(), locals.user.id, name, step, Date.now()))
      return fail(400);
    return { saved: name };
  }
};
