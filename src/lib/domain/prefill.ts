// What a new shot starts from (docs/SPEC.md §4.2).
// Pure: the caller loads the candidates (Brew next, the bean's latest shot, the re-buy chain, My setup,
// machines, routines, archived ids) and this function picks one and brings it up to date.
import type { FeatureValue, MachineSpec, PrepStepSetting, SetupSnapshot, Taste } from './schemas';
import type { Thousandths } from './units';

export type RecipeValues = {
  beanId: string;
  machineId: string;
  grinderId: string;
  basketId: string | null;
  routineId: string | null;
  grind: Thousandths;
  dose: Thousandths;
  setup: SetupSnapshot;
};

export type ShotResult = {
  /** The shot's own dose; without it the recipe's dose is used. */
  dose?: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
};

/** A routine as it is now, in the shape of a setup snapshot: name, steps with names, units and values. */
export type RoutineNow = NonNullable<SetupSnapshot['routine']>;

export type PrefillContext = {
  /** The current bean (Home's bean scope). */
  beanId: string;
  /** The recipe marked Brew next, with its latest shot if it has one. */
  brewNext: { recipe: RecipeValues; latestShot: ShotResult | null } | null;
  /** The current bean's latest shot and its recipe. */
  latestShotOfBean: { recipe: RecipeValues; shot: ShotResult } | null;
  /**
   * Earlier bags of a re-buy, nearest first: each with its best recipe if it has rated
   * shots, and its latest shot; both null when the bag has no shots.
   */
  rebuyChain: {
    beanId: string;
    best: { recipe: RecipeValues; latestShot: ShotResult | null } | null;
    latest: { recipe: RecipeValues; shot: ShotResult } | null;
  }[];
  /** My setup defaults; `features` has the same shape as a recipe's feature values. */
  mySetup: {
    machineId: string;
    grinderId: string;
    basketId: string | null;
    routineId: string | null;
    grind: Thousandths;
    dose: Thousandths;
    yield: Thousandths | null;
    features: Record<string, FeatureValue>;
  };
  /** Machine specs as they are now, by id, including any archived machine a candidate uses. */
  machines: Record<string, MachineSpec>;
  /** Routines as they are now, by id. */
  routines: Record<string, RoutineNow>;
  /** Puck prep steps' settings as they are now, by id: a copied value is brought into range. */
  stepSettings?: Record<string, PrepStepSetting>;
  /** Ids of archived gear and routines. */
  archivedIds: ReadonlySet<string>;
  /** A routine just chosen for new shots: the next shot starts with it, unless it is Brew next. */
  nextRoutineId?: string | null;
};

export type PrefillSource = 'brew_next' | 'last_shot' | 'rebuy' | 'my_setup';

export type Prefill = Omit<RecipeValues, 'setup'> &
  ShotResult & {
    /** `brew_next` makes the form say "Recipe chosen from Library". */
    source: PrefillSource;
    setup: SetupSnapshot;
    /** Always empty: taste is never prefilled. */
    taste: Taste;
  };

/** A fresh object each time, so a form writing into one prefill never prefills the next. */
const emptyTaste = (): Taste => ({
  score: null,
  balance: null,
  body: null,
  sweetness: null,
  aftertaste: null
});

/** The new shot's starting values, in the order of docs/SPEC.md §4.2. */
export function prefill(context: PrefillContext): Prefill {
  const { brewNext, latestShotOfBean, rebuyChain, mySetup, beanId } = context;

  if (brewNext) {
    const { recipe, latestShot } = brewNext;
    return fromRecipe(context, 'brew_next', recipe, latestShot, recipe.beanId);
  }
  if (latestShotOfBean) {
    return fromRecipe(context, 'last_shot', latestShotOfBean.recipe, latestShotOfBean.shot, beanId);
  }
  // A new recipe for this bag; scores are not carried over.
  for (const bag of rebuyChain) {
    if (bag.best) return fromRecipe(context, 'rebuy', bag.best.recipe, bag.best.latestShot, beanId);
    if (bag.latest) return fromRecipe(context, 'rebuy', bag.latest.recipe, bag.latest.shot, beanId);
  }
  return {
    source: 'my_setup',
    beanId,
    machineId: mySetup.machineId,
    grinderId: mySetup.grinderId,
    basketId: mySetup.basketId,
    routineId: mySetup.routineId,
    grind: mySetup.grind,
    dose: mySetup.dose,
    yield: mySetup.yield,
    time: null, // a bean's first shot starts with an empty time
    setup: {
      features: reconcileFeatures(
        machineSpec(context, mySetup.machineId),
        mySetup.features,
        mySetup.features
      ),
      routine: mySetup.routineId === null ? null : routineNow(context, mySetup.routineId, null)
    },
    taste: emptyTaste()
  };
}

