// The Journal (D-54) and the shot detail (D-57). Every query is scoped by the owner (D-60).
import { and, asc, desc, eq, inArray, lt, or } from 'drizzle-orm';
import { describeChange, type RecipeMatch } from '../../domain/fingerprint';
import { recipeFilterLabel, shotsThisWeek } from '../../domain/journal';
import type { GrinderSpec, MachineSpec } from '../../domain/schemas';
import { setupDetail } from '../../domain/shot-form';
import type { Thousandths } from '../../domain/units';
import type { Queryable } from './client';
import { bean, gear, recipe, shot, shotTag, tag, userSettings } from './schema';

export type JournalFilter = { beanId?: string; recipeId?: string; unrated?: boolean };

export type JournalShot = {
  id: string;
  brewedAt: number;
  beanName: string;
  grind: Thousandths;
  /** The grinder dial's step, for the grind's decimals (D-07). */
  grindStep: Thousandths;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
  score: number | null;
  balance: number | null;
  /** The recipe tag as it was when the shot was brewed (D-16): reused N× before it, or new. */
  recipeTag: RecipeMatch;
  /** The score of the recipe's latest rated shot before this one, the faint marker of the Rate sheet (D-12). */
  previousScore: number | null;
};

export type Journal = {
  shots: JournalShot[];
  /** Beans that have shots, most recently brewed first, for the bean filter. */
  beans: { id: string; name: string }[];
  /** The bean filter in effect; null for all beans (an unknown bean is ignored). */
  beanId: string | null;
  /** The chosen bean's recipes, most recently brewed first, for the recipe filter (D-112); empty without a bean. */
  recipes: { id: string; label: string }[];
  /** The recipe filter in effect: only with a bean, and only one of its recipes. */
  recipeId: string | null;
  unrated: boolean;
  /** Unrated shots within the bean and recipe filters: "Unrated · N". */
  unratedCount: number;
  /** All shots since Monday, whatever the filter: "9 shots this week". */
  shotsThisWeek: number;
  timeZone: string;
  /** −/+ steps of dose, yield and time, for their decimals (D-07, D-89). */
  steps: Steps;
};

type Steps = { dose: Thousandths; yield: Thousandths; time: Thousandths };

export function loadJournal(
  db: Queryable,
  ownerId: string,
  filter: JournalFilter,
  now: number
): Journal {
  const { timeZone, steps } = settingsOf(db, ownerId);
  // Shots are few (thousands at most): one query, newest first, and the rest in memory.
  const rows = db
    .select({
      id: shot.id,
      brewedAt: shot.brewedAt,
      recipeId: shot.recipeId,
      beanId: recipe.beanId,
      beanName: bean.name,
      grind: recipe.grind,
      dose: recipe.dose,
      setup: recipe.setup,
      grinderSpec: gear.spec,
      yield: shot.yield,
      time: shot.time,
      score: shot.score,
      balance: shot.balance
    })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .innerJoin(bean, eq(bean.id, recipe.beanId))
    .innerJoin(gear, eq(gear.id, recipe.grinderId))
    .where(eq(shot.ownerId, ownerId))
    .orderBy(desc(shot.brewedAt), desc(shot.id))
    .all();

  const tags = recipeTags(rows);
  const beans: Journal['beans'] = [];
  for (const row of rows)
    if (!beans.some((b) => b.id === row.beanId)) beans.push({ id: row.beanId, name: row.beanName });
  const beanId = beans.some((b) => b.id === filter.beanId) ? filter.beanId! : null;
  const ofBean = rows.filter((r) => beanId === null || r.beanId === beanId);
  const recipes: Journal['recipes'] = [];
  if (beanId !== null)
    for (const row of ofBean) {
      if (recipes.some((r) => r.id === row.recipeId)) continue;
      const label = recipeFilterLabel(
        {
          grind: row.grind,
          dose: row.dose,
          routine: row.setup.routine?.name ?? null,
          shotCount: ofBean.filter((r) => r.recipeId === row.recipeId).length
        },
        { grind: (row.grinderSpec as GrinderSpec).dial.step, dose: steps.dose }
      );
      recipes.push({ id: row.recipeId, label });
    }
  const recipeId = recipes.some((r) => r.id === filter.recipeId) ? filter.recipeId! : null;
  const filtered = ofBean.filter((r) => recipeId === null || r.recipeId === recipeId);
  const unrated = filter.unrated === true;

  return {
    shots: filtered
      .filter((r) => !unrated || r.score === null)
      .map((r) => ({
        id: r.id,
        brewedAt: r.brewedAt,
        beanName: r.beanName,
        grind: r.grind,
        grindStep: (r.grinderSpec as GrinderSpec).dial.step,
        dose: r.dose,
        yield: r.yield,
        time: r.time,
        score: r.score,
        balance: r.balance,
        recipeTag: tags.get(r.id)!.tag,
        previousScore: tags.get(r.id)!.previousScore
      })),
    beans,
    beanId,
    recipes,
    recipeId,
    unrated,
    unratedCount: filtered.filter((r) => r.score === null).length,
    shotsThisWeek: shotsThisWeek(
      rows.map((r) => r.brewedAt),
      now,
      timeZone
    ),
    timeZone,
    steps
  };
}

