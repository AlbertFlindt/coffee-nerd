// "Best recipe": used on Home, the bean detail page and as the re-buy starting point. Never stored.

export type RecipeShots = {
  recipeId: string;
  /** Every shot of the recipe; `score` is null when not rated. `brewedAt` is UTC milliseconds. */
  shots: { score: number | null; brewedAt: number }[];
};

export type BestRecipe = {
  recipeId: string;
  /** `average`: highest mean among recipes with at least 3 rated shots; `single`: highest single score. */
  basis: 'average' | 'single';
  /** The average score (`average`) or the single highest score (`single`). */
  score: number;
  ratedShots: number;
};

const MIN_RATED_SHOTS = 3;

type Candidate = { recipeId: string; total: number; rated: number; best: number; latest: number };

/**
 * The recipe with the highest average score among those with at least 3 rated shots. Until one has 3, the
 * recipe with the highest single score. Ties go to more rated shots, then to the most recently brewed
 * recipe (its latest shot). No rated shots at all gives null.
 */
export function bestRecipe(recipes: readonly RecipeShots[]): BestRecipe | null {
  const candidates: Candidate[] = recipes
    .map(({ recipeId, shots }) => {
      const scores = shots.flatMap((s) => (s.score === null ? [] : [s.score]));
      return {
        recipeId,
        total: scores.reduce((sum, s) => sum + s, 0),
        rated: scores.length,
        best: Math.max(...scores),
        latest: Math.max(...shots.map((s) => s.brewedAt))
      };
    })
    .filter((c) => c.rated > 0);

  const established = candidates.filter((c) => c.rated >= MIN_RATED_SHOTS);
  if (established.length > 0) {
    // Compare averages exactly with whole numbers: a/b > c/d ⇔ a·d > c·b.
    const winner = pick(established, (a, b) => a.total * b.rated - b.total * a.rated);
    return {
      recipeId: winner.recipeId,
      basis: 'average',
      score: winner.total / winner.rated,
      ratedShots: winner.rated
    };
  }
  if (candidates.length === 0) return null;
  const winner = pick(candidates, (a, b) => a.best - b.best);
  return {
    recipeId: winner.recipeId,
    basis: 'single',
    score: winner.best,
    ratedShots: winner.rated
  };
}

/** The candidate that compares highest; ties broken by more rated shots, then the latest shot. */
function pick(candidates: Candidate[], compare: (a: Candidate, b: Candidate) => number): Candidate {
  return candidates.reduce((best, c) => {
    const order = compare(c, best) || c.rated - best.rated || c.latest - best.latest;
    return order > 0 ? c : best;
  });
}

/**
 * A bean's recipes "best first", ranked by the best-recipe rule: recipes with at least 3 rated shots by
 * average, then the other rated ones by their highest score, ties by more rated shots, then the latest
 * shot; recipes without a rated shot last, most recent first. The first is the best recipe.
 */
export function rankRecipes(recipes: readonly RecipeShots[]): string[] {
  const candidates = recipes.map(({ recipeId, shots }) => {
    const scores = shots.flatMap((s) => (s.score === null ? [] : [s.score]));
    return {
      recipeId,
      total: scores.reduce((sum, s) => sum + s, 0),
      rated: scores.length,
      best: Math.max(...scores),
      latest: Math.max(...shots.map((s) => s.brewedAt))
    };
  });
  const tier = (c: Candidate) => (c.rated >= MIN_RATED_SHOTS ? 0 : c.rated > 0 ? 1 : 2);
  return candidates
    .sort((a, b) => {
      if (tier(a) !== tier(b)) return tier(a) - tier(b);
      // Averages compared exactly with whole numbers, as in bestRecipe.
      const score =
        tier(a) === 0 ? b.total * a.rated - a.total * b.rated : tier(a) === 1 ? b.best - a.best : 0;
      return score || b.rated - a.rated || b.latest - a.latest;
    })
    .map((c) => c.recipeId);
}
