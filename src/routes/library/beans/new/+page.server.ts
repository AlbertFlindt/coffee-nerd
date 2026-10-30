import { error, redirect } from '@sveltejs/kit';
import { localDate } from '#lib/domain/bean.ts';
import { beanFormText } from '#lib/domain/bean-form.ts';
import { addBean, rebuyChoices, rebuyFields, timeZoneOf } from '#lib/server/db/beans.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { saveBeanForm } from '#lib/server/bean-form.ts';
import { guideNext, guideOf } from '#lib/server/first-run.ts';
import type { Actions, PageServerLoad } from './$types';

const EMPTY = {
  name: '',
  roaster: null,
  countryCode: null,
  region: null,
  variety: null,
  process: null,
  altitudeMinM: null,
  altitudeMaxM: null,
  roastLevel: null,
  roastDate: null,
  bagWeight: null,
  rebuyOfId: null
};

// Add bean (screen 9); ?rebuy=<bean> fills it from an earlier bag ("Same as before").
export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.user) error(401);
  const db = getDb();
  const rebuyId = url.searchParams.get('rebuy');
  const rebuy = rebuyId ? rebuyFields(db, locals.user.id, rebuyId) : null;
  return {
    text: beanFormText(rebuy ?? EMPTY),
    rebuyName: rebuy?.name ?? null,
    choices: rebuyChoices(db, locals.user.id),
    today: localDate(Date.now(), timeZoneOf(db, locals.user.id)),
    // The last step of the step-by-step start.
    guide: url.searchParams.has('guide') ? guideOf('bean') : null
  };
};

export const actions: Actions = {
  save: async ({ locals, request, url }) => {
    if (!locals.user) error(401);
    const ownerId = locals.user.id;
    let id = '';
    const problem = await saveBeanForm(request, (bean) => {
      id = addBean(getDb(), ownerId, bean, Date.now());
    });
    if (problem) return problem;
    // The guide ends on the shot form; otherwise the new bean's page opens.
    redirect(
      303,
      url.searchParams.has('guide') ? guideNext(getDb(), ownerId) : `/library/beans/${id}`
    );
  }
};
