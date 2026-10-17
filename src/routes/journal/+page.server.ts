import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadJournal } from '#lib/server/db/journal.ts';
import type { PageServerLoad } from './$types';

// Journal (screen 22, D-54): every shot, newest first; ?bean= and ?unrated=1 filter it.
export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.user) error(401);
  const now = Date.now();
  return {
    now,
    journal: loadJournal(
      getDb(),
      locals.user.id,
      {
        beanId: url.searchParams.get('bean') ?? undefined,
        unrated: url.searchParams.get('unrated') === '1'
      },
      now
    )
  };
};
