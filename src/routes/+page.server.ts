import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { chooseHomeBean, loadHome } from '#lib/server/db/home.ts';
import { bean } from '#lib/server/db/schema.ts';
import { rateShot, reopenAutoFinishedBean, ShotRejected } from '#lib/server/db/shots.ts';
import { setFlash, takeFlash } from '#lib/server/flash.ts';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

// Home (screen 6, D-32): the bean you're brewing, its last shot, quick numbers and best recipe.
export const load: PageServerLoad = ({ locals, cookies }) => {
  if (!locals.user) error(401);
  return { home: loadHome(getDb(), locals.user.id, Date.now()), flash: takeFlash(cookies) };
};

export const actions: Actions = {
  // D-195: the bean pill chooses the bean Home shows and "+" starts from.
  bean: async ({ locals, request }) => {
    if (!locals.user) error(401);
    const beanId = String((await request.formData()).get('beanId') ?? '');
    if (!chooseHomeBean(getDb(), locals.user.id, beanId, Date.now())) return fail(404);
    return { chosen: true };
  },

  // D-111, D-197: the Rate block on the Last shot card sets the shot's score.
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
  },

  // D-95, D-40: Undo after a shot finished the bean automatically.
  undoFinish: async ({ locals, request, cookies }) => {
    if (!locals.user) error(401);
    const beanId = String((await request.formData()).get('beanId') ?? '');
    const db = getDb();
    if (reopenAutoFinishedBean(db, locals.user.id, beanId, Date.now())) {
      const reopened = db
        .select({ name: bean.name })
        .from(bean)
        .where(and(eq(bean.id, beanId), eq(bean.ownerId, locals.user.id)))
        .get();
      setFlash(cookies, request, { kind: 'reopened', beanName: reopened?.name ?? '' });
    }
    redirect(303, '/');
  }
};
