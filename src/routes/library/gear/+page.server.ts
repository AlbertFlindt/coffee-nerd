import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadGearPage } from '#lib/server/db/gear.ts';
import type { PageServerLoad } from './$types';

// Gear (screen 8, D-38): My setup on top, then machines, grinders and baskets.
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  return { page: loadGearPage(getDb(), locals.user.id) };
};
