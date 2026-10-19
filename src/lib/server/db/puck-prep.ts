// Library › Puck prep (D-51, D-52): your routines and the steps they are built from. Every query is scoped
// by the owner (D-60). A step a shot used keeps what its recorded values mean (D-168); a step in a routine
// stays (D-169).
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { prepStepSettingSchema, type PrepStepSetting } from '../../domain/schemas';
import type { Db, Queryable } from './client';
import { newId } from './ids';
import { prepStep, recipe, routine, shot, userSettings } from './schema';

export type RoutineCard = {
  id: string;
  name: string;
  /** Step names in order: the mini flow on the card. */
  steps: string[];
  /** My setup's routine or the last shot's (D-163). */
  inUse: boolean;
  shots: number;
  /** Average over the rated shots; null when none is rated. */
  averageScore: number | null;
};

export type StepItem = {
  id: string;
  name: string;
  /** What the chip shows after the name ("seconds", "kg"); null for no setting or a list. */
  unit: string | null;
  setting: PrepStepSetting;
  /** A shot has used it (D-168). */
  used: boolean;
  /** Names of the routines (not archived) that contain it (D-169). */
  routines: string[];
};

export type PuckPrepPage = { routines: RoutineCard[]; steps: StepItem[] };

export type StepInput = { name: string; setting: PrepStepSetting };

/** What was wrong, as schema paths ("name", "setting: used"); the page turns them into words. */
export class StepRejected extends Error {
  constructor(readonly problems: string[]) {
    super(`Step rejected: ${problems.join('; ')}`);
    this.name = 'StepRejected';
  }
}

export function unitOf(setting: PrepStepSetting): string | null {
  if (setting.kind === 'number') return setting.unit;
  if (setting.kind === 'seconds') return 'seconds';
  return null;
}

/** Step ids any of your recipes recorded: steps a shot has used (D-168). */
function usedStepIds(db: Queryable, ownerId: string): Set<string> {
  const ids = new Set<string>();
  for (const { setup } of db
    .select({ setup: recipe.setup })
    .from(recipe)
    .where(eq(recipe.ownerId, ownerId))
    .all())
    for (const step of setup.routine?.steps ?? []) ids.add(step.stepId);
  return ids;
}

/** The Puck prep page (D-51): routines and steps in the order they were made. */
export function loadPuckPrep(db: Queryable, ownerId: string): PuckPrepPage {
  const steps = db
    .select()
    .from(prepStep)
    .where(and(eq(prepStep.ownerId, ownerId), isNull(prepStep.archivedAt)))
    .orderBy(prepStep.createdAt, sql`rowid`)
    .all();
  const routines = db
    .select()
    .from(routine)
    .where(and(eq(routine.ownerId, ownerId), isNull(routine.archivedAt)))
    .orderBy(routine.createdAt, sql`rowid`)
    .all();
  const allSteps = new Map(
    db
      .select({ id: prepStep.id, name: prepStep.name })
      .from(prepStep)
      .where(eq(prepStep.ownerId, ownerId))
      .all()
      .map((s) => [s.id, s.name])
  );

  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  const last = db
    .select({ routineId: recipe.routineId })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .where(eq(shot.ownerId, ownerId))
    .orderBy(desc(shot.brewedAt), desc(shot.id))
    .get();
  const inUse = new Set([settings?.defaultRoutineId, last?.routineId].filter(Boolean));

  const scores = db
    .select({ routineId: recipe.routineId, score: shot.score })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .where(eq(shot.ownerId, ownerId))
    .all();

  const used = usedStepIds(db, ownerId);
  return {
    routines: routines.map((r) => {
      const ofRoutine = scores.filter((s) => s.routineId === r.id);
      const rated = ofRoutine.filter((s) => s.score !== null).map((s) => s.score!);
      return {
        id: r.id,
        name: r.name,
        steps: r.steps.map((s) => allSteps.get(s.stepId) ?? ''),
        inUse: inUse.has(r.id),
        shots: ofRoutine.length,
        averageScore: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null
      };
    }),
    steps: steps.map((s) => ({
      id: s.id,
      name: s.name,
      unit: unitOf(s.setting),
      setting: s.setting,
      used: used.has(s.id),
      routines: routines.filter((r) => r.steps.some((x) => x.stepId === s.id)).map((r) => r.name)
    }))
  };
}

function checked(input: StepInput): StepInput {
  const problems: string[] = [];
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) problems.push('name: required');
  const setting = prepStepSettingSchema.safeParse(input.setting);
  if (!setting.success)
    problems.push(...setting.error.issues.map((i) => `setting.${i.path.join('.')}: ${i.message}`));
  if (problems.length > 0) throw new StepRejected(problems);
  return { name, setting: setting.data! };
}

/** New step (D-52). */
export function addStep(db: Db, ownerId: string, input: StepInput, now: number): string {
  const step = checked(input);
  const id = newId(now);
  db.insert(prepStep)
    .values({ id, ownerId, ...step, createdAt: now, updatedAt: now })
    .run();
  return id;
}

/** D-168: once used, the kind of setting, its unit and its list options stay. */
function keepsMeaning(before: PrepStepSetting, after: PrepStepSetting): boolean {
  if (before.kind !== after.kind) return false;
  if (before.kind === 'number' && after.kind === 'number') return before.unit === after.unit;
  if (before.kind === 'choice' && after.kind === 'choice') {
    const ids = new Set(after.options.map((o) => o.id));
    return before.options.every((o) => ids.has(o.id));
  }
  return true;
}

/** Saves a step's sheet (D-168). */
export function saveStep(db: Db, ownerId: string, id: string, input: StepInput, now: number): void {
  const existing = db
    .select()
    .from(prepStep)
    .where(and(eq(prepStep.id, id), eq(prepStep.ownerId, ownerId), isNull(prepStep.archivedAt)))
    .get();
  if (!existing) throw new StepRejected(['step: not found']);
  const step = checked(input);
  if (usedStepIds(db, ownerId).has(id) && !keepsMeaning(existing.setting, step.setting))
    throw new StepRejected(['setting: used']);
  db.update(prepStep)
    .set({ ...step, updatedAt: now })
    .where(and(eq(prepStep.id, id), eq(prepStep.ownerId, ownerId)))
    .run();
}

/**
 * Removes a step (D-168, D-169): refused while a routine (not archived) contains it; archived when a shot
 * used it or an archived routine still holds it; otherwise deleted. Null when it is not yours.
 */
export function removeStep(
  db: Db,
  ownerId: string,
  id: string,
  now: number
): 'deleted' | 'archived' | 'in_routine' | null {
  const existing = db
    .select({ id: prepStep.id })
    .from(prepStep)
    .where(and(eq(prepStep.id, id), eq(prepStep.ownerId, ownerId), isNull(prepStep.archivedAt)))
    .get();
  if (!existing) return null;
  const holders = db
    .select({ steps: routine.steps, archivedAt: routine.archivedAt })
    .from(routine)
    .where(eq(routine.ownerId, ownerId))
    .all()
    .filter((r) => r.steps.some((s) => s.stepId === id));
  if (holders.some((r) => r.archivedAt === null)) return 'in_routine';
  const where = and(eq(prepStep.id, id), eq(prepStep.ownerId, ownerId));
  if (holders.length > 0 || usedStepIds(db, ownerId).has(id)) {
    db.update(prepStep).set({ archivedAt: now, updatedAt: now }).where(where).run();
    return 'archived';
  }
  db.delete(prepStep).where(where).run();
  return 'deleted';
}
