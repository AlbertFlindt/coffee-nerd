// "Best recipe" (D-66): used on Home, the bean detail page and as the re-buy starting point. Never stored.

export type RecipeShots = {
  recipeId: string;
  /** Every shot of the recipe; `score` is null when not rated (D-11). `brewedAt` is UTC milliseconds. */
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
