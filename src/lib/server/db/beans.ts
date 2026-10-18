// The Beans overview (D-37) and its numbers, and adding and editing a bean (D-41, D-130). Every query is
// scoped by the owner (D-60).
import { and, desc, eq } from 'drizzle-orm';
import {
  bestScoreText,
  gramsLeft,
  gramsLeftText,
  localDate,
  originLine,
  roastAgeDays
} from '../../domain/bean';
import { bestRecipe } from '../../domain/best-recipe';
import type { BeanInput } from '../../domain/schemas';
import type { Db, Queryable } from './client';
import { newId } from './ids';
import { bean, recipe, shot, userSettings } from './schema';

export type BeanSummary = {
  id: string;
  name: string;
  /** "Nordlys Roasters · Ethiopia · Natural" (D-37). */
  origin: string;
  roastAgeDays: number;
  /** The best score as shown (D-135); null when no shot is rated ("Not rated yet"). */
  best: string | null;
  recipes: number;
  shots: number;
  /** "120 g left" (D-132); null without a bag weight. */
  gramsLeft: string | null;
};

export type Beans = { open: BeanSummary[]; finished: BeanSummary[] };

/** Open beans newest first, then finished beans, most recently finished first (D-37, D-137). */
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
      dose: recipe.dose,
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

/** The Add bean form's fields; a new form or a re-buy has no roast date yet (D-138). */
export type BeanForm = Omit<BeanInput, 'roastDate'> & { roastDate: string | null };

export class BeanRejected extends Error {
  constructor(readonly problems: string[]) {
    super(`Bean rejected: ${problems.join('; ')}`);
    this.name = 'BeanRejected';
  }
}

function timeZoneOf(db: Queryable, ownerId: string): string {
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

/** D-138: a bag cannot be roasted after today, in your time zone. */
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

/** Adds an open bean (D-41). It does not become the current bean; a shot does that (D-140). */
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

/** Saves an edited bean (D-130). Its re-buy link and status stay as they are. */
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

/** The Edit bean form, filled in from the bean (D-130); null when it is not yours. */
export function loadBeanForm(db: Queryable, ownerId: string, id: string): BeanForm | null {
  const row = ownBean(db, ownerId, id);
  return row ? formOf(row) : null;
}

/**
 * "Same as before" (D-126): every earlier bean once, newest first. Bags with the same name and roaster
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
    const key = JSON.stringify([row.name.trim().toLowerCase(), row.roaster?.trim().toLowerCase()]);
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push({ id: row.id, name: row.name, origin: originLine(row) });
  }
  return choices;
}

/**
 * A re-buy of an earlier bag (D-41, D-139): everything copied except roast date and bag weight, linked
 * to that bag. Null when the bag is not yours.
 */
export function rebuyFields(db: Queryable, ownerId: string, id: string): BeanForm | null {
  const row = ownBean(db, ownerId, id);
  return row ? { ...formOf(row), roastDate: null, bagWeight: null, rebuyOfId: row.id } : null;
}
