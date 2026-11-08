// Import: reads an "Export everything" file (src/lib/server/db/export.ts) back into stored values.
// Pure, so it is tested without a database: decimals become thousandths, ISO times become UTC
// milliseconds, every JSON value is checked with the schemas the app saves with, recipes get their
// fingerprint again, and every link between rows must point to a row in the same file.
import { z } from 'zod';
import { recipeFingerprint } from './fingerprint';
import {
  basketSpecSchema,
  featureValueSchema,
  grinderSpecSchema,
  machineSpecSchema,
  prepStepSettingSchema,
  routineStepsSchema,
  setupSnapshotSchema,
  tasteSchema,
  type BasketSpec,
  type FeatureValue,
  type GrinderSpec,
  type MachineSpec,
  type PrepStepSetting,
  type RoutineSteps,
  type SetupSnapshot
} from './schemas';
import { toThousandths, type Thousandths } from './units';

/** Every number in an exported JSON value as thousandths: the inverse of `decimalsDeep`. */
export function thousandthsDeep(value: unknown): unknown {
  if (typeof value === 'number') return toThousandths(value);
  if (Array.isArray(value)) return value.map(thousandthsDeep);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, thousandthsDeep(v)]));
  return value;
}

const id = z.uuid();
const time = z.iso.datetime({ offset: true }).transform((text) => Date.parse(text));
const optionalTime = time.nullable();
const decimal = z.number().transform((value, ctx) => {
  try {
    return toThousandths(value);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Not a quantity' });
    return z.NEVER;
  }
});
const optionalDecimal = decimal.nullable();
const text = z.string();
const optionalText = text.nullable();
/** A JSON value stored in thousandths, checked with the schema the app saves it with. */
const stored = <T extends z.ZodType>(schema: T) =>
  z
    .unknown()
    .transform((value, ctx) => {
      try {
        return thousandthsDeep(value);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Not a quantity' });
        return z.NEVER;
      }
    })
    .pipe(schema);
const times = { createdAt: time, updatedAt: time };
const library = { shared: z.boolean(), archivedAt: optionalTime };
const taste = tasteSchema.shape;

const gearRow = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('machine'), spec: stored(machineSpecSchema) }),
  z.object({ kind: z.literal('grinder'), spec: stored(grinderSpecSchema) }),
  z.object({ kind: z.literal('basket'), spec: stored(basketSpecSchema) })
]);

const fileSchema = z.object({
  app: z.literal('Coffee Nerd'),
  mySetup: z
    .object({
      machineId: id.nullable(),
      grinderId: id.nullable(),
      basketId: id.nullable(),
      routineId: id.nullable(),
      grind: optionalDecimal,
      dose: optionalDecimal,
      yield: optionalDecimal,
      features: stored(z.record(z.string(), featureValueSchema)),
      timeZone: text,
      steps: z.object({ dose: decimal, yield: decimal, time: decimal })
    })
    .nullish(),
  brewNextRecipeId: id.nullable(),
  gear: z.array(
    z.intersection(z.object({ id, name: text.trim().min(1), ...library, ...times }), gearRow)
  ),
  beans: z.array(
    z.object({
      id,
      name: text.trim().min(1),
      roaster: optionalText,
      countryCode: z.string().length(2).nullable(),
      region: optionalText,
      variety: optionalText,
      process: z.enum(['washed', 'natural', 'honey', 'anaerobic', 'other']).nullable(),
      altitudeMinMetres: z.number().int().nullable(),
      altitudeMaxMetres: z.number().int().nullable(),
      roastLevel: z.enum(['light', 'medium_light', 'medium', 'dark']).nullable(),
      roastDate: z.iso.date(),
      bagWeight: optionalDecimal,
      status: z.enum(['open', 'finished']),
      finishedAt: optionalTime,
      finishedAutomatically: z.boolean(),
      rebuyOfId: id.nullable(),
      shared: z.boolean(),
      ...times
    })
  ),
  puckPrepSteps: z.array(
    z.object({
      id,
      name: text.trim().min(1),
      setting: stored(prepStepSettingSchema),
      ...library,
      ...times
    })
  ),
  routines: z.array(
    z.object({
      id,
      name: text.trim().min(1),
      steps: stored(routineStepsSchema),
      ...library,
      ...times
    })
  ),
  flavorNotes: z.array(
    z.object({
      id,
      name: text.trim().min(1),
      family: z.enum(['fruity', 'sweet', 'floral', 'nutty_roasty', 'other']),
      builtIn: z.boolean(),
      ...library,
      ...times
    })
  ),
  recipes: z.array(
    z.object({
      id,
      method: z.literal('espresso'),
      beanId: id,
      machineId: id,
      grinderId: id,
      basketId: id.nullable(),
      routineId: id.nullable(),
      grind: decimal,
      dose: decimal,
      setup: stored(setupSnapshotSchema),
      ...times
    })
  ),
  shots: z.array(
    z.object({
      id,
      recipeId: id,
      brewedAt: time,
      dose: decimal,
      yield: optionalDecimal,
      time: optionalDecimal,
      ...taste,
      flavorNoteIds: z.array(id),
      notes: optionalText,
      ...times
    })
  )
});

