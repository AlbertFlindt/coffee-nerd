// "Best recipe": used on Home, the bean detail page and as the re-buy starting point. Never stored.

export type RecipeShots = {
  recipeId: string;
  /** Every shot of the recipe; `score` is null when not rated. `brewedAt` is UTC milliseconds. */
  shots: { score: number | null; brewedAt: number }[];
};

export type BestRecipe = {
  recipeId: string;
  /** The average score of the recipe's rated shots; with one rated shot, that shot's score. */
  score: number;
  ratedShots: number;
};

type Candidate = { recipeId: string; total: number; rated: number; latest: number };

function candidate({ recipeId, shots }: RecipeShots): Candidate {
  const scores = shots.flatMap((s) => (s.score === null ? [] : [s.score]));
  return {
    recipeId,
    total: scores.reduce((sum, s) => sum + s, 0),
    rated: scores.length,
    latest: Math.max(...shots.map((s) => s.brewedAt))
  };
}

/**
 * Best first: the higher average score of the rated shots (compared exactly with whole numbers:
 * a/b > c/d ⇔ a·d > c·b), ties to more rated shots, then to the latest shot. Recipes without a
 * rated shot come last, most recent first.
 */
function compare(a: Candidate, b: Candidate): number {
  if (a.rated > 0 !== b.rated > 0) return b.rated - a.rated;
  return b.total * a.rated - a.total * b.rated || b.rated - a.rated || b.latest - a.latest;
}

/**
 * The recipe with the highest average score over its rated shots; a recipe rated once counts with
 * that score. Ties go to more rated shots, then to the most recently brewed recipe (its latest
 * shot). No rated shots at all gives null.
 */
export function bestRecipe(recipes: readonly RecipeShots[]): BestRecipe | null {
  const rated = recipes.map(candidate).filter((c) => c.rated > 0);
  if (rated.length === 0) return null;
  const winner = rated.reduce((best, c) => (compare(c, best) < 0 ? c : best));
  return {
    recipeId: winner.recipeId,
    score: winner.total / winner.rated,
    ratedShots: winner.rated
  };
}

/**
 * A bean's recipes "best first", ranked by the best-recipe rule (highest average score, ties by
 * more rated shots, then the latest shot); recipes without a rated shot last, most recent first.
 * The first is the best recipe.
 */
export function rankRecipes(recipes: readonly RecipeShots[]): string[] {
  return recipes
    .map(candidate)
    .sort(compare)
    .map((c) => c.recipeId);
}
