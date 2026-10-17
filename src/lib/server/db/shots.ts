// Saving and editing shots (data-model §4.1). Each call is one transaction: validate, recompute the
// fingerprint on the server, find or create the recipe, write the shot, clear Brew next, finish the bean
// when the bag runs out. Every query is scoped by the owner (D-60).
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { shouldAutoFinish } from '../../domain/bean';
import { recipeFingerprint } from '../../domain/fingerprint';
import {
  machineSpecSchema,
  setupSnapshotSchema,
  tasteSchema,
  validateRoutineAgainstSteps,
  validateSetupAgainstMachine,
  type PrepStepSetting,
  type SetupSnapshot,
  type Taste
} from '../../domain/schemas';
import type { Thousandths } from '../../domain/units';
import type { Db, Queryable } from './client';
import { newId } from './ids';
import { appState, bean, gear, prepStep, recipe, routine, shot, shotTag, tag } from './schema';

export type ShotInput = {
  /** UUID v7; may be made on the phone (D-61). */
  id: string;
  beanId: string;
  machineId: string;
  grinderId: string;
  basketId: string | null;
  routineId: string | null;
  grind: Thousandths;
  dose: Thousandths;
  setup: SetupSnapshot;
  yield: Thousandths | null;
  time: Thousandths | null;
  taste: Taste;
  tagIds: string[];
  notes: string | null;
  brewedAt: number;
};

export type SaveResult = {
  status: 'saved' | 'duplicate';
  shotId: string;
  recipeId: string;
  /** Shots on the recipe after saving, including this one (the form shows the count before saving, D-16). */
  recipeShotCount: number;
  newRecipe: boolean;
  /** The bean was finished automatically by this shot; the app offers an undo (D-40). */
  autoFinished: boolean;
};

/** The shot was not saved; `problems` says why. Nothing was written. */
export class ShotRejected extends Error {
  constructor(readonly problems: string[]) {
    super(`Shot rejected: ${problems.join('; ')}`);
    this.name = 'ShotRejected';
  }
}

/** Saves a new shot. Saving the same id again changes nothing (D-61). */
export function saveShot(db: Db, ownerId: string, input: ShotInput, now: number): SaveResult {
  return db.transaction((tx) => {
    // Looked up by id alone on purpose: an id another account already uses must be refused, not reused.
    const existing = tx.select().from(shot).where(eq(shot.id, input.id)).get();
    if (existing) {
      if (existing.ownerId !== ownerId) throw new ShotRejected(['shot: this id is already in use']);
      return {
        status: 'duplicate',
        shotId: existing.id,
        recipeId: existing.recipeId,
        recipeShotCount: recipeShotCount(tx, ownerId, existing.recipeId),
        newRecipe: false,
        autoFinished: false
      };
    }

    const setup = validate(tx, ownerId, input);
    const { recipeId, newRecipe } = findOrCreateRecipe(tx, ownerId, { ...input, setup }, now);
    tx.insert(shot)
      .values({
        id: input.id,
        ownerId,
        recipeId,
        ...shotValues(input),
        createdAt: now,
        updatedAt: now
      })
      .run();
    writeTags(tx, input.id, input.tagIds);
    // D-43: the mark is used up by the shot it started.
    tx.update(appState)
      .set({ brewNextRecipeId: null, updatedAt: now })
      .where(eq(appState.userId, ownerId))
      .run();
    const autoFinished = finishBeanIfUsedUp(tx, ownerId, input, now);

    return {
      status: 'saved',
      shotId: input.id,
      recipeId,
      recipeShotCount: recipeShotCount(tx, ownerId, recipeId),
      newRecipe,
      autoFinished
    };
  });
}

/**
 * Saves changes to a shot (D-57). The shot may move to another recipe; a recipe left without shots is
 * deleted unless it is marked Brew next (data-model §4.1, step 6). Brew next and the bean's status are
 * left alone: they belong to new shots.
 */
