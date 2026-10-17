// What a new shot starts from (data-model §4.2; D-03, D-11, D-38, D-41, D-43, D-72, D-73).
// Pure: the caller loads the candidates (Brew next, the bean's latest shot, the re-buy chain with each
// earlier bag's best recipe, My setup, the machines) and this function picks and reconciles them.
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

export type PrefillContext = {
  /** The current bean (Home's bean scope). */
  beanId: string;
  /** The recipe marked Brew next, with its latest shot if it has one (D-43). */
  brewNext: { recipe: RecipeValues; latestShot: ShotResult | null } | null;
  /** The current bean's latest shot and its recipe. */
  latestShotOfBean: { recipe: RecipeValues; shot: ShotResult } | null;
  /** Earlier bags of a re-buy, nearest first, each with its best recipe (D-66) or null without shots. */
  rebuyChain: {
    beanId: string;
    best: { recipe: RecipeValues; latestShot: ShotResult | null } | null;
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
    routine: SetupSnapshot['routine'];
  };
  /** Current machine specs by id, for reconciling features. */
  machines: Record<string, MachineSpec>;
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

const EMPTY_TASTE: Taste = {
  score: null,
  balance: null,
  body: null,
  sweetness: null,
  aftertaste: null
};

/** The new shot's starting values, in the order of data-model §4.2. */
export function prefill(context: PrefillContext): Prefill {
  const { brewNext, latestShotOfBean, rebuyChain, mySetup, beanId } = context;

  if (brewNext) {
    return fromRecipe(
      context,
      'brew_next',
      brewNext.recipe,
      brewNext.latestShot,
      brewNext.recipe.beanId
    );
  }
  if (latestShotOfBean) {
    return fromRecipe(context, 'last_shot', latestShotOfBean.recipe, latestShotOfBean.shot, beanId);
  }
  const nearest = rebuyChain.find((bag) => bag.best !== null)?.best;
  if (nearest) {
    // A new recipe for this bag; scores are not carried over (D-41, D-73).
    return fromRecipe(context, 'rebuy', nearest.recipe, nearest.latestShot, beanId);
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
      routine: mySetup.routine
    },
    taste: EMPTY_TASTE
  };
}

function fromRecipe(
  context: PrefillContext,
  source: PrefillSource,
  recipe: RecipeValues,
  shot: ShotResult | null,
  beanId: string
): Prefill {
  return {
    source,
    beanId,
    machineId: recipe.machineId,
    grinderId: recipe.grinderId,
    basketId: recipe.basketId,
    routineId: recipe.routineId,
    grind: recipe.grind,
    dose: recipe.dose,
    yield: shot?.yield ?? null,
    time: shot?.time ?? null,
    setup: {
      features: reconcileFeatures(
        machineSpec(context, recipe.machineId),
        recipe.setup.features,
        context.mySetup.features
      ),
      routine: recipe.setup.routine
    },
    taste: EMPTY_TASTE
  };
}

function machineSpec(context: PrefillContext, machineId: string): MachineSpec {
  const spec = context.machines[machineId];
  if (!spec) throw new Error(`Unknown machine ${machineId}`);
  return spec;
}

/**
 * Fits copied feature values to the machine as it is now (data-model §4.2): features switched off on the
 * machine are left out; features switched on since start from My setup when it has a value, otherwise
 * switched off (or on and waiting for a value when they have no off switch). Values take the feature's
 * current label and unit, since the new recipe's snapshot records them as they are now (D-65).
 */
function reconcileFeatures(
  machine: MachineSpec,
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
