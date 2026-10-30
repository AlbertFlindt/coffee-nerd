import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { openDatabase } from './db/client';
import { newId } from './db/ids';
import { bean, userSettings } from './db/schema';
import { seedReferenceSetup } from './db/seed';
import { offlinePages } from './offline-pages';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-offline-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 26, 6, 0);
let counter = 0;
function seeded() {
  const db = openDatabase(join(dir, `offline-${counter++}.db`));
  const ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
  return { db, ids };
}

describe('offlinePages', () => {
  it('Home, the Journal and the shot form for every open bean, from Home and from the Journal', () => {
    const { db, ids } = seeded();
    const second = newId(T0);
    db.insert(bean)
      .values({
        id: second,
        ownerId: ids.userId,
        name: 'Second bean',
        roastLevel: 'light',
        roastDate: '2026-10-20',
        createdAt: T0 + 1,
        updatedAt: T0 + 1
      })
      .run();
    expect(offlinePages(db, ids.userId, T0)).toEqual([
      '/',
      '/journal',
      '/shot/new',
      '/shot/new?from=journal',
      `/shot/new?bean=${second}`,
      `/shot/new?bean=${second}&from=journal`,
      `/shot/new?bean=${ids.beanId}`,
      `/shot/new?bean=${ids.beanId}&from=journal`
    ]);
  });

  it('without My setup there is no shot form to keep, only Home and the Journal', () => {
    const { db, ids } = seeded();
    db.delete(userSettings).where(eq(userSettings.userId, ids.userId)).run();
    expect(offlinePages(db, ids.userId, T0)).toEqual(['/', '/journal']);
  });
});