export function editShot(
  db: Db,
  ownerId: string,
  shotId: string,
  input: ShotInput,
  now: number
): SaveResult {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(shot)
      .where(and(eq(shot.id, shotId), eq(shot.ownerId, ownerId)))
      .get();
    if (!existing) throw new ShotRejected(['shot: not found']);

    const setup = validate(tx, ownerId, input);
    const { recipeId, newRecipe } = findOrCreateRecipe(tx, ownerId, { ...input, setup }, now);
    tx.update(shot)
      .set({ recipeId, ...shotValues(input), updatedAt: now })
      .where(and(eq(shot.id, shotId), eq(shot.ownerId, ownerId)))
      .run();
    tx.delete(shotTag).where(eq(shotTag.shotId, shotId)).run();
    writeTags(tx, shotId, input.tagIds);

    if (existing.recipeId !== recipeId && recipeShotCount(tx, ownerId, existing.recipeId) === 0) {
      const marked = tx
        .select({ id: appState.userId })
        .from(appState)
        .where(and(eq(appState.userId, ownerId), eq(appState.brewNextRecipeId, existing.recipeId)))
        .get();
      if (!marked)
        tx.delete(recipe)
          .where(and(eq(recipe.id, existing.recipeId), eq(recipe.ownerId, ownerId)))
          .run();
    }

    return {
      status: 'saved',
      shotId,
      recipeId,
      recipeShotCount: recipeShotCount(tx, ownerId, recipeId),
      newRecipe,
      autoFinished: false
    };
  });
}

function shotValues(input: ShotInput) {
  const { score, balance, body, sweetness, aftertaste } = input.taste;
  return {
    brewedAt: input.brewedAt,
    yield: input.yield,
    time: input.time,
    score,
    balance,
    body,
    sweetness,
    aftertaste,
    notes: input.notes
  };
}

/**
 * Checks everything the shot points to and every value it carries; throws ShotRejected. Returns the
 * setup as checked, so only known fields reach the recipe snapshot (D-65).
 */
