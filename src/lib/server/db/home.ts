// Home (screen 6, D-32): the bean on Home, its last shot, quick numbers and best recipe. Every query is
// scoped by the owner (D-60).
import { and, desc, eq } from 'drizzle-orm';
import { gramsLeft, gramsLeftText, PROCESS_LABEL, roastAgeDays } from '../../domain/bean';
import { recipeHistory, recipeTitle } from '../../domain/bean-detail';
import { bestRecipe } from '../../domain/best-recipe';
import type { RecipeMatch } from '../../domain/fingerprint';
import {
  bestScoreOutOfTen,
  dialInProgress,
  lastShotValues,
  thisWeek,
  type DialInGraph,
  type ShotValue,
  type Week
} from '../../domain/home';
import type { GrinderSpec, MachineSpec } from '../../domain/schemas';
import { setupSummary } from '../../domain/shot-form';
import { decimalsFor, formatQuantity, type Thousandths } from '../../domain/units';
import type { Db, Queryable } from './client';
import { appState, bean, gear, recipe, shot, userSettings } from './schema';

export type HomeBean = {
  id: string;
  name: string;
  /** "Natural · 12 days" after the name in the bean list, as on the shot form (D-134). */
  detail: string;
};

export type HomeLastShot = {
  id: string;
  brewedAt: number;
  score: number | null;
  /** The score of the recipe's latest rated shot before this one, the faint marker of the Rate sheet (D-12). */
  previousScore: number | null;
  /** "Grind 1.6", "Time 25.5 s" … in two fixed columns (D-32). */
  values: { left: ShotValue[]; right: ShotValue[] };
  /** The recipe tag as it was when the shot was brewed (D-16). */
  recipeTag: RecipeMatch;
};

export type Home =
  | { state: 'no-bean' }
  | {
      state: 'ready';
      /** `label`: the bean pill, "Guji Hambela · Natural" as on the shot form's bean card. */
      bean: HomeBean & { label: string; roastAgeDays: number; gramsLeft: string | null };
      /** Open beans for the bean pill, newest first (D-32, D-195). */
      openBeans: HomeBean[];
      lastShot: HomeLastShot | null;
      /** This bean's shots since Monday (D-194). */
      week: Week;
      /** The best recipe (D-66), its score as on the Beans pages (D-135, D-197); null without a rated shot. */
      best: { score: string; title: string; detail: string } | null;
      /** Dial-in progress (D-196); null with fewer than 2 rated shots. */
      graph: DialInGraph | null;
      timeZone: string;
    };

/**
 * Home for the bean Home and "+" share (D-195): the current bean while it is open, otherwise the newest
 * open bean, as on the shot form. With no open bean, Home has nothing to show for one (D-198).
 */
export function loadHome(db: Queryable, ownerId: string, now: number): Home {
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  if (!settings) throw new Error('Signed-in user without settings');
  const { timeZone } = settings;
  const open = db
    .select()
    .from(bean)
    .where(and(eq(bean.ownerId, ownerId), eq(bean.status, 'open')))
    .orderBy(desc(bean.createdAt), desc(bean.id))
    .all();
  const state = db.select().from(appState).where(eq(appState.userId, ownerId)).get();
  const current = open.find((b) => b.id === state?.currentBeanId) ?? open[0];
  if (!current) return { state: 'no-bean' };

  const choice = (b: (typeof open)[number]): HomeBean => {
    const days = roastAgeDays(b.roastDate, now, timeZone);
    const age = `${days} ${days === 1 ? 'day' : 'days'}`;
    return {
      id: b.id,
      name: b.name,
      detail: b.process ? `${PROCESS_LABEL[b.process]} · ${age}` : age
    };
  };

  // This bean's shots, newest first, with their recipe and grinder for the values.
  const shots = db
    .select({
      id: shot.id,
      brewedAt: shot.brewedAt,
      recipeId: shot.recipeId,
      dose: shot.dose,
      yield: shot.yield,
      time: shot.time,
      score: shot.score,
      balance: shot.balance,
      grind: recipe.grind,
      grinderSpec: gear.spec
    })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .innerJoin(gear, eq(gear.id, recipe.grinderId))
    .where(and(eq(shot.ownerId, ownerId), eq(recipe.beanId, current.id)))
    .orderBy(desc(shot.brewedAt), desc(shot.id))
    .all();
  const steps = {
    dose: settings.doseStep,
    yield: settings.yieldStep,
    time: settings.timeStep
  };

  const last = shots[0];
  let lastShot: HomeLastShot | null = null;
  if (last) {
    const earlier = shots.filter((s) => s.recipeId === last.recipeId).slice(1);
    lastShot = {
      id: last.id,
      brewedAt: last.brewedAt,
      score: last.score,
      previousScore: earlier.find((s) => s.score !== null)?.score ?? null,
      values: lastShotValues(last, {
        ...steps,
        grind: (last.grinderSpec as GrinderSpec).dial.step
      }),
      recipeTag:
        earlier.length === 0
          ? { kind: 'new', changes: [] }
          : { kind: 'reused', shotCount: earlier.length }
    };
  }

  return {
    state: 'ready',
    bean: {
      ...choice(current),
      label: current.process ? `${current.name} · ${PROCESS_LABEL[current.process]}` : current.name,
      roastAgeDays: roastAgeDays(current.roastDate, now, timeZone),
      gramsLeft: gramsLeftText(
        gramsLeft(
          current.bagWeight,
          shots.map((s) => s.dose)
        )
      )
    },
    openBeans: open.map(choice),
    lastShot,
    week: thisWeek(shots, now, timeZone),
    best: bestOf(db, ownerId, current.id, shots, steps),
    graph: dialInProgress(shots),
    timeZone
  };
}

