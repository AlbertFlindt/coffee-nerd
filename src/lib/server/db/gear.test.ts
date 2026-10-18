import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { BasketSpec, FeatureDefinition, MachineSpec } from '../../domain/schemas';
import { openDatabase, type Db } from './client';
import {
  addGear,
  archiveGear,
  GearRejected,
  loadGear,
  loadGearPage,
  loadLibrary,
  loadMachineSizes,
  saveGear,
  usedFeatureKeys
} from './gear';
import { newId } from './ids';
import { bean, gear, recipe } from './schema';
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
    // The name is built from the checked brand, so spaces around it never reach the name.
    const spaced = addGear(
      db,
      ids.userId,
      {
        kind: 'basket',
        spec: { ...stock, brand: '  VST ', sizeG: 20000 }
      },
      T0
    );
    expect(db.select().from(gear).where(eq(gear.id, spaced)).get()?.name).toBe('VST · 20 g');
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

  it('D-148: archived gear is no longer saved from its page', () => {
    const id = addGear(db, ids.userId, { kind: 'basket', spec: stock }, T0);
    archiveGear(db, ids.userId, id, T0);
    expect(() =>
      saveGear(db, ids.userId, id, { kind: 'basket', spec: { ...stock, brand: 'Later' } }, T0)
    ).toThrow(GearRejected);
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

describe('loadMachineSizes', () => {
  it('D-49: your machines and their group size, for the basket fit check', () => {
    expect(loadMachineSizes(db, ids.userId)).toEqual([
      { name: 'Lelit Bianca', groupSizeMm: 58000 }
    ]);
    expect(loadMachineSizes(db, 'someone-else')).toEqual([]);
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

describe('custom features (D-46, D-151)', () => {
  const KEY = 'custom-0b6c6a52-6a0e-4a1f-9c55-3f1f0f6d2a11';
  const bloom: FeatureDefinition = {
    key: KEY,
    label: 'Bloom pause',
    builtIn: false,
    enabled: true,
    switchable: true,
    value: { kind: 'seconds', step: 1000 }
  };
  const machine = (features: FeatureDefinition[]) => ({
    kind: 'machine' as const,
    name: 'Lelit Bianca',
    spec: { ...REFERENCE.machine.spec, features } satisfies MachineSpec
  });
  const withBloom = () => machine([...REFERENCE.machine.spec.features, bloom]);

  /** A recipe whose setup has the feature: a shot used it. */
  function useIt(ownerId = ids.userId) {
    db.insert(recipe)
      .values({
        id: newId(T0),
        ownerId,
        beanId: ids.beanId,
        machineId: ids.machineId,
        grinderId: ids.grinderId,
        grind: 1600,
        dose: 18000,
        setup: {
          features: { [KEY]: { label: 'Bloom pause', on: true, value: 6000 } },
          routine: null
        },
        fingerprint: 'f',
        createdAt: T0,
        updatedAt: T0
      })
      .run();
  }

  it('D-46: adding a custom feature saves it with the machine', () => {
    saveGear(db, ids.userId, ids.machineId, withBloom(), T0);
    const spec = loadGear(db, ids.userId, ids.machineId)!.spec as MachineSpec;
    expect(spec.features.at(-1)).toMatchObject({ key: KEY, label: 'Bloom pause' });
  });

  it('D-151: a custom feature no shot used can be deleted', () => {
    saveGear(db, ids.userId, ids.machineId, withBloom(), T0);
    saveGear(db, ids.userId, ids.machineId, machine(REFERENCE.machine.spec.features), T0);
    const spec = loadGear(db, ids.userId, ids.machineId)!.spec as MachineSpec;
    expect(spec.features.map((f) => f.key)).not.toContain(KEY);
  });

  it('D-151: a custom feature a shot used cannot be deleted', () => {
    saveGear(db, ids.userId, ids.machineId, withBloom(), T0);
    useIt();
    expect(() =>
      saveGear(db, ids.userId, ids.machineId, machine(REFERENCE.machine.spec.features), T0)
    ).toThrow(new GearRejected(['spec.features: used']));
    expect((loadGear(db, ids.userId, ids.machineId)!.spec as MachineSpec).features).toHaveLength(
      REFERENCE.machine.spec.features.length + 1
    );
  });

  it('D-151: a custom feature a shot used can be renamed and switched off', () => {
    saveGear(db, ids.userId, ids.machineId, withBloom(), T0);
    useIt();
    const renamed = { ...bloom, label: 'Bloom', enabled: false };
    saveGear(
      db,
      ids.userId,
      ids.machineId,
      machine([...REFERENCE.machine.spec.features, renamed]),
      T0
    );
    const spec = loadGear(db, ids.userId, ids.machineId)!.spec as MachineSpec;
    expect(spec.features.at(-1)).toMatchObject({ label: 'Bloom', enabled: false });
  });

  it('D-151: a used feature keeps its kind of value and its options', () => {
    const water: FeatureDefinition = {
      ...bloom,
      label: 'Water',
      value: {
        kind: 'choice',
        options: [
          { id: 'soft', label: 'Soft' },
          { id: 'hard', label: 'Hard' }
        ]
      }
    };
    saveGear(
      db,
      ids.userId,
      ids.machineId,
      machine([...REFERENCE.machine.spec.features, water]),
      T0
    );
    useIt();
    const changed = (value: FeatureDefinition['value']) =>
      machine([...REFERENCE.machine.spec.features, { ...water, value }]);
    expect(() =>
      saveGear(db, ids.userId, ids.machineId, changed({ kind: 'seconds', step: 1000 }), T0)
    ).toThrow(new GearRejected(['spec.features: used']));
    expect(() =>
      saveGear(
        db,
        ids.userId,
        ids.machineId,
        changed({
          kind: 'choice',
          options: [
            { id: 'soft', label: 'Soft' },
            { id: 'filtered', label: 'Filtered' }
          ]
        }),
        T0
      )
    ).toThrow(new GearRejected(['spec.features: used']));
    // A new option and a renamed one are fine.
    saveGear(
      db,
      ids.userId,
      ids.machineId,
      changed({
        kind: 'choice',
        options: [
          { id: 'soft', label: 'Very soft' },
          { id: 'hard', label: 'Hard' },
          { id: 'filtered', label: 'Filtered' }
        ]
      }),
      T0
    );
  });

  it('D-152: a list of your own needs at least two options', () => {
    const one: FeatureDefinition = {
      ...bloom,
      value: { kind: 'choice', options: [{ id: 'only', label: 'Only' }] }
    };
    expect(() =>
      saveGear(
        db,
        ids.userId,
        ids.machineId,
        machine([...REFERENCE.machine.spec.features, one]),
        T0
      )
    ).toThrow(GearRejected);
  });

  it('D-151, D-60: usedFeatureKeys lists the keys of your recipes only', () => {
    expect(usedFeatureKeys(db, ids.userId)).toEqual([]);
    useIt();
    expect(usedFeatureKeys(db, ids.userId)).toEqual([KEY]);
    expect(usedFeatureKeys(db, 'someone-else')).toEqual([]);
  });
});
