import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrepStepSetting } from '../../domain/schemas';
import { openDatabase, type Db } from './client';
import { newId } from './ids';
import {
  addRoutine,
  addStep,
  archiveRoutine,
  deleteRoutine,
  loadPuckPrep,
  loadRoutine,
  removeStep,
  RoutineRejected,
  saveRoutine,
  saveStep,
  StepRejected,
  useForNewShots
} from './puck-prep';
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
  it('routines with their steps in order, then your steps with their unit', () => {
    const page = loadPuckPrep(db, ids.userId);
    expect(page.routines).toEqual([
      {
        id: ids.routineId,
        name: 'Daily routine',
        steps: ['WDT', 'Distributor', 'Tamp', 'Puck screen'],
        inUse: true,
        inMySetup: true,
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

  it('shots and the average score of the rated ones', () => {
    brew(1, 7);
    brew(2, 8);
    brew(3, null);
    const [daily] = loadPuckPrep(db, ids.userId).routines;
    expect(daily).toMatchObject({ shots: 3, averageScore: 7.5 });
  });

  it('"In use" on My setup’s routine and on the last shot’s routine', () => {
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

  it('only your own, and archived ones are left out', () => {
    db.update(prepStep).set({ archivedAt: T0 }).where(eq(prepStep.id, ids.stepIds[3])).run();
    expect(loadPuckPrep(db, ids.userId).steps).toHaveLength(3);
    expect(loadPuckPrep(db, 'someone-else')).toEqual({ routines: [], steps: [] });
  });

  it('a step knows the routines that contain it', () => {
    lightRoast();
    const wdt = loadPuckPrep(db, ids.userId).steps[0];
    expect(wdt.routines).toEqual(['Daily routine', 'Light roast']);
  });
});

describe('addStep and saveStep', () => {
  it('a new step is saved with its setting', () => {
    const id = addStep(db, ids.userId, { name: ' RDT ', setting: sprays }, T0);
    const step = loadPuckPrep(db, ids.userId).steps.find((s) => s.id === id);
    expect(step).toMatchObject({ name: 'RDT', unit: 'sprays', used: false, routines: [] });
  });

  it('a name and a valid setting are required', () => {
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

  it('an unused step can change anything', () => {
    const id = addStep(db, ids.userId, { name: 'RDT', setting: sprays }, T0);
    saveStep(db, ids.userId, id, { name: 'Spritz', setting: { kind: 'none' } }, T0);
    expect(loadPuckPrep(db, ids.userId).steps.find((s) => s.id === id)).toMatchObject({
      name: 'Spritz',
      unit: null
    });
  });

  it('a used step keeps its kind of setting and its unit; name, step, range and start can change', () => {
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

  it('a used list step keeps its options and can get new ones', () => {
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

  it('a change that would break a routine is refused, naming the routine', () => {
    const tamp = ids.stepIds[2];
    const setting = { kind: 'number', unit: 'kg', step: 500, startsAt: 5000 } as const;
    expect(() =>
      saveStep(
        db,
        ids.userId,
        tamp,
        { name: 'Tamp', setting: { ...setting, min: 0, max: 10000 } },
        T0
      )
    ).toThrow(new StepRejected(['routine: Daily routine uses 15 kg, outside this range']));
    expect(() =>
      saveStep(db, ids.userId, tamp, { name: 'Tamp', setting: { kind: 'none' } }, T0)
    ).toThrow(
      new StepRejected([
        'routine: Daily routine uses this step with its current setting; change the routine first'
      ])
    );
    // A range that still fits is fine.
    saveStep(
      db,
      ids.userId,
      tamp,
      { name: 'Tamp', setting: { ...setting, min: 0, max: 30000 } },
      T0
    );
  });

  it('removing a list option a routine uses is refused', () => {
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
      .set({ steps: [{ stepId: id, value: 'metal' }] })
      .where(eq(routine.id, ids.routineId))
      .run();
    expect(() =>
      saveStep(
        db,
        ids.userId,
        id,
        {
          name: 'Filter',
          setting: { ...list, options: [list.options[0], { id: 'cloth', label: 'Cloth' }] }
        },
        T0
      )
    ).toThrow(
      new StepRejected(['routine: Daily routine uses Metal, which this list no longer has'])
    );
  });

  it('not another user’s step', () => {
    expect(() =>
      saveStep(db, 'someone-else', ids.stepIds[0], { name: 'X', setting: { kind: 'none' } }, T0)
    ).toThrow(new StepRejected(['step: not found']));
  });
});

describe('removeStep', () => {
  it('a step no shot used is deleted', () => {
    const id = addStep(db, ids.userId, { name: 'RDT', setting: sprays }, T0);
    expect(removeStep(db, ids.userId, id, T0)).toBe('deleted');
    expect(db.select().from(prepStep).where(eq(prepStep.id, id)).get()).toBeUndefined();
  });

  it('an unused step is deleted, and taken out of an archived routine that holds it', () => {
    const id = addStep(db, ids.userId, { name: 'RDT', setting: sprays }, T0);
    const old = newId(T0);
    db.insert(routine)
      .values({
        id: old,
        ownerId: ids.userId,
        name: 'Old routine',
        steps: [
          { stepId: id, value: 2000 },
          { stepId: ids.stepIds[1], value: null }
        ],
        archivedAt: T0,
        createdAt: T0,
        updatedAt: T0
      })
      .run();
    expect(removeStep(db, ids.userId, id, T0)).toBe('deleted');
    expect(db.select().from(routine).where(eq(routine.id, old)).get()?.steps).toEqual([
      { stepId: ids.stepIds[1], value: null }
    ]);
  });

  it('a step a routine contains stays', () => {
    expect(removeStep(db, ids.userId, ids.stepIds[0], T0)).toBe('in_routine');
    expect(loadPuckPrep(db, ids.userId).steps).toHaveLength(4);
  });

  it('a step a shot used is archived, once no routine contains it', () => {
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

  it('not another user’s step', () => {
    expect(removeStep(db, 'someone-else', ids.stepIds[0], T0)).toBeNull();
  });
});

describe('routines', () => {
  const steps = () => [
    { stepId: ids.stepIds[0], value: 25000 },
    { stepId: ids.stepIds[2], value: 15000 }
  ];

  it('a new routine is saved with its steps in order', () => {
    const id = addRoutine(db, ids.userId, { name: ' Light roast ', steps: steps() }, T0);
    expect(loadRoutine(db, ids.userId, id)).toMatchObject({
      name: 'Light roast',
      steps: steps(),
      inMySetup: false,
      used: false
    });
    expect(loadPuckPrep(db, ids.userId).routines.map((r) => r.name)).toEqual([
      'Daily routine',
      'Light roast'
    ]);
  });

  it('a name, at least one step and fitting values are required', () => {
    expect(() => addRoutine(db, ids.userId, { name: ' ', steps: steps() }, T0)).toThrow(
      new RoutineRejected(['name: required'])
    );
    expect(() => addRoutine(db, ids.userId, { name: 'Empty', steps: [] }, T0)).toThrow(
      new RoutineRejected(['steps: none'])
    );
    expect(() =>
      addRoutine(
        db,
        ids.userId,
        { name: 'Odd', steps: [{ stepId: ids.stepIds[1], value: 3000 }] },
        T0
      )
    ).toThrow(RoutineRejected);
  });

  it('the same step may appear twice', () => {
    const twice = [...steps(), { stepId: ids.stepIds[0], value: 10000 }];
    const id = addRoutine(db, ids.userId, { name: 'Two WDT', steps: twice }, T0);
    expect(loadRoutine(db, ids.userId, id)?.steps).toEqual(twice);
  });

  it('only your own steps that are not archived', () => {
    db.update(prepStep).set({ archivedAt: T0 }).where(eq(prepStep.id, ids.stepIds[3])).run();
    expect(() =>
      addRoutine(
        db,
        ids.userId,
        { name: 'X', steps: [{ stepId: ids.stepIds[3], value: null }] },
        T0
      )
    ).toThrow(new RoutineRejected(['steps: not found']));
    expect(() => addRoutine(db, 'someone-else', { name: 'X', steps: steps() }, T0)).toThrow(
      new RoutineRejected(['steps: not found'])
    );
  });

  it('saving a routine changes it for future shots', () => {
    saveRoutine(db, ids.userId, ids.routineId, { name: 'Morning', steps: steps() }, T0);
    expect(loadRoutine(db, ids.userId, ids.routineId)).toMatchObject({
      name: 'Morning',
      steps: steps(),
      inMySetup: true
    });
    expect(() =>
      saveRoutine(db, 'someone-else', ids.routineId, { name: 'X', steps: steps() }, T0)
    ).toThrow(new RoutineRejected(['routine: not found']));
  });

  it('My setup’s routine is neither archived nor deleted', () => {
    expect(archiveRoutine(db, ids.userId, ids.routineId, T0)).toBe('in_my_setup');
    expect(deleteRoutine(db, ids.userId, ids.routineId)).toBe('in_my_setup');
  });

  it('a routine no shot used can be deleted; one a shot used is archived instead', () => {
    const unused = addRoutine(db, ids.userId, { name: 'Unused', steps: steps() }, T0);
    expect(deleteRoutine(db, ids.userId, unused)).toBe('deleted');
    expect(loadRoutine(db, ids.userId, unused)).toBeNull();

    const light = addRoutine(db, ids.userId, { name: 'Light roast', steps: steps() }, T0);
    brew(1, null, light);
    expect(loadRoutine(db, ids.userId, light)?.used).toBe(true);
    expect(deleteRoutine(db, ids.userId, light)).toBe('used');
    expect(archiveRoutine(db, ids.userId, light, T0)).toBe('archived');
    expect(loadRoutine(db, ids.userId, light)).toBeNull();
    expect(loadPuckPrep(db, ids.userId).routines.map((r) => r.name)).toEqual(['Daily routine']);
  });

  it('not another user’s routine', () => {
    expect(loadRoutine(db, 'someone-else', ids.routineId)).toBeNull();
    expect(archiveRoutine(db, 'someone-else', ids.routineId, T0)).toBeNull();
    expect(deleteRoutine(db, 'someone-else', ids.routineId)).toBeNull();
  });
});

describe('useForNewShots', () => {
  it('Yes makes the routine My setup’s, and the next shot starts with it once', () => {
    brew(0, 7);
    const id = lightRoast();
    expect(useForNewShots(db, ids.userId, id, T0 + 60_000)).toBe(true);
    const settings = db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, ids.userId))
      .get();
    expect(settings?.defaultRoutineId).toBe(id);

    const form = loadShotForm(db, ids.userId);
    if (form.state !== 'ready') throw new Error('Expected a ready form');
    expect(form.prefill.routineId).toBe(id);
    expect(form.prefill.setup.routine?.name).toBe('Light roast');

    // Used up by that shot: the shot after copies the last shot again.
    brew(2, 7, ids.routineId);
    const after = loadShotForm(db, ids.userId);
    if (after.state !== 'ready') throw new Error('Expected a ready form');
    expect(after.prefill.routineId).toBe(ids.routineId);
  });

  it('not for an archived routine or someone else’s', () => {
    const id = lightRoast();
    expect(useForNewShots(db, 'someone-else', id, T0)).toBe(false);
    archiveRoutine(db, ids.userId, id, T0);
    expect(useForNewShots(db, ids.userId, id, T0)).toBe(false);
  });
});
