import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrepStepSetting } from '../../domain/schemas';
import { openDatabase, type Db } from './client';
import { newId } from './ids';
import { addStep, loadPuckPrep, removeStep, saveStep, StepRejected } from './puck-prep';
import { prepStep, routine, userSettings } from './schema';
import { seedReferenceSetup, type SeededIds } from './seed';
import { loadShotForm } from './shot-form';
import { saveShot } from './shots';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-puck-prep-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 19, 6, 0);
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `puck-prep-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
});

const sprays: PrepStepSetting = { kind: 'number', unit: 'sprays', step: 1000, startsAt: 2000 };

/** Saves a shot from the form's prefill, with an optional score and routine. */
function brew(minutes: number, score: number | null, routineId?: string | null) {
  const form = loadShotForm(db, ids.userId);
  if (form.state !== 'ready') throw new Error('Expected a ready form');
  const now = T0 + minutes * 60_000;
  const chosen = routineId === undefined ? form.prefill.routineId : routineId;
  const routineNow = form.routines.find((r) => r.id === chosen)?.routine ?? null;
  return saveShot(
    db,
    ids.userId,
    {
      ...form.prefill,
      id: newId(now),
      routineId: chosen,
      setup: { ...form.prefill.setup, routine: routineNow },
      yield: 36000,
      time: 28000,
      taste: { score, balance: null, body: null, sweetness: null, aftertaste: null },
      tagIds: [],
      notes: null,
      brewedAt: now
    },
    now
  );
}

function lightRoast(): string {
  const id = newId(T0);
  db.insert(routine)
    .values({
      id,
      ownerId: ids.userId,
      name: 'Light roast',
      steps: [
        { stepId: ids.stepIds[0], value: 20000 },
        { stepId: ids.stepIds[2], value: 15000 }
      ],
      createdAt: T0,
      updatedAt: T0
    })
    .run();
  return id;
}

describe('loadPuckPrep', () => {
  it('D-51: routines with their steps in order, then your steps with their unit', () => {
    const page = loadPuckPrep(db, ids.userId);
    expect(page.routines).toEqual([
      {
        id: ids.routineId,
        name: 'Daily routine',
        steps: ['WDT', 'Distributor', 'Tamp', 'Puck screen'],
        inUse: true,
        shots: 0,
        averageScore: null
      }
    ]);
    expect(page.steps.map((s) => [s.name, s.unit])).toEqual([
      ['WDT', 'seconds'],
      ['Distributor', null],
      ['Tamp', 'kg'],
      ['Puck screen', null]
    ]);
  });

  it('D-51: shots and the average score of the rated ones', () => {
    brew(1, 7);
    brew(2, 8);
    brew(3, null);
    const [daily] = loadPuckPrep(db, ids.userId).routines;
    expect(daily).toMatchObject({ shots: 3, averageScore: 7.5 });
  });

  it('D-163: "In use" on My setup’s routine and on the last shot’s routine', () => {
    const light = lightRoast();
    expect(loadPuckPrep(db, ids.userId).routines.map((r) => [r.name, r.inUse])).toEqual([
      ['Daily routine', true],
      ['Light roast', false]
    ]);
    brew(1, null, light);
    expect(loadPuckPrep(db, ids.userId).routines.map((r) => [r.name, r.inUse])).toEqual([
      ['Daily routine', true],
      ['Light roast', true]
    ]);
    db.update(userSettings)
      .set({ defaultRoutineId: light })
      .where(eq(userSettings.userId, ids.userId))
      .run();
    expect(loadPuckPrep(db, ids.userId).routines.map((r) => r.inUse)).toEqual([false, true]);
  });

  it('D-60, D-148: only your own, and archived ones are left out', () => {
    db.update(prepStep).set({ archivedAt: T0 }).where(eq(prepStep.id, ids.stepIds[3])).run();
    expect(loadPuckPrep(db, ids.userId).steps).toHaveLength(3);
    expect(loadPuckPrep(db, 'someone-else')).toEqual({ routines: [], steps: [] });
  });

  it('D-169: a step knows the routines that contain it', () => {
    lightRoast();
    const wdt = loadPuckPrep(db, ids.userId).steps[0];
    expect(wdt.routines).toEqual(['Daily routine', 'Light roast']);
  });
});

describe('addStep and saveStep', () => {
  it('D-52: a new step is saved with its setting', () => {
    const id = addStep(db, ids.userId, { name: ' RDT ', setting: sprays }, T0);
    const step = loadPuckPrep(db, ids.userId).steps.find((s) => s.id === id);
    expect(step).toMatchObject({ name: 'RDT', unit: 'sprays', used: false, routines: [] });
  });

  it('D-52: a name and a valid setting are required', () => {
    expect(() => addStep(db, ids.userId, { name: ' ', setting: { kind: 'none' } }, T0)).toThrow(
      StepRejected
    );
    expect(() =>
      addStep(
        db,
        ids.userId,
        { name: 'RDT', setting: { ...sprays, min: 0, max: 1000, startsAt: 5000 } },
        T0
      )
    ).toThrow(StepRejected);
  });

  it('D-168: an unused step can change anything', () => {
    const id = addStep(db, ids.userId, { name: 'RDT', setting: sprays }, T0);
    saveStep(db, ids.userId, id, { name: 'Spritz', setting: { kind: 'none' } }, T0);
    expect(loadPuckPrep(db, ids.userId).steps.find((s) => s.id === id)).toMatchObject({
      name: 'Spritz',
      unit: null
    });
  });

  it('D-168: a used step keeps its kind of setting and its unit; name, step, range and start can change', () => {
    brew(1, null);
    const tamp = ids.stepIds[2];
    const setting = { kind: 'number', unit: 'kg', step: 500, startsAt: 15000 } as const;
    saveStep(
      db,
      ids.userId,
      tamp,
      {
        name: 'Tamp hard',
        setting: { ...setting, step: 1000, min: 0, max: 30000, startsAt: 20000 }
      },
      T0
    );
    expect(() =>
      saveStep(db, ids.userId, tamp, { name: 'Tamp', setting: { ...setting, unit: 'lb' } }, T0)
    ).toThrow(new StepRejected(['setting: used']));
    expect(() =>
      saveStep(
        db,
        ids.userId,
        tamp,
        { name: 'Tamp', setting: { kind: 'seconds', step: 1000, startsAt: 5000 } },
        T0
      )
    ).toThrow(new StepRejected(['setting: used']));
  });

  it('D-168: a used list step keeps its options and can get new ones', () => {
    const list: PrepStepSetting = {
      kind: 'choice',
      options: [
        { id: 'paper', label: 'Paper' },
        { id: 'metal', label: 'Metal' }
      ],
      startsAt: 'paper'
    };
    const id = addStep(db, ids.userId, { name: 'Filter', setting: list }, T0);
    db.update(routine)
      .set({ steps: [{ stepId: id, value: 'paper' }] })
      .where(eq(routine.id, ids.routineId))
      .run();
    brew(1, null);
    saveStep(
      db,
      ids.userId,
      id,
      {
        name: 'Filter',
        setting: { ...list, options: [...list.options, { id: 'none', label: 'None' }] }
      },
      T0
    );
    expect(() =>
      saveStep(
        db,
        ids.userId,
        id,
        {
          name: 'Filter',
          setting: { ...list, options: [list.options[0], { id: 'x', label: 'X' }] }
        },
        T0
      )
    ).toThrow(new StepRejected(['setting: used']));
  });

  it('D-60: not another user’s step', () => {
    expect(() =>
      saveStep(db, 'someone-else', ids.stepIds[0], { name: 'X', setting: { kind: 'none' } }, T0)
    ).toThrow(new StepRejected(['step: not found']));
  });
});

describe('removeStep', () => {
  it('D-168: a step no shot used is deleted', () => {
    const id = addStep(db, ids.userId, { name: 'RDT', setting: sprays }, T0);
    expect(removeStep(db, ids.userId, id, T0)).toBe('deleted');
    expect(db.select().from(prepStep).where(eq(prepStep.id, id)).get()).toBeUndefined();
  });

  it('D-169: a step a routine contains stays', () => {
    expect(removeStep(db, ids.userId, ids.stepIds[0], T0)).toBe('in_routine');
    expect(loadPuckPrep(db, ids.userId).steps).toHaveLength(4);
  });

  it('D-168: a step a shot used is archived, once no routine contains it', () => {
    brew(1, null);
    const puckScreen = ids.stepIds[3];
    db.update(routine)
      .set({ steps: ids.stepIds.slice(0, 3).map((stepId) => ({ stepId, value: null })) })
      .where(eq(routine.id, ids.routineId))
      .run();
    expect(removeStep(db, ids.userId, puckScreen, T0)).toBe('archived');
    expect(db.select().from(prepStep).where(eq(prepStep.id, puckScreen)).get()?.archivedAt).toBe(
      T0
    );
  });

  it('D-60: not another user’s step', () => {
    expect(removeStep(db, 'someone-else', ids.stepIds[0], T0)).toBeNull();
  });
});
