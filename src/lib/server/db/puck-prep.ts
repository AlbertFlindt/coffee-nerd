// Library › Puck prep (D-51, D-52): your routines and the steps they are built from. Every query is scoped
// by the owner (D-60). A step a shot used keeps what its recorded values mean (D-168); a step in a routine
// stays (D-169).
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  prepStepSettingSchema,
  routineStepsSchema,
  validateRoutineAgainstSteps,
  type PrepStepSetting,
  type RoutineProblem,
  type RoutineSteps
} from '../../domain/schemas';
import { trimmed } from '../../domain/gear';
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

/** A routine value in words, with the step's unit: "15 kg", "20 s", or the option's label. */
function valueText(setting: PrepStepSetting, value: number | string | undefined): string {
  if (typeof value === 'string')
    return setting.kind === 'choice'
      ? (setting.options.find((o) => o.id === value)?.label ?? value)
      : value;
  if (value === undefined) return '';
  const unit = setting.kind === 'number' ? setting.unit : setting.kind === 'seconds' ? 's' : '';
  return trimmed(value, unit || undefined);
}

/**
 * D-175: the routines (not archived) that hold this step and would no longer fit its new setting, each
 * as a "routine: …" problem in words.
 */
function routineClashes(
  db: Queryable,
  ownerId: string,
  id: string,
  before: PrepStepSetting,
  after: PrepStepSetting
): string[] {
  const holders = db
    .select({ name: routine.name, steps: routine.steps })
    .from(routine)
    .where(and(eq(routine.ownerId, ownerId), isNull(routine.archivedAt)))
    .all()
    .filter((r) => r.steps.some((s) => s.stepId === id));
  const words = (name: string, p: RoutineProblem) =>
    p.problem === 'out_of_range'
      ? `routine: ${name} uses ${valueText(after, p.value)}, outside this range`
      : p.problem === 'not_an_option'
        ? `routine: ${name} uses ${valueText(before, p.value)}, which this list no longer has`
        : `routine: ${name} uses this step with its current setting; change the routine first`;
  const problems: string[] = [];
  for (const r of holders) {
    const own = r.steps.filter((s) => s.stepId === id);
    const found = validateRoutineAgainstSteps(own, { [id]: after });
    if (found.length > 0) problems.push(words(r.name, found[0]));
  }
  return problems;
}

/** Saves a step's sheet (D-168, D-175). */
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
  const broken = routineClashes(db, ownerId, id, existing.setting, step.setting);
  if (broken.length > 0) throw new StepRejected(broken);
  db.update(prepStep)
    .set({ ...step, updatedAt: now })
    .where(and(eq(prepStep.id, id), eq(prepStep.ownerId, ownerId)))
    .run();
}

/**
 * Removes a step (D-168, D-169, D-176): refused while a routine (not archived) contains it; archived when a
 * shot used it; otherwise deleted, also from archived routines. Null when it is not yours.
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
    .select({ id: routine.id, steps: routine.steps, archivedAt: routine.archivedAt })
    .from(routine)
    .where(eq(routine.ownerId, ownerId))
    .all()
    .filter((r) => r.steps.some((s) => s.stepId === id));
  if (holders.some((r) => r.archivedAt === null)) return 'in_routine';
  const where = and(eq(prepStep.id, id), eq(prepStep.ownerId, ownerId));
  if (usedStepIds(db, ownerId).has(id)) {
    db.update(prepStep).set({ archivedAt: now, updatedAt: now }).where(where).run();
    return 'archived';
  }
  // D-176: unused, so it goes, also from the archived routines that still hold it.
  db.transaction((tx) => {
    for (const r of holders)
      tx.update(routine)
        .set({ steps: r.steps.filter((s) => s.stepId !== id), updatedAt: now })
        .where(and(eq(routine.id, r.id), eq(routine.ownerId, ownerId)))
        .run();
    tx.delete(prepStep).where(where).run();
  });
  return 'deleted';
}

// --- routines (D-51, D-164, D-165, D-167) ---

export type RoutineInput = { name: string; steps: RoutineSteps };

export type RoutineItem = {
  id: string;
  name: string;
  steps: RoutineSteps;
  /** My setup uses it: it is neither archived nor deleted (D-83). */
  inMySetup: boolean;
  /** A shot used it: it is archived, not deleted (D-167). */
  used: boolean;
};

