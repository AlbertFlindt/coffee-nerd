import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { archivedCount, loadArchived, restoreArchived } from './archived';
import { openDatabase, type Db } from './client';
import { addGear, archiveGear, loadGearPage, type GearInput } from './gear';
import { newId } from './ids';
import { loadPuckPrep } from './puck-prep';
import { prepStep, routine, tag } from './schema';
import { seedReferenceSetup, type SeededIds } from './seed';
import { loadTags } from './tags';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-archived-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 23, 6, 0);
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `archived-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
});

const basket: GearInput = {
  kind: 'basket',
  spec: { brand: 'IMS', sizeG: 20000, type: 'precision', shotSize: 'double', diameterMm: 58000 }
};

describe('archived gear (D-188)', () => {
  it('D-188: archived gear is listed with its summary, and Restore puts it back', () => {
    expect(archivedCount(db, ids.userId, 'gear')).toBe(0);
    const id = addGear(db, ids.userId, basket, T0);
    archiveGear(db, ids.userId, id, T0);
    expect(archivedCount(db, ids.userId, 'gear')).toBe(1);
    const groups = loadArchived(db, ids.userId, 'gear');
    expect(groups).toEqual([
      {
        title: 'Baskets',
        items: [{ kind: 'gear', id, name: 'IMS · 20 g', detail: expect.any(String) }]
      }
    ]);
    expect(restoreArchived(db, ids.userId, 'gear', id, T0)).toBe(true);
    expect(loadGearPage(db, ids.userId).baskets.map((b) => b.id)).toContain(id);
    expect(archivedCount(db, ids.userId, 'gear')).toBe(0);
  });

  it('D-60: not someone else’s, and not an item that is not archived', () => {
    const id = addGear(db, ids.userId, basket, T0);
    expect(restoreArchived(db, ids.userId, 'gear', id, T0)).toBe(false);
    archiveGear(db, ids.userId, id, T0);
    expect(restoreArchived(db, 'someone-else', 'gear', id, T0)).toBe(false);
    expect(loadArchived(db, 'someone-else', 'gear')).toEqual([]);
  });
});

describe('archived puck prep (D-188)', () => {
  it('D-188, D-169: a restored routine brings back the archived steps it holds', () => {
    const stepId = newId(T0);
    db.insert(prepStep)
      .values({
        id: stepId,
        ownerId: ids.userId,
        name: 'Paper filter',
        setting: { kind: 'none' },
        archivedAt: T0,
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    const routineId = newId(T0 + 1);
    db.insert(routine)
      .values({
        id: routineId,
        ownerId: ids.userId,
        name: 'Light roast',
        steps: [
          { stepId: ids.stepIds[0], value: 20000 },
          { stepId, value: null }
        ],
        archivedAt: T0,
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    expect(loadArchived(db, ids.userId, 'puck-prep')).toEqual([
      {
        title: 'Routines',
        items: [
          { kind: 'routine', id: routineId, name: 'Light roast', detail: 'WDT → Paper filter' }
        ]
      },
      { title: 'Steps', items: [{ kind: 'step', id: stepId, name: 'Paper filter', detail: null }] }
    ]);
    expect(archivedCount(db, ids.userId, 'puck-prep')).toBe(2);

    expect(restoreArchived(db, ids.userId, 'routine', routineId, T0)).toBe(true);
    const page = loadPuckPrep(db, ids.userId);
    expect(page.routines.map((r) => r.name)).toContain('Light roast');
    expect(page.steps.map((s) => s.name)).toContain('Paper filter');
    expect(archivedCount(db, ids.userId, 'puck-prep')).toBe(0);
  });

  it('D-188: a step is restored on its own', () => {
    db.update(prepStep).set({ archivedAt: T0 }).where(eq(prepStep.id, ids.stepIds[3])).run();
    expect(restoreArchived(db, ids.userId, 'step', ids.stepIds[3], T0)).toBe(true);
    expect(
      db.select().from(prepStep).where(eq(prepStep.id, ids.stepIds[3])).get()?.archivedAt
    ).toBeNull();
  });
});

describe('archived flavor notes (D-188)', () => {
  it('D-188: a removed note is listed with its family and comes back on Restore', () => {
    const berry = db.select().from(tag).where(eq(tag.name, 'Berry')).get()!;
    db.update(tag).set({ archivedAt: T0 }).where(eq(tag.id, berry.id)).run();
    expect(loadArchived(db, ids.userId, 'tags')).toEqual([
      {
        title: 'Flavor notes',
        items: [{ kind: 'tag', id: berry.id, name: 'Berry', detail: 'Fruity' }]
      }
    ]);
    expect(restoreArchived(db, ids.userId, 'tag', berry.id, T0)).toBe(true);
    const names = loadTags(db, ids.userId).families.flatMap((f) => f.tags.map((t) => t.name));
    expect(names).toContain('Berry');
  });
});
