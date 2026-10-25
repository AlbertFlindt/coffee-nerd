import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadInsights } from '#lib/server/insights/insights.ts';
import type { PageServerLoad } from './$types';

// Insights (screens 23–25, D-55, D-56): the data basis and every card; the page shows one topic at a time.
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) error(401);
  return { insights: loadInsights(getDb(), locals.user.id, Date.now()) };
};
