import { error, fail, redirect } from '@sveltejs/kit';
import {
  archiveGear,
  loadGear,
  loadMachineSizes,
  saveGear,
  usedFeatureKeys
} from '#lib/server/db/gear.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { saveGearForm } from '#lib/server/gear-form.ts';
import type { Actions, PageServerLoad } from './$types';

// A gear page (screens 12, 15, 16): machine, grinder or basket, by its kind (D-44, D-48, D-49).
export const load: PageServerLoad = ({ locals, params }) => {
  if (!locals.user) error(401);
  const db = getDb();
  const item = loadGear(db, locals.user.id, params.id);
  if (!item || item.archived) error(404);
  return {
    item,
    machines: loadMachineSizes(db, locals.user.id),
    // D-151: a custom feature can be deleted only while no shot has used it.
    usedFeatures: item.kind === 'machine' ? usedFeatureKeys(db, locals.user.id) : []
  };
};

export const actions: Actions = {
  save: async ({ locals, request, params }) => {
    if (!locals.user) error(401);
    const ownerId = locals.user.id;
    const problem = await saveGearForm(request, (input) =>
      saveGear(getDb(), ownerId, params.id, input, Date.now())
    );
    if (problem) return problem;
    redirect(303, '/library/gear');
  },
  // D-148: archive; an item My setup uses is refused (D-83).
  archive: ({ locals, params }) => {
    if (!locals.user) error(401);
    const result = archiveGear(getDb(), locals.user.id, params.id, Date.now());
    if (result === null) error(404);
    if (result === 'in_my_setup')
      return fail(409, { problems: ['Used in My setup · choose another default first'] });
    redirect(303, '/library/gear');
  }
};
