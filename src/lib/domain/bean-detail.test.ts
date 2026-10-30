import { describe, expect, it } from 'vitest';
import { aboutLines, recipeHistory, recipeRowDetail, recipeTitle } from './bean-detail';

describe('recipeTitle', () => {
  it('grind, dose, and the latest shot’s yield', () => {
    expect(
      recipeTitle({ grind: 1600, dose: 18000, yield: 36000 }, { grind: 100, dose: 100, yield: 100 })
    ).toBe('Grind 1.6 · 18.0 g → 36.0 g');
  });

  it('without a yield the arrow is left out', () => {
    expect(
      recipeTitle(
        { grind: 15000, dose: 18500, yield: null },
        { grind: 1000, dose: 100, yield: 100 }
      )
    ).toBe('Grind 15 · 18.5 g');
  });
});

describe('recipeRowDetail', () => {
  it('the setup line, then the average time', () => {
    expect(recipeRowDetail('Preinfusion 4 s · Low bar start 5 s', [28000, 27000, 29000], 100)).toBe(
      'Preinfusion 4 s · Low bar start 5 s · avg 28.0 s'
    );
  });

  it('the average is rounded to the time step’s decimals', () => {
    expect(recipeRowDetail('', [25000, 27000, 27000], 100)).toBe('avg 26.3 s');
    expect(recipeRowDetail('', [25000, 26000], 500)).toBe('avg 25.5 s');
  });

  it('times that were not entered are left out; no time, no average', () => {
    expect(recipeRowDetail('93 °C', [null, 25000], 100)).toBe('93 °C · avg 25.0 s');
    expect(recipeRowDetail('93 °C', [null], 100)).toBe('93 °C');
    expect(recipeRowDetail('', [], 100)).toBe('');
  });
});

describe('recipeHistory', () => {
  it('reused for every shot after the first, "Tried once" for one', () => {
    expect(recipeHistory(5)).toEqual({ text: 'Reused 4x', reused: true });
    expect(recipeHistory(1)).toEqual({ text: 'Tried once', reused: false });
  });

  it('a recipe kept only by its Brew next mark is new', () => {
    expect(recipeHistory(0)).toEqual({ text: 'New recipe', reused: false });
  });
});

describe('aboutLines', () => {
  const guji = {
    roaster: 'Nordlys Roasters',
    countryCode: 'ET',
    region: 'Guji',
    process: 'natural' as const,
    variety: 'Heirloom',
    altitudeMinM: 1900,
    altitudeMaxM: 2100,
    roastLevel: 'light' as const,
    roastDate: '2026-10-04',
    status: 'open' as const
  };

  it('roaster; country · region · process; variety · altitude · roast level; roast date · status', () => {
    expect(aboutLines(guji, '2026-10-16')).toEqual([
      'Nordlys Roasters',
      'Ethiopia · Guji · Natural',
      'Heirloom · 1,900–2,100 m · Light',
      'Roasted 4 Oct · Open'
    ]);
  });

  it('what is not set is left out, and an empty line too', () => {
    expect(
      aboutLines(
        {
          ...guji,
          roaster: null,
          region: null,
          variety: null,
          altitudeMinM: null,
          altitudeMaxM: null,
          roastLevel: null,
          status: 'finished'
        },
        '2026-10-16'
      )
    ).toEqual(['Ethiopia · Natural', 'Roasted 4 Oct · Finished']);
  });
});
