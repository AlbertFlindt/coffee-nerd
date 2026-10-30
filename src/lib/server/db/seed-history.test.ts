import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { loadShotFacts } from '../insights/facts';
import { loadInsights } from '../insights/insights';
import { openDatabase } from './client';
import { appState, bean, routine } from './schema';
import { seedReferenceSetup } from './seed';
import { seedShotHistory } from './seed-history';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-history-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const T0 = Date.UTC(2026, 9, 17, 6, 0);
let counter = 0;

function seeded() {
  const db = openDatabase(join(dir, `history-${counter++}.db`));
  const ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
  seedShotHistory(db, ids, T0);
  return { db, ids, facts: loadShotFacts(db, ids.userId, 'Europe/Copenhagen') };
}

describe('seedShotHistory', () => {
  it('214 shots on 9 beans over 13 weeks, 96 of them rated, as screen 23 counts', () => {
    const { facts } = seeded();
    expect(facts).toHaveLength(214);
    expect(new Set(facts.map((f) => f.beanId)).size).toBe(9);
    expect(facts.filter((f) => f.score !== null)).toHaveLength(96);
    expect(facts[0].brewedAt).toBeGreaterThan(T0 - 13 * 7 * 86_400_000);
    expect(facts[facts.length - 1].brewedAt).toBeLessThan(T0);
  });

  it('rated shots per process and per origin match screen 23', () => {
    const { facts } = seeded();
    const rated = facts.filter((f) => f.score !== null);
    const per = (key: (f: (typeof facts)[number]) => string | null) =>
      Object.fromEntries(
        [...new Set(rated.map(key))].map((k) => [k, rated.filter((f) => key(f) === k).length])
      );
    expect(per((f) => f.process)).toEqual({ natural: 38, honey: 12, washed: 36, null: 10 });
    expect(per((f) => f.countryCode)).toEqual({ ET: 41, KE: 22, CO: 18, BR: 15 });
  });

  it('Guji Hambela is the one open bean and the bean on Home; a Light roast routine exists', () => {
    const { db, ids } = seeded();
    expect(
      db
        .select({ id: bean.id })
        .from(bean)
        .where(eq(bean.status, 'open'))
        .all()
        .map((b) => b.id)
    ).toEqual([ids.beanId]);
    expect(db.select().from(appState).get()?.currentBeanId).toBe(ids.beanId);
    expect(
      db
        .select({ name: routine.name })
        .from(routine)
        .all()
        .map((r) => r.name)
    ).toEqual(['Daily routine', 'Light roast']);
  });

  it('every card shows the finding screens 23 to 25 are drawn with', () => {
    const { db, ids } = seeded();
    const cards = loadInsights(db, ids.userId, T0).cards;
    expect(cards.map((c) => c.title)).toEqual([
      'Naturals are your thing',
      'Ethiopia leads your origins',
      'Better and steadier',
      'Your shot time is under control',
      'Daily routine is more repeatable',
      'Most consistent beans'
    ]);
    expect(cards[0].chart?.kind === 'box' && cards[0].chart.rows.map((r) => r.label)).toEqual([
      'Natural',
      'Honey',
      'Washed'
    ]);
  });

  it('is the same every time', () => {
    const scores = () => seeded().facts.map((f) => [f.score, f.time, f.grind]);
    expect(scores()).toEqual(scores());
  });
});
