import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { BasketSpec } from '../../domain/schemas';
import { openDatabase, type Db } from './client';
import {
  addGear,
  archiveGear,
  GearRejected,
  loadGear,
  loadGearPage,
  loadLibrary,
  saveGear
} from './gear';
import { newId } from './ids';
import { bean, gear } from './schema';
import { REFERENCE, seedReferenceSetup, type SeededIds } from './seed';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-gear-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 17, 6, 0);
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `gear-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
});

const stock: BasketSpec = {
  brand: 'Lelit',
  type: 'standard',
  shotSize: 'double',
  diameterMm: 58000
};

describe('loadGearPage', () => {
  it('D-38: My setup on top, then gear grouped by kind with summaries and the Default chip', () => {
    const page = loadGearPage(db, ids.userId);
    expect(page.mySetup).toEqual({
      machine: 'Lelit Bianca',
      grinder: 'Timemore 064S',
      basket: 'VST · 18 g',
      routine: 'Daily routine',
      values: 'Dose 18.0 g · Yield 36.0 g · Grind 1.6',
      setup: '93 °C · Flat 9.0 bar · Preinfusion 4 s · Low bar start 5 s at 2.0 bar'
    });
    expect(page.machines).toEqual([
      {
        id: ids.machineId,
        name: 'Lelit Bianca',
        summary: 'Semi-auto · Preinfusion, low bar start, low bar end',
        isDefault: true
      }
    ]);
    expect(page.grinders[0]).toMatchObject({ summary: 'Stepless · steps of 0.1', isDefault: true });
    expect(page.baskets[0]).toMatchObject({
      name: 'VST · 18 g',
      summary: 'Precision · 58 mm',
      isDefault: true
    });
  });

  it('D-148: archived gear is left out', () => {
    const id = addGear(db, ids.userId, { kind: 'basket', spec: stock }, T0);
    archiveGear(db, ids.userId, id, T0);
    expect(loadGearPage(db, ids.userId).baskets.map((b) => b.name)).toEqual(['VST · 18 g']);
  });

  it('D-60: only your own gear', () => {
    const page = loadGearPage(db, 'someone-else');
    expect([page.machines, page.grinders, page.baskets]).toEqual([[], [], []]);
    expect(page.mySetup).toBeNull();
  });
});

describe('addGear and saveGear', () => {
  it('D-147, D-150: a basket is named by brand and size', () => {
    const id = addGear(db, ids.userId, { kind: 'basket', spec: { ...stock, sizeG: 18000 } }, T0);
    expect(db.select().from(gear).where(eq(gear.id, id)).get()).toMatchObject({
      ownerId: ids.userId,
      kind: 'basket',
      name: 'Lelit · 18 g'
    });
  });

  it('D-44: a machine is saved with its name and spec, checked first', () => {
    const item = loadGear(db, ids.userId, ids.machineId)!;
    expect(item).toMatchObject({ kind: 'machine', name: 'Lelit Bianca', isDefault: true });
    saveGear(
      db,
      ids.userId,
      ids.machineId,
      { kind: 'machine', name: 'Bianca V3', spec: { ...REFERENCE.machine.spec, type: 'lever' } },
      T0
    );
    expect(loadGear(db, ids.userId, ids.machineId)).toMatchObject({
      name: 'Bianca V3',
      spec: { type: 'lever' }
    });
    expect(() =>
      saveGear(
        db,
        ids.userId,
        ids.machineId,
        { kind: 'machine', name: ' ', spec: REFERENCE.machine.spec },
        T0
      )
    ).toThrow(GearRejected);
  });

  it('D-48: a grinder whose finest equals its coarsest is refused', () => {
    const spec = {
      ...REFERENCE.grinder.spec,
      dial: { ...REFERENCE.grinder.spec.dial, coarsest: 0 }
    };
    expect(() =>
      saveGear(db, ids.userId, ids.grinderId, { kind: 'grinder', name: 'X', spec }, T0)
    ).toThrow(GearRejected);
  });

  it('D-60: not another user’s gear, and not changing its kind', () => {
    expect(loadGear(db, 'someone-else', ids.machineId)).toBeNull();
    expect(() =>
      saveGear(
        db,
        'someone-else',
        ids.machineId,
        { kind: 'machine', name: 'X', spec: REFERENCE.machine.spec },
        T0
      )
    ).toThrow(GearRejected);
    expect(() =>
      saveGear(db, ids.userId, ids.machineId, { kind: 'basket', spec: stock }, T0)
    ).toThrow(GearRejected);
  });
});

describe('archiveGear', () => {
  it('D-148: archives an item; past shots keep pointing to it', () => {
    const id = addGear(db, ids.userId, { kind: 'basket', spec: stock }, T0);
    expect(archiveGear(db, ids.userId, id, T0)).toBe('archived');
    expect(db.select().from(gear).where(eq(gear.id, id)).get()?.archivedAt).toBe(T0);
    expect(loadGear(db, ids.userId, id)).toMatchObject({ archived: true });
  });

  it('D-83: an item My setup uses is not archived', () => {
    expect(archiveGear(db, ids.userId, ids.basketId, T0)).toBe('in_my_setup');
    expect(loadGear(db, ids.userId, ids.basketId)).toMatchObject({
      isDefault: true,
      archived: false
    });
  });

  it('D-60: not another user’s gear', () => {
    expect(archiveGear(db, 'someone-else', ids.basketId, T0)).toBeNull();
  });
});

describe('loadLibrary', () => {
  it('D-50, D-156: a short summary for each section', () => {
    db.insert(bean)
      .values({
        id: newId(T0),
        ownerId: ids.userId,
        name: 'Old',
        roastDate: '2026-09-01',
        status: 'finished',
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    const library = loadLibrary(db, ids.userId, T0);
    expect(library.beans).toEqual(['1 open · 1 finished', 'Freshest: 12 days']);
    expect(library.gear).toEqual(['3 items', 'Lelit Bianca · Timemore 064S']);
    expect(library.puckPrep).toEqual(['1 routine · 4 steps', 'In use: Daily routine']);
    expect(library.tags[0]).toMatch(/^\d+ flavor notes$/);
  });
});
