import { error, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/connection.ts';
import { bean } from '#lib/server/db/schema.ts';
import { reopenAutoFinishedBean } from '#lib/server/db/shots.ts';
import { setFlash, takeFlash } from '#lib/server/flash.ts';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ cookies }) => ({ flash: takeFlash(cookies) });

export const actions: Actions = {
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
