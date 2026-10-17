// Everything the shot form needs (data-model §4.1, §4.2): the prefill, the bean's recipes for matching in
// the browser, the bean's last shot for deltas (D-15, D-81), and the choices its pickers offer. Every query
// is scoped by the owner (D-60).
import { and, desc, eq, sql } from 'drizzle-orm';
import { bestRecipe } from '../../domain/best-recipe';
import type { RecipeIdentity } from '../../domain/fingerprint';
import {
  prefill,
  type Prefill,
  type PrefillContext,
  type RecipeValues,
  type RoutineNow,
  type ShotResult
} from '../../domain/prefill';
import type { FeatureDefinition, GrinderSpec, MachineSpec } from '../../domain/schemas';
import type { KnownRecipe } from '../../domain/shot-form';
import type { Thousandths } from '../../domain/units';
import type { Queryable } from './client';
import {
  appState,
  bean,
  gear,
  prepStep,
  recipe,
  routine,
  shot,
  shotTag,
  tag,
  userSettings
} from './schema';

type Process = (typeof bean.$inferSelect)['process'];
export type BeanChoice = { id: string; name: string; process: Process };

export type ShotFormData = {
  state: 'ready';
  prefill: Prefill;
  bean: BeanChoice;
  /** Open beans for the bean switcher (D-94). */
  openBeans: BeanChoice[];
  machine: { id: string; name: string; features: FeatureDefinition[] };
  grinder: { id: string; name: string; dial: GrinderSpec['dial'] };
  /** Names of every machine, grinder and basket, archived ones included, for what a recipe points to. */
  gearNames: Record<string, string>;
  /** Baskets and routines you can pick (archived ones are left out). */
  baskets: { id: string; name: string }[];
  routines: { id: string; name: string; routine: RoutineNow }[];
  /** This bean's recipes, for matching while the form changes (D-16, D-12). */
  recipes: KnownRecipe[];
  /** This bean's last shot: what the deltas and the recipe tag compare with (D-15, D-81). */
  lastShot: ({ recipe: RecipeIdentity } & ShotResult) | null;
  /** Flavor notes, most used first, then A–Z (D-97). */
  tags: { id: string; name: string }[];
  /** −/+ steps for dose, yield and time (D-89). */
  steps: { dose: Thousandths; yield: Thousandths; time: Thousandths };
};

export type ShotFormEmpty = { state: 'empty'; missing: 'setup' | 'bean' };

/**
 * The shot form for the current bean, or for `beanId` when one of your open beans is chosen (D-94).
 * Brew next (D-43) applies unless another bean was chosen.
 */
