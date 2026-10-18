import { describe, expect, it } from 'vitest';
import { recipeHistory, recipeRowDetail, recipeTitle } from './bean-detail';

describe('recipeTitle', () => {
  it('D-42, D-143: grind, dose, and the latest shot’s yield', () => {
    expect(
      recipeTitle({ grind: 1600, dose: 18000, yield: 36000 }, { grind: 100, dose: 100, yield: 100 })
    ).toBe('Grind 1.6 · 18.0 g → 36.0 g');
  });

  it('D-143: without a yield the arrow is left out', () => {
    expect(
      recipeTitle(
        { grind: 15000, dose: 18500, yield: null },
        { grind: 1000, dose: 100, yield: 100 }
      )
    ).toBe('Grind 15 · 18.5 g');
  });
});

describe('recipeRowDetail', () => {
  it('D-128: the setup line, then the average time', () => {
    expect(recipeRowDetail('Preinfusion 4 s · Low bar start 5 s', [28000, 27000, 29000], 100)).toBe(
      'Preinfusion 4 s · Low bar start 5 s · avg 28.0 s'
    );
  });

  it('D-128: times that were not entered are left out; no time, no average', () => {
    expect(recipeRowDetail('93 °C', [null, 25000], 100)).toBe('93 °C · avg 25.0 s');
    expect(recipeRowDetail('93 °C', [null], 100)).toBe('93 °C');
    expect(recipeRowDetail('', [], 100)).toBe('');
  });
});

describe('recipeHistory', () => {
  it('D-42: reused for every shot after the first, "Tried once" for one', () => {
    expect(recipeHistory(5)).toEqual({ text: 'Reused 4x', reused: true });
    expect(recipeHistory(1)).toEqual({ text: 'Tried once', reused: false });
  });

  it('D-128: a recipe kept only by its Brew next mark is new', () => {
    expect(recipeHistory(0)).toEqual({ text: 'New recipe', reused: false });
  });
});
