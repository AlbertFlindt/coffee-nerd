// The Journal and the shot detail. Every query is scoped to the signed-in account.
import { and, asc, desc, eq, inArray, lt, or } from 'drizzle-orm';
import { describeChange, type RecipeMatch } from '../../domain/fingerprint';
import { beanIdentity } from '../../domain/bean';
import {
  groupRecipes,
  recipeFilterLabel,
  setupDifferences,
  shotsThisWeek
} from '../../domain/journal';
import type { GrinderSpec, MachineSpec, PrepStepSetting } from '../../domain/schemas';
import { prepDetail, routineParts, setupDetail, setupParts } from '../../domain/shot-form';
import type { Thousandths } from '../../domain/units';
import type { Queryable } from './client';
import { bean, gear, prepStep, recipe, shot, shotTag, tag, userSettings } from './schema';

export type JournalFilter = { beanId?: string; recipeId?: string; unrated?: boolean };

export type JournalShot = {
  id: string;
  brewedAt: number;
  beanName: string;
  grind: Thousandths;
  /** The grinder dial's step, for the grind's decimals. */
  grindStep: Thousandths;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
  score: number | null;
  balance: number | null;
  /** The recipe tag as it was when the shot was brewed: reused N× before it, or new. */
  recipeTag: RecipeMatch;
  /** The score of the recipe's latest rated shot before this one, the faint marker of the Rate sheet. */
  previousScore: number | null;
};

export type Journal = {
  shots: JournalShot[];
  /**
   * Beans that have shots, most recently brewed first, for the bean filter, with their roaster. Bags
   * with the same name and roaster are one bean, named by the bag brewed last.
   */
  beans: { id: string; name: string; roaster: string | null }[];
  /** The bean filter in effect, as its entry in `beans` (any of its bags chooses it); null for all beans (an unknown bean is ignored). */
  beanId: string | null;
  /**
   * The chosen bean's recipes, most recently brewed first, for the recipe filter; empty without a bean.
   * The same recipe brewed from several bags is one entry.
   */
  recipes: { id: string; label: string }[];
  /** The recipe filter in effect, as its entry in `recipes`: only with a bean, and only one of its recipes. */
  recipeId: string | null;
  unrated: boolean;
  /** Unrated shots within the bean and recipe filters: "Unrated · N". */
  unratedCount: number;
  /** All shots since Monday, whatever the filter: "9 shots this week". */
  shotsThisWeek: number;
  timeZone: string;
  /** −/+ steps of dose, yield and time, for their decimals. */
  steps: Steps;
};

type Steps = { dose: Thousandths; yield: Thousandths; time: Thousandths };

