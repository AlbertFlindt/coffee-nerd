import { describe, expect, it } from 'vitest';
import {
  careText,
  count,
  listText,
  scoreAxis,
  statText,
  TOPICS,
  weeklyAxis,
  timeAxis,
  sigmaAxis,
  timeBins,
  decimalText
} from './insights';

describe('insights wording', () => {
  it('statistics show at most one decimal, with a real minus sign', () => {
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

  it('groups with fewer than 10 shots are named to treat with care', () => {
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

  it('score axes run to 10 with even ticks; dot plots start below their lowest whisker', () => {
    expect(scoreAxis()).toEqual({ from: 0, to: 10, ticks: [2, 4, 6, 8, 10] });
    expect(scoreAxis(5.7)).toEqual({ from: 3, to: 10, ticks: [4, 6, 8, 10] });
    expect(scoreAxis(1)).toEqual({ from: 0, to: 10, ticks: [2, 4, 6, 8, 10] });
  });

  it('four topics, What I like first', () => {
    expect(TOPICS.map((t) => t.label)).toEqual([
      'What I like',
      'Progress',
      'Dial-in',
      'Comparisons'
    ]);
  });
});

describe('axes for screens 24 and 25', () => {
  it('the weekly line runs from below its band to 10, a tick every 2 points', () => {
    expect(weeklyAxis(4.8)).toEqual({ from: 4, to: 10, ticks: [5, 7, 9] });
    expect(weeklyAxis(-0.5)).toEqual({ from: 0, to: 10, ticks: [1, 3, 5, 7, 9] });
  });

  it('screen 25: a time axis a second beyond the whiskers, in even seconds', () => {
    expect(timeAxis(26.5, 30.5)).toEqual({
      from: 24,
      to: 32,
      ticks: [24, 26, 28, 30, 32],
      unit: 's'
    });
  });

  it('σ bars start at zero; the axis reaches at least 2', () => {
    expect(sigmaAxis(1.3)).toEqual({ from: 0, to: 2, ticks: [0, 0.5, 1, 1.5, 2] });
    expect(sigmaAxis(2.2).to).toBe(2.5);
  });

  it('screen 24: the bell curve bins whole seconds, with half a second of room each side', () => {
    const { bins, axis } = timeBins([25.2, 26.5, 26.9, 27.4, 31]);
    expect(bins).toEqual([
      { from: 24.5, to: 25.5, count: 1 },
      { from: 25.5, to: 26.5, count: 0 },
      { from: 26.5, to: 27.5, count: 3 },
      { from: 27.5, to: 28.5, count: 0 },
      { from: 28.5, to: 29.5, count: 0 },
      { from: 29.5, to: 30.5, count: 0 },
      { from: 30.5, to: 31.5, count: 1 }
    ]);
    expect(axis).toEqual({ from: 24, to: 32, ticks: [25, 27, 29, 31], unit: 's' });
  });

  it('screens 24, 25: seconds and σ keep one decimal', () => {
    expect(decimalText(27.95)).toBe('28.0');
    expect(decimalText(26.54)).toBe('26.5');
  });
});
