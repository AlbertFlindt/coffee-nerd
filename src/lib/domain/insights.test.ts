import { describe, expect, it } from 'vitest';
import { careText, count, listText, scoreAxis, statText, TOPICS } from './insights';

describe('insights wording', () => {
  it('D-56: statistics show at most one decimal, with a real minus sign', () => {
    expect(statText(8)).toBe('8');
    expect(statText(7.5)).toBe('7.5');
    expect(statText(8.024)).toBe('8');
    expect(statText(0.66)).toBe('0.7');
    expect(statText(-0.25)).toBe('−0.3');
  });

  it('counts and lists in plain words', () => {
    expect(count(1, 'shot')).toBe('1 shot');
    expect(count(214, 'shot')).toBe('214 shots');
    expect(listText(['Brazil'])).toBe('Brazil');
    expect(listText(['Brazil', 'Kenya'])).toBe('Brazil and Kenya');
    expect(listText(['Brazil', 'Honey', 'Kenya'])).toBe('Brazil, Honey and Kenya');
  });

  it('D-203: groups with fewer than 10 shots are named to treat with care', () => {
    expect(careText([{ label: 'Daily', n: 26 }])).toBeNull();
    expect(careText([{ label: 'Light roast', n: 6 }])).toBe(
      'Light roast has few shots, so treat with care'
    );
    expect(
      careText([
        { label: 'Brazil', n: 9 },
        { label: 'Kenya', n: 5 }
      ])
    ).toBe('Brazil and Kenya have few shots, so treat with care');
  });

  it('D-56: score axes run to 10 with even ticks; dot plots start below their lowest whisker', () => {
    expect(scoreAxis()).toEqual({ from: 0, to: 10, ticks: [2, 4, 6, 8, 10] });
    expect(scoreAxis(5.7)).toEqual({ from: 3, to: 10, ticks: [4, 6, 8, 10] });
    expect(scoreAxis(1)).toEqual({ from: 0, to: 10, ticks: [2, 4, 6, 8, 10] });
  });

  it('D-55, D-208: four topics, What I like first', () => {
    expect(TOPICS.map((t) => t.label)).toEqual([
      'What I like',
      'Progress',
      'Dial-in',
      'Comparisons'
    ]);
  });
});