export function loadShotForm(
  db: Queryable,
  ownerId: string,
  beanId?: string
): ShotFormData | ShotFormEmpty {
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  const mySetup = settings && readMySetup(settings);
  if (!settings || !mySetup) return { state: 'empty', missing: 'setup' };

  const openBeans = db
    .select({ id: bean.id, name: bean.name, process: bean.process })
    .from(bean)
    .where(and(eq(bean.ownerId, ownerId), eq(bean.status, 'open')))
    .orderBy(desc(bean.createdAt), desc(bean.id))
    .all();
  const state = db.select().from(appState).where(eq(appState.userId, ownerId)).get();
  const chosen = openBeans.find((b) => b.id === beanId);
  const brewNextRow = state?.brewNextRecipeId
    ? recipeRow(db, ownerId, state.brewNextRecipeId)
    : undefined;
  // D-43, D-94: the mark applies to an open bean, unless you chose another bean on the form.
  const brewNext =
    brewNextRow &&
    openBeans.some((b) => b.id === brewNextRow.beanId) &&
    (!chosen || chosen.id === brewNextRow.beanId)
      ? brewNextRow
      : undefined;
  const current =
    openBeans.find((b) => b.id === brewNext?.beanId) ??
    chosen ??
    openBeans.find((b) => b.id === state?.currentBeanId) ??
    openBeans[0];
  if (!current) return { state: 'empty', missing: 'bean' };

  const gearRows = db.select().from(gear).where(eq(gear.ownerId, ownerId)).all();
  const routineRows = db.select().from(routine).where(eq(routine.ownerId, ownerId)).all();
  const routines = routinesNow(db, ownerId, routineRows);
  const latest = latestShotOfBean(db, ownerId, current.id);

  const context: PrefillContext = {
    beanId: current.id,
    brewNext: brewNext
      ? { recipe: toValues(brewNext), latestShot: latestShotOfRecipe(db, ownerId, brewNext.id) }
      : null,
    latestShotOfBean: latest,
    rebuyChain: rebuyChain(db, ownerId, current.id),
    mySetup,
    machines: Object.fromEntries(
      gearRows.filter((g) => g.kind === 'machine').map((g) => [g.id, g.spec as MachineSpec])
    ),
    routines,
    archivedIds: new Set(
      [...gearRows, ...routineRows].filter((r) => r.archivedAt !== null).map((r) => r.id)
    )
  };
  const start = prefill(context);

  const byId = new Map(gearRows.map((g) => [g.id, g]));
  const machine = byId.get(start.machineId)!;
  const grinder = byId.get(start.grinderId)!;
  return {
    state: 'ready',
    prefill: start,
    bean: current,
    openBeans,
    machine: {
      id: machine.id,
      name: machine.name,
      features: (machine.spec as MachineSpec).features.filter((f) => f.enabled)
    },
    grinder: { id: grinder.id, name: grinder.name, dial: (grinder.spec as GrinderSpec).dial },
    gearNames: Object.fromEntries(gearRows.map((g) => [g.id, g.name])),
    baskets: gearRows
      .filter((g) => g.kind === 'basket' && g.archivedAt === null)
      .map((g) => ({ id: g.id, name: g.name })),
    routines: routineRows
      .filter((r) => r.archivedAt === null)
      .map((r) => ({ id: r.id, name: r.name, routine: routines[r.id] })),
    recipes: knownRecipes(db, ownerId, current.id),
    lastShot: latest ? { recipe: latest.recipe, ...latest.shot } : null,
    tags: tagsByUse(db, ownerId),
    steps: { dose: settings.doseStep, yield: settings.yieldStep, time: settings.timeStep }
  };
}

function readMySetup(settings: typeof userSettings.$inferSelect): PrefillContext['mySetup'] | null {
  const { defaultMachineId, defaultGrinderId, defaultGrind, defaultDose } = settings;
  if (!defaultMachineId || !defaultGrinderId || defaultGrind === null || defaultDose === null)
    return null;
  return {
    machineId: defaultMachineId,
    grinderId: defaultGrinderId,
    basketId: settings.defaultBasketId,
    routineId: settings.defaultRoutineId,
    grind: defaultGrind,
    dose: defaultDose,
    yield: settings.defaultYield,
    features: settings.defaultFeatures
  };
}

type RecipeRow = typeof recipe.$inferSelect;

function recipeRow(db: Queryable, ownerId: string, id: string): RecipeRow | undefined {
  return db
    .select()
    .from(recipe)
    .where(and(eq(recipe.id, id), eq(recipe.ownerId, ownerId)))
    .get();
}

function toValues(row: RecipeRow): RecipeValues {
  const { beanId, machineId, grinderId, basketId, routineId, grind, dose, setup } = row;
  return { beanId, machineId, grinderId, basketId, routineId, grind, dose, setup };
}

const newestShot = [desc(shot.brewedAt), desc(shot.id)];

function latestShotOfRecipe(db: Queryable, ownerId: string, recipeId: string): ShotResult | null {
  return (
    db
      .select({ yield: shot.yield, time: shot.time })
      .from(shot)
      .where(and(eq(shot.recipeId, recipeId), eq(shot.ownerId, ownerId)))
      .orderBy(...newestShot)
      .get() ?? null
  );
}

function latestShotOfBean(
  db: Queryable,
  ownerId: string,
  beanId: string
): { recipe: RecipeValues; shot: ShotResult } | null {
  const row = db
    .select({ recipe, yield: shot.yield, time: shot.time })
    .from(shot)
    .innerJoin(recipe, eq(shot.recipeId, recipe.id))
    .where(and(eq(recipe.beanId, beanId), eq(shot.ownerId, ownerId)))
    .orderBy(...newestShot)
    .get();
  return row ? { recipe: toValues(row.recipe), shot: { yield: row.yield, time: row.time } } : null;
}

