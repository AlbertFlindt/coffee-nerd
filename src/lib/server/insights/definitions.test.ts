import { describe, expect, it } from 'vitest';
import type { ShotFact } from './facts';
import { evaluateInsights, INSIGHTS, type InsightContext } from './definitions';
import { fact } from './fixtures';

const dimensions = { stepOptions: {}, machineFeatures: {} };
/** 12 Mondays, oldest first, ending with the week of the fixture's shots (2026-10-12). */
const WEEKS = Array.from({ length: 12 }, (_, i) =>
  new Date(Date.UTC(2026, 9, 12 - 7 * (11 - i))).toISOString().slice(0, 10)
);
const home: InsightContext = {
  weeks: WEEKS,
  homeBean: { id: 'bean-guji', name: 'Guji Hambela' },
  bestRecipe: { id: 'recipe-a', title: 'Grind 1.6 · 18.0 g → 36.0 g' }
};
const card = (id: string, facts: ShotFact[], context: InsightContext = home) =>
  evaluateInsights(facts, dimensions, context, INSIGHTS).find((c) => c.id === id)!;
const shots = (n: number, overrides: Partial<ShotFact>, scores: number[] = [8]) =>
  Array.from({ length: n }, (_, i) => fact({ ...overrides, score: scores[i % scores.length] }));

