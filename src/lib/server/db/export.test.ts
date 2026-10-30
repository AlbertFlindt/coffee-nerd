import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSession } from '../auth/session';
import { openDatabase, type Db } from './client';
import { backupDatabase, exportEverything, exportShotRows } from './export';
import { addGear, archiveGear } from './gear';
import { newId } from './ids';
import { loadMySetupForm } from './my-setup';
import { gear, session, shot, tag, user, userSettings } from './schema';
import { loadSettings, saveStep } from './settings';
import { REFERENCE, seedReferenceSetup, type SeededIds } from './seed';
import { loadShotForm } from './shot-form';
import { saveShot, type ShotInput } from './shots';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-export-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 30, 6, 0);
const MINUTE = 60_000;
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `export-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'secret-hash' });
});

function input(overrides: Partial<ShotInput> = {}, minutes = 1): ShotInput {
  const now = T0 + minutes * MINUTE;
  return {
    id: newId(now),
    beanId: ids.beanId,
    machineId: ids.machineId,
    grinderId: ids.grinderId,
    basketId: ids.basketId,
    routineId: ids.routineId,
    grind: 1600,
    dose: 18000,
    setup: {
      features: { ...REFERENCE.myFeatures },
      routine: {
        name: 'Daily routine',
        steps: [
          { stepId: ids.stepIds[0], name: 'WDT', unit: 's', value: 20000 },
          { stepId: ids.stepIds[1], name: 'Distributor', value: null },
          { stepId: ids.stepIds[2], name: 'Tamp', unit: 'kg', value: 15000 },
          { stepId: ids.stepIds[3], name: 'Puck screen', value: null }
        ]
      }
    },
    yield: 36000,
    time: 28000,
    taste: { score: null, balance: null, body: null, sweetness: null, aftertaste: null },
    tagIds: [],
    notes: null,
    brewedAt: now,
    ...overrides
  };
}

/** A second account with a machine and a flavor note of its own, which no export may show. */
function otherAccount() {
  const otherId = newId(T0);
  db.insert(user)
    .values({
      id: otherId,
      name: 'Other',
      passwordHash: 'other-hash',
      createdAt: T0,
      updatedAt: T0
    })
    .run();
  db.insert(userSettings)
    .values({ userId: otherId, timeZone: 'UTC', createdAt: T0, updatedAt: T0 })
    .run();
  db.insert(gear)
    .values({
      id: newId(T0),
      ownerId: otherId,
      kind: 'basket',
      name: 'Other basket',
      spec: { brand: 'Other', type: 'standard', shotSize: 'double' },
      createdAt: T0,
      updatedAt: T0
    })
    .run();
  db.insert(tag)
    .values({
      id: newId(T0),
      ownerId: otherId,
      name: 'Other note',
      family: 'other',
      createdAt: T0,
      updatedAt: T0
    })
    .run();
  return otherId;
}

describe('saveStep', () => {
  it('a step chosen in Settings is the step the shot form and Edit My setup use', () => {
    expect(saveStep(db, ids.userId, 'dose', 500, T0)).toBe(true);
    expect(saveStep(db, ids.userId, 'yield', 1000, T0)).toBe(true);
    expect(saveStep(db, ids.userId, 'time', 100, T0)).toBe(true);
    expect(loadSettings(db, ids.userId).steps).toEqual({ dose: 500, yield: 1000, time: 100 });
    const form = loadShotForm(db, ids.userId, ids.beanId, T0);
    expect('steps' in form && form.steps).toEqual({ dose: 500, yield: 1000, time: 100 });
    expect(loadMySetupForm(db, ids.userId).steps).toEqual({ dose: 500, yield: 1000 });
  });

  it('a step that is not offered changes nothing', () => {
    expect(saveStep(db, ids.userId, 'dose', 200, T0)).toBe(false);
    expect(saveStep(db, ids.userId, 'time', -1000, T0)).toBe(false);
    expect(loadSettings(db, ids.userId).steps).toEqual({ dose: 100, yield: 100, time: 1000 });
  });

  it('changes only the signed-in account', () => {
    const otherId = otherAccount();
    saveStep(db, ids.userId, 'dose', 1000, T0);
    expect(loadSettings(db, otherId).steps.dose).toBe(100);
  });
});

describe('backupDatabase', () => {
  it('the backup opens as a database with the same shots, and no sign-ins', () => {
    saveShot(db, ids.userId, input(), T0 + MINUTE);
    saveShot(db, ids.userId, input({ grind: 1700 }, 2), T0 + 2 * MINUTE);
    createSession(db, ids.userId, T0);

    const file = join(dir, `backup-${counter}.db`);
    writeFileSync(file, backupDatabase(db));
    const restored = openDatabase(file);
    expect(restored.select().from(shot).all()).toEqual(db.select().from(shot).all());
    expect(restored.select().from(user).all()).toEqual(db.select().from(user).all());
    expect(restored.select().from(session).all()).toEqual([]);
    expect(db.select().from(session).all()).toHaveLength(1);
    restored.$client.close();
  });

  it('made while the app is in use: shots not yet written back from the log are in it', () => {
    db.$client.pragma('wal_autocheckpoint = 0');
    saveShot(db, ids.userId, input(), T0 + MINUTE);
    const restored = new (db.$client.constructor as typeof import('better-sqlite3'))(
      backupDatabase(db)
    );
    expect(restored.prepare('select count(*) as n from shot').get()).toEqual({ n: 1 });
    restored.close();
  });
});

describe('exportShotRows', () => {
  it('one row per saved shot, oldest first, named as the shot detail shows them', () => {
    const [first] = db.select().from(tag).where(eq(tag.ownerId, ids.userId)).limit(1).all();
    saveShot(db, ids.userId, input({ grind: 1700, notes: 'second' }, 5), T0 + 5 * MINUTE);
    saveShot(
      db,
      ids.userId,
      input({
        taste: { score: 8, balance: -1, body: null, sweetness: null, aftertaste: null },
        tagIds: [first.id]
      }),
      T0 + MINUTE
    );
    const rows = exportShotRows(db, ids.userId);
    expect(rows.map((r) => r.grind)).toEqual([1600, 1700]);
    expect(rows[0]).toMatchObject({
      machine: REFERENCE.machine.name,
      grinder: REFERENCE.grinder.name,
      basket: REFERENCE.basket.name,
      routine: 'Daily routine',
      dose: 18000,
      yield: 36000,
      score: 8,
      balance: -1,
      body: null,
      flavors: [first.name]
    });
    expect(rows[0].setup).toContain('93 °C');
    expect(rows[1]).toMatchObject({ notes: 'second', score: null, flavors: [] });
  });

  it('never another account’s shots', () => {
    saveShot(db, ids.userId, input(), T0 + MINUTE);
    expect(exportShotRows(db, otherAccount())).toEqual([]);
  });
});

describe('exportEverything', () => {
  it('holds every kind of row the account owns, archived ones included, in decimals', () => {
    saveShot(db, ids.userId, input(), T0 + MINUTE);
    const spare = addGear(
      db,
      ids.userId,
      {
        kind: 'basket',
        spec: { brand: 'IMS', type: 'precision', shotSize: 'double' }
      },
      T0
    );
    expect(archiveGear(db, ids.userId, spare, T0 + MINUTE)).toBe('archived');

    const all = exportEverything(db, ids.userId, T0 + 2 * MINUTE);
    expect(all.exportedAt).toBe('2026-10-30T06:02:00.000Z');
    expect(all.account).toEqual({ name: 'Demo' });
    expect(all.mySetup).toMatchObject({
      dose: 18,
      grind: 1.6,
      steps: { dose: 0.1, yield: 0.1, time: 1 }
    });
    expect(all.gear.map((g) => g.kind).sort()).toEqual(['basket', 'basket', 'grinder', 'machine']);
    expect(all.gear.find((g) => g.id === spare)?.archivedAt).toBe('2026-10-30T06:01:00.000Z');
    expect(all.beans).toHaveLength(1);
    expect(all.puckPrepSteps).toHaveLength(4);
    expect(all.routines).toHaveLength(1);
    expect(all.flavorNotes.length).toBeGreaterThan(0);
    expect(all.recipes).toHaveLength(1);
    expect(all.recipes[0]).toMatchObject({ grind: 1.6, dose: 18 });
    expect(all.recipes[0].setup).toMatchObject({
      features: { temperature: { value: 93 } },
      routine: { steps: [{ name: 'WDT', value: 20 }, {}, { value: 15 }, {}] }
    });
    expect(all.shots).toEqual([
      expect.objectContaining({ dose: 18, yield: 36, time: 28, score: null, flavorNoteIds: [] })
    ]);
  });

  it('never another account’s rows, the password or sign-ins', () => {
    const otherId = otherAccount();
    createSession(db, ids.userId, T0);
    const text = JSON.stringify(exportEverything(db, ids.userId, T0));
    expect(text).not.toContain('secret-hash');
    expect(text).not.toContain('Other basket');
    expect(text).not.toContain('Other note');
    expect(text).not.toContain(otherId);
    const sessionId = db.select().from(session).get()!.id;
    expect(text).not.toContain(sessionId);
  });
});
