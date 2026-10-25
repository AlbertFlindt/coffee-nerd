import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Settings behind the gear on Home (D-30, D-34): only "Sign out" until Settings is built (D-199, M11).
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  return {};
};
