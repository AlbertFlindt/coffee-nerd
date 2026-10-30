// Settings: the dose, yield and time steps, scoped by the signed-in account.
import { eq } from 'drizzle-orm';
import { isStepChoice, type StepName } from '../../domain/settings';
import type { Thousandths } from '../../domain/units';
import type { Queryable } from './client';
import { userSettings } from './schema';

export type Steps = { dose: Thousandths; yield: Thousandths; time: Thousandths };

const COLUMN = { dose: 'doseStep', yield: 'yieldStep', time: 'timeStep' } as const;

/** The steps as Settings shows them, and the time zone the file names use. */
export function loadSettings(db: Queryable, ownerId: string): { steps: Steps; timeZone: string } {
  const row = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  if (!row) throw new Error('This account has no settings');
  return {
    steps: { dose: row.doseStep, yield: row.yieldStep, time: row.timeStep },
    timeZone: row.timeZone
  };
}

/** Saves one step at once; false when it is not one of the offered choices. */
export function saveStep(
  db: Queryable,
  ownerId: string,
  name: StepName,
  step: number,
  now: number
): boolean {
  if (!isStepChoice(name, step)) return false;
  db.update(userSettings)
    .set({ [COLUMN[name]]: step, updatedAt: now })
    .where(eq(userSettings.userId, ownerId))
    .run();
  return true;
}
