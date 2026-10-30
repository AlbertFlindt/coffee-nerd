import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadShotDetail } from '#lib/server/db/journal.ts';
import { journalFilters } from '#lib/server/journal-filters.ts';
import type { PageServerLoad } from './$types';

// Shot detail (screen 26), opened from a Journal row, or from Home's Last shot card with ?from=home
// so that Back returns to Home.
export const load: PageServerLoad = ({ locals, params, cookies, url }) => {
  if (!locals.user) error(401);
  const shot = loadShotDetail(getDb(), locals.user.id, params.id);
  if (!shot) error(404, 'Shot not found');
  return {
    now: Date.now(),
    shot,
    filters: journalFilters(cookies),
    fromHome: url.searchParams.get('from') === 'home'
  };
};