export function loadJournal(
  db: Queryable,
  ownerId: string,
  filter: JournalFilter,
  now: number
): Journal {
  const { timeZone, steps } = settingsOf(db, ownerId);
  // Shots are few (thousands at most): one query, newest first, and the rest in memory.
  const rows = db
    .select({
      id: shot.id,
      brewedAt: shot.brewedAt,
      recipeId: shot.recipeId,
      beanId: recipe.beanId,
      beanName: bean.name,
      roaster: bean.roaster,
      grind: recipe.grind,
      fingerprint: recipe.fingerprint,
      // A shot shows the dose it was brewed with; recipe labels show the recipe's.
      dose: shot.dose,
      recipeDose: recipe.dose,
      setup: recipe.setup,
      machineId: recipe.machineId,
      grinderId: recipe.grinderId,
      basketId: recipe.basketId,
      grinderSpec: gear.spec,
      yield: shot.yield,
      time: shot.time,
      score: shot.score,
      balance: shot.balance
    })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .innerJoin(bean, eq(bean.id, recipe.beanId))
    .innerJoin(gear, eq(gear.id, recipe.grinderId))
    .where(eq(shot.ownerId, ownerId))
    .orderBy(desc(shot.brewedAt), desc(shot.id))
    .all();

  const tags = recipeTags(rows);
  // Bags of the same bean are one bean: each row's bean, named by its bag brewed last.
  const beans: Journal['beans'] = [];
  const beanOf = new Map<string, string>();
  for (const row of rows) {
    const identity = beanIdentity(row.beanName, row.roaster);
    if (!beanOf.has(identity)) {
      beanOf.set(identity, row.beanId);
      beans.push({ id: row.beanId, name: row.beanName, roaster: row.roaster || null });
    }
  }
  const beanOfRow = (row: (typeof rows)[number]) =>
    beanOf.get(beanIdentity(row.beanName, row.roaster))!;
  const chosen = rows.find((r) => r.beanId === filter.beanId);
  const beanId = chosen ? beanOfRow(chosen) : null;
  const ofBean = rows.filter((r) => beanId === null || beanOfRow(r) === beanId);
  const recipes: Journal['recipes'] = [];
  // Each recipe id of the chosen bean, to its entry in `recipes`.
  const recipeOf = new Map<string, string>();
  if (beanId !== null) {
    const distinct = ofBean.filter(
      (row, i) => ofBean.findIndex((r) => r.recipeId === row.recipeId) === i
    );
    // The same recipe brewed from several bags is one: its group's ids, named by the one brewed last.
    const groups = groupRecipes(
      distinct.map((r) => ({
        id: r.recipeId,
        machineId: r.machineId,
        fingerprint: r.fingerprint,
        dose: r.recipeDose
      }))
    );
    for (const group of groups) for (const id of group.ids) recipeOf.set(id, group.id);
    const ofRecipe = groups.map((group) => distinct.find((r) => r.recipeId === group.id)!);
    // Two recipes with the same values say which setup values tell them apart.
    const gearRows = db.select().from(gear).where(eq(gear.ownerId, ownerId)).all();
    const gearOf = new Map(gearRows.map((g) => [g.id, g]));
    // A step value that differs names it too; a list option by its label.
    const optionLabel = optionLabels(db, ownerId);
    const differences = setupDifferences(
      ofRecipe.map((row) => {
        const named = [
          { key: 'machine', id: row.machineId },
          { key: 'grinder', id: row.grinderId },
          { key: 'basket', id: row.basketId }
        ].flatMap(({ key, id }) =>
          id && gearOf.has(id) ? [{ key, text: gearOf.get(id)!.name }] : []
        );
        const machineSpec = gearOf.get(row.machineId)?.spec as MachineSpec | undefined;
        return {
          values: JSON.stringify([row.grind, row.recipeDose, row.setup.routine?.name ?? null]),
          setup: [
            ...named,
            ...setupParts(row.setup, machineSpec?.features ?? []),
            ...routineParts(row.setup.routine, optionLabel)
          ]
        };
      })
    );
    ofRecipe.forEach((row, i) => {
      const label = recipeFilterLabel(
        {
          grind: row.grind,
          dose: row.recipeDose,
          routine: row.setup.routine?.name ?? null,
          shotCount: ofBean.filter((r) => recipeOf.get(r.recipeId) === row.recipeId).length,
          differences: differences[i]
        },
        { grind: (row.grinderSpec as GrinderSpec).dial.step, dose: steps.dose }
      );
      recipes.push({ id: row.recipeId, label });
    });
  }
  const recipeId = (filter.recipeId && recipeOf.get(filter.recipeId)) || null;
  const filtered = ofBean.filter((r) => recipeId === null || recipeOf.get(r.recipeId) === recipeId);
  const unrated = filter.unrated === true;

  return {
    shots: filtered
      .filter((r) => !unrated || r.score === null)
      .map((r) => ({
        id: r.id,
        brewedAt: r.brewedAt,
        beanName: r.beanName,
        grind: r.grind,
        grindStep: (r.grinderSpec as GrinderSpec).dial.step,
        dose: r.dose,
        yield: r.yield,
        time: r.time,
        score: r.score,
        balance: r.balance,
        recipeTag: tags.get(r.id)!.tag,
        previousScore: tags.get(r.id)!.previousScore
      })),
    beans,
    beanId,
    recipes,
    recipeId,
    unrated,
    unratedCount: filtered.filter((r) => r.score === null).length,
    shotsThisWeek: shotsThisWeek(
      rows.map((r) => r.brewedAt),
      now,
      timeZone
    ),
    timeZone,
    steps
  };
}

