import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { loadShotForm } from '#lib/server/db/shot-form.ts';
import { guideNext } from '#lib/server/first-run.ts';
import { clearBrewNext, saveShot, shotRequestSchema, ShotRejected } from '#lib/server/db/shots.ts';
import { setFlash } from '#lib/server/flash.ts';
import { journalFilters, originPath } from '#lib/server/journal-filters.ts';
import { originOf } from '#lib/domain/origin.ts';
import { bean } from '#lib/server/db/schema.ts';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

// New shot (screens 1–5 and 11): "+" opens it prefilled; ?bean= picks another open bean.
// With nothing to brew with yet, "+" resumes the step-by-step start at the first missing step.
// ?from=journal when "+" was pressed on the Journal: Back and Save return there.
const NOT_SAVED = 'The shot could not be saved. Nothing was changed.';

export const load: PageServerLoad = ({ locals, url, cookies }) => {
  if (!locals.user) error(401);
  const db = getDb();
  const form = loadShotForm(db, locals.user.id, url.searchParams.get('bean') ?? undefined);
  if (form.state === 'empty') redirect(303, guideNext(db, locals.user.id));
  return {
    // Whose shots wait on the phone.
    userId: locals.user.id,
    form,
    origin: { from: originOf(url.searchParams.get('from')), filters: journalFilters(cookies) }
  };
};

export const actions: Actions = {
  save: async ({ locals, request, cookies }) => {
    if (!locals.user) error(401);
    const data = await request.formData();
    let json: unknown;
    try {
      json = JSON.parse(String(data.get('shot') ?? ''));
    } catch {
      return fail(400, { problems: [NOT_SAVED] });
    }
    const parsed = shotRequestSchema.safeParse(json);
    if (!parsed.success) return fail(400, { problems: [NOT_SAVED] });

    const db = getDb();
    const now = Date.now();
    try {
      // The server recomputes the fingerprint and finds or creates the recipe (docs/SPEC.md §4.1).
      const result = saveShot(db, locals.user.id, { ...parsed.data, brewedAt: now }, now);
      if (result.autoFinished) {
        const finished = db
          .select({ name: bean.name })
          .from(bean)
          .where(and(eq(bean.id, parsed.data.beanId), eq(bean.ownerId, locals.user.id)))
          .get();
        setFlash(cookies, request, {
          kind: 'finished',
          beanId: parsed.data.beanId,
          beanName: finished?.name ?? ''
        });
      } else setFlash(cookies, request, { kind: 'saved' });
    } catch (e) {
      if (e instanceof ShotRejected) {
        // The details are for the server log; the form says it in plain words.
        console.error('Shot rejected:', e.problems.join('; '));
        return fail(400, { problems: [NOT_SAVED] });
      }
      throw e;
    }
    // Back to where "+" was pressed, which shows the "Shot saved" bar.
    redirect(303, originPath(originOf(String(data.get('from') ?? '')), cookies));
  },

  // "Use last shot recipe" clears the mark; the form starts from the last shot again.
  useLastShot: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const from = originOf(String((await request.formData()).get('from') ?? ''));
    clearBrewNext(getDb(), locals.user.id, Date.now());
    redirect(303, from === 'journal' ? '/shot/new?from=journal' : '/shot/new');
  }
};
