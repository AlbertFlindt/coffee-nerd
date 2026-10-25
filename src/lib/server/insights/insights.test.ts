import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/client';
import { newId } from '../db/ids';
import { REFERENCE, seedReferenceSetup } from '../db/seed';
import { saveShot } from '../db/shots';
import { loadInsights } from './insights';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-insights-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const T0 = Date.UTC(2026, 9, 17, 6, 0);

describe('loadInsights', () => {
  it('D-208, D-207: the header counts every shot and bean with a shot; every card says what it needs', () => {
    const db = openDatabase(join(dir, 'insights.db'));
    const ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
    const empty = loadInsights(db, ids.userId);
    expect(empty).toMatchObject({ shots: 0, beans: 0 });
    expect(empty.cards.map((c) => [c.title, c.chart])).toEqual([
      ['Score by process', null],
      ['Score by origin', null]
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
    expect(loadInsights(db, ids.userId)).toMatchObject({ shots: 2, beans: 1 });
  });
});
