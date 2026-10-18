import { error, redirect } from '@sveltejs/kit';
import { addGear, loadMachineSizes } from '#lib/server/db/gear.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { saveGearForm } from '#lib/server/gear-form.ts';
import type { Actions, PageServerLoad } from './$types';

const KINDS = ['machine', 'grinder', 'basket'] as const;

// Add gear (D-147): ?kind=machine|grinder|basket opens that kind's page, empty.
export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.user) error(401);
  const kind = KINDS.find((k) => k === url.searchParams.get('kind'));
  if (!kind) error(404);
  return { kind, machines: loadMachineSizes(getDb(), locals.user.id) };
};

export const actions: Actions = {
  save: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const ownerId = locals.user.id;
    const problem = await saveGearForm(request, (input) => {
      addGear(getDb(), ownerId, input, Date.now());
    });
    if (problem) return problem;
    redirect(303, '/library/gear');
  }
};