function fromRecipe(
  context: PrefillContext,
  source: PrefillSource,
  recipe: RecipeValues,
  shot: ShotResult | null,
  beanId: string
): Prefill {
  const { mySetup, archivedIds } = context;
  // An archived item is swapped for My setup's; everything else is copied. A routine just
  // chosen for new shots replaces the copied one.
  const current = <T extends string | null>(id: T, fallback: T): T =>
    id !== null && archivedIds.has(id) ? fallback : id;
  const machineId = current(recipe.machineId, mySetup.machineId);
  const next = context.nextRoutineId ?? null;
  const routineId =
    source !== 'brew_next' && next !== null && !archivedIds.has(next) && next in context.routines
      ? next
      : current(recipe.routineId, mySetup.routineId);
  const routineSwapped = routineId !== recipe.routineId;

  return {
    source,
    beanId,
    machineId,
    grinderId: current(recipe.grinderId, mySetup.grinderId),
    basketId: current(recipe.basketId, mySetup.basketId),
    routineId,
    grind: recipe.grind,
    dose: shot?.dose ?? recipe.dose, // the dose of its last shot
    yield: shot?.yield ?? null,
    time: shot?.time ?? null,
    setup: {
      features: reconcileFeatures(
        machineSpec(context, machineId),
        recipe.setup.features,
        mySetup.features
      ),
      routine:
        routineId === null
          ? null
          : routineNow(context, routineId, routineSwapped ? null : recipe.setup.routine)
    },
    taste: emptyTaste()
  };
}

/**
 * A copied step value that no longer fits its step: a number moves to the nearest end of the
 * range, a removed option falls back to the routine's own value.
 */
function inRange(
  value: RoutineNow['steps'][number]['value'],
  own: RoutineNow['steps'][number]['value'],
  setting: PrepStepSetting | undefined
): RoutineNow['steps'][number]['value'] {
  if (!setting || value === null) return value;
  if (setting.kind === 'choice')
    return typeof value === 'string' && setting.options.some((o) => o.id === value) ? value : own;
  if ((setting.kind === 'number' || setting.kind === 'seconds') && typeof value === 'number') {
    if (setting.min !== undefined && value < setting.min) return setting.min;
    if (setting.max !== undefined && value > setting.max) return setting.max;
  }
  return value;
}

function machineSpec(context: PrefillContext, machineId: string): MachineSpec {
  const spec = context.machines[machineId];
  if (!spec) throw new Error(`Unknown machine ${machineId}`);
  return spec;
}

/**
 * The routine as it is now: its current name and steps, with the copied value for each step that
 * is still in it (matched by step id, in order, so a step used twice keeps both values) and the routine's
 * own value for new steps.
 */
function routineNow(
  context: PrefillContext,
  routineId: string,
  copied: SetupSnapshot['routine']
): RoutineNow {
  const routine = context.routines[routineId];
  if (!routine) throw new Error(`Unknown routine ${routineId}`);
  const copiedValues = new Map<string, RoutineNow['steps'][number]['value'][]>();
  for (const step of copied?.steps ?? []) {
    copiedValues.set(step.stepId, [...(copiedValues.get(step.stepId) ?? []), step.value]);
  }
  return {
    name: routine.name,
    steps: routine.steps.map((step) => {
      const values = copiedValues.get(step.stepId);
      if (!values?.length) return { ...step };
      return {
        ...step,
        value: inRange(values.shift()!, step.value, context.stepSettings?.[step.stepId])
      };
    })
  };
}

/**
 * Fits copied feature values to the machine as it is now (docs/SPEC.md §4.2): features switched off on the
 * machine are left out; features switched on since start from My setup when it has a value, otherwise
 * switched off, or on and waiting for a value when they have no off switch. Values take the
 * feature's current label and unit, since the new recipe's snapshot records them as they are now.
 * Also used when the machine is switched on the shot form or in Edit My setup.
 */
export function reconcileFeatures(
  machine: Pick<MachineSpec, 'features'>,
  copied: Record<string, FeatureValue>,
  defaults: Record<string, FeatureValue>
): Record<string, FeatureValue> {
  const result: Record<string, FeatureValue> = {};
  for (const feature of machine.features) {
    if (!feature.enabled) continue;
    const unit = feature.value.kind === 'number' ? feature.value.unit : undefined;
    const labels = unit ? { label: feature.label, unit } : { label: feature.label };
    const source = copied[feature.key] ?? defaults[feature.key];
    if (source) {
      const { on, value, pressure, choice } = source;
      result[feature.key] = {
        ...labels,
        on,
        ...(value !== undefined && { value }),
        ...(pressure !== undefined && { pressure }),
        ...(choice !== undefined && { choice })
      };
    } else {
      result[feature.key] = { ...labels, on: !feature.switchable };
    }
  }
  return result;
}
