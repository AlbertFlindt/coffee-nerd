import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/client';
import { newId } from '../db/ids';
import { REFERENCE, seedReferenceSetup } from '../db/seed';
import { loadHome } from '../db/home';
import { saveShot } from '../db/shots';
import { loadInsights } from './insights';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-insights-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const T0 = Date.UTC(2026, 9, 17, 6, 0);

function shot(
  db: ReturnType<typeof openDatabase>,
  ids: ReturnType<typeof seedReferenceSetup>,
  brewedAt: number,
  score: number | null,
  grind = 1600
) {
  saveShot(
    db,
    ids.userId,
    {
      id: newId(brewedAt),
      beanId: ids.beanId,
      machineId: ids.machineId,
      grinderId: ids.grinderId,
      basketId: ids.basketId,
      routineId: null,
      grind,
      dose: 18000,
      setup: { features: { ...REFERENCE.myFeatures }, routine: null },
      yield: 36000,
      time: 28000,
      taste: { score, balance: null, body: null, sweetness: null, aftertaste: null },
      tagIds: [],
      notes: null,
      brewedAt
    },
    brewedAt
  );
}

describe('loadInsights', () => {
  it('D-208, D-207: the header counts every shot and bean with a shot; every card says what it needs', () => {
    const db = openDatabase(join(dir, 'insights.db'));
    const ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
    const empty = loadInsights(db, ids.userId, T0);
    expect(empty).toMatchObject({ shots: 0, beans: 0 });
    expect(empty.cards.map((c) => [c.title, c.sentence, c.chart])).toEqual([
      ['Score by process', 'Rate 5 shots each from two processes to compare.', null],
      ['Score by origin', 'Rate 5 shots each from two origins to compare.', null],
      ['Weekly average score', 'Rate 2 shots a week for 4 more weeks to see your progress.', null],
      [
        'Shot time',
        'Rate a shot of Guji Hambela to find its best recipe and its shot times.',
        null
      ],
      [
        'Shot time by routine',
        'Brew 5 shots of Guji Hambela with each of two routines, the rest of the recipe the same, to compare.',
        null
      ],
      [
        'Most consistent beans',
        'Rate 5 shots each of two beans on recipes you reuse to compare.',
        null
      ]
    ]);

    for (const score of [8, null])
      saveShot(
        db,
        ids.userId,
        {
          id: newId(T0),
          beanId: ids.beanId,
          machineId: ids.machineId,
          grinderId: ids.grinderId,
          basketId: ids.basketId,
          routineId: null,
          grind: 1600,
          dose: 18000,
          setup: { features: { ...REFERENCE.myFeatures }, routine: null },
          yield: 36000,
          time: 28000,
          taste: { score, balance: null, body: null, sweetness: null, aftertaste: null },
          tagIds: [],
          notes: null,
          brewedAt: T0
        },
        T0
      );
    const after = loadInsights(db, ids.userId, T0);
    expect(after).toMatchObject({ shots: 2, beans: 1 });
    // D-205: the rated shot makes its recipe the best one of the bean on Home.
    expect(after.cards.find((c) => c.id === 'shot-time')?.sentence).toBe(
      'Brew 8 more shots of your best Guji Hambela recipe to see its shot times.'
    );
  });
  it('D-208, D-212: the weekly line ends with this week in the user time zone and spans 12 weeks', () => {
    const db = openDatabase(join(dir, 'weeks.db'));
    const ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
    // Monday 19 October, 00:30 in Copenhagen, is still Sunday in UTC.
    const now = Date.UTC(2026, 9, 18, 22, 30);
    const day = 86_400_000;
    // Two rated shots in each of this week and 3 earlier ones, and two 12 weeks back, out of range.
    for (const daysBack of [0, 0, 7, 7, 14, 14, 21, 21, 84, 84])
      shot(db, ids, now - daysBack * day, 7);
    const weekly = loadInsights(db, ids.userId, now).cards.find((c) => c.id === 'weekly-score')!;
    const points = weekly.chart?.kind === 'weekly' ? weekly.chart.points : [];
    expect(points.map((p) => p.week)).toHaveLength(12);
    expect(points[0].week).toBe('2026-08-03');
    expect(points[11]).toMatchObject({ week: '2026-10-19', stats: { n: 2 } });
    expect(points.filter((p) => p.stats !== null)).toHaveLength(4);
  });

  it('D-205: the bell curve uses the recipe Home calls best', () => {
    const db = openDatabase(join(dir, 'best.db'));
    const ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
    for (const [grind, score] of [
      [1600, 6],
      [1500, 9],
      [1600, 7]
    ])
      shot(db, ids, T0, score, grind);
    const home = loadHome(db, ids.userId, T0);
    const bell = loadInsights(db, ids.userId, T0).cards.find((c) => c.id === 'shot-time')!;
    expect(home.state === 'ready' && home.best?.title).toMatch(/^Grind 1\.5 · 18\.0 g → 36\.0 g/);
    expect(bell.sentence).toBe(
      'Brew 9 more shots of your best Guji Hambela recipe to see its shot times.'
    );
  });
});
