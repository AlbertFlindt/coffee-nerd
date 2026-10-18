import { error, redirect } from '@sveltejs/kit';
import { addGear, loadMachineSizes } from '#lib/server/db/gear.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { guideNext, guideOf, skipBasketStep } from '#lib/server/first-run.ts';
import { saveGearForm } from '#lib/server/gear-form.ts';
import type { Actions, PageServerLoad } from './$types';

const KINDS = ['machine', 'grinder', 'basket'] as const;

// Add gear (D-147): ?kind=machine|grinder|basket opens that kind's page, empty. With &guide=1 it is a step
// of the step-by-step start (D-157): "Step n of 5", "Next", and the basket step can be skipped.
export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.user) error(401);
  const kind = KINDS.find((k) => k === url.searchParams.get('kind'));
  if (!kind) error(404);
  return {
    kind,
    machines: loadMachineSizes(getDb(), locals.user.id),
    guide: url.searchParams.has('guide') ? guideOf(kind) : null
  };
};

export const actions: Actions = {
  save: async ({ locals, request, url }) => {
    if (!locals.user) error(401);
    const ownerId = locals.user.id;
    const db = getDb();
    const problem = await saveGearForm(request, (input) => {
      addGear(db, ownerId, input, Date.now());
    });
    if (problem) return problem;
    redirect(303, url.searchParams.has('guide') ? guideNext(db, ownerId) : '/library/gear');
  },
  // D-157: the basket step can be skipped; the guide remembers it.
  skip: ({ locals }) => {
    if (!locals.user) error(401);
    const db = getDb();
    skipBasketStep(db, locals.user.id, Date.now());
    redirect(303, guideNext(db, locals.user.id));
  }
};
