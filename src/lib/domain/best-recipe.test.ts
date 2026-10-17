import { describe, expect, it } from 'vitest';
import { bestRecipe, type RecipeShots } from './best-recipe';

const day = 86_400_000;
const shots = (scores: (number | null)[], start = 0) =>
  scores.map((score, i) => ({ score, brewedAt: start + i * day }));

describe('bestRecipe', () => {
  it('D-66: the highest average score among recipes with at least 3 rated shots', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'steady', shots: shots([8, 8, 8, 8]) },
      { recipeId: 'lucky', shots: shots([9, 9]) },
      { recipeId: 'ok', shots: shots([7, 8, 7]) }
    ];
    expect(bestRecipe(recipes)).toEqual({
      recipeId: 'steady',
      basis: 'average',
      averageScore: 8,
      ratedShots: 4
    });
  });

  it('D-66: one lucky 9 does not beat a recipe that reliably scores 8', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'lucky', shots: shots([9]) },
      { recipeId: 'steady', shots: shots([8, 8, 8]) }
    ];
    expect(bestRecipe(recipes)?.recipeId).toBe('steady');
  });

  it('D-66: until a recipe has 3 rated shots, the highest single score is shown', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'a', shots: shots([6, 7]) },
      { recipeId: 'b', shots: shots([8]) }
    ];
    expect(bestRecipe(recipes)).toEqual({
      recipeId: 'b',
      basis: 'single',
      averageScore: 8,
      ratedShots: 1
    });
  });

  it('D-11, D-66: unrated shots do not count toward the 3 rated shots', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'mostly-unrated', shots: shots([9, null, null, 9]) },
      { recipeId: 'rated', shots: shots([7, 7]) }
    ];
    expect(bestRecipe(recipes)).toMatchObject({ recipeId: 'mostly-unrated', basis: 'single' });
  });

  it('D-66: ties go to the recipe with more rated shots', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'three', shots: shots([8, 8, 8], 10 * day) },
      { recipeId: 'four', shots: shots([8, 8, 8, 8]) }
    ];
    expect(bestRecipe(recipes)?.recipeId).toBe('four');
  });

  it('D-66: then to the most recently brewed recipe', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'older', shots: shots([8, 7, 9]) },
      { recipeId: 'newer', shots: shots([9, 8, 7], 5 * day) }
    ];
    expect(bestRecipe(recipes)?.recipeId).toBe('newer');
  });

  it('D-66: compares averages exactly (7.67 beats 7.5)', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'a', shots: shots([7, 8, 7, 8]) },
      { recipeId: 'b', shots: shots([8, 8, 7]) }
    ];
    expect(bestRecipe(recipes)?.recipeId).toBe('b');
  });

  it('D-66: no rated shots at all means no best recipe', () => {
    expect(bestRecipe([{ recipeId: 'a', shots: shots([null, null]) }])).toBeNull();
    expect(bestRecipe([])).toBeNull();
  });
});
