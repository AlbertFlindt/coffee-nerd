// The step-by-step start (D-157): after creating the account, and on "+" while something is missing, the
// app walks through Machine → Grinder → Basket (can be skipped) → My setup → first bean, each on its own
// page with "Step n of 5" and "Next". Leaving halfway is fine: the guide resumes at the first missing step.
import { and, eq, isNull } from 'drizzle-orm';
import { guideOf, GUIDE_STEPS, type GuideStep } from '../domain/guide';
import type { Queryable } from './db/client';
import { appState, bean, gear, userSettings } from './db/schema';

export { guideOf, GUIDE_STEPS };

const URL: Record<GuideStep, string> = {
  machine: '/library/gear/new?kind=machine&guide=1',
  grinder: '/library/gear/new?kind=grinder&guide=1',
  basket: '/library/gear/new?kind=basket&guide=1',
  setup: '/library/gear/setup?guide=1',
  bean: '/library/beans/new?guide=1'
};

export const stepUrl = (step: GuideStep): string => URL[step];

/** The first step still missing for this account, or null when it is ready to brew. */
export function firstStep(db: Queryable, ownerId: string): GuideStep | null {
  const kinds = new Set(
    db
      .select({ kind: gear.kind })
      .from(gear)
      .where(and(eq(gear.ownerId, ownerId), isNull(gear.archivedAt)))
      .all()
      .map((g) => g.kind)
  );
  if (!kinds.has('machine')) return 'machine';
  if (!kinds.has('grinder')) return 'grinder';
  const state = db.select().from(appState).where(eq(appState.userId, ownerId)).get();
  if (!kinds.has('basket') && !state?.basketStepSkipped) return 'basket';
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  // The same test the shot form uses for "My setup exists" (shot-form.ts).
  if (
    !settings?.defaultMachineId ||
    !settings.defaultGrinderId ||
    settings.defaultGrind === null ||
    settings.defaultDose === null
  )
    return 'setup';
  const open = db
    .select({ id: bean.id })
    .from(bean)
    .where(and(eq(bean.ownerId, ownerId), eq(bean.status, 'open')))
    .get();
  return open ? null : 'bean';
}

/** Where "Next" goes: the next missing step, or the shot form once everything is there. */
export function guideNext(db: Queryable, ownerId: string): string {
  const step = firstStep(db, ownerId);
  return step ? stepUrl(step) : '/shot/new';
}

/** "Skip" on the basket step: remembered, so the guide does not ask again (D-157). */
export function skipBasketStep(db: Queryable, ownerId: string, now: number): void {
  db.update(appState)
    .set({ basketStepSkipped: true, updatedAt: now })
    .where(eq(appState.userId, ownerId))
    .run();
}