describe('score by process (screen 23)', () => {
  const process = (facts: ShotFact[]) => card('score-by-process', facts);

  it('names the process with the highest median, and the one that sits lowest', () => {
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

  it('medians within half a point are no clear difference', () => {
    const result = process([
      ...shots(10, { process: 'natural' }, [8]),
      ...shots(10, { process: 'honey' }, [7, 8])
    ]);
    expect(result.title).toBe('No clear favorite process');
    expect(result.sentence).toBe(
      'Your processes score about the same: their medians are within half a point.'
    );
  });

  it('unrated shots are left out, never counted as 0', () => {
    const result = process([
      ...shots(5, { process: 'natural' }, [8]),
      ...shots(5, { process: 'washed' }, [6]),
      ...shots(4, { process: 'washed', score: null }).map((f) => ({ ...f, score: null }))
    ]);
    expect(result.chart).toMatchObject({ rows: [{ n: 5 }, { n: 5, min: 6 }] });
  });

  it('without two processes of 5 rated shots, the card says what is missing', () => {
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

  it('a process with fewer than 5 rated shots is left out of the chart', () => {
    const result = process([
      ...shots(5, { process: 'natural' }, [9]),
      ...shots(5, { process: 'washed' }, [6]),
      ...shots(2, { process: 'honey' }, [7])
    ]);
    expect(result.chart).toMatchObject({ rows: [{ label: 'Natural' }, { label: 'Washed' }] });
  });

  it('rows run from the highest median down; on a tie, the higher average first', () => {
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

  it('names the origin with the highest average; its row is the amber one', () => {
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

  it('without the tightest spread, the sentence compares the top two averages', () => {
    const result = origin([
      ...shots(10, { countryCode: 'ET' }, [6, 10]),
      ...shots(10, { countryCode: 'KE' }, [7])
    ]);
    expect(result.title).toBe('Ethiopia leads your origins');
    expect(result.sentence).toBe('Highest average: 8 against 7 for Kenya.');
  });

  it('averages within half a point are no clear difference', () => {
    const result = origin([
      ...shots(10, { countryCode: 'ET' }, [8]),
      ...shots(10, { countryCode: 'KE' }, [8, 7, 8, 8, 8, 8, 8, 8, 8, 8])
    ]);
    expect(result.title).toBe('No clear favorite origin');
    expect(result.sentence).toBe('Your top origins average within half a point of each other.');
    // No row is painted amber as a winner.
    expect(result.chart).toMatchObject({ rows: [{ top: false }, { top: false }] });
  });

  it('the axis starts below the lowest whisker', () => {
    const result = origin([
      ...shots(10, { countryCode: 'ET' }, [8]),
      ...shots(10, { countryCode: 'BR' }, [5, 7])
    ]);
    // Brazil: 6 ± 1.05, so its whisker starts at 4.9 and the axis at 2.
    expect(result.chart?.axis).toEqual({ from: 2, to: 10, ticks: [4, 6, 8, 10] });
  });

  it('says how many more shots an origin needs', () => {
    expect(
      origin([...shots(6, { countryCode: 'ET' }), ...shots(1, { countryCode: 'KE' })]).sentence
    ).toBe('Rate 4 more shots from Kenya to compare.');
    expect(origin(shots(3, { countryCode: null })).sentence).toBe(
      'Rate 5 shots each from two origins to compare.'
    );
  });
});

describe('weekly average score (screen 24)', () => {
  const weekly = (facts: ShotFact[]) => card('weekly-score', facts);
  const week = (i: number, scores: number[]) =>
    scores.map((score) => fact({ week: WEEKS[i], score }));

  it('better and steadier when the line rises and the band narrows', () => {
    const result = weekly([
      ...week(0, [5, 7, 6, 8]),
      ...week(4, [6, 7]),
      ...week(8, [7, 8]),
      ...week(11, [8, 8, 7.5, 8.5])
    ]);
    expect(result.title).toBe('Better and steadier');
    expect(result.sentence).toBe(
      'Up 1.5 points in 12 weeks, and your spread halved: σ went from 1.3 to 0.4.'
    );
    expect(result.basis).toBe('Weekly average score · shaded band = ± 1 standard deviation');
    expect(result.chart).toMatchObject({
      kind: 'weekly',
      first: '12 weeks ago',
      last: 'This week',
      axis: { from: 5, to: 10, ticks: [6, 8] }
    });
  });

  it('a week with fewer than 2 rated shots is a gap, never 0', () => {
    const result = weekly([
      ...week(0, [6, 7]),
      ...week(1, [9]),
      ...week(2, [6, 7]),
      ...week(3, [6, 7]),
      ...week(5, [6, 7]),
      fact({ week: WEEKS[6], score: null })
    ]);
    const points = result.chart?.kind === 'weekly' ? result.chart.points : [];
    expect(points.map((p) => p.week)).toEqual(WEEKS);
    expect(points.map((p) => p.stats?.n ?? null)).toEqual([
      2,
      null,
      2,
      2,
      null,
      2,
      null,
      null,
      null,
      null,
      null,
      null
    ]);
    expect(result.title).toBe('Holding steady');
    expect(result.sentence).toBe(
      'About the same score over 6 weeks, and your spread stayed about the same.'
    );
  });

  it('falling scores and a wider spread are said too', () => {
    const result = weekly([
      ...week(0, [8, 8]),
      ...week(1, [8, 8.5]),
      ...week(2, [7, 8]),
      ...week(3, [5, 8])
    ]);
    expect(result.title).toBe('Scores are slipping');
    expect(result.sentence).toBe(
      'Down 1.5 points in 4 weeks, and your spread widened: σ went from 0 to 2.1.'
    );
  });

  it('needs 4 weeks with 2 rated shots each', () => {
    const result = weekly([...week(0, [6, 7]), ...week(1, [6, 7]), ...week(2, [7])]);
    expect(result).toMatchObject({
      title: 'Weekly average score',
      sentence: 'Rate 2 shots a week for 2 more weeks to see your progress.',
      chart: null
    });
  });
});

describe('shot time on the best recipe (screen 24, under Dial-in)', () => {
  const bell = (facts: ShotFact[], context: InsightContext = home) =>
    card('shot-time', facts, context);
  const times = (seconds: number[], overrides: Partial<ShotFact> = {}) =>
    seconds.map((t) => fact({ time: t * 1000, ...overrides }));

  it('the best recipe of the bean on Home, with μ, σ and where 2 in 3 shots land', () => {
    const result = bell([
      ...times([26, 27, 27, 28, 28, 28, 28, 29, 29, 30]),
      ...times([40, 41], { recipeId: 'recipe-b' })
    ]);
    expect(result.topic).toBe('dial-in');
    expect(result.title).toBe('Your shot time is under control');
    expect(result.sentence).toBe(
      'On your best Guji Hambela recipe, 2 in 3 shots land between 26.8 and 29.2 s.'
    );
    expect(result.basis).toBe(
      'Shot time · Guji Hambela · Grind 1.6 · 18.0 g → 36.0 g · 10 shots · μ 28.0 s · σ 1.2 s'
    );
    expect(result.chart).toMatchObject({
      kind: 'bell',
      n: 10,
      bins: [
        { from: 25.5, to: 26.5, count: 1 },
        { from: 26.5, to: 27.5, count: 2 },
        { from: 27.5, to: 28.5, count: 4 },
        { from: 28.5, to: 29.5, count: 2 },
        { from: 29.5, to: 30.5, count: 1 }
      ],
      axis: { from: 25, to: 31, ticks: [26, 28, 30], unit: 's' }
    });
  });

  it('a wide spread says the shot time wanders', () => {
    const result = bell(times([24, 26, 28, 30, 32, 24, 26, 28, 30, 32]));
    expect(result.title).toBe('Your shot time wanders');
  });

  it('without a bean on Home, a best recipe or 10 timed shots, says what it needs', () => {
    expect(bell([], { ...home, homeBean: null, bestRecipe: null }).sentence).toBe(
      'Add a bean on Home to see the shot times of its best recipe.'
    );
    expect(bell([], { ...home, bestRecipe: null }).sentence).toBe(
      'Rate a shot of Guji Hambela to find its best recipe and its shot times.'
    );
    expect(bell([...times([28, 28, 29]), fact({ time: null })])).toMatchObject({
      title: 'Shot time',
      sentence: 'Brew 7 more shots of your best Guji Hambela recipe to see its shot times.',
      chart: null
    });
  });
});

describe('shot time by routine (screen 25)', () => {
  const routines = (facts: ShotFact[]) => card('routine-time', facts);
  const light = { routineId: 'routine-light', routineName: 'Light roast', recipeId: 'recipe-l' };
  const times = (seconds: number[], overrides: Partial<ShotFact> = {}) =>
    seconds.map((t) => fact({ time: t * 1000, recipeShots: seconds.length, ...overrides }));

  it('compares routines on the bean on Home with the rest of the recipe equal', () => {
    const result = routines([
      ...times([27, 28, 28, 29, 28]),
      ...times([25, 28, 31, 28, 30], light),
      // Another grind is another recipe: not compared.
      ...times([20, 40], { grind: 1500, recipeId: 'recipe-fine' }),
      // Another bean: not compared.
      ...times([20, 40, 20, 40, 20], { ...light, beanId: 'bean-other', recipeId: 'recipe-o' })
    ]);
    expect(result.title).toBe('Daily routine is more repeatable');
    expect(result.sentence).toBe(
      'Same bean, same recipe: your shot time wanders less with the Daily routine.'
    );
    expect(result.chart).toMatchObject({
      kind: 'mean-sigma',
      unit: 's',
      rows: [
        { label: 'Daily routine', n: 5, top: true },
        { label: 'Light roast', n: 5, top: false }
      ],
      axis: { from: 24, to: 32, unit: 's' }
    });
    expect(result.basis).toBe(
      'Guji Hambela only · average shot time ± 1 standard deviation · ' +
        'Daily routine and Light roast have few shots, so treat with care'
    );
  });

  it('routines that never shared a recipe are not compared', () => {
    const turbo = { routineId: 'routine-turbo', routineName: 'Turbo', recipeId: 'recipe-t' };
    const result = routines([
      // Daily on recipe A, with one Light roast shot beside it.
      ...times([27, 28, 29, 28, 28]),
      ...times([28], { ...light, recipeId: 'recipe-a-light' }),
      // Light roast on a finer recipe, with one Turbo shot beside it.
      ...times([25, 28, 31, 28, 30], { ...light, grind: 1500 }),
      ...times([28], { ...turbo, grind: 1500 })
    ]);
    expect(result.chart).toBeNull();
  });

  it('σ within 0.2 s is no clear difference; no row is amber', () => {
    const result = routines([
      ...times([27, 28, 29, 28, 28]),
      ...times([27, 28, 29, 28, 28], light)
    ]);
    expect(result.title).toBe('No clear difference between routines');
    expect(result.chart).toMatchObject({ rows: [{ top: false }, { top: false }] });
  });

  it('needs 2 routines with 5 comparable shots each', () => {
    expect(routines(times([27, 28, 29, 28, 28])).sentence).toBe(
      'Brew 5 shots of Guji Hambela with each of two routines, the rest of the recipe the same, to compare.'
    );
    expect(routines([...times([27, 28, 29, 28, 28]), ...times([27, 28], light)]).sentence).toBe(
      'Brew 3 more shots of Guji Hambela with another routine, the rest of the recipe the same, to compare.'
    );
  });
});

describe('most consistent beans (screen 25)', () => {
  const beans = (facts: ShotFact[]) => card('consistent-beans', facts);
  const bean = (id: string, recipes: number[][]) =>
    recipes.flatMap((scores, r) =>
      scores.map((score) =>
        fact({
          beanId: id,
          beanName: id,
          recipeId: `${id}-${r}`,
          recipeShots: scores.length,
          score
        })
      )
    );

  it('spread is pooled within each reused recipe; moving between recipes is not spread', () => {
    const result = beans([
      // Steady within each recipe, though the recipes score far apart.
      ...bean('Guji Hambela', [
        [5, 5, 6],
        [9, 9, 8]
      ]),
      ...bean('Huila', [[5, 7, 9, 6, 8]]),
      // A recipe brewed once does not count.
      ...bean('Cerrado', [[9], [2], [5], [7], [1]])
    ]);
    expect(result.title).toBe('Most consistent beans');
    expect(result.sentence).toBe(
      'Lower is steadier. Spread of scores once you found a recipe you reused.'
    );
    expect(result.chart).toMatchObject({
      kind: 'sigma-bars',
      rows: [
        { label: 'Guji Hambela', n: 6, top: true },
        { label: 'Huila', n: 5, top: false }
      ],
      axis: { from: 0, to: 2, ticks: [0, 0.5, 1, 1.5, 2] }
    });
    const rows = result.chart?.kind === 'sigma-bars' ? result.chart.rows : [];
    expect(rows[0].sigma).toBeCloseTo(Math.sqrt(1 / 3), 10);
    expect(result.basis).toBe(
      'Standard deviation of score · reused recipes only · ' +
        'Guji Hambela and Huila have few shots, so treat with care'
    );
  });

  it('screen 25: shows the four steadiest beans', () => {
    const result = beans(
      ['A', 'B', 'C', 'D', 'E'].flatMap((id, i) => bean(id, [[7, 7 + i, 7, 7 + i, 7]]))
    );
    expect(result.chart).toMatchObject({
      rows: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }]
    });
  });

  it('needs 2 beans with 5 rated shots on reused recipes; σ within 0.2 is no winner', () => {
    expect(beans(bean('Guji Hambela', [[7, 8, 7, 8, 7]])).sentence).toBe(
      'Rate 5 shots each of two beans on recipes you reuse to compare.'
    );
    expect(
      beans([...bean('Guji Hambela', [[7, 8, 7, 8, 7]]), ...bean('Huila', [[7, 8]])]).sentence
    ).toBe('Rate 3 more shots of Huila on a recipe you reuse to compare.');
    const tie = beans([...bean('A', [[7, 8, 7, 8, 7]]), ...bean('B', [[7, 8, 7, 8, 8]])]);
    expect(tie.title).toBe('No bean is clearly steadier');
    expect(tie.chart).toMatchObject({ rows: [{ top: false }, { top: false }] });
  });
});
