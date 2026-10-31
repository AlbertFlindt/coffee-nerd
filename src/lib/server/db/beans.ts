// The Beans overview and its numbers, and adding and editing a bean. Every query is
// scoped to the signed-in account.
import { and, desc, eq } from 'drizzle-orm';
import {
  beanIdentity,
  bestScoreText,
  gramsLeft,
  gramsLeftText,
  localDate,
  originLine,
  roastAgeDays
} from '../../domain/bean';
import { aboutLines, recipeHistory, recipeRowDetail, recipeTitle } from '../../domain/bean-detail';
import { bestRecipe, rankRecipes } from '../../domain/best-recipe';
import type { GrinderSpec, MachineSpec } from '../../domain/schemas';
import { setupSummary } from '../../domain/shot-form';
import type { BeanFormValues as BeanForm } from '../../domain/bean-form';
import type { BeanInput } from '../../domain/schemas';
import type { Db, Queryable } from './client';
import { newId } from './ids';
import { appState, bean, gear, recipe, shot, userSettings } from './schema';
import { clearMark, markedRecipe } from './shots';

export type BeanSummary = {
  id: string;
  name: string;
  /** "Nordlys Roasters · Ethiopia · Natural". */
  origin: string;
  roastAgeDays: number;
  /** The best score as shown; null when no shot is rated ("Not rated yet"). */
  best: string | null;
  recipes: number;
  shots: number;
  /** "120 g left"; null without a bag weight. */
  gramsLeft: string | null;
};

export type Beans = { open: BeanSummary[]; finished: BeanSummary[] };

/** Open beans newest first, then finished beans, most recently finished first. */
export function loadBeans(db: Queryable, ownerId: string, now: number): Beans {
  const beans = db
    .select()
    .from(bean)
    .where(eq(bean.ownerId, ownerId))
    .orderBy(desc(bean.createdAt), desc(bean.id))
    .all();
  if (beans.length === 0) return { open: [], finished: [] };

  const timeZone = db
    .select({ timeZone: userSettings.timeZone })
    .from(userSettings)
    .where(eq(userSettings.userId, ownerId))
    .get()!.timeZone;
  const recipes = db
    .select({ id: recipe.id, beanId: recipe.beanId })
    .from(recipe)
    .where(eq(recipe.ownerId, ownerId))
    .all();
  const shots = db
    .select({
      recipeId: shot.recipeId,
      beanId: recipe.beanId,
      dose: shot.dose,
      score: shot.score,
      brewedAt: shot.brewedAt
    })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .where(and(eq(shot.ownerId, ownerId), eq(recipe.ownerId, ownerId)))
    .all();

  const summary = (b: (typeof beans)[number]): BeanSummary => {
    const ofBean = shots.filter((s) => s.beanId === b.id);
    const recipeIds = recipes.filter((r) => r.beanId === b.id).map((r) => r.id);
    const best = bestRecipe(
      recipeIds.map((recipeId) => ({
        recipeId,
        shots: ofBean.filter((s) => s.recipeId === recipeId)
      }))
    );
    return {
      id: b.id,
      name: b.name,
      origin: originLine(b),
      roastAgeDays: roastAgeDays(b.roastDate, now, timeZone),
      best: bestScoreText(best),
      recipes: recipeIds.length,
      shots: ofBean.length,
      gramsLeft: gramsLeftText(
        gramsLeft(
          b.bagWeight,
          ofBean.map((s) => s.dose)
        )
      )
    };
  };

  return {
    open: beans.filter((b) => b.status === 'open').map(summary),
    finished: beans
      .filter((b) => b.status === 'finished')
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
      .map(summary)
  };
}

export type { BeanFormValues as BeanForm } from '../../domain/bean-form';

export class BeanRejected extends Error {
  constructor(readonly problems: string[]) {
    super(`Bean rejected: ${problems.join('; ')}`);
    this.name = 'BeanRejected';
  }
}

/** Your time zone, for today's date. */
export function timeZoneOf(db: Queryable, ownerId: string): string {
  return (
    db
      .select({ timeZone: userSettings.timeZone })
      .from(userSettings)
      .where(eq(userSettings.userId, ownerId))
      .get()?.timeZone ?? 'UTC'
  );
}

