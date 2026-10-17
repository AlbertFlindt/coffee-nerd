// Shapes of the JSON the app stores (D-64), checked in the browser and again on the server.
// Numbers that are quantities are whole thousandths (data-model §1.4); see ./units.ts.
import { z } from 'zod';

const thousandths = z.number().int();
const step = z.number().int().positive();
const name = z.string().trim().min(1);
const id = z.uuid();

type Range = { min?: number; max?: number };
const rangeIsOrdered = ({ min, max }: Range) =>
  min === undefined || max === undefined || min <= max;
const RANGE_MESSAGE = 'The range must run from low to high';

// --- value definitions: shared by machine features and puck prep steps (D-46, D-52) ---

const numberValue = z.object({
  kind: z.literal('number'),
  unit: name,
  step,
  min: thousandths.optional(),
  max: thousandths.optional()
});
const secondsValue = z.object({
  kind: z.literal('seconds'),
  step,
  min: thousandths.optional(),
  max: thousandths.optional()
});
const toggleValue = z.object({ kind: z.literal('toggle') });
const choiceOptions = z
  .array(z.object({ id: name, label: name }))
  .min(1)
  .refine((options) => new Set(options.map((o) => o.id)).size === options.length, {
    message: 'Options need distinct ids'
  });
const choiceValue = z.object({ kind: z.literal('choice'), options: choiceOptions });
/** A pressure profile phase: seconds as the main value, optional pressure in bar (D-24). */
const phaseValue = z.object({
  kind: z.literal('phase'),
  step,
  pressure: z
    .object({ step, min: thousandths, max: thousandths })
    .refine(rangeIsOrdered, RANGE_MESSAGE)
    .optional()
});

export const valueDefinitionSchema = z
  .discriminatedUnion('kind', [numberValue, secondsValue, toggleValue, choiceValue, phaseValue])
  .refine((v) => !('min' in v) || rangeIsOrdered(v), RANGE_MESSAGE);
export type ValueDefinition = z.infer<typeof valueDefinitionSchema>;

// --- machine features (D-44, D-46) ---

export const BUILT_IN_FEATURE_KEYS = [
  'temperature',
  'flat_pressure',
  'preinfusion',
  'low_bar_start',
  'low_bar_end'
] as const;
const builtInKeys: ReadonlySet<string> = new Set(BUILT_IN_FEATURE_KEYS);
const CUSTOM_KEY = /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const featureDefinitionSchema = z
  .object({
    /** Stable forever; labels can be renamed freely (D-65). */
    key: z.string().refine((key) => builtInKeys.has(key) || CUSTOM_KEY.test(key), {
      message: 'A feature key is built in or custom-<uuid>'
    }),
    label: name,
    builtIn: z.boolean(),
    enabled: z.boolean(),
    switchable: z.boolean(),
    value: valueDefinitionSchema
  })
  .refine((f) => f.builtIn === builtInKeys.has(f.key), {
    message: 'Only the five known features are built in',
    path: ['builtIn']
  });
export type FeatureDefinition = z.infer<typeof featureDefinitionSchema>;

// --- gear specs: one per kind (D-68) ---

export const machineSpecSchema = z.object({
  type: z.enum(['automatic', 'semi_auto', 'lever', 'manual']),
  groupSizeMm: z.number().int().positive().optional(),
  features: z
    .array(featureDefinitionSchema)
    .refine((features) => new Set(features.map((f) => f.key)).size === features.length, {
      message: 'Each feature appears once'
    })
});
export type MachineSpec = z.infer<typeof machineSpecSchema>;

export const grinderSpecSchema = z.object({
  type: z.enum(['electric', 'hand']),
  burrs: z.enum(['flat', 'conical']),
  burrSizeMm: z.number().int().positive().optional(),
  /** How the dial works; drives the grind control (D-48). */
  dial: z
    .object({
      mode: z.enum(['stepped', 'stepless']),
      step,
      finest: thousandths,
      coarsest: thousandths
    })
    .refine((dial) => dial.finest !== dial.coarsest, {
      message: 'Finest and coarsest must differ'
    })
});
export type GrinderSpec = z.infer<typeof grinderSpecSchema>;

export const basketSpecSchema = z.object({
  type: z.enum(['precision', 'standard', 'pressurized']),
  shotSize: z.enum(['single', 'double', 'triple']),
  diameterMm: z.number().int().positive().optional(),
  doseRange: z
    .object({ from: thousandths.nonnegative(), to: thousandths.nonnegative() })
    .refine((range) => range.from <= range.to, RANGE_MESSAGE)
    .optional()
});
export type BasketSpec = z.infer<typeof basketSpecSchema>;