type Stamps = { createdAt: number; updatedAt: number };
type Library = { shared: boolean; archivedAt: number | null };

/** The file's rows as the database stores them, without the account they go into. */
export type ImportData = {
  mySetup: {
    defaultMachineId: string | null;
    defaultGrinderId: string | null;
    defaultBasketId: string | null;
    defaultRoutineId: string | null;
    defaultGrind: Thousandths | null;
    defaultDose: Thousandths | null;
    defaultYield: Thousandths | null;
    defaultFeatures: Record<string, FeatureValue>;
    timeZone: string;
    doseStep: Thousandths;
    yieldStep: Thousandths;
    timeStep: Thousandths;
  } | null;
  brewNextRecipeId: string | null;
  gear: ({
    id: string;
    kind: 'machine' | 'grinder' | 'basket';
    name: string;
    spec: MachineSpec | GrinderSpec | BasketSpec;
  } & Library &
    Stamps)[];
  beans: ({
    id: string;
    name: string;
    roaster: string | null;
    countryCode: string | null;
    region: string | null;
    variety: string | null;
    process: 'washed' | 'natural' | 'honey' | 'anaerobic' | 'other' | null;
    altitudeMinM: number | null;
    altitudeMaxM: number | null;
    roastLevel: 'light' | 'medium_light' | 'medium' | 'dark' | null;
    roastDate: string;
    bagWeight: Thousandths | null;
    status: 'open' | 'finished';
    finishedAt: number | null;
    finishedAutomatically: boolean;
    rebuyOfId: string | null;
    shared: boolean;
  } & Stamps)[];
  prepSteps: ({ id: string; name: string; setting: PrepStepSetting } & Library & Stamps)[];
  routines: ({ id: string; name: string; steps: RoutineSteps } & Library & Stamps)[];
  tags: ({
    id: string;
    name: string;
    family: 'fruity' | 'sweet' | 'floral' | 'nutty_roasty' | 'other';
    builtIn: boolean;
  } & Library &
    Stamps)[];
  recipes: ({
    id: string;
    method: 'espresso';
    beanId: string;
    machineId: string;
    grinderId: string;
    basketId: string | null;
    routineId: string | null;
    grind: Thousandths;
    dose: Thousandths;
    setup: SetupSnapshot;
    fingerprint: string;
  } & Stamps)[];
  shots: ({
    id: string;
    recipeId: string;
    brewedAt: number;
    dose: Thousandths;
    yield: Thousandths | null;
    time: Thousandths | null;
    score: number | null;
    balance: number | null;
    body: number | null;
    sweetness: number | null;
    aftertaste: number | null;
    notes: string | null;
  } & Stamps)[];
  shotTags: { shotId: string; tagId: string }[];
};

export type ImportResult = { ok: true; data: ImportData } | { ok: false; problem: string };

export const NOT_AN_EXPORT =
  'This is not an "Export everything" file from Coffee Nerd, or it was changed after the export.';