function ownBean(db: Queryable, ownerId: string, id: string) {
  return db
    .select()
    .from(bean)
    .where(and(eq(bean.id, id), eq(bean.ownerId, ownerId)))
    .get();
}

/** A bag cannot be roasted after today, in your time zone. */
function checkRoastDate(db: Queryable, ownerId: string, roastDate: string, now: number): void {
  if (roastDate > localDate(now, timeZoneOf(db, ownerId)))
    throw new BeanRejected(['roastDate: after today']);
}

const fields = (input: BeanInput) => ({
  name: input.name,
  roaster: input.roaster,
  countryCode: input.countryCode,
  region: input.region,
  variety: input.variety,
  process: input.process,
  altitudeMinM: input.altitudeMinM,
  altitudeMaxM: input.altitudeMaxM,
  roastLevel: input.roastLevel,
  roastDate: input.roastDate,
  bagWeight: input.bagWeight
});

/** Adds an open bean. It does not become the current bean; a shot does that. */
export function addBean(db: Db, ownerId: string, input: BeanInput, now: number): string {
  return db.transaction((tx) => {
    checkRoastDate(tx, ownerId, input.roastDate, now);
    if (input.rebuyOfId !== null && !ownBean(tx, ownerId, input.rebuyOfId))
      throw new BeanRejected(['rebuyOfId: not found']);
    const id = newId(now);
    tx.insert(bean)
      .values({
        id,
        ownerId,
        rebuyOfId: input.rebuyOfId,
        ...fields(input),
        status: 'open',
        createdAt: now,
        updatedAt: now
      })
      .run();
    return id;
  });
}

/** Saves an edited bean. Its re-buy link and status stay as they are. */
export function updateBean(
  db: Db,
  ownerId: string,
  id: string,
  input: BeanInput,
  now: number
): void {
  db.transaction((tx) => {
    if (!ownBean(tx, ownerId, id)) throw new BeanRejected(['bean: not found']);
    checkRoastDate(tx, ownerId, input.roastDate, now);
    tx.update(bean)
      .set({ ...fields(input), updatedAt: now })
      .where(and(eq(bean.id, id), eq(bean.ownerId, ownerId)))
      .run();
  });
}

function formOf(row: typeof bean.$inferSelect): BeanForm {
  return {
    name: row.name,
    roaster: row.roaster,
    countryCode: row.countryCode,
    region: row.region,
    variety: row.variety,
    process: row.process,
    altitudeMinM: row.altitudeMinM,
    altitudeMaxM: row.altitudeMaxM,
    roastLevel: row.roastLevel,
    roastDate: row.roastDate,
    bagWeight: row.bagWeight,
    rebuyOfId: row.rebuyOfId
  };
}

/** The Edit bean form, filled in from the bean; null when it is not yours. */
export function loadBeanForm(db: Queryable, ownerId: string, id: string): BeanForm | null {
  const row = ownBean(db, ownerId, id);
  return row ? formOf(row) : null;
}

/**
 * "Same as before": every earlier bean once, newest first. Bags with the same name and roaster
 * count as one bean, shown as its latest bag.
 */
export function rebuyChoices(
  db: Queryable,
  ownerId: string
): { id: string; name: string; origin: string }[] {
  const rows = db
    .select()
    .from(bean)
    .where(eq(bean.ownerId, ownerId))
    .orderBy(desc(bean.createdAt), desc(bean.id))
    .all();
  const seen = new Set<string>();
  const choices: { id: string; name: string; origin: string }[] = [];
  for (const row of rows) {
    const key = beanIdentity(row.name, row.roaster);
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push({ id: row.id, name: row.name, origin: originLine(row) });
  }
  return choices;
}

/**
 * A re-buy of an earlier bag: everything copied except roast date and bag weight, linked
 * to that bag. Null when the bag is not yours.
 */
export function rebuyFields(db: Queryable, ownerId: string, id: string): BeanForm | null {
  const row = ownBean(db, ownerId, id);
  return row ? { ...formOf(row), roastDate: null, bagWeight: null, rebuyOfId: row.id } : null;
}

