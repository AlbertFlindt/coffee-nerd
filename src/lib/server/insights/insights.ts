// The Insights page (screens 23–25, D-55): the data basis for the header and every card, for one owner.
import { eq } from 'drizzle-orm';
import type { InsightCard } from '../../domain/insights';
import type { Queryable } from '../db/client';
import { userSettings } from '../db/schema';
import { evaluateInsights } from './definitions';
import { loadDimensionContext, loadShotFacts } from './facts';

export type InsightsPage = {
  /** Every shot and every bean with a shot (D-208), unrated ones too. */
  shots: number;
  beans: number;
  cards: InsightCard[];
};

export function loadInsights(db: Queryable, ownerId: string): InsightsPage {
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  if (!settings) throw new Error('Signed-in user without settings');
  const facts = loadShotFacts(db, ownerId, settings.timeZone);
  return {
    shots: facts.length,
    beans: new Set(facts.map((f) => f.beanId)).size,
    cards: evaluateInsights(facts, loadDimensionContext(db, ownerId))
  };
}