export type ShotDetail = {
  id: string;
  brewedAt: number;
  beanName: string;
  roastDate: string;
  /** "Lelit Bianca · Timemore 064S · VST 18 g · Daily routine" (D-57). */
  gear: string;
  /** The pressure profile and other features (D-57). */
  setup: string;
  recipeTag: RecipeMatch;
  grind: Thousandths;
  grindStep: Thousandths;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
  taste: {
    score: number | null;
    balance: number | null;
    body: number | null;
    sweetness: number | null;
    aftertaste: number | null;
  };
  flavors: string[];
  /** "Compared with this recipe" (D-109): the recipe's shot count and its other shots' results. */
  recipe: { shotCount: number; others: { time: Thousandths | null; score: number | null }[] };
  notes: string | null;
  timeZone: string;
  steps: Steps;
};

export function loadShotDetail(db: Queryable, ownerId: string, shotId: string): ShotDetail | null {
  const row = db
    .select({ shot, recipe, beanName: bean.name, roastDate: bean.roastDate })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .innerJoin(bean, eq(bean.id, recipe.beanId))
    .where(and(eq(shot.id, shotId), eq(shot.ownerId, ownerId)))
    .get();
  if (!row) return null;
  const { shot: s, recipe: r } = row;

  const gearIds = [r.machineId, r.grinderId, ...(r.basketId ? [r.basketId] : [])];
  const gearRows = db
    .select({ id: gear.id, name: gear.name, spec: gear.spec })
    .from(gear)
    .where(and(eq(gear.ownerId, ownerId), inArray(gear.id, gearIds)))
    .all();
  const gearOf = (id: string | null) => gearRows.find((g) => g.id === id);
  const machine = gearOf(r.machineId)!;
  const grinder = gearOf(r.grinderId)!;
  const basket = gearOf(r.basketId);

  const flavors = db
    .select({ name: tag.name })
    .from(shotTag)
    .innerJoin(tag, eq(tag.id, shotTag.tagId))
    .where(and(eq(shotTag.shotId, s.id), eq(tag.ownerId, ownerId)))
    .orderBy(asc(tag.name))
    .all()
    .map((t) => t.name);

  const recipeShots = db
    .select({ id: shot.id, brewedAt: shot.brewedAt, time: shot.time, score: shot.score })
    .from(shot)
    .where(and(eq(shot.ownerId, ownerId), eq(shot.recipeId, r.id)))
    .orderBy(asc(shot.brewedAt), asc(shot.id))
    .all();
  const earlier = recipeShots.filter((o) => before(o, s)).length;
  const others = recipeShots.filter((o) => o.id !== s.id);

  const { timeZone, steps } = settingsOf(db, ownerId);
  return {
    id: s.id,
    brewedAt: s.brewedAt,
    beanName: row.beanName,
    roastDate: row.roastDate,
    gear: [machine.name, grinder.name, basket?.name, r.setup.routine?.name]
      .filter((part) => part)
      .join(' · '),
    setup: setupDetail(r.setup, (machine.spec as MachineSpec).features),
    recipeTag:
      earlier === 0
        ? { kind: 'new', changes: changesSincePrevious(db, ownerId, r, s) }
        : { kind: 'reused', shotCount: earlier },
    grind: r.grind,
    grindStep: (grinder.spec as GrinderSpec).dial.step,
    dose: r.dose,
    yield: s.yield,
    time: s.time,
    taste: {
      score: s.score,
      balance: s.balance,
      body: s.body,
      sweetness: s.sweetness,
      aftertaste: s.aftertaste
    },
    flavors,
    recipe: {
      shotCount: recipeShots.length,
      others: others.map(({ time, score }) => ({ time, score }))
    },
    notes: s.notes,
    timeZone,
    steps
  };
}

