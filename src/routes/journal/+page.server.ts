import { error, fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadJournal } from '#lib/server/db/journal.ts';
import { rateShot, ShotRejected } from '#lib/server/db/shots.ts';
import { takeFlash } from '#lib/server/flash.ts';
import { rememberJournalFilters } from '#lib/server/journal-filters.ts';
import type { Actions, PageServerLoad } from './$types';

// Journal (screen 22, D-54): every shot, newest first; ?bean=, ?recipe= and ?unrated=1 filter it. After a
// shot saved from the Journal's "+", it shows the "Shot saved" bar (D-200).
export const load: PageServerLoad = ({ locals, url, cookies, request }) => {
  if (!locals.user) error(401);
  const now = Date.now();
  const journal = loadJournal(
    getDb(),
    locals.user.id,
    {
      beanId: url.searchParams.get('bean') ?? undefined,
      recipeId: url.searchParams.get('recipe') ?? undefined,
      unrated: url.searchParams.get('unrated') === '1'
    },
    now
  );
  // D-117: remember the filters in effect; ids that no longer exist are dropped.
  rememberJournalFilters(cookies, journal, request);
  return { now, journal, flash: takeFlash(cookies) };
};

export const actions: Actions = {
  // D-111: the Rate sheet sets the score of one shot.
  rate: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const data = await request.formData();
    try {
      if (
        !rateShot(
          getDb(),
          locals.user.id,
          String(data.get('shotId') ?? ''),
          Number(data.get('score')),
          Date.now()
        )
      )
        return fail(404);
    } catch (e) {
      if (e instanceof ShotRejected) return fail(400);
      throw e;
    }
    return { rated: true };
  }
};
