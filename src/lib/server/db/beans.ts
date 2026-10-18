// The Beans overview (D-37) and its numbers. Every query is scoped by the owner (D-60).
import { and, desc, eq } from 'drizzle-orm';
import {
  bestScoreText,
  gramsLeft,
  gramsLeftText,
  originLine,
  roastAgeDays
} from '../../domain/bean';
import { bestRecipe } from '../../domain/best-recipe';
import type { Queryable } from './client';
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