/** What was wrong, as paths ("name: required", "steps: none"); the page turns them into words. */
export class RoutineRejected extends Error {
  constructor(readonly problems: string[]) {
    super(`Routine rejected: ${problems.join('; ')}`);
    this.name = 'RoutineRejected';
  }
}

function defaultRoutineOf(db: Queryable, ownerId: string): string | null {
  return (
    db
      .select({ id: userSettings.defaultRoutineId })
      .from(userSettings)
      .where(eq(userSettings.userId, ownerId))
      .get()?.id ?? null
  );
}

function routineUsed(db: Queryable, ownerId: string, id: string): boolean {
  return !!db
    .select({ id: recipe.id })
    .from(recipe)
    .where(and(eq(recipe.ownerId, ownerId), eq(recipe.routineId, id)))
    .get();
}

/** A routine for the builder, or null when it is not yours or archived. */
export function loadRoutine(db: Queryable, ownerId: string, id: string): RoutineItem | null {
  const row = db
    .select()
    .from(routine)
    .where(and(eq(routine.id, id), eq(routine.ownerId, ownerId), isNull(routine.archivedAt)))
    .get();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    steps: row.steps,
    inMySetup: defaultRoutineOf(db, ownerId) === row.id,
    used: routineUsed(db, ownerId, row.id)
  };
}

/** The routine as typed, checked: a name, at least one of your steps, values that fit (D-51, D-165). */
function checkedRoutine(db: Queryable, ownerId: string, input: RoutineInput): RoutineInput {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const parsed = routineStepsSchema.safeParse(input.steps);
  const problems: string[] = [];
  if (!name) problems.push('name: required');
  if (!parsed.success) throw new RoutineRejected([...problems, 'steps: invalid']);
  const steps = parsed.data;
  if (steps.length === 0) problems.push('steps: none');
  if (problems.length > 0) throw new RoutineRejected(problems);
  const ids = [...new Set(steps.map((s) => s.stepId))];
  const settings = Object.fromEntries(
    db
      .select({ id: prepStep.id, setting: prepStep.setting })
      .from(prepStep)
      .where(
        and(inArray(prepStep.id, ids), eq(prepStep.ownerId, ownerId), isNull(prepStep.archivedAt))
      )
      .all()
      .map((s) => [s.id, s.setting])
  );
  if (Object.keys(settings).length !== ids.length) throw new RoutineRejected(['steps: not found']);
  const found = validateRoutineAgainstSteps(steps, settings);
  if (found.length > 0)
    throw new RoutineRejected(found.map((p) => `steps.${p.index}: ${p.problem}`));
  return { name, steps };
}

/** New routine (D-51). */
export function addRoutine(db: Db, ownerId: string, input: RoutineInput, now: number): string {
  const r = checkedRoutine(db, ownerId, input);
  const id = newId(now);
  db.insert(routine)
    .values({ id, ownerId, ...r, createdAt: now, updatedAt: now })
    .run();
  return id;
}

/** Saves the builder (D-51). Shots keep the routine as it was in their recipe (D-65, D-76). */
export function saveRoutine(
  db: Db,
  ownerId: string,
  id: string,
  input: RoutineInput,
  now: number
): void {
  if (!loadRoutine(db, ownerId, id)) throw new RoutineRejected(['routine: not found']);
  const r = checkedRoutine(db, ownerId, input);
  db.update(routine)
    .set({ ...r, updatedAt: now })
    .where(and(eq(routine.id, id), eq(routine.ownerId, ownerId)))
    .run();
}

/** Archives a routine (D-167): not My setup's (D-83). Null when it is not yours. */
export function archiveRoutine(
  db: Db,
  ownerId: string,
  id: string,
  now: number
): 'archived' | 'in_my_setup' | null {
  const item = loadRoutine(db, ownerId, id);
  if (!item) return null;
  if (item.inMySetup) return 'in_my_setup';
  db.update(routine)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(routine.id, id), eq(routine.ownerId, ownerId)))
    .run();
  return 'archived';
}

/** Deletes a routine no shot used (D-167); not My setup's (D-83). Null when it is not yours. */
export function deleteRoutine(
  db: Db,
  ownerId: string,
  id: string
): 'deleted' | 'used' | 'in_my_setup' | null {
  const item = loadRoutine(db, ownerId, id);
  if (!item) return null;
  if (item.inMySetup) return 'in_my_setup';
  if (item.used) return 'used';
  db.delete(routine)
    .where(and(eq(routine.id, id), eq(routine.ownerId, ownerId)))
    .run();
  return 'deleted';
}
