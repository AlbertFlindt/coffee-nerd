import { error, fail } from '@sveltejs/kit';
import { finishBean, loadBeanDetail, reopenBean, toggleBrewNext } from '#lib/server/db/beans.ts';
import { getDb } from '#lib/server/db/connection.ts';
import type { Actions, PageServerLoad } from './$types';

// Bean detail (screen 10, D-42): about, numbers, recipes best first with Brew next, finish and reopen.
export const load: PageServerLoad = ({ locals, params }) => {
  if (!locals.user) error(401);
  const bean = loadBeanDetail(getDb(), locals.user.id, params.id, Date.now());
  if (!bean) error(404);
  return { bean };
};

export const actions: Actions = {
  // D-43: mark or clear Brew next; on a finished bean, marking reopens it (D-129).
  brewNext: async ({ locals, request, params }) => {
    if (!locals.user) error(401);
    const recipeId = String((await request.formData()).get('recipeId') ?? '');
    const result = toggleBrewNext(getDb(), locals.user.id, params.id, recipeId, Date.now());
    if (!result) return fail(404);
    return { brewNext: result };
  },
  // D-40, D-127: finish by hand; the page offers Undo.
  finish: ({ locals, params }) => {
    if (!locals.user) error(401);
    if (!finishBean(getDb(), locals.user.id, params.id, Date.now())) return fail(409);
    return { finished: true };
  },
  // "Reopen", and the Undo after finishing.
  reopen: ({ locals, params }) => {
    if (!locals.user) error(401);
    if (!reopenBean(getDb(), locals.user.id, params.id, Date.now())) return fail(409);
    return { reopened: true };
  }
};