export type BeanDetail = {
  id: string;
  name: string;
  status: 'open' | 'finished';
  roastAgeDays: number;
  /** The about card's lines; the first is the roaster when `roaster` is set. */
  about: string[];
  roaster: boolean;
  /** The best score as shown; null when no shot is rated. */
  best: string | null;
  recipeCount: number;
  shotCount: number;
  /** Best first. */
  recipes: {
    id: string;
    /** "Grind 1.6 · 18.0 g → 36.0 g". */
    title: string;
    /** "Preinfusion 4 s · 93 °C · avg 28.0 s". */
    detail: string;
    history: { text: string; reused: boolean };
    /** The recipe's highest single score, "8 best"; null when none is rated. */
    best: number | null;
    /** Marked Brew next. */
    marked: boolean;
  }[];
};

/** The bean detail page; null when the bean is not yours. */
export function loadBeanDetail(
  db: Queryable,
  ownerId: string,
  beanId: string,
  now: number
): BeanDetail | null {
  const b = ownBean(db, ownerId, beanId);
  if (!b) return null;
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get()!;
  const recipes = db
    .select()
    .from(recipe)
    .where(and(eq(recipe.beanId, beanId), eq(recipe.ownerId, ownerId)))
    .all();
  const shots = db
    .select({
      recipeId: shot.recipeId,
      score: shot.score,
      yield: shot.yield,
      time: shot.time,
      brewedAt: shot.brewedAt
    })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .where(and(eq(shot.ownerId, ownerId), eq(recipe.beanId, beanId)))
    .orderBy(desc(shot.brewedAt), desc(shot.id))
    .all();
  const gearOf = new Map(
    db
      .select()
      .from(gear)
      .where(eq(gear.ownerId, ownerId))
      .all()
      .map((g) => [g.id, g])
  );
  const marked = markedRecipe(db, ownerId);
  const ofRecipe = (id: string) => shots.filter((s) => s.recipeId === id);
  const byRecipe = recipes.map((r) => ({ recipeId: r.id, shots: ofRecipe(r.id) }));
  const order = rankRecipes(byRecipe);
  const today = localDate(now, settings.timeZone);
  // The rows name the temperature only when the bean's recipes do not all share it.
  // Compared as the rows would show them, not as stored (label or key order do not count).
  const temperatures = new Set(
    recipes.map((r) => {
      const t = r.setup.features.temperature;
      return t?.on ? (t.value ?? null) : null;
    })
  );
  const temperature = temperatures.size > 1;

  return {
    id: b.id,
    name: b.name,
    status: b.status,
    roastAgeDays: roastAgeDays(b.roastDate, now, settings.timeZone),
    about: aboutLines(b, today),
    roaster: b.roaster !== null,
    best: bestScoreText(bestRecipe(byRecipe)),
    recipeCount: recipes.length,
    shotCount: shots.length,
    recipes: order.map((id) => {
      const r = recipes.find((x) => x.id === id)!;
      const its = ofRecipe(id);
      const scores = its.flatMap((s) => (s.score === null ? [] : [s.score]));
      const machine = gearOf.get(r.machineId)?.spec as MachineSpec | undefined;
      const grinder = gearOf.get(r.grinderId)?.spec as GrinderSpec | undefined;
      return {
        id,
        title: recipeTitle(
          { grind: r.grind, dose: r.dose, yield: its[0]?.yield ?? null },
          {
            grind: grinder?.dial.step ?? 100,
            dose: settings.doseStep,
            yield: settings.yieldStep
          }
        ),
        detail: recipeRowDetail(
          setupSummary(r.setup, machine?.features ?? [], { temperature }),
          its.map((s) => s.time),
          settings.timeStep
        ),
        history: recipeHistory(its.length),
        best: scores.length > 0 ? Math.max(...scores) : null,
        marked: marked === id
      };
    })
  };
}

/**
 * The Brew next button: marks this recipe, moving the mark from another; tapping the marked one
 * clears it. On a finished bean, marking reopens the bean. Null when the recipe is not one of
 * yours on this bean.
 */