/**
 * D-118: for a recipe's first shot, what changed since the bean's shot before it (D-81, D-113), named as
 * on the shot form; nothing when the bean had no shot before.
 */
function changesSincePrevious(
  db: Queryable,
  ownerId: string,
  r: typeof recipe.$inferSelect,
  s: { id: string; brewedAt: number }
): string[] {
  const previous = db
    .select({ recipe })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .where(
      and(
        eq(shot.ownerId, ownerId),
        eq(recipe.beanId, r.beanId),
        or(lt(shot.brewedAt, s.brewedAt), and(eq(shot.brewedAt, s.brewedAt), lt(shot.id, s.id)))
      )
    )
    .orderBy(desc(shot.brewedAt), desc(shot.id))
    .get();
  return previous ? describeChange(r, previous.recipe) : [];
}

/** Brewed before the other shot; the same moment falls back to the id, which is time-ordered (UUID v7). */
function before(a: { id: string; brewedAt: number }, b: { id: string; brewedAt: number }): boolean {
  return a.brewedAt < b.brewedAt || (a.brewedAt === b.brewedAt && a.id < b.id);
}

/**
 * The recipe tag of each shot at the time it was brewed (D-16), and its recipe's last score before it (D-12): "Recipe reused N×" with N the recipe's
 * earlier shots, or "New recipe" for its first. What changed is not named here: that compares with the
 * shot before it on the form (D-81), and the Journal shows "New recipe" alone.
 */
function recipeTags(
  newestFirst: readonly { id: string; recipeId: string; score: number | null }[]
): Map<string, { tag: RecipeMatch; previousScore: number | null }> {
  const seen = new Map<string, { count: number; lastScore: number | null }>();
  const tags = new Map<string, { tag: RecipeMatch; previousScore: number | null }>();
  for (const row of [...newestFirst].reverse()) {
    const { count, lastScore } = seen.get(row.recipeId) ?? { count: 0, lastScore: null };
    tags.set(row.id, {
      tag: count === 0 ? { kind: 'new', changes: [] } : { kind: 'reused', shotCount: count },
      previousScore: lastScore
    });
    seen.set(row.recipeId, { count: count + 1, lastScore: row.score ?? lastScore });
  }
  return tags;
}

function settingsOf(db: Queryable, ownerId: string): { timeZone: string; steps: Steps } {
  const settings = db
    .select({
      timeZone: userSettings.timeZone,
      dose: userSettings.doseStep,
      yield: userSettings.yieldStep,
      time: userSettings.timeStep
    })
    .from(userSettings)
    .where(eq(userSettings.userId, ownerId))
    .get();
  if (!settings) throw new Error('Signed-in user without settings');
  const { timeZone, ...steps } = settings;
  return { timeZone, steps };
}
