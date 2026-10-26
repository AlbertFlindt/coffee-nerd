import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { v7 } from 'uuid';
import { afterAll, describe, expect, it } from 'vitest';
import { openDatabase } from './db/client';
import { shot } from './db/schema';
import { loadShotForm, type ShotFormData } from './db/shot-form';
import { seedReferenceSetup } from './db/seed';
import { receiveQueued } from './queue';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-queue-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 26, 6, 0);
let counter = 0;
function seeded() {
  const db = openDatabase(join(dir, `queue-${counter++}.db`));
  const ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
  const form = loadShotForm(db, ids.userId, undefined, T0) as ShotFormData;
  const p = form.prefill;
  const values = {
    id: v7(),
    beanId: p.beanId,
    machineId: p.machineId,
    grinderId: p.grinderId,
    basketId: p.basketId,
    routineId: p.routineId,
    grind: p.grind,
    dose: p.dose,
    setup: p.setup,
    yield: 36000,
    time: 27000,
    taste: { score: null, balance: null, body: null, sweetness: null, aftertaste: null },
    tagIds: [],
    newTagNames: [],
    notes: null
  };
  return { db, ids, values };
}

const rowOf = (db: ReturnType<typeof seeded>['db'], id: string) =>
  db.select().from(shot).where(eq(shot.id, id)).get();

describe('receiveQueued', () => {
  it('D-220, D-61: a waiting shot keeps its brew time and is saved once, however often it is sent', () => {
    const { db, ids, values } = seeded();
    const request = { ownerId: ids.userId, kind: 'new', shot: values, brewedAt: T0 + 1000 };
    expect(receiveQueued(db, ids.userId, request, T0 + 60_000)).toBe('saved');
    expect(receiveQueued(db, ids.userId, request, T0 + 90_000)).toBe('saved');
    expect(db.select().from(shot).all()).toHaveLength(1);
    expect(rowOf(db, values.id)!.brewedAt).toBe(T0 + 1000);
  });

  it('D-220: a phone clock ahead of the server does not brew in the future', () => {
    const { db, ids, values } = seeded();
    receiveQueued(
      db,
      ids.userId,
      { ownerId: ids.userId, kind: 'new', shot: values, brewedAt: T0 + 9e6 },
      T0
    );
    expect(rowOf(db, values.id)!.brewedAt).toBe(T0);
  });

  it('D-223, D-113: an edit and a score keep the brew time; the latest change wins', () => {
    const { db, ids, values } = seeded();
    receiveQueued(
      db,
      ids.userId,
      { ownerId: ids.userId, kind: 'new', shot: values, brewedAt: T0 },
      T0
    );
    const edit = { ...values, time: 31000 };
    expect(
      receiveQueued(db, ids.userId, { ownerId: ids.userId, kind: 'edit', shot: edit }, T0 + 5)
    ).toBe('saved');
    expect(
      receiveQueued(
        db,
        ids.userId,
        { ownerId: ids.userId, kind: 'rate', shotId: values.id, score: 8 },
        T0 + 6
      )
    ).toBe('saved');
    expect(rowOf(db, values.id)).toMatchObject({ brewedAt: T0, time: 31000, score: 8 });
  });

  it('D-224: a shot the server cannot take is refused and nothing is written', () => {
    const { db, ids, values } = seeded();
    const bad = { ...values, grinderId: 'no-such-grinder' };
    expect(
      receiveQueued(
        db,
        ids.userId,
        { ownerId: ids.userId, kind: 'new', shot: bad, brewedAt: T0 },
        T0
      )
    ).toBe('refused');
    expect(receiveQueued(db, ids.userId, { kind: 'new' }, T0)).toBe('refused');
    expect(db.select().from(shot).all()).toHaveLength(0);
  });

  it('D-225: a shot of another account is not saved under this one', () => {
    const { db, ids, values } = seeded();
    expect(
      receiveQueued(
        db,
        ids.userId,
        { ownerId: 'someone-else', kind: 'new', shot: values, brewedAt: T0 },
        T0
      )
    ).toBe('other-account');
    expect(db.select().from(shot).all()).toHaveLength(0);
  });

  it('an edit or a score of a shot deleted meanwhile has nothing left to change', () => {
    const { db, ids, values } = seeded();
    expect(
      receiveQueued(db, ids.userId, { ownerId: ids.userId, kind: 'edit', shot: values }, T0)
    ).toBe('gone');
    expect(
      receiveQueued(
        db,
        ids.userId,
        { ownerId: ids.userId, kind: 'rate', shotId: values.id, score: 5 },
        T0
      )
    ).toBe('gone');
  });

  it('D-223, D-61: a new shot sent again with changes made while it was on its way is one shot, changed', () => {
    const { db, ids, values } = seeded();
    receiveQueued(
      db,
      ids.userId,
      { ownerId: ids.userId, kind: 'new', shot: values, brewedAt: T0 },
      T0
    );
    const changed = { ...values, taste: { ...values.taste, score: 8 } };
    expect(
      receiveQueued(
        db,
        ids.userId,
        { ownerId: ids.userId, kind: 'new', shot: changed, brewedAt: T0 + 50 },
        T0 + 60
      )
    ).toBe('saved');
    expect(db.select().from(shot).all()).toHaveLength(1);
    expect(rowOf(db, values.id)).toMatchObject({ brewedAt: T0, score: 8 });
  });
});
