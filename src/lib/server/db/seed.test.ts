import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { gearSchema, routineStepsSchema, prepStepSettingSchema } from '../../domain/schemas';
import { openDatabase } from './client';
import { appState, bean, gear, prepStep, routine, tag, userSettings } from './schema';
import { seedReferenceSetup } from './seed';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-seed-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const T0 = Date.UTC(2026, 9, 17, 6, 0);

describe('seedReferenceSetup', () => {
  it('M2: the seed runs on an empty database and creates the reference setup', () => {
    const db = openDatabase(join(dir, 'seed.db'));
    const ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });

    expect(
      db
        .select()
        .from(gear)
        .all()
        .map((g) => g.name)
    ).toEqual(['Lelit Bianca', 'Timemore 064S', 'VST 18 g']);
    expect(
      db
        .select()
        .from(prepStep)
        .all()
        .map((s) => s.name)
    ).toEqual(['WDT', 'Distributor', 'Tamp', 'Puck screen']);
    expect(db.select().from(routine).get()?.name).toBe('Daily routine');
    expect(db.select().from(tag).all()).toHaveLength(15);
    expect(db.select().from(userSettings).get()).toMatchObject({
      defaultMachineId: ids.machineId,
      defaultRoutineId: ids.routineId,
      defaultDose: 18000,
      defaultYield: 36000,
      defaultGrind: 1600
    });
    expect(db.select().from(bean).get()).toMatchObject({
      name: 'Guji Hambela',
      status: 'open',
      roastDate: '2026-10-05'
    });
    expect(db.select().from(appState).get()?.currentBeanId).toBe(ids.beanId);
  });

  it('D-44, D-48, D-49, D-51, D-52: the seeded gear, steps and routine pass their schemas', () => {
    const db = openDatabase(join(dir, 'valid.db'));
    seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
    for (const row of db.select().from(gear).all())
      expect(gearSchema.safeParse(row).success, row.name).toBe(true);
    for (const row of db.select().from(prepStep).all())
      expect(prepStepSettingSchema.safeParse(row.setting).success, row.name).toBe(true);
    expect(routineStepsSchema.safeParse(db.select().from(routine).get()?.steps).success).toBe(true);
  });

  it('D-89: dose, yield and time steps default to 0.1 g, 0.1 g and 1 s per user', () => {
    const db = openDatabase(join(dir, 'steps.db'));
    seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
    expect(db.select().from(userSettings).get()).toMatchObject({
      doseStep: 100,
      yieldStep: 100,
      timeStep: 1000
    });
  });

  it('D-88: the seed refuses a database that already has an account', () => {
    const db = openDatabase(join(dir, 'twice.db'));
    seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
    expect(() => seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' })).toThrow(
      /empty database/
    );
  });
});