export type ShotDetail = {
  id: string;
  brewedAt: number;
  beanName: string;
  roastDate: string;
  /** "Lelit Bianca · Timemore 064S · VST · 18 g". */
  gear: string;
  /** The pressure profile and other features. */
  setup: string;
  /** "Daily routine: WDT 20 s · Distributor · Tamp 15 kg"; null without puck prep. */
  prep: string | null;
  recipeTag: RecipeMatch;
  grind: Thousandths;
  grindStep: Thousandths;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
  taste: {
    score: number | null;
    balance: number | null;
    body: number | null;
    sweetness: number | null;
    aftertaste: number | null;
  };
  flavors: string[];
  /** "Compared with this recipe": the recipe's shot count and its other shots' results. */
  recipe: { shotCount: number; others: { time: Thousandths | null; score: number | null }[] };
  notes: string | null;
  timeZone: string;
  steps: Steps;
};

export function loadShotDetail(db: Queryable, ownerId: string, shotId: string): ShotDetail | null {
  const row = db
    .select({ shot, recipe, beanName: bean.name, roastDate: bean.roastDate })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .innerJoin(bean, eq(bean.id, recipe.beanId))
    .where(and(eq(shot.id, shotId), eq(shot.ownerId, ownerId)))
    .get();
  if (!row) return null;
  const { shot: s, recipe: r } = row;

  const gearIds = [r.machineId, r.grinderId, ...(r.basketId ? [r.basketId] : [])];
  const gearRows = db
    .select({ id: gear.id, name: gear.name, spec: gear.spec })
    .from(gear)
    .where(and(eq(gear.ownerId, ownerId), inArray(gear.id, gearIds)))
    .all();
  const gearOf = (id: string | null) => gearRows.find((g) => g.id === id);
  const machine = gearOf(r.machineId)!;
  const grinder = gearOf(r.grinderId)!;
  const basket = gearOf(r.basketId);

  const flavors = db
    .select({ name: tag.name })
    .from(shotTag)
    .innerJoin(tag, eq(tag.id, shotTag.tagId))
    .where(and(eq(shotTag.shotId, s.id), eq(tag.ownerId, ownerId)))
    .orderBy(asc(tag.name))
    .all()
    .map((t) => t.name);

  const recipeShots = db
    .select({ id: shot.id, brewedAt: shot.brewedAt, time: shot.time, score: shot.score })
    .from(shot)
    .where(and(eq(shot.ownerId, ownerId), eq(shot.recipeId, r.id)))
    .orderBy(asc(shot.brewedAt), asc(shot.id))
    .all();
  const earlier = recipeShots.filter((o) => before(o, s)).length;
  const others = recipeShots.filter((o) => o.id !== s.id);

  const { timeZone, steps } = settingsOf(db, ownerId);
  return {
    id: s.id,
    brewedAt: s.brewedAt,
    beanName: row.beanName,
    roastDate: row.roastDate,
    gear: [machine.name, grinder.name, basket?.name].filter((part) => part).join(' · '),
    setup: setupDetail(r.setup, (machine.spec as MachineSpec).features),
    prep: prepDetail(r.setup.routine, optionLabels(db, ownerId)),
    recipeTag:
      earlier === 0
        ? { kind: 'new', changes: changesSincePrevious(db, ownerId, r, s) }
        : { kind: 'reused', shotCount: earlier },
    grind: r.grind,
    grindStep: (grinder.spec as GrinderSpec).dial.step,
    dose: s.dose,
    yield: s.yield,
    time: s.time,
    taste: {
      score: s.score,
      balance: s.balance,
      body: s.body,
      sweetness: s.sweetness,
      aftertaste: s.aftertaste
    },
    flavors,
    recipe: {
      shotCount: recipeShots.length,
      others: others.map(({ time, score }) => ({ time, score }))
    },
    notes: s.notes,
    timeZone,
    steps
  };
}

