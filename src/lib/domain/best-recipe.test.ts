import { describe, expect, it } from 'vitest';
import { bestRecipe, rankRecipes, type RecipeShots } from './best-recipe';

const day = 86_400_000;
const shots = (scores: (number | null)[], start = 0) =>
  scores.map((score, i) => ({ score, brewedAt: start + i * day }));

describe('bestRecipe', () => {
  it('the recipe with the highest average score', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'steady', shots: shots([8, 8, 8, 8]) },
      { recipeId: 'mixed', shots: shots([9, 6]) },
      { recipeId: 'ok', shots: shots([7, 8, 7]) }
    ];
    expect(bestRecipe(recipes)).toEqual({ recipeId: 'steady', score: 8, ratedShots: 4 });
  });

  it('one great shot does not make a recipe best when its other shots are poor', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'peak', shots: shots([10, 5, 6]) },
      { recipeId: 'steady', shots: shots([8, 8]) }
    ];
    expect(bestRecipe(recipes)?.recipeId).toBe('steady');
  });

  it('a recipe rated once counts with that score', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'a', shots: shots([6, 7]) },
      { recipeId: 'b', shots: shots([8]) }
    ];
    expect(bestRecipe(recipes)).toEqual({ recipeId: 'b', score: 8, ratedShots: 1 });
  });

  it('with only one shot, that shot’s recipe is the best recipe', () => {
    expect(bestRecipe([{ recipeId: 'only', shots: shots([4]) }])).toEqual({
      recipeId: 'only',
      score: 4,
      ratedShots: 1
    });
  });

  it('unrated shots do not count toward the average', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'mostly-unrated', shots: shots([9, null, null, 9]) },
      { recipeId: 'rated', shots: shots([8, 8, 8]) }
    ];
    expect(bestRecipe(recipes)).toEqual({ recipeId: 'mostly-unrated', score: 9, ratedShots: 2 });
  });

  it('ties go to the recipe with more rated shots', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'three', shots: shots([8, 8, 8], 10 * day) },
      { recipeId: 'four', shots: shots([8, 8, 8, 8]) }
    ];
    expect(bestRecipe(recipes)?.recipeId).toBe('four');
  });

  it('then to the most recently brewed recipe', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'older', shots: shots([8, 7, 9]) },
      { recipeId: 'newer', shots: shots([9, 8, 7], 5 * day) }
    ];
    expect(bestRecipe(recipes)?.recipeId).toBe('newer');
  });

  it('compares averages exactly (7.67 beats 7.5)', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'a', shots: shots([7, 8, 7, 8]) },
      { recipeId: 'b', shots: shots([8, 8, 7]) }
    ];
    expect(bestRecipe(recipes)?.recipeId).toBe('b');
  });

  it('no rated shots at all means no best recipe', () => {
    expect(bestRecipe([{ recipeId: 'a', shots: shots([null, null]) }])).toBeNull();
    expect(bestRecipe([])).toBeNull();
  });
});

describe('rankRecipes', () => {
  it('by average score, unrated last', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'unrated', shots: shots([null, null], 9 * day) },
      { recipeId: 'peak', shots: shots([10, 5]) },
      { recipeId: 'steady', shots: shots([8, 8, 8]) },
      { recipeId: 'ok', shots: shots([7, 7, 7, 7]) },
      { recipeId: 'fine', shots: shots([6]) }
    ];
    expect(rankRecipes(recipes)).toEqual(['steady', 'peak', 'ok', 'fine', 'unrated']);
  });

  it('the first is the best recipe; ties by more rated shots, then the latest', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'older', shots: shots([8], 0) },
      { recipeId: 'newer', shots: shots([8], 5 * day) },
      { recipeId: 'more', shots: shots([8, 8], 0) }
    ];
    expect(rankRecipes(recipes)).toEqual(['more', 'newer', 'older']);
    expect(bestRecipe(recipes)?.recipeId).toBe('more');
  });

  it('recipes without rated shots, most recent first', () => {
    const recipes: RecipeShots[] = [
      { recipeId: 'none', shots: [] },
      { recipeId: 'old', shots: shots([null], 0) },
      { recipeId: 'new', shots: shots([null], 3 * day) }
    ];
    expect(rankRecipes(recipes)).toEqual(['new', 'old', 'none']);
  });
});
