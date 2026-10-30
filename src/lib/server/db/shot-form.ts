// Everything the shot form needs (docs/SPEC.md §4.1, §4.2): the prefill, the bean's recipes for matching in
// the browser, the bean's last shot for deltas, and the choices its pickers offer. Every query
// is scoped by the owner.
import { and, asc, desc, eq, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { roastAgeDays } from '../../domain/bean';
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
import type {
  BasketSpec,
  FeatureDefinition,
  FeatureValue,
  GrinderSpec,
  MachineSpec,
  PrepStepSetting,
  Taste
} from '../../domain/schemas';
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
/** A bean in the shot form's bean list, with its roast age today. */
export type BeanChoice = { id: string; name: string; process: Process; roastAgeDays: number };

export type ShotFormData = {
  state: 'ready';
  prefill: Prefill;
  bean: BeanChoice;
  /** Open beans for the bean switcher. */
  openBeans: BeanChoice[];
  /** Machines and grinders you can pick, with their switched-on features and dial. */
  machines: MachineChoice[];
  grinders: GrinderChoice[];
  /** My setup's feature values: what a machine switched to on the form starts from. */
  defaultFeatures: Record<string, FeatureValue>;
  /** Names of every machine, grinder and basket, archived ones included, for what a recipe points to. */
  gearNames: Record<string, string>;
  /** Baskets and routines you can pick (archived ones are left out), a basket with its dose range. */
  baskets: { id: string; name: string; doseRange?: BasketSpec['doseRange'] }[];
  routines: { id: string; name: string; routine: RoutineNow }[];
  /** Every puck prep step's setting, archived ones too: a step's value can change for one shot. */
  stepSettings: Record<string, PrepStepSetting>;
  /** This bean's recipes, for matching while the form changes. */
  recipes: KnownRecipe[];
  /** This bean's last shot: what the deltas and the recipe tag compare with. */
  lastShot: ({ recipe: RecipeIdentity } & ShotResult) | null;
  /** Flavor notes, most used first, then A–Z. */
  tags: { id: string; name: string }[];
  /** −/+ steps for dose, yield and time. */
  steps: { dose: Thousandths; yield: Thousandths; time: Thousandths };
  /** Editing a saved shot: its id and what it already has besides the recipe. */
  edit?: { shotId: string; brewedAt: number; taste: Taste; tagIds: string[]; notes: string | null };
};

export type MachineChoice = { id: string; name: string; features: FeatureDefinition[] };
export type GrinderChoice = { id: string; name: string; dial: GrinderSpec['dial'] };

type GearRow = typeof gear.$inferSelect;

/**
 * The machines, grinders and baskets the form offers: the ones not archived, plus the ones in `keep`
 * (what the shot already uses, even when archived since), sorted by name.
 */
function gearChoices(rows: GearRow[], keep: (string | null)[]) {
  const offered = rows
    .filter((g) => g.archivedAt === null || keep.includes(g.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const of = (kind: GearRow['kind']) => offered.filter((g) => g.kind === kind);
  return {
    machines: of('machine').map((g) => ({
      id: g.id,
      name: g.name,
      features: (g.spec as MachineSpec).features.filter((f) => f.enabled)
    })),
    grinders: of('grinder').map((g) => ({
      id: g.id,
      name: g.name,
      dial: (g.spec as GrinderSpec).dial
    })),
    baskets: of('basket').map((g) => {
      const { doseRange } = g.spec as BasketSpec;
      return doseRange ? { id: g.id, name: g.name, doseRange } : { id: g.id, name: g.name };
    })
  };
}

export type ShotFormEmpty = { state: 'empty'; missing: 'setup' | 'bean' };

/**
 * The shot form for the current bean, or for `beanId` when one of your open beans is chosen.
 * Brew next applies unless another bean was chosen.
 */
export function loadShotForm(
  db: Queryable,
  ownerId: string,
  beanId?: string,
  now = Date.now()
): ShotFormData | ShotFormEmpty {
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  const mySetup = settings && readMySetup(settings);
  if (!settings || !mySetup) return { state: 'empty', missing: 'setup' };

  const openBeans = openBeansOf(db, ownerId, settings.timeZone, now);
  const state = db.select().from(appState).where(eq(appState.userId, ownerId)).get();
  const chosen = openBeans.find((b) => b.id === beanId);
  const brewNextRow = state?.brewNextRecipeId
    ? recipeRow(db, ownerId, state.brewNextRecipeId)
    : undefined;
  // The mark applies to an open bean, unless you chose another bean on the form.
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
  const stepSettings = stepSettingsOf(db, ownerId);
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
    stepSettings,
    archivedIds: new Set(
      [...gearRows, ...routineRows].filter((r) => r.archivedAt !== null).map((r) => r.id)
    ),
    nextRoutineId: state?.nextRoutineId ?? null
  };
  const start = prefill(context);

  return {
    state: 'ready',
    prefill: start,
    bean: current,
    openBeans,
    ...gearChoices(gearRows, []),
    defaultFeatures: mySetup.features,
    gearNames: Object.fromEntries(gearRows.map((g) => [g.id, g.name])),
    stepSettings,
    routines: routineRows
      .filter((r) => r.archivedAt === null)
      .map((r) => ({ id: r.id, name: r.name, routine: routines[r.id] })),
    recipes: knownRecipes(db, ownerId, current.id),
    lastShot: latest ? { recipe: latest.recipe, ...latest.shot } : null,
    tags: tagsByUse(db, ownerId),
    steps: { dose: settings.doseStep, yield: settings.yieldStep, time: settings.timeStep }
  };
}

/**
 * The shot form for editing a saved shot: it starts from the shot's own values, taste,
 * flavor notes and notes. The changes and the recipe tag compare with the bean's shot brewed before it,
 * and only earlier shots count, as when it was brewed. `beanId` moves the shot to another open bean,
 * which is then compared with its own shots before this one. Null when the shot is not yours.
 */
export function loadEditShotForm(
  db: Queryable,
  ownerId: string,
  shotId: string,
  beanId?: string,
  now = Date.now()
): ShotFormData | null {
  const row = db
    .select({ shot, recipe })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .where(and(eq(shot.id, shotId), eq(shot.ownerId, ownerId)))
    .get();
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  if (!row || !settings) return null;
  const { shot: s, recipe: r } = row;

  const openBeans = openBeansOf(db, ownerId, settings.timeZone, now);
  // The shot's own bean may be finished by now: the shot keeps it, but only open beans are offered.
  const own =
    openBeans.find((b) => b.id === r.beanId) ??
    beanChoice(
      db
        .select(CHOICE)
        .from(bean)
        .where(and(eq(bean.id, r.beanId), eq(bean.ownerId, ownerId)))
        .get()!,
      settings.timeZone,
      now
    );
  const current = openBeans.find((b) => b.id === beanId) ?? own;

  const gearRows = db.select().from(gear).where(eq(gear.ownerId, ownerId)).all();
  const routineRows = db.select().from(routine).where(eq(routine.ownerId, ownerId)).all();
  const routines = routinesNow(db, ownerId, routineRows);
  const before = { brewedAt: s.brewedAt, id: s.id };
  const previous = latestShotOfBean(db, ownerId, current.id, before);
  const tagIds = db
    .select({ id: shotTag.tagId })
    .from(shotTag)
    .where(eq(shotTag.shotId, s.id))
    .all()
    .map((t) => t.id);

  return {
    state: 'ready',
    prefill: {
      ...toValues(r),
      beanId: current.id,
      dose: s.dose, // the dose it was brewed with
      yield: s.yield,
      time: s.time,
      source: 'last_shot',
      taste: { score: null, balance: null, body: null, sweetness: null, aftertaste: null }
    },
    bean: current,
    openBeans,
    // The shot keeps its own gear, even when archived since.
    ...gearChoices(gearRows, [r.machineId, r.grinderId, r.basketId]),
    defaultFeatures: settings.defaultFeatures,
    gearNames: Object.fromEntries(gearRows.map((g) => [g.id, g.name])),
    stepSettings: stepSettingsOf(db, ownerId),
    routines: routineRows
      .filter((x) => x.archivedAt === null || x.id === r.routineId)
      .map((x) => ({ id: x.id, name: x.name, routine: routines[x.id] })),
    recipes: knownRecipes(db, ownerId, current.id, before),
    lastShot: previous ? { recipe: previous.recipe, ...previous.shot } : null,
    tags: tagsByUse(db, ownerId, tagIds),
    steps: { dose: settings.doseStep, yield: settings.yieldStep, time: settings.timeStep },
    edit: {
      shotId: s.id,
      brewedAt: s.brewedAt,
      taste: {
        score: s.score,
        balance: s.balance,
        body: s.body,
        sweetness: s.sweetness,
        aftertaste: s.aftertaste
      },
      tagIds,
      notes: s.notes
    }
  };
}

/** My setup as the prefill uses it, or null while it is not set up yet. */
export function readMySetup(
  settings: typeof userSettings.$inferSelect
): PrefillContext['mySetup'] | null {
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

/** A shot's place in time; the same moment falls back to the id, which is time-ordered (UUID v7). */
type ShotMoment = { brewedAt: number; id: string };

/** Shots brewed before `before`; every shot without it. */
function brewedBefore(before?: ShotMoment): SQL | undefined {
  if (!before) return undefined;
  return or(
    lt(shot.brewedAt, before.brewedAt),
    and(eq(shot.brewedAt, before.brewedAt), lt(shot.id, before.id))
  );
}

function latestShotOfRecipe(db: Queryable, ownerId: string, recipeId: string): ShotResult | null {
  return (
    db
      .select({ dose: shot.dose, yield: shot.yield, time: shot.time })
      .from(shot)
      .where(and(eq(shot.recipeId, recipeId), eq(shot.ownerId, ownerId)))
      .orderBy(...newestShot)
      .get() ?? null
  );
}

function latestShotOfBean(
  db: Queryable,
  ownerId: string,
  beanId: string,
  before?: ShotMoment
): { recipe: RecipeValues; shot: ShotResult } | null {
  const row = db
    .select({ recipe, dose: shot.dose, yield: shot.yield, time: shot.time })
    .from(shot)
    .innerJoin(recipe, eq(shot.recipeId, recipe.id))
    .where(and(eq(recipe.beanId, beanId), eq(shot.ownerId, ownerId), brewedBefore(before)))
    .orderBy(...newestShot)
    .get();
  // The shot's own dose beside its recipe's: the next shot starts from it, while the recipe tag
  // compares recipes.
  return row
    ? { recipe: toValues(row.recipe), shot: { dose: row.dose, yield: row.yield, time: row.time } }
    : null;
}

/** Earlier bags of a re-buy, nearest first, with their best recipe and latest shot. */
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

/** Every puck prep step's setting, archived ones too. */
function stepSettingsOf(db: Queryable, ownerId: string): Record<string, PrepStepSetting> {
  return Object.fromEntries(
    db
      .select({ id: prepStep.id, setting: prepStep.setting })
      .from(prepStep)
      .where(eq(prepStep.ownerId, ownerId))
      .all()
      .map((s) => [s.id, s.setting])
  );
}

/** Routines as they are now, with each step's current name and unit. */
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

/** This bean's recipes with their shot count and the score of their latest rated shot. */
function knownRecipes(
  db: Queryable,
  ownerId: string,
  beanId: string,
  before?: ShotMoment
): KnownRecipe[] {
  // Editing: only the shots brewed before the edited one count, as when it was brewed.
  const earlier = before
    ? sql`and (s.brewed_at < ${before.brewedAt} or (s.brewed_at = ${before.brewedAt} and s.id < ${before.id}))`
    : sql``;
  const rows = db
    .select({
      id: recipe.id,
      machineId: recipe.machineId,
      fingerprint: recipe.fingerprint,
      dose: recipe.dose,
      lastBrewedAt: sql<number | null>`max(${shot.brewedAt})`,
      shotCount: sql<number>`count(${shot.id})`,
      lastScore: sql<number | null>`(
        select s.score from shot s where s.recipe_id = ${recipe.id} and s.score is not null ${earlier}
        order by s.brewed_at desc, s.id desc limit 1)`
    })
    .from(recipe)
    .leftJoin(shot, and(eq(shot.recipeId, recipe.id), brewedBefore(before)))
    .where(and(eq(recipe.beanId, beanId), eq(recipe.ownerId, ownerId)))
    .groupBy(recipe.id)
    // The order the server matches in, so a tie between two doses goes the same way.
    .orderBy(asc(recipe.createdAt), asc(recipe.id))
    .all();
  return rows;
}

/**
 * Flavor notes by how often you used them, then A–Z. Removed notes are left out, except
 * those the edited shot already has (`keep`).
 */
function tagsByUse(
  db: Queryable,
  ownerId: string,
  keep: string[] = []
): { id: string; name: string }[] {
  return db
    .select({ id: tag.id, name: tag.name })
    .from(tag)
    .leftJoin(shotTag, eq(shotTag.tagId, tag.id))
    .where(
      and(
        eq(tag.ownerId, ownerId),
        keep.length > 0 ? or(isNull(tag.archivedAt), inArray(tag.id, keep)) : isNull(tag.archivedAt)
      )
    )
    .groupBy(tag.id)
    .orderBy(desc(sql`count(${shotTag.shotId})`), sql`lower(${tag.name})`)
    .all();
}

const CHOICE = { id: bean.id, name: bean.name, process: bean.process, roastDate: bean.roastDate };

function beanChoice(
  row: { id: string; name: string; process: Process; roastDate: string },
  timeZone: string,
  now: number
): BeanChoice {
  const { roastDate, ...rest } = row;
  return { ...rest, roastAgeDays: roastAgeDays(roastDate, now, timeZone) };
}

/** Your open beans, newest first, for the bean list. */
function openBeansOf(db: Queryable, ownerId: string, timeZone: string, now: number): BeanChoice[] {
  return db
    .select(CHOICE)
    .from(bean)
    .where(and(eq(bean.ownerId, ownerId), eq(bean.status, 'open')))
    .orderBy(desc(bean.createdAt), desc(bean.id))
    .all()
    .map((row) => beanChoice(row, timeZone, now));
}