/**
 * "Grind 1.6 · 18.0 g → 36.0 g · 28.0 s" with yield and time from the recipe's latest shot (D-143), then
 * the setup line as on the bean card (D-100) and "Reused 4x" (D-42).
 */
type BeanShot = {
  recipeId: string;
  brewedAt: number;
  score: number | null;
  yield: Thousandths | null;
  time: Thousandths | null;
};

function bestOf(
  db: Queryable,
  ownerId: string,
  beanId: string,
  shots: readonly BeanShot[],
  steps: { dose: Thousandths; yield: Thousandths; time: Thousandths }
): { score: string; title: string; detail: string } | null {
  const recipeIds = [...new Set(shots.map((s) => s.recipeId))];
  const best = bestRecipe(
    recipeIds.map((recipeId) => ({
      recipeId,
      shots: shots.filter((s) => s.recipeId === recipeId)
    }))
  );
  if (!best) return null;
  const r = db
    .select()
    .from(recipe)
    .where(
      and(eq(recipe.id, best.recipeId), eq(recipe.ownerId, ownerId), eq(recipe.beanId, beanId))
    )
    .get()!;
  const gearOf = (id: string) =>
    db
      .select({ spec: gear.spec })
      .from(gear)
      .where(and(eq(gear.id, id), eq(gear.ownerId, ownerId)))
      .get()?.spec;
  const grinder = gearOf(r.grinderId) as GrinderSpec | undefined;
  const machine = gearOf(r.machineId) as MachineSpec | undefined;
  const its = shots.filter((s) => s.recipeId === r.id);
  const latest = its[0];
  const core = recipeTitle(
    { grind: r.grind, dose: r.dose, yield: latest?.yield ?? null },
    { grind: grinder?.dial.step ?? 100, dose: steps.dose, yield: steps.yield }
  );
  const time =
    latest?.time == null
      ? null
      : formatQuantity(latest.time, {
          decimals: Math.max(1, decimalsFor(latest.time, steps.time)),
          unit: 's'
        });
  const setup = setupSummary(r.setup, machine?.features ?? []);
  return {
    score: bestScoreOutOfTen(best),
    title: time === null ? core : `${core} · ${time}`,
    detail: [setup, recipeHistory(its.length).text].filter((p) => p).join(' · ')
  };
}

/**
 * The bean pill (D-195): one of your open beans becomes the bean Home shows and "+" starts from.
 * False when the bean is not one of your open beans.
 */
export function chooseHomeBean(db: Db, ownerId: string, beanId: string, now: number): boolean {
  const chosen = db
    .select({ id: bean.id })
    .from(bean)
    .where(and(eq(bean.id, beanId), eq(bean.ownerId, ownerId), eq(bean.status, 'open')))
    .get();
  if (!chosen) return false;
  db.insert(appState)
    .values({ userId: ownerId, currentBeanId: beanId, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: appState.userId,
      set: { currentBeanId: beanId, updatedAt: now }
    })
    .run();
  return true;
}
