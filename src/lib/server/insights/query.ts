// The query runner (data-model §5, D-64): `{ measure, groupBy, filters, holdConstant }` over shot facts,
// returning each group's values. Statistics are left to `src/lib/domain/statistics.ts`.
import { recipeFingerprint, sameDose } from '../../domain/fingerprint';
import type { ShotFact } from './facts';
import {
  dimension,
  MEASURES,
  type DimensionContext,
  type DimensionName,
  type MeasureName
} from './registry';

/**
 * What to hold constant for a fair comparison (D-55): the same bean, the same recipe, or the same
 * recipe apart from its routine, to compare routines with everything else equal (D-204).
 */
export type HoldConstant = 'bean' | 'recipe' | 'recipe-apart-from-routine';

export type InsightQuery = {
  measure: MeasureName;
  /** Without one, every shot falls in one group. */
  groupBy?: DimensionName;
  filters?: {
    /** Only rated shots, also when the measure is not the score (D-11). */
    ratedOnly?: boolean;
    /** Only shots on recipes brewed more than once (D-203). */
    reusedRecipesOnly?: boolean;
    beanId?: string;
  };
  holdConstant?: HoldConstant;
};

export type QueryGroup = {
  key: string;
  label: string;
  /** The measure's values, oldest shot first; shots without a value are left out (D-11). */
  values: number[];
  /** With `holdConstant`: the same values split by what was held constant, for pooled σ (D-211). */
  held: number[][];
};

/** Runs a query over facts (oldest first). Groups come in the order their first shot was brewed. */
export function runQuery(
  facts: readonly ShotFact[],
  query: InsightQuery,
  context?: DimensionContext
): QueryGroup[] {
  const { filters = {} } = query;
  const measure = MEASURES[query.measure];
  const groupOf = query.groupBy ? dimension(query.groupBy, context).group : () => ALL;
  const heldKey = query.holdConstant ? heldKeyFor(query.holdConstant, facts) : () => '';

  const groups = new Map<string, QueryGroup & { strata: Map<string, number[]> }>();
  for (const fact of facts) {
    if (filters.ratedOnly && fact.score === null) continue;
    if (filters.reusedRecipesOnly && fact.recipeShots < 2) continue;
    if (filters.beanId !== undefined && fact.beanId !== filters.beanId) continue;
    const value = measure.value(fact);
    if (value === null) continue;
    const group = groupOf(fact);
    if (group === null) continue;

    let entry = groups.get(group.key);
    if (!entry) {
      entry = { ...group, values: [], held: [], strata: new Map() };
      groups.set(group.key, entry);
    }
    entry.values.push(value);
    if (query.holdConstant) {
      const key = heldKey(fact);
      const stratum = entry.strata.get(key) ?? [];
      stratum.push(value);
      entry.strata.set(key, stratum);
    }
  }
  return [...groups.values()].map(({ strata, ...group }) => ({
    ...group,
    held: [...strata.values()]
  }));
}

const ALL = { key: 'all', label: 'All shots' };

function heldKeyFor(hold: HoldConstant, facts: readonly ShotFact[]): (fact: ShotFact) => string {
  if (hold === 'bean') return (f) => f.beanId;
  if (hold === 'recipe') return (f) => f.recipeId;
  const keys = recipesApartFromRoutine(facts);
  return (f) => keys.get(f.recipeId)!;
}

/**
 * Groups recipes that are equal apart from the routine (D-204): same bean, machine, grinder, grind,
 * basket and setup, and a dose within 0.2 g (D-186). "Within 0.2 g" is not transitive, so recipes are
 * taken from the most brewed down (the first brewed first on a tie), and each joins the closest anchor
 * within reach, as D-186 matches a dose to the closest recipe; one with none starts its own. Returns each
 * recipe's group key.
 */
export function recipesApartFromRoutine(facts: readonly ShotFact[]): Map<string, string> {
  const recipes = new Map<string, ShotFact>();
  for (const fact of facts) if (!recipes.has(fact.recipeId)) recipes.set(fact.recipeId, fact);
  // Facts are oldest first and the sort is stable, so a tie keeps the first brewed recipe first.
  const ordered = [...recipes.values()].sort((a, b) => b.recipeShots - a.recipeShots);

  const anchors = new Map<string, { key: string; dose: number }[]>();
  const keys = new Map<string, string>();
  for (const fact of ordered) {
    const identity = `${fact.beanId}|${fact.machineId}|${fingerprintWithoutRoutine(fact)}`;
    const list = anchors.get(identity) ?? [];
    const distance = (a: { dose: number }) => Math.abs(a.dose - fact.recipeDose);
    let anchor = list
      .filter((a) => sameDose(a.dose, fact.recipeDose))
      .reduce<(typeof list)[number] | undefined>(
        (best, a) => (best === undefined || distance(a) < distance(best) ? a : best),
        undefined
      );
    if (!anchor) {
      anchor = { key: `${identity}|${fact.recipeDose}`, dose: fact.recipeDose };
      list.push(anchor);
      anchors.set(identity, list);
    }
    keys.set(fact.recipeId, anchor.key);
  }
  return keys;
}

function fingerprintWithoutRoutine(fact: ShotFact): string {
  return recipeFingerprint({
    machineId: fact.machineId,
    grinderId: fact.grinderId,
    basketId: fact.basketId,
    routineId: null,
    grind: fact.grind,
    dose: fact.recipeDose,
    setup: { features: fact.setup.features, routine: null }
  });
}
