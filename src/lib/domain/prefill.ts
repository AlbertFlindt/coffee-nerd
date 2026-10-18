// What a new shot starts from (data-model §4.2; D-03, D-11, D-38, D-41, D-43, D-72 to D-76, D-78).
// Pure: the caller loads the candidates (Brew next, the bean's latest shot, the re-buy chain, My setup,
// machines, routines, archived ids) and this function picks one and brings it up to date.
import type { FeatureValue, MachineSpec, SetupSnapshot, Taste } from './schemas';
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

export type ShotResult = { yield: Thousandths | null; time: Thousandths | null };

/** A routine as it is now, in the shape of a setup snapshot: name, steps with names, units and values. */
export type RoutineNow = NonNullable<SetupSnapshot['routine']>;

export type PrefillContext = {
  /** The current bean (Home's bean scope). */
  beanId: string;
  /** The recipe marked Brew next, with its latest shot if it has one (D-43). */
  brewNext: { recipe: RecipeValues; latestShot: ShotResult | null } | null;
  /** The current bean's latest shot and its recipe. */
  latestShotOfBean: { recipe: RecipeValues; shot: ShotResult } | null;
  /**
   * Earlier bags of a re-buy, nearest first (D-73): each with its best recipe (D-66) if it has rated
   * shots, and its latest shot (D-74); both null when the bag has no shots.
   */
  rebuyChain: {
    beanId: string;
    best: { recipe: RecipeValues; latestShot: ShotResult | null } | null;
    latest: { recipe: RecipeValues; shot: ShotResult } | null;
  }[];
  /** My setup defaults (D-38); `features` has the same shape as a recipe's feature values. */
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
  /** Routines as they are now, by id (D-76). */
  routines: Record<string, RoutineNow>;
  /** Ids of archived gear and routines (D-75). */
  archivedIds: ReadonlySet<string>;
};

export type PrefillSource = 'brew_next' | 'last_shot' | 'rebuy' | 'my_setup';

export type Prefill = Omit<RecipeValues, 'setup'> &
  ShotResult & {
    /** `brew_next` makes the form say "Recipe chosen from Library" (D-43). */
    source: PrefillSource;
    setup: SetupSnapshot;
    /** Always empty: taste is never prefilled (D-11). */
    taste: Taste;
  };

/** A fresh object each time, so a form writing into one prefill never prefills the next (D-11). */
const emptyTaste = (): Taste => ({
  score: null,
  balance: null,
  body: null,
  sweetness: null,
  aftertaste: null
});

/** The new shot's starting values, in the order of data-model §4.2. */
export function prefill(context: PrefillContext): Prefill {
  const { brewNext, latestShotOfBean, rebuyChain, mySetup, beanId } = context;

  if (brewNext) {
    const { recipe, latestShot } = brewNext;
    return fromRecipe(context, 'brew_next', recipe, latestShot, recipe.beanId);
  }
  if (latestShotOfBean) {
    return fromRecipe(context, 'last_shot', latestShotOfBean.recipe, latestShotOfBean.shot, beanId);
  }
  // A new recipe for this bag; scores are not carried over (D-41, D-73, D-74).
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
    time: null, // D-72
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
  // D-75: an archived item is swapped for My setup's; everything else is copied.
  const current = <T extends string | null>(id: T, fallback: T): T =>
    id !== null && archivedIds.has(id) ? fallback : id;
  const machineId = current(recipe.machineId, mySetup.machineId);
  const routineId = current(recipe.routineId, mySetup.routineId);
  const routineSwapped = routineId !== recipe.routineId;

  return {
    source,
    beanId,
    machineId,
    grinderId: current(recipe.grinderId, mySetup.grinderId),
    basketId: current(recipe.basketId, mySetup.basketId),
    routineId,
    grind: recipe.grind,
    dose: recipe.dose,
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

function machineSpec(context: PrefillContext, machineId: string): MachineSpec {
  const spec = context.machines[machineId];
  if (!spec) throw new Error(`Unknown machine ${machineId}`);
  return spec;
}

/**
 * The routine as it is now (D-76): its current name and steps, with the copied value for each step that
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
      return { ...step, value: values?.length ? values.shift()! : step.value };
    })
  };
}

/**
 * Fits copied feature values to the machine as it is now (data-model §4.2): features switched off on the
 * machine are left out; features switched on since start from My setup when it has a value, otherwise
 * switched off, or on and waiting for a value when they have no off switch (D-78). Values take the
 * feature's current label and unit, since the new recipe's snapshot records them as they are now (D-65).
 * Also used when the machine is switched on the shot form (D-153) or in Edit My setup (D-45).
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
