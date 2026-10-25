import { describe, expect, it } from 'vitest';
import type { ShotFact } from './facts';
import { evaluateInsights, INSIGHTS } from './definitions';
import { fact } from './fixtures';

const context = { stepOptions: {}, machineFeatures: {} };
const card = (id: string, facts: ShotFact[]) =>
  evaluateInsights(facts, context, INSIGHTS).find((c) => c.id === id)!;
const shots = (n: number, overrides: Partial<ShotFact>, scores: number[] = [8]) =>
  Array.from({ length: n }, (_, i) => fact({ ...overrides, score: scores[i % scores.length] }));

describe('score by process (screen 23)', () => {
  const process = (facts: ShotFact[]) => card('score-by-process', facts);

  it('D-55, D-206: names the process with the highest median, and the one that sits lowest', () => {
    const result = process([
      ...shots(6, { process: 'natural' }, [7, 8, 9, 8, 10, 6]),
      ...shots(6, { process: 'washed' }, [4, 5, 7, 8, 9, 7])
    ]);
    expect(result.title).toBe('Naturals are your thing');
    expect(result.sentence).toBe(
      'Half of your natural shots score 8 or more. Washed coffees spread wider and sit lower.'
    );
    expect(result.chart).toMatchObject({
      kind: 'box',
      rows: [
        { label: 'Natural', n: 6, median: 8, min: 6, max: 10 },
        { label: 'Washed', n: 6, median: 7, min: 4, max: 9 }
      ],
      axis: { from: 0, to: 10 }
    });
    expect(result.basis).toBe(
      'Score by process · box = middle 50% · amber line = median · whiskers = full range · ' +
        'Natural and Washed have few shots, so treat with care'
    );
  });

  it('D-214: medians within half a point are no clear difference', () => {
    const result = process([
      ...shots(10, { process: 'natural' }, [8]),
      ...shots(10, { process: 'honey' }, [7, 8])
    ]);
    expect(result.title).toBe('No clear favorite process');
    expect(result.sentence).toBe(
      'Your processes score about the same: their medians are within half a point.'
    );
  });

  it('D-11: unrated shots are left out, never counted as 0', () => {
    const result = process([
      ...shots(5, { process: 'natural' }, [8]),
      ...shots(5, { process: 'washed' }, [6]),
      ...shots(4, { process: 'washed', score: null }).map((f) => ({ ...f, score: null }))
    ]);
    expect(result.chart).toMatchObject({ rows: [{ n: 5 }, { n: 5, min: 6 }] });
  });

  it('D-203, D-207: without two processes of 5 rated shots, the card says what is missing', () => {
    expect(process([])).toEqual({
      id: 'score-by-process',
      topic: 'like',
      title: 'Score by process',
      sentence: 'Rate 5 shots each from two processes to compare.',
      chart: null,
      basis: null
    });
    expect(process(shots(5, { process: 'natural' })).sentence).toBe(
      'Rate 5 shots of another process to compare.'
    );
    expect(
      process([...shots(7, { process: 'natural' }), ...shots(2, { process: 'washed' })]).sentence
    ).toBe('Rate 3 more washed shots to compare.');
    expect(
      process([...shots(7, { process: 'natural' }), ...shots(4, { process: 'honey' })]).sentence
    ).toBe('Rate 1 more honey shot to compare.');
  });

  it('D-203: a process with fewer than 5 rated shots is left out of the chart', () => {
    const result = process([
      ...shots(5, { process: 'natural' }, [9]),
      ...shots(5, { process: 'washed' }, [6]),
      ...shots(2, { process: 'honey' }, [7])
    ]);
    expect(result.chart).toMatchObject({ rows: [{ label: 'Natural' }, { label: 'Washed' }] });
  });

  it('D-55: rows run from the highest median down; on a tie, the higher average first', () => {
    const result = process([
      ...shots(5, { process: 'washed' }, [5, 7, 7]),
      ...shots(5, { process: 'honey' }, [6, 7, 8]),
      ...shots(5, { process: 'natural' }, [8, 9])
    ]);
    expect(result.chart).toMatchObject({
      rows: [{ label: 'Natural' }, { label: 'Honey' }, { label: 'Washed' }]
    });
    expect(result.sentence).toBe(
      'Half of your natural shots score 8 or more. Washed coffees spread wider and sit lower.'
    );
  });
});

describe('score by origin (screen 23)', () => {
  const origin = (facts: ShotFact[]) => card('score-by-origin', facts);

  it('D-55, D-206: names the origin with the highest average; its row is the amber one', () => {
    const result = origin([
      ...shots(10, { countryCode: 'ET' }, [8, 8, 9, 8]),
      ...shots(12, { countryCode: 'KE' }, [6, 8, 7, 9]),
      ...shots(10, { countryCode: 'BR' }, [5, 7, 6, 8])
    ]);
    expect(result.title).toBe('Ethiopia leads your origins');
    expect(result.sentence).toBe(
      'Highest average, and the tightest spread: you rarely miss with coffees from Ethiopia.'
    );
    expect(result.chart).toMatchObject({
      kind: 'mean-sigma',
      rows: [
        { label: 'Ethiopia', n: 10, top: true },
        { label: 'Kenya', n: 12, mean: 7.5, top: false },
        { label: 'Brazil', n: 10, mean: 6.4, top: false }
      ]
    });
    expect(result.basis).toBe('Average score ± 1 standard deviation · 32 rated shots');
  });

  it('D-206: without the tightest spread, the sentence compares the top two averages', () => {
    const result = origin([
      ...shots(10, { countryCode: 'ET' }, [6, 10]),
      ...shots(10, { countryCode: 'KE' }, [7])
    ]);
    expect(result.title).toBe('Ethiopia leads your origins');
    expect(result.sentence).toBe('Highest average: 8 against 7 for Kenya.');
  });

  it('D-214: averages within half a point are no clear difference', () => {
    const result = origin([
      ...shots(10, { countryCode: 'ET' }, [8]),
      ...shots(10, { countryCode: 'KE' }, [8, 7, 8, 8, 8, 8, 8, 8, 8, 8])
    ]);
    expect(result.title).toBe('No clear favorite origin');
    expect(result.sentence).toBe('Your top origins average within half a point of each other.');
    // D-206: no row is painted amber as a winner.
    expect(result.chart?.rows.map((r) => ('top' in r ? r.top : null))).toEqual([false, false]);
  });

  it('D-56: the axis starts below the lowest whisker', () => {
    const result = origin([
      ...shots(10, { countryCode: 'ET' }, [8]),
      ...shots(10, { countryCode: 'BR' }, [5, 7])
    ]);
    // Brazil: 6 ± 1.05, so its whisker starts at 4.9 and the axis at 2.
    expect(result.chart?.axis).toEqual({ from: 2, to: 10, ticks: [4, 6, 8, 10] });
  });

  it('D-203: says how many more shots an origin needs', () => {
    expect(
      origin([...shots(6, { countryCode: 'ET' }), ...shots(1, { countryCode: 'KE' })]).sentence
    ).toBe('Rate 4 more shots from Kenya to compare.');
    expect(origin(shots(3, { countryCode: null })).sentence).toBe(
      'Rate 5 shots each from two origins to compare.'
    );
  });
});
