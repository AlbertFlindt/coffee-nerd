import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NEW_GEAR } from '../domain/gear';
import { createAccount } from './auth/account';
import { openDatabase, type Db } from './db/client';
import { addGear, archiveGear } from './db/gear';
import { newId } from './db/ids';
import { saveMySetup } from './db/my-setup';
import { bean } from './db/schema';
import { firstStep, GUIDE_STEPS, guideNext, skipBasketStep, stepUrl } from './first-run';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-first-run-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 18, 15, 0);
let db: Db;
let userId: string;
let counter = 0;

beforeEach(async () => {
  db = openDatabase(join(dir, `first-run-${counter++}.db`));
  userId = await createAccount(
    db,
    { name: 'Albert', password: 'espresso-at-dawn', timeZone: 'UTC' },
    T0
  );
});

const machine = () =>
  addGear(db, userId, { kind: 'machine', name: 'Gaggia Classic', spec: NEW_GEAR.machine() }, T0);
const grinder = () =>
  addGear(db, userId, { kind: 'grinder', name: 'Comandante C40', spec: NEW_GEAR.grinder() }, T0);
const basket = () =>
  addGear(db, userId, { kind: 'basket', spec: { ...NEW_GEAR.basket(), brand: 'IMS' } }, T0);

function mySetup(machineId: string, grinderId: string) {
  saveMySetup(
    db,
    userId,
    {
      machineId,
      grinderId,
      basketId: null,
      routineId: null,
      grind: 1000,
      dose: 18000,
      yield: 36000,
      features: {
        temperature: { label: 'Temperature', unit: '°C', on: true, value: 93000 },
        flat_pressure: { label: 'Flat pressure', unit: 'bar', on: true, value: 9000 }
      }
    },
    T0
  );
}

function openBean() {
  db.insert(bean)
    .values({
      id: newId(T0),
      ownerId: userId,
      name: 'Guji Hambela',
      roastDate: '2026-10-10',
      createdAt: T0,
      updatedAt: T0
    })
    .run();
}

describe('the step-by-step start (D-157)', () => {
  it('D-157: five steps in order: machine, grinder, basket, My setup, first bean', () => {
    expect(GUIDE_STEPS).toEqual(['machine', 'grinder', 'basket', 'setup', 'bean']);
    expect(stepUrl('machine')).toBe('/library/gear/new?kind=machine&guide=1');
    expect(stepUrl('setup')).toBe('/library/gear/setup?guide=1');
    expect(stepUrl('bean')).toBe('/library/beans/new?guide=1');
  });

  it('D-157: a new account starts at the machine, and each step done moves on', () => {
    expect(firstStep(db, userId)).toBe('machine');
    const m = machine();
    expect(firstStep(db, userId)).toBe('grinder');
    const g = grinder();
    expect(firstStep(db, userId)).toBe('basket');
    basket();
    expect(firstStep(db, userId)).toBe('setup');
    mySetup(m, g);
    expect(firstStep(db, userId)).toBe('bean');
    openBean();
    expect(firstStep(db, userId)).toBeNull();
  });

  it('D-157: the basket can be skipped, and is not asked again', () => {
    machine();
    grinder();
    skipBasketStep(db, userId, T0);
    expect(firstStep(db, userId)).toBe('setup');
  });

  it('D-157: leaving halfway resumes at the first missing step, archived gear does not count', () => {
    const m = machine();
    archiveGear(db, userId, m, T0);
    expect(firstStep(db, userId)).toBe('machine');
  });

  it('D-157: after a step, the guide goes to the next missing one, then to the shot form', () => {
    const m = machine();
    const g = grinder();
    skipBasketStep(db, userId, T0);
    expect(guideNext(db, userId)).toBe('/library/gear/setup?guide=1');
    mySetup(m, g);
    openBean();
    expect(guideNext(db, userId)).toBe('/shot/new');
  });

  it('D-157: skipping twice is the same as once', () => {
    skipBasketStep(db, userId, T0);
    skipBasketStep(db, userId, T0 + 1);
    machine();
    grinder();
    expect(firstStep(db, userId)).toBe('setup');
  });
});
