// The Insights page (screens 23–25): the data basis for the header and every card, for one owner.
import { eq } from 'drizzle-orm';
import { localDate } from '../../domain/bean';
import { recipeTitle } from '../../domain/bean-detail';
import { bestRecipe } from '../../domain/best-recipe';
import type { InsightCard } from '../../domain/insights';
import type { Queryable } from '../db/client';
import { homeBeans } from '../db/home';
import { userSettings } from '../db/schema';
import { evaluateInsights, type InsightContext } from './definitions';
import { loadDimensionContext, loadShotFacts, mondayOf, type ShotFact } from './facts';

export type InsightsPage = {
  /** Every shot and every bean with a shot, unrated ones too. */
  shots: number;
  beans: number;
  cards: InsightCard[];
};

/** The weekly line covers the last 12 weeks. */
const WEEKS = 12;

export function loadInsights(db: Queryable, ownerId: string, now: number): InsightsPage {
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  if (!settings) throw new Error('Signed-in user without settings');
  const facts = loadShotFacts(db, ownerId, settings.timeZone);

  const thisWeek = mondayOf(localDate(now, settings.timeZone));
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const [year, month, day] = thisWeek.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day - 7 * (WEEKS - 1 - i)))
      .toISOString()
      .slice(0, 10);
  });

  const home = homeBeans(db, ownerId).current;
  const context: InsightContext = {
    weeks,
    homeBean: home ? { id: home.id, name: home.name } : null,
    bestRecipe: home
      ? bestOf(
          facts.filter((f) => f.beanId === home.id),
          { dose: settings.doseStep, yield: settings.yieldStep }
        )
      : null
  };
  return {
    shots: facts.length,
    beans: new Set(facts.map((f) => f.beanId)).size,
    cards: evaluateInsights(facts, loadDimensionContext(db, ownerId), context)
  };
}

/** The bean's best recipe, titled as on Home with the yield of its latest shot. */
function bestOf(
  facts: readonly ShotFact[],
  steps: { dose: number; yield: number }
): InsightContext['bestRecipe'] {
  const recipeIds = [...new Set(facts.map((f) => f.recipeId))];
  const best = bestRecipe(
    recipeIds.map((recipeId) => ({ recipeId, shots: facts.filter((f) => f.recipeId === recipeId) }))
  );
  if (!best) return null;
  const its = facts.filter((f) => f.recipeId === best.recipeId);
  const latest = its[its.length - 1];
  return {
    id: best.recipeId,
    title: recipeTitle(
      { grind: latest.grind, dose: latest.recipeDose, yield: latest.yield },
      { grind: latest.grindStep, ...steps }
    )
  };
}
