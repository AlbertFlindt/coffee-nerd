import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { builtInFeatures } from '../../domain/gear';
import type { BasketSpec, MachineSpec } from '../../domain/schemas';
import { openDatabase, type Db } from './client';
import { addGear, archiveGear, loadGearPage } from './gear';
import { newId } from './ids';
import {
  loadMySetupForm,
  MySetupRejected,
  saveMySetup,
  type MySetupInput,
  type MySetupFormData
} from './my-setup';
import { routine, user, userSettings } from './schema';
import { seedReferenceSetup, type SeededIds } from './seed';
import { loadShotForm } from './shot-form';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-my-setup-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 17, 6, 0);
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `my-setup-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
});

const basket: BasketSpec = { brand: 'IMS', type: 'precision', shotSize: 'double' };

/** What the form posts when nothing is changed. */
function current(): MySetupInput {
  const form = loadMySetupForm(db, ids.userId);
  return {
    machineId: form.current.machineId!,
    grinderId: form.current.grinderId!,
    basketId: form.current.basketId,
    routineId: form.current.routineId,
    grind: form.current.grind!,
    dose: form.current.dose!,
    yield: form.current.yield,
    features: form.current.features
  };
}

function rejection(input: unknown): string[] {
  try {
    saveMySetup(db, ids.userId, input, T0);
  } catch (err) {
    if (err instanceof MySetupRejected) return err.problems;
    throw err;
  }
  throw new Error('Expected My setup to be refused');
}

function otherUsersGear(kind: 'machine' | 'grinder' | 'basket'): string {
  db.insert(user)
    .values({ id: 'someone-else', name: 'Else', passwordHash: 'x', createdAt: T0, updatedAt: T0 })
    .onConflictDoNothing()
    .run();
  return kind === 'machine'
    ? addGear(db, 'someone-else', { kind, name: 'Other', spec: machine(['temperature']) }, T0)
    : addGear(db, 'someone-else', { kind: 'basket', spec: basket }, T0);
}

function machine(features: string[]): MachineSpec {
  return {
    type: 'semi_auto',
    groupSizeMm: 58000,
    features: builtInFeatures(Object.fromEntries(features.map((k) => [k, true])))
  };
}

describe('loadMySetupForm', () => {
  it('D-45: the form starts from My setup, with your gear to choose from and your steps (D-89)', () => {
    const form = loadMySetupForm(db, ids.userId);
    expect(form.current).toMatchObject({
      machineId: ids.machineId,
      grinderId: ids.grinderId,
      basketId: ids.basketId,
      routineId: ids.routineId,
      grind: 1600,
      dose: 18000,
      yield: 36000
    });
    expect(form.current.features.temperature).toMatchObject({ on: true, value: 93000 });
    expect(form.steps).toEqual({ dose: 100, yield: 100 });
    expect(form.machines.map((m) => m.name)).toEqual(['Lelit Bianca']);
    expect(form.machines[0].features.map((f) => f.key)).toContain('low_bar_start');
    expect(form.grinders[0].dial).toMatchObject({ step: 100, finest: 0, coarsest: 16000 });
    expect(form.baskets.map((b) => b.name)).toEqual(['VST · 18 g']);
    expect(form.routines.map((r) => r.name)).toEqual(['Daily routine']);
  });

  it('D-89: dose and yield steps are the ones in your settings', () => {
    db.update(userSettings)
      .set({ doseStep: 500, yieldStep: 250 })
      .where(eq(userSettings.userId, ids.userId))
      .run();
    expect(loadMySetupForm(db, ids.userId).steps).toEqual({ dose: 500, yield: 250 });
  });

  it('D-155, D-148: archived gear and routines are never offered', () => {
    const spare = addGear(db, ids.userId, { kind: 'basket', spec: basket }, T0);
    archiveGear(db, ids.userId, spare, T0);
    const form = loadMySetupForm(db, ids.userId);
    expect(form.baskets.map((b) => b.id)).toEqual([ids.basketId]);
  });

  it('D-60: another user’s gear is not offered', () => {
    otherUsersGear('machine');
    expect(loadMySetupForm(db, ids.userId).machines).toHaveLength(1);
  });

  it('D-38: a new account with nothing chosen yet gets an empty form', () => {
    db.update(userSettings)
      .set({
        defaultMachineId: null,
        defaultGrinderId: null,
        defaultBasketId: null,
        defaultRoutineId: null,
        defaultGrind: null,
        defaultDose: null,
        defaultYield: null,
        defaultFeatures: {}
      })
      .where(eq(userSettings.userId, ids.userId))
      .run();
    const form: MySetupFormData = loadMySetupForm(db, ids.userId);
    expect(form.current).toMatchObject({ machineId: null, grinderId: null, dose: null });
    expect(form.machines).toHaveLength(1);
  });
});

describe('saveMySetup', () => {
  it('D-45: My setup is saved and a new bean starts from it', () => {
    saveMySetup(db, ids.userId, { ...current(), dose: 18500, grind: 1700, yield: 37000 }, T0);
    const form = loadMySetupForm(db, ids.userId);
    expect(form.current).toMatchObject({ dose: 18500, grind: 1700, yield: 37000 });
    const shotForm = loadShotForm(db, ids.userId);
    if (shotForm.state !== 'ready') throw new Error('Expected a ready shot form');
    expect(shotForm.prefill).toMatchObject({
      source: 'my_setup',
      dose: 18500,
      grind: 1700,
      yield: 37000
    });
    expect(loadGearPage(db, ids.userId).mySetup?.values).toBe(
      'Dose 18.5 g · Yield 37.0 g · Grind 1.7'
    );
  });

  it('D-45: pressure profile values are saved with My setup', () => {
    const input = current();
    input.features.low_bar_start = { ...input.features.low_bar_start, value: 6000, pressure: 3000 };
    input.features.low_bar_end = {
      ...input.features.low_bar_end,
      on: true,
      value: 8000,
      pressure: 4000
    };
    saveMySetup(db, ids.userId, input, T0);
    const saved = loadMySetupForm(db, ids.userId).current.features;
    expect(saved.low_bar_start).toMatchObject({ on: true, value: 6000, pressure: 3000 });
    expect(saved.low_bar_end).toMatchObject({ on: true, value: 8000, pressure: 4000 });
  });

  it('D-149: the Default chip follows My setup', () => {
    const second = addGear(
      db,
      ids.userId,
      { kind: 'machine', name: 'Second', spec: machine(['temperature', 'flat_pressure']) },
      T0 + 1000
    );
    saveMySetup(
      db,
      ids.userId,
      {
        ...current(),
        machineId: second,
        features: {
          temperature: { label: 'Temperature', unit: '°C', on: true, value: 92000 },
          flat_pressure: { label: 'Flat pressure', unit: 'bar', on: true, value: 9000 }
        }
      },
      T0
    );
    const page = loadGearPage(db, ids.userId);
    expect(page.machines.map((m) => [m.name, m.isDefault])).toEqual([
      ['Lelit Bianca', false],
      ['Second', true]
    ]);
    expect(page.mySetup?.machine).toBe('Second');
  });

  it('D-45: features that the chosen machine does not have are left out', () => {
    const plain = addGear(
      db,
      ids.userId,
      { kind: 'machine', name: 'Plain', spec: machine(['flat_pressure']) },
      T0
    );
    saveMySetup(
      db,
      ids.userId,
      {
        ...current(),
        machineId: plain,
        features: {
          ...current().features,
          flat_pressure: { label: 'Flat pressure', unit: 'bar', on: true, value: 8500 }
        }
      },
      T0
    );
    const features = loadMySetupForm(db, ids.userId).current.features;
    expect(Object.keys(features)).toEqual(['flat_pressure']);
  });

  it('D-155: no basket and no puck prep', () => {
    saveMySetup(db, ids.userId, { ...current(), basketId: null, routineId: null }, T0);
    const form = loadMySetupForm(db, ids.userId);
    expect(form.current).toMatchObject({ basketId: null, routineId: null });
    expect(loadGearPage(db, ids.userId).mySetup).toMatchObject({ basket: null, routine: null });
  });

  it('D-155: an empty yield stays empty, never 0', () => {
    saveMySetup(db, ids.userId, { ...current(), yield: null }, T0);
    expect(loadMySetupForm(db, ids.userId).current.yield).toBeNull();
  });

  it('D-60: another user’s gear is refused', () => {
    expect(rejection({ ...current(), machineId: otherUsersGear('machine') })).toEqual([
      'This gear could not be found'
    ]);
    expect(rejection({ ...current(), basketId: otherUsersGear('basket') })).toEqual([
      'This gear could not be found'
    ]);
  });

  it('D-60: another user’s routine is refused', () => {
    db.insert(user)
      .values({ id: 'someone-else', name: 'Else', passwordHash: 'x', createdAt: T0, updatedAt: T0 })
      .run();
    const id = newId(T0);
    db.insert(routine)
      .values({
        id,
        ownerId: 'someone-else',
        name: 'Theirs',
        steps: [],
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    expect(rejection({ ...current(), routineId: id })).toEqual(['This gear could not be found']);
  });

  it('D-60: a gear item of the wrong kind is refused', () => {
    expect(rejection({ ...current(), grinderId: ids.machineId })).toEqual([
      'This gear could not be found'
    ]);
    expect(rejection({ ...current(), basketId: ids.grinderId })).toEqual([
      'This gear could not be found'
    ]);
  });

  it('D-148: archived gear is refused', () => {
    const spare = addGear(db, ids.userId, { kind: 'basket', spec: basket }, T0);
    archiveGear(db, ids.userId, spare, T0);
    expect(rejection({ ...current(), basketId: spare })).toEqual(['This gear could not be found']);
  });

  it('D-45: a machine and a grinder are required', () => {
    expect(rejection({ ...current(), machineId: null })).toEqual(['Choose a machine']);
    expect(rejection({ ...current(), grinderId: null })).toEqual(['Choose a grinder']);
  });

  it('D-45: grind and dose are required, and dose is more than 0', () => {
    expect(rejection({ ...current(), dose: null })).toEqual(['Set Dose first.']);
    expect(rejection({ ...current(), dose: 0 })).toEqual(['Set Dose first.']);
    expect(rejection({ ...current(), grind: null })).toEqual(['Set Grind first.']);
  });

  it('D-48: a grind outside the grinder’s range is refused', () => {
    expect(rejection({ ...current(), grind: 17000 })).toEqual([
      'Grind must be within the grinder’s range'
    ]);
  });

  it('D-78: temperature without a value is refused', () => {
    const input = current();
    input.features.temperature = { label: 'Temperature', unit: '°C', on: true };
    expect(rejection(input)).toEqual(['Set Temperature first.']);
  });

  it('D-78: flat pressure that is missing is refused, and temperature cannot be switched off', () => {
    const input = current();
    delete input.features.flat_pressure;
    input.features.temperature = { ...input.features.temperature, on: false };
    expect(rejection(input)).toEqual(['Set Temperature first.', 'Set Flat pressure first.']);
  });

  it('D-24: a switched-on phase needs its seconds and pressure', () => {
    const input = current();
    input.features.low_bar_start = { label: 'Low bar start', on: true, value: 5000 };
    expect(rejection(input)).toEqual(['Set the pressure for Low bar start first.']);
  });

  it('D-45: nothing is saved when it is refused', () => {
    rejection({ ...current(), dose: 22000, machineId: otherUsersGear('machine') });
    expect(loadMySetupForm(db, ids.userId).current.dose).toBe(18000);
  });

  it('D-38: an account without a settings row gets one', () => {
    db.delete(userSettings).where(eq(userSettings.userId, ids.userId)).run();
    saveMySetup(
      db,
      ids.userId,
      { ...current0(), machineId: ids.machineId, grinderId: ids.grinderId },
      T0
    );
    expect(loadMySetupForm(db, ids.userId).current).toMatchObject({ dose: 18000 });
  });
});

/** The reference values, for an account whose settings row was removed. */
function current0(): MySetupInput {
  return {
    machineId: ids.machineId,
    grinderId: ids.grinderId,
    basketId: null,
    routineId: null,
    grind: 1600,
    dose: 18000,
    yield: 36000,
    features: {
      temperature: { label: 'Temperature', unit: '°C', on: true, value: 93000 },
      flat_pressure: { label: 'Flat pressure', unit: 'bar', on: true, value: 9000 }
    }
  };
}