function validate(tx: Queryable, ownerId: string, input: ShotInput): SetupSnapshot {
  const problems: string[] = [];
  const wholeNumber = (value: unknown, min: number) =>
    Number.isSafeInteger(value) && (value as number) >= min;

  if (!wholeNumber(input.grind, 0)) problems.push('grind: must be a whole number of thousandths');
  if (!wholeNumber(input.dose, 1))
    problems.push('dose: must be a positive whole number of thousandths');
  if (input.yield !== null && !wholeNumber(input.yield, 0)) problems.push('yield: invalid');
  if (input.time !== null && !wholeNumber(input.time, 0)) problems.push('time: invalid');
  if (!wholeNumber(input.brewedAt, 0)) problems.push('brewedAt: invalid');

  const taste = tasteSchema.safeParse(input.taste);
  if (!taste.success)
    problems.push(`taste: ${taste.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  const setup = setupSnapshotSchema.safeParse(input.setup);
  if (!setup.success) throw new ShotRejected([...problems, 'setup: not a valid setup']);

  const owned = and(eq(bean.id, input.beanId), eq(bean.ownerId, ownerId));
  if (!tx.select({ id: bean.id }).from(bean).where(owned).get()) problems.push('bean: not found');

  const ownGear = (id: string, kind: 'machine' | 'grinder' | 'basket') => {
    const row = tx
      .select()
      .from(gear)
      .where(and(eq(gear.id, id), eq(gear.ownerId, ownerId)))
      .get();
    if (!row || row.kind !== kind) {
      problems.push(`${kind}: not found`);
      return undefined;
    }
    return row;
  };
  const machine = ownGear(input.machineId, 'machine');
  ownGear(input.grinderId, 'grinder');
  if (input.basketId !== null) ownGear(input.basketId, 'basket');

  if (machine) {
    const spec = machineSpecSchema.parse(machine.spec);
    for (const p of validateSetupAgainstMachine(setup.data, spec))
      problems.push(`setup: ${p.label} ${p.problem.replaceAll('_', ' ')}`);
  }

  // Puck prep: the routine and its snapshot go together (D-51); values fit their steps (D-52).
  const routineSnapshot = setup.data.routine;
  if ((input.routineId === null) !== (routineSnapshot === null)) {
    problems.push('routine: puck prep does not match the routine');
  } else if (input.routineId !== null && routineSnapshot) {
    const owns = tx
      .select({ id: routine.id })
      .from(routine)
      .where(and(eq(routine.id, input.routineId), eq(routine.ownerId, ownerId)))
      .get();
    if (!owns) problems.push('routine: not found');
    const stepIds = [...new Set(routineSnapshot.steps.map((s) => s.stepId))];
    const settings: Record<string, PrepStepSetting> = Object.fromEntries(
      stepIds.length === 0
        ? []
        : tx
            .select({ id: prepStep.id, setting: prepStep.setting })
            .from(prepStep)
            .where(and(inArray(prepStep.id, stepIds), eq(prepStep.ownerId, ownerId)))
            .all()
            .map((row) => [row.id, row.setting])
    );
    const steps = routineSnapshot.steps.map(({ stepId, value }) => ({ stepId, value }));
    for (const p of validateRoutineAgainstSteps(steps, settings))
      problems.push(`routine: step ${p.index + 1} ${p.problem.replaceAll('_', ' ')}`);
  }

  const tagIds = [...new Set(input.tagIds)];
  if (tagIds.length > 0) {
    const found = tx
      .select({ id: tag.id })
      .from(tag)
      .where(and(inArray(tag.id, tagIds), eq(tag.ownerId, ownerId)))
      .all();
    if (found.length !== tagIds.length) problems.push('tag: not found');
  }

  if (problems.length > 0) throw new ShotRejected(problems);
  return setup.data;
}

/** The recipe with this fingerprint for this bean and machine, or a new one (D-16, D-63). */
function findOrCreateRecipe(
  tx: Queryable,
  ownerId: string,
  input: ShotInput,
  now: number
): { recipeId: string; newRecipe: boolean } {
  const fingerprint = recipeFingerprint(input);
  const found = tx
    .select({ id: recipe.id })
    .from(recipe)
    .where(
      and(
        eq(recipe.ownerId, ownerId),
        eq(recipe.beanId, input.beanId),
        eq(recipe.machineId, input.machineId),
        eq(recipe.fingerprint, fingerprint)
      )
    )
    .get();
  if (found) return { recipeId: found.id, newRecipe: false };

  const recipeId = newId(now);
  tx.insert(recipe)
    .values({
      id: recipeId,
      ownerId,
      beanId: input.beanId,
      machineId: input.machineId,
      grinderId: input.grinderId,
      basketId: input.basketId,
      routineId: input.routineId,
      grind: input.grind,
      dose: input.dose,
      setup: input.setup,
      fingerprint,
      createdAt: now,
      updatedAt: now
    })
    .run();
  return { recipeId, newRecipe: true };
}

function writeTags(tx: Queryable, shotId: string, tagIds: string[]): void {
  const unique = [...new Set(tagIds)];
  if (unique.length > 0)
    tx.insert(shotTag)
      .values(unique.map((tagId) => ({ shotId, tagId })))
      .run();
}

function recipeShotCount(tx: Queryable, ownerId: string, recipeId: string): number {
  return (
    tx
      .select({ n: count() })
      .from(shot)
      .where(and(eq(shot.recipeId, recipeId), eq(shot.ownerId, ownerId)))
      .get()?.n ?? 0
  );
}

/** D-40: when this shot's dose uses up an open bean's bag, mark the bean finished automatically. */
function finishBeanIfUsedUp(
  tx: Queryable,
  ownerId: string,
  input: ShotInput,
  now: number
): boolean {
  const row = tx
    .select()
    .from(bean)
    .where(and(eq(bean.id, input.beanId), eq(bean.ownerId, ownerId)))
    .get();
  if (!row || row.status !== 'open' || row.bagWeight === null) return false;

  const earlier = tx
    .select({ dose: recipe.dose })
    .from(shot)
    .innerJoin(recipe, eq(shot.recipeId, recipe.id))
    .where(
      and(
        eq(recipe.beanId, input.beanId),
        eq(shot.ownerId, ownerId),
        sql`${shot.id} <> ${input.id}`
      )
    )
    .all()
    .map((r) => r.dose);
  if (!shouldAutoFinish(row.bagWeight, earlier, input.dose)) return false;

  tx.update(bean)
    .set({ status: 'finished', finishedAt: now, finishedAutomatically: true, updatedAt: now })
    .where(and(eq(bean.id, input.beanId), eq(bean.ownerId, ownerId)))
    .run();
  return true;
}