export const gearSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('machine'), name, spec: machineSpecSchema }),
  z.object({ kind: z.literal('grinder'), name, spec: grinderSpecSchema }),
  z.object({ kind: z.literal('basket'), name, spec: basketSpecSchema })
]);
export type Gear = z.infer<typeof gearSchema>;

// --- puck prep (D-51, D-52) ---

const inRange = (value: number, { min, max }: Range) =>
  (min === undefined || value >= min) && (max === undefined || value <= max);

/** A step's setting: none, or a number, seconds or list value with the value it starts at. */
export const prepStepSettingSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    numberValue.extend({ startsAt: thousandths }),
    secondsValue.extend({ startsAt: thousandths }),
    choiceValue.extend({ startsAt: name })
  ])
  .refine((s) => !('min' in s) || rangeIsOrdered(s), RANGE_MESSAGE)
  .refine(
    (s) =>
      s.kind === 'none' ||
      (s.kind === 'choice' ? s.options.some((o) => o.id === s.startsAt) : inRange(s.startsAt, s)),
    { message: 'The starting value must be a valid value', path: ['startsAt'] }
  );
export type PrepStepSetting = z.infer<typeof prepStepSettingSchema>;

/** A step value: thousandths for numbers and seconds, an option id for lists, null for no setting. */
const stepValue = z.union([thousandths, name, z.null()]);

/** A routine is a straight line of steps (D-51). */
export const routineStepsSchema = z.array(z.object({ stepId: id, value: stepValue }));
export type RoutineSteps = z.infer<typeof routineStepsSchema>;

// --- a recipe's setup snapshot (D-65) ---

export const featureValueSchema = z.object({
  label: name,
  unit: name.optional(),
  on: z.boolean(),
  value: thousandths.optional(),
  pressure: thousandths.optional(),
  choice: name.optional()
});
export type FeatureValue = z.infer<typeof featureValueSchema>;

export const setupSnapshotSchema = z.object({
  features: z.record(z.string(), featureValueSchema),
  routine: z
    .object({
      name,
      steps: z.array(z.object({ stepId: id, name, unit: name.optional(), value: stepValue }))
    })
    .nullable()
});
export type SetupSnapshot = z.infer<typeof setupSnapshotSchema>;

/**
 * Checks a setup against the machine it is brewed on: every enabled feature is present, nothing else is,
 * non-switchable features are on, and switched-on values fit their definition. Values typed off the step
 * grid are allowed (D-07). Returns readable problems; an empty list means valid.
 */
export function validateSetupAgainstMachine(setup: SetupSnapshot, machine: MachineSpec): string[] {
  const problems: string[] = [];
  const enabled = machine.features.filter((f) => f.enabled);

  for (const feature of enabled) {
    const entry = setup.features[feature.key];
    const label = feature.label;
    if (!entry) {
      problems.push(`${label}: missing`);
      continue;
    }
    if (!entry.on) {
      if (!feature.switchable) problems.push(`${label}: cannot be switched off`);
      continue;
    }
    const definition = feature.value;
    switch (definition.kind) {
      case 'toggle':
        break;
      case 'choice':
        if (entry.choice === undefined) problems.push(`${label}: value missing`);
        else if (!definition.options.some((o) => o.id === entry.choice))
          problems.push(`${label}: "${entry.choice}" is not an option`);
        break;
      case 'number':
      case 'seconds':
      case 'phase':
        if (entry.value === undefined) {
          problems.push(`${label}: value missing`);
          break;
        }
        if (definition.kind !== 'phase' && !inRange(entry.value, definition))
          problems.push(`${label}: ${entry.value} is outside ${rangeText(definition)}`);
        if (definition.kind === 'phase' && definition.pressure) {
          if (entry.pressure === undefined) problems.push(`${label}: pressure missing`);
          else if (!inRange(entry.pressure, definition.pressure))
            problems.push(
              `${label}: pressure ${entry.pressure} is outside ${rangeText(definition.pressure)}`
            );
        }
        break;
    }
  }

  const enabledKeys = new Set(enabled.map((f) => f.key));
  for (const key of Object.keys(setup.features)) {
    if (!enabledKeys.has(key)) problems.push(`${key}: not a feature of this machine`);
  }
  return problems;
}

const rangeText = ({ min, max }: Range) => `${min ?? '…'}–${max ?? '…'}`;

// --- a shot's taste (D-09, D-11, D-23, D-67): null means not rated / not set, never 0 ---

const scale = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

export const tasteSchema = z.object({
  score: scale(1, 10),
  balance: scale(-10, 10),
  body: scale(0, 10),
  sweetness: scale(0, 10),
  aftertaste: scale(0, 10)
});
export type Taste = z.infer<typeof tasteSchema>;
