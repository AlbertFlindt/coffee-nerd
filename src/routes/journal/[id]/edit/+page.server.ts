import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadEditShotForm } from '#lib/server/db/shot-form.ts';
import { deleteShot, editShot, shotRequestSchema, ShotRejected } from '#lib/server/db/shots.ts';
import { journalWithFilters } from '#lib/server/journal-filters.ts';
import { shot } from '#lib/server/db/schema.ts';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

// Editing a shot (D-57, D-113): the shot form in edit mode; ?bean= moves the shot to another open bean.
const NOT_SAVED = 'The shot could not be saved. Nothing was changed.';

export const load: PageServerLoad = ({ locals, params, url }) => {
  if (!locals.user) error(401);
  const form = loadEditShotForm(
    getDb(),
    locals.user.id,
    params.id,
    url.searchParams.get('bean') ?? undefined
  );
  if (!form) error(404, 'Shot not found');
  return { form };
};

export const actions: Actions = {
  save: async ({ locals, params, request }) => {
    if (!locals.user) error(401);
    let json: unknown;
    try {
      json = JSON.parse(String((await request.formData()).get('shot') ?? ''));
    } catch {
      return fail(400, { problems: [NOT_SAVED] });
    }
    const parsed = shotRequestSchema.safeParse(json);
    if (!parsed.success || parsed.data.id !== params.id)
      return fail(400, { problems: [NOT_SAVED] });

    const db = getDb();
    const existing = db
      .select({ brewedAt: shot.brewedAt })
      .from(shot)
      .where(and(eq(shot.id, params.id), eq(shot.ownerId, locals.user.id)))
      .get();
    if (!existing) error(404, 'Shot not found');
    try {
      // D-113: the brewing time stays as it was; the server finds or creates the recipe (data-model §4.1).
      editShot(
        db,
        locals.user.id,
        params.id,
        { ...parsed.data, brewedAt: existing.brewedAt },
        Date.now()
      );
    } catch (e) {
      if (e instanceof ShotRejected) {
        console.error('Shot edit rejected:', e.problems.join('; '));
        return fail(400, { problems: [NOT_SAVED] });
      }
      throw e;
    }
    // D-113: "Save changes" returns to the shot.
    redirect(303, `/journal/${params.id}`);
  },

  // D-116: delete after the confirmation; back to the Journal as you left it (D-117).
  delete: ({ locals, params, cookies }) => {
    if (!locals.user) error(401);
    // A second tap finds the shot already gone: the Journal is still the right place to land.
    deleteShot(getDb(), locals.user.id, params.id);
    redirect(303, journalWithFilters(cookies));
  }
};