/** Reads the text of an "Export everything" file, or says in plain words why it can't be imported. */
export function readImport(fileText: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(fileText);
  } catch {
    return { ok: false, problem: NOT_AN_EXPORT };
  }
  const parsed = fileSchema.safeParse(json);
  if (!parsed.success) return { ok: false, problem: NOT_AN_EXPORT };
  const file = parsed.data;

  const data: ImportData = {
    mySetup: file.mySetup
      ? {
          defaultMachineId: file.mySetup.machineId,
          defaultGrinderId: file.mySetup.grinderId,
          defaultBasketId: file.mySetup.basketId,
          defaultRoutineId: file.mySetup.routineId,
          defaultGrind: file.mySetup.grind,
          defaultDose: file.mySetup.dose,
          defaultYield: file.mySetup.yield,
          defaultFeatures: file.mySetup.features,
          timeZone: file.mySetup.timeZone,
          doseStep: file.mySetup.steps.dose,
          yieldStep: file.mySetup.steps.yield,
          timeStep: file.mySetup.steps.time
        }
      : null,
    brewNextRecipeId: file.brewNextRecipeId,
    gear: file.gear.map((g) => ({
      id: g.id,
      kind: g.kind,
      name: g.name,
      spec: g.spec,
      shared: g.shared,
      archivedAt: g.archivedAt,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt
    })),
    beans: file.beans.map(({ altitudeMinMetres, altitudeMaxMetres, ...b }) => ({
      ...b,
      altitudeMinM: altitudeMinMetres,
      altitudeMaxM: altitudeMaxMetres
    })),
    prepSteps: file.puckPrepSteps,
    routines: file.routines,
    tags: file.flavorNotes,
    recipes: file.recipes.map((r) => ({ ...r, fingerprint: recipeFingerprint(r) })),
    shots: file.shots.map((s) => omitFlavorNotes(s)),
    shotTags: file.shots.flatMap((s) =>
      [...new Set(s.flavorNoteIds)].map((tagId) => ({ shotId: s.id, tagId }))
    )
  };
  return linksHold(data) ? { ok: true, data } : { ok: false, problem: NOT_AN_EXPORT };
}

function omitFlavorNotes<T extends { flavorNoteIds: unknown }>(row: T): Omit<T, 'flavorNoteIds'> {
  const copy: Partial<T> = { ...row };
  delete copy.flavorNoteIds;
  return copy as Omit<T, 'flavorNoteIds'>;
}

/**
 * True when every link points to a row of the right kind in the file, and ids, flavor note names and
 * recipe identities are unique, as the database requires.
 */
function linksHold(data: ImportData): boolean {
  const all = [
    ...data.gear,
    ...data.beans,
    ...data.prepSteps,
    ...data.routines,
    ...data.tags,
    ...data.recipes,
    ...data.shots
  ].map((row) => row.id);
  if (new Set(all).size !== all.length) return false;

  const kindOf = new Map(data.gear.map((g) => [g.id, g.kind]));
  const beans = new Set(data.beans.map((b) => b.id));
  const steps = new Set(data.prepSteps.map((p) => p.id));
  const routines = new Set(data.routines.map((r) => r.id));
  const tags = new Set(data.tags.map((t) => t.id));
  const recipes = new Set(data.recipes.map((r) => r.id));
  const isGear = (gearId: string | null, kind: string) =>
    gearId === null || kindOf.get(gearId) === kind;
  const isRoutine = (routineId: string | null) => routineId === null || routines.has(routineId);

  const names = data.tags.map((t) => t.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return false;
  if (data.beans.some((b) => b.rebuyOfId !== null && !beans.has(b.rebuyOfId))) return false;
  if (data.routines.some((r) => r.steps.some((s) => !steps.has(s.stepId)))) return false;
  const setup = data.mySetup;
  if (
    setup &&
    !(
      isGear(setup.defaultMachineId, 'machine') &&
      isGear(setup.defaultGrinderId, 'grinder') &&
      isGear(setup.defaultBasketId, 'basket') &&
      isRoutine(setup.defaultRoutineId)
    )
  )
    return false;
  if (
    data.recipes.some(
      (r) =>
        !beans.has(r.beanId) ||
        !isGear(r.machineId, 'machine') ||
        !isGear(r.grinderId, 'grinder') ||
        !isGear(r.basketId, 'basket') ||
        !isRoutine(r.routineId)
    )
  )
    return false;
  // One recipe per bean, machine, setup and dose, as the database allows (docs/SPEC.md §3).
  const identities = data.recipes.map((r) =>
    [r.beanId, r.machineId, r.fingerprint, r.dose].join(' ')
  );
  if (new Set(identities).size !== identities.length) return false;
  if (data.brewNextRecipeId !== null && !recipes.has(data.brewNextRecipeId)) return false;
  if (data.shots.some((s) => !recipes.has(s.recipeId))) return false;
  if (data.shotTags.some((t) => !tags.has(t.tagId))) return false;
  return true;
}