/**
 * For a recipe's first shot, what changed since the bean's shot before it, named as
 * on the shot form; nothing when the bean had no shot before.
 */
function changesSincePrevious(
  db: Queryable,
  ownerId: string,
  r: typeof recipe.$inferSelect,
  s: { id: string; brewedAt: number }
): string[] {
  const previous = db
    .select({ recipe })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .where(
      and(
        eq(shot.ownerId, ownerId),
        eq(recipe.beanId, r.beanId),
        or(lt(shot.brewedAt, s.brewedAt), and(eq(shot.brewedAt, s.brewedAt), lt(shot.id, s.id)))
      )
    )
    .orderBy(desc(shot.brewedAt), desc(shot.id))
    .get();
  return previous ? describeChange(r, previous.recipe) : [];
}

/** Names a list option of a puck prep step by its label; any other value as it is. */
function optionLabels(
  db: Queryable,
  ownerId: string
): (stepId: string, optionId: string) => string {
  const settingOf = new Map(
    db
      .select({ id: prepStep.id, setting: prepStep.setting })
      .from(prepStep)
      .where(eq(prepStep.ownerId, ownerId))
      .all()
      .map((s) => [s.id, s.setting as PrepStepSetting])
  );
  return (stepId, optionId) => {
    const setting = settingOf.get(stepId);
    return setting?.kind === 'choice'
      ? (setting.options.find((o) => o.id === optionId)?.label ?? optionId)
      : optionId;
  };
}

/** Brewed before the other shot; the same moment falls back to the id, which is time-ordered (UUID v7). */
function before(a: { id: string; brewedAt: number }, b: { id: string; brewedAt: number }): boolean {
  return a.brewedAt < b.brewedAt || (a.brewedAt === b.brewedAt && a.id < b.id);
}

/**
 * The recipe tag of each shot at the time it was brewed, and its recipe's last score before it: "Recipe reused N×" with N the recipe's
 * earlier shots, or "New recipe" for its first. What changed is not named here: that compares with the
 * shot before it on the form, and the Journal shows "New recipe" alone.
 */
function recipeTags(
  newestFirst: readonly { id: string; recipeId: string; score: number | null }[]
): Map<string, { tag: RecipeMatch; previousScore: number | null }> {
  const seen = new Map<string, { count: number; lastScore: number | null }>();
  const tags = new Map<string, { tag: RecipeMatch; previousScore: number | null }>();
  for (const row of [...newestFirst].reverse()) {
    const { count, lastScore } = seen.get(row.recipeId) ?? { count: 0, lastScore: null };
    tags.set(row.id, {
      tag: count === 0 ? { kind: 'new', changes: [] } : { kind: 'reused', shotCount: count },
      previousScore: lastScore
    });
    seen.set(row.recipeId, { count: count + 1, lastScore: row.score ?? lastScore });
  }
  return tags;
}

function settingsOf(db: Queryable, ownerId: string): { timeZone: string; steps: Steps } {
  const settings = db
    .select({
      timeZone: userSettings.timeZone,
      dose: userSettings.doseStep,
      yield: userSettings.yieldStep,
      time: userSettings.timeStep
    })
    .from(userSettings)
    .where(eq(userSettings.userId, ownerId))
    .get();
  if (!settings) throw new Error('Signed-in user without settings');
  const { timeZone, ...steps } = settings;
  return { timeZone, steps };
}
