import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadShotDetail } from '#lib/server/db/journal.ts';
import { journalFilters } from '#lib/server/journal-filters.ts';
import type { PageServerLoad } from './$types';

// Shot detail (screen 26, D-57), opened from a Journal row.
export const load: PageServerLoad = ({ locals, params, cookies }) => {
  if (!locals.user) error(401);
  const shot = loadShotDetail(getDb(), locals.user.id, params.id);
  if (!shot) error(404, 'Shot not found');
  return { now: Date.now(), shot, filters: journalFilters(cookies) };
};
