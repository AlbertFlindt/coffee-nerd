import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { journalWithFilters } from '#lib/server/journal-filters.ts';
import { offlinePages } from '#lib/server/offline-pages.ts';
import type { RequestHandler } from './$types';

// The pages the service worker keeps ready for offline use (D-219), with the Journal as it was left (D-117).
export const GET: RequestHandler = ({ locals, cookies }) => {
  if (!locals.user) error(401);
  const pages = offlinePages(getDb(), locals.user.id);
  const journal = journalWithFilters(cookies);
  if (!pages.includes(journal)) pages.push(journal);
  return json(pages, { headers: { 'cache-control': 'no-store' } });
};
