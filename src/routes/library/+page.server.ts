import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadLibrary } from '#lib/server/db/gear.ts';
import type { PageServerLoad } from './$types';

// Library (screen 17, D-50, D-156): four doors with two short lines each.
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  return { library: loadLibrary(getDb(), locals.user.id, Date.now()) };
};
