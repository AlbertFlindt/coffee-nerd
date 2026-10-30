import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { archivedCount } from '#lib/server/db/archived.ts';
import { loadGearPage } from '#lib/server/db/gear.ts';
import type { PageServerLoad } from './$types';

// Gear (screen 8): My setup on top, then machines, grinders and baskets.
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  const db = getDb();
  return {
    page: loadGearPage(db, locals.user.id),
    archived: archivedCount(db, locals.user.id, 'gear')
  };
};