/** Earlier bags of a re-buy, nearest first (D-73, D-74), with their best recipe (D-66) and latest shot. */
function rebuyChain(db: Queryable, ownerId: string, beanId: string): PrefillContext['rebuyChain'] {
  const chain: PrefillContext['rebuyChain'] = [];
  const seen = new Set([beanId]);
  let earlier = db
    .select({ rebuyOfId: bean.rebuyOfId })
    .from(bean)
    .where(and(eq(bean.id, beanId), eq(bean.ownerId, ownerId)))
    .get()?.rebuyOfId;
  while (earlier && !seen.has(earlier)) {
    seen.add(earlier);
    const bagId = earlier;
    const rows = db
      .select({ recipe, score: shot.score, brewedAt: shot.brewedAt })
      .from(shot)
      .innerJoin(recipe, eq(shot.recipeId, recipe.id))
      .where(and(eq(recipe.beanId, bagId), eq(shot.ownerId, ownerId)))
      .all();
    const recipes = new Map<
      string,
      { row: RecipeRow; shots: { score: number | null; brewedAt: number }[] }
    >();
    for (const r of rows) {
      const entry = recipes.get(r.recipe.id) ?? { row: r.recipe, shots: [] };
      entry.shots.push({ score: r.score, brewedAt: r.brewedAt });
      recipes.set(r.recipe.id, entry);
    }
    const best = bestRecipe(
      [...recipes.values()].map((e) => ({ recipeId: e.row.id, shots: e.shots }))
    );
    const bestRow = best ? recipes.get(best.recipeId)!.row : null;
    chain.push({
      beanId: bagId,
      best: bestRow
        ? { recipe: toValues(bestRow), latestShot: latestShotOfRecipe(db, ownerId, bestRow.id) }
        : null,
      latest: latestShotOfBean(db, ownerId, bagId)
    });
    earlier = db
      .select({ rebuyOfId: bean.rebuyOfId })
      .from(bean)
      .where(and(eq(bean.id, bagId), eq(bean.ownerId, ownerId)))
      .get()?.rebuyOfId;
  }
  return chain;
}

/** Routines as they are now (D-76), with each step's current name and unit. */
function routinesNow(
  db: Queryable,
  ownerId: string,
  rows: (typeof routine.$inferSelect)[]
): Record<string, RoutineNow> {
  const steps = new Map(
    db
      .select()
      .from(prepStep)
      .where(eq(prepStep.ownerId, ownerId))
      .all()
      .map((s) => [s.id, s])
  );
  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      {
        name: r.name,
        steps: r.steps.map(({ stepId, value }) => {
          const step = steps.get(stepId);
          const setting = step?.setting;
          const unit =
            setting?.kind === 'number'
              ? setting.unit
              : setting?.kind === 'seconds'
                ? 's'
                : undefined;
          return { stepId, name: step?.name ?? '', ...(unit && { unit }), value };
        })
      }
    ])
  );
}

/** This bean's recipes with their shot count and the score of their latest rated shot (D-12, D-16). */
function knownRecipes(db: Queryable, ownerId: string, beanId: string): KnownRecipe[] {
  const rows = db
    .select({
      id: recipe.id,
      machineId: recipe.machineId,
      fingerprint: recipe.fingerprint,
      shotCount: sql<number>`count(${shot.id})`,
      lastScore: sql<number | null>`(
        select s.score from shot s where s.recipe_id = ${recipe.id} and s.score is not null
        order by s.brewed_at desc, s.id desc limit 1)`
    })
    .from(recipe)
    .leftJoin(shot, eq(shot.recipeId, recipe.id))
    .where(and(eq(recipe.beanId, beanId), eq(recipe.ownerId, ownerId)))
    .groupBy(recipe.id)
    .all();
  return rows;
}

/** Flavor notes by how often you used them, then A–Z (D-97). */
function tagsByUse(db: Queryable, ownerId: string): { id: string; name: string }[] {
  return db
    .select({ id: tag.id, name: tag.name })
    .from(tag)
    .leftJoin(shotTag, eq(shotTag.tagId, tag.id))
    .where(eq(tag.ownerId, ownerId))
    .groupBy(tag.id)
    .orderBy(desc(sql`count(${shotTag.shotId})`), sql`lower(${tag.name})`)
    .all();
}