export function toggleBrewNext(
  db: Db,
  ownerId: string,
  beanId: string,
  recipeId: string,
  now: number
): 'marked' | 'cleared' | 'reopened' | null {
  return db.transaction((tx) => {
    // Only a recipe of the bean whose page this is.
    const r = tx
      .select({ id: recipe.id, beanId: recipe.beanId })
      .from(recipe)
      .where(and(eq(recipe.id, recipeId), eq(recipe.ownerId, ownerId), eq(recipe.beanId, beanId)))
      .get();
    if (!r) return null;
    if (markedRecipe(tx, ownerId) === recipeId) {
      clearMark(tx, ownerId, now);
      return 'cleared';
    }
    // A recipe that only the old mark kept goes with it (docs/SPEC.md §4.1).
    clearMark(tx, ownerId, now);
    tx.update(appState)
      .set({ brewNextRecipeId: recipeId, updatedAt: now })
      .where(eq(appState.userId, ownerId))
      .run();
    return reopen(tx, ownerId, r.beanId, now) ? 'reopened' : 'marked';
  });
}

function reopen(tx: Queryable, ownerId: string, beanId: string, now: number): boolean {
  const result = tx
    .update(bean)
    .set({ status: 'open', finishedAt: null, finishedAutomatically: false, updatedAt: now })
    .where(and(eq(bean.id, beanId), eq(bean.ownerId, ownerId), eq(bean.status, 'finished')))
    .run();
  return result.changes > 0;
}

/** "Mark as finished". True when an open bean of yours was finished. */
export function finishBean(db: Db, ownerId: string, beanId: string, now: number): boolean {
  const result = db
    .update(bean)
    .set({ status: 'finished', finishedAt: now, finishedAutomatically: false, updatedAt: now })
    .where(and(eq(bean.id, beanId), eq(bean.ownerId, ownerId), eq(bean.status, 'open')))
    .run();
  return result.changes > 0;
}

/** "Reopen", and the Undo after finishing by hand. True when a bean was reopened. */
export function reopenBean(db: Db, ownerId: string, beanId: string, now: number): boolean {
  return reopen(db, ownerId, beanId, now);
}

/**
 * Deletes a bean that has no shots, for a bag added by mistake; a bean with shots is finished,
 * never deleted. A recipe kept only by its Brew next mark goes too, with the mark (docs/SPEC.md §4.1), Home
 * stops pointing at it, and a later re-buy links to the bag before it instead.
 */
export function deleteBean(
  db: Db,
  ownerId: string,
  beanId: string
): 'deleted' | 'has_shots' | null {
  return db.transaction((tx) => {
    const b = ownBean(tx, ownerId, beanId);
    if (!b) return null;
    if (beanHasShots(tx, ownerId, beanId)) return 'has_shots';

    const recipeIds = tx
      .select({ id: recipe.id })
      .from(recipe)
      .where(and(eq(recipe.beanId, beanId), eq(recipe.ownerId, ownerId)))
      .all()
      .map((r) => r.id);
    const state = tx.select().from(appState).where(eq(appState.userId, ownerId)).get();
    if (state) {
      const marked = state.brewNextRecipeId !== null && recipeIds.includes(state.brewNextRecipeId);
      tx.update(appState)
        .set({
          brewNextRecipeId: marked ? null : state.brewNextRecipeId,
          currentBeanId: state.currentBeanId === beanId ? null : state.currentBeanId
        })
        .where(eq(appState.userId, ownerId))
        .run();
    }
    for (const id of recipeIds)
      tx.delete(recipe)
        .where(and(eq(recipe.id, id), eq(recipe.ownerId, ownerId)))
        .run();
    tx.update(bean)
      .set({ rebuyOfId: b.rebuyOfId })
      .where(and(eq(bean.rebuyOfId, beanId), eq(bean.ownerId, ownerId)))
      .run();
    tx.delete(bean)
      .where(and(eq(bean.id, beanId), eq(bean.ownerId, ownerId)))
      .run();
    return 'deleted';
  });
}

/** True when any shot was brewed with this bean (only a bean without shots can be deleted). */
export function beanHasShots(db: Queryable, ownerId: string, beanId: string): boolean {
  return (
    db
      .select({ id: shot.id })
      .from(shot)
      .innerJoin(recipe, eq(recipe.id, shot.recipeId))
      .where(and(eq(recipe.beanId, beanId), eq(shot.ownerId, ownerId)))
      .get() !== undefined
  );
}
