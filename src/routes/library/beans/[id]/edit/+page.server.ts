import { error, fail, redirect } from '@sveltejs/kit';
import { localDate } from '#lib/domain/bean.ts';
import { beanFormText } from '#lib/domain/bean-form.ts';
import {
  beanHasShots,
  deleteBean,
  loadBeanForm,
  timeZoneOf,
  updateBean
} from '#lib/server/db/beans.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { saveBeanForm } from '#lib/server/bean-form.ts';
import type { Actions, PageServerLoad } from './$types';

// Edit bean (D-130): the Add bean form, filled in, without "Same as before".
export const load: PageServerLoad = ({ locals, params }) => {
  if (!locals.user) error(401);
  const db = getDb();
  const bean = loadBeanForm(db, locals.user.id, params.id);
  if (!bean) error(404);
  return {
    text: beanFormText(bean),
    // D-145: only a bean without shots can be deleted.
    deletable: !beanHasShots(db, locals.user.id, params.id),
    today: localDate(Date.now(), timeZoneOf(db, locals.user.id))
  };
};

export const actions: Actions = {
  save: async ({ locals, request, params }) => {
    if (!locals.user) error(401);
    const ownerId = locals.user.id;
    const problem = await saveBeanForm(request, (bean) =>
      updateBean(getDb(), ownerId, params.id, bean, Date.now())
    );
    if (problem) return problem;
    // D-130: back to the bean's page.
    redirect(303, `/library/beans/${params.id}`);
  },
  // D-145: delete a bean without shots, then the Beans overview.
  delete: ({ locals, params }) => {
    if (!locals.user) error(401);
    const result = deleteBean(getDb(), locals.user.id, params.id);
    if (result === null) error(404);
    if (result !== 'deleted')
      return fail(409, { problems: ['A bean with shots cannot be deleted'] });
    redirect(303, '/library/beans');
  }
};
