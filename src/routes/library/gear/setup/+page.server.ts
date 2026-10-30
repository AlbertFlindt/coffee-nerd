import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadMySetupForm, MySetupRejected, saveMySetup } from '#lib/server/db/my-setup.ts';
import { guideNext, guideOf } from '#lib/server/first-run.ts';
import type { Actions, PageServerLoad } from './$types';

// Edit My setup (screen 13): the starting point for new beans, chosen here only. With ?guide=1
// it is step 4 of the step-by-step start.
export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.user) error(401);
  return {
    setup: loadMySetupForm(getDb(), locals.user.id),
    guide: url.searchParams.has('guide') ? guideOf('setup') : null
  };
};

export const actions: Actions = {
  save: async ({ locals, request, url }) => {
    if (!locals.user) error(401);
    const raw = String((await request.formData()).get('payload') ?? '');
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return fail(400, { problems: ['Something on this page is not right'] });
    }
    try {
      saveMySetup(getDb(), locals.user.id, input, Date.now());
    } catch (err) {
      if (!(err instanceof MySetupRejected)) throw err;
      return fail(400, { problems: err.problems });
    }
    redirect(
      303,
      url.searchParams.has('guide') ? guideNext(getDb(), locals.user.id) : '/library/gear'
    );
  }
};
