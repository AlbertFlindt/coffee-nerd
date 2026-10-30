import { error } from '@sveltejs/kit';
import { loadBeans } from '#lib/server/db/beans.ts';
import { getDb } from '#lib/server/db/connection.ts';
import type { PageServerLoad } from './$types';

// Beans overview (screen 7): open beans as cards, finished beans as rows.
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  return { beans: loadBeans(getDb(), locals.user.id, Date.now()) };
};
