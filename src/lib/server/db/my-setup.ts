// Edit My setup (screen 13): the form's current values and choices, and saving them. My setup is the
// only place the default gear is chosen. Every chosen id must be one of this owner's items that is
// not archived; anything else is refused and nothing is saved.
import { and, asc, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { reconcileFeatures } from '../../domain/prefill';
import {
  featureValueSchema,
  validateSetupAgainstMachine,
  type FeatureDefinition,
  type FeatureValue,
  type GrinderSpec,
  type MachineSpec
} from '../../domain/schemas';
import type { Thousandths } from '../../domain/units';
import type { Db, Queryable } from './client';
import { appState, gear, routine, userSettings } from './schema';

export type MySetupFormData = {
  /** What My setup has now; machine and grinder (and dose, grind) are null on an account that never chose. */
  current: {
    machineId: string | null;
    grinderId: string | null;
    basketId: string | null;
    routineId: string | null;
    grind: Thousandths | null;
    dose: Thousandths | null;
    yield: Thousandths | null;
    features: Record<string, FeatureValue>;
  };
  /** −/+ steps for dose and yield. */
  steps: { dose: Thousandths; yield: Thousandths };
  /** Only items that are not archived. */
  machines: { id: string; name: string; features: FeatureDefinition[] }[];
  grinders: { id: string; name: string; dial: GrinderSpec['dial'] }[];
  baskets: { id: string; name: string }[];
  routines: { id: string; name: string }[];
};

/** Your machines, grinders, baskets and puck prep routines (not archived) and what My setup has now. */
export function loadMySetupForm(db: Queryable, ownerId: string): MySetupFormData {
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  const rows = db
    .select()
    .from(gear)
    .where(and(eq(gear.ownerId, ownerId), isNull(gear.archivedAt)))
    .orderBy(asc(gear.createdAt), asc(gear.id))
    .all();
  const routines = db
    .select({ id: routine.id, name: routine.name })
    .from(routine)
    .where(and(eq(routine.ownerId, ownerId), isNull(routine.archivedAt)))
    .orderBy(asc(routine.createdAt), asc(routine.id))
    .all();
  const of = (kind: 'machine' | 'grinder' | 'basket') => rows.filter((r) => r.kind === kind);

  const machines = of('machine').map((m) => ({
    id: m.id,
    name: m.name,
    features: (m.spec as MachineSpec).features.filter((f) => f.enabled)
  }));
  const grinders = of('grinder').map((g) => ({
    id: g.id,
    name: g.name,
    dial: (g.spec as GrinderSpec).dial
  }));
  const baskets = of('basket').map((b) => ({ id: b.id, name: b.name }));
  // Archiving a default is refused, but an id that is not offered is never shown as chosen.
  const chosen = (id: string | null | undefined, offered: { id: string }[]) =>
    id && offered.some((o) => o.id === id) ? id : null;

  return {
    current: {
      machineId: chosen(settings?.defaultMachineId, machines),
      grinderId: chosen(settings?.defaultGrinderId, grinders),
      basketId: chosen(settings?.defaultBasketId, baskets),
      routineId: chosen(settings?.defaultRoutineId, routines),
      grind: settings?.defaultGrind ?? null,
      dose: settings?.defaultDose ?? null,
      yield: settings?.defaultYield ?? null,
      features: settings?.defaultFeatures ?? {}
    },
    steps: { dose: settings?.doseStep ?? 100, yield: settings?.yieldStep ?? 100 },
    machines,
    grinders,
    baskets,
    routines
  };
}

const id = z.string().min(1);
const thousandths = z.number().int();

/** What the form posts. Machine and grinder are required; basket and puck prep may be none. */
export const mySetupSchema = z.object({
  machineId: id,
  grinderId: id,
  basketId: id.nullable(),
  routineId: id.nullable(),
  grind: thousandths,
  dose: thousandths.positive(),
  yield: thousandths.nonnegative().nullable(),
  features: z.record(z.string(), featureValueSchema)
});
export type MySetupInput = z.infer<typeof mySetupSchema>;

/** Plain words for the problems; a screen shows them above the button. */
export class MySetupRejected extends Error {
  constructor(readonly problems: string[]) {
    super(`My setup rejected: ${problems.join('; ')}`);
    this.name = 'MySetupRejected';
  }
}

const NOT_FOUND = 'This gear could not be found';
const PATH_PROBLEM: Record<string, string> = {
  machineId: 'Choose a machine',
  grinderId: 'Choose a grinder',
  basketId: NOT_FOUND,
  routineId: NOT_FOUND,
  grind: 'Set Grind first.',
  dose: 'Set Dose first.',
  yield: 'Yield must be 0 or more'
};

function ownGear(
  db: Queryable,
  ownerId: string,
  id: string,
  kind: 'machine' | 'grinder' | 'basket'
) {
  return db
    .select()
    .from(gear)
    .where(
      and(eq(gear.id, id), eq(gear.ownerId, ownerId), eq(gear.kind, kind), isNull(gear.archivedAt))
    )
    .get();
}

/**
 * Saves My setup. Refused, with problems in plain words and nothing saved, when a chosen item is not
 * yours or is archived, when temperature or flat pressure has no value, or when a
 * switched-on phase lacks its value. Features follow the chosen machine: those it does not have are dropped.
 */
export function saveMySetup(db: Db, ownerId: string, input: unknown, now: number): void {
  const parsed = mySetupSchema.safeParse(input);
  if (!parsed.success) {
    const words = parsed.error.issues.map(
      (i) => PATH_PROBLEM[String(i.path[0])] ?? 'Something on this page is not right'
    );
    throw new MySetupRejected([...new Set(words)]);
  }
  const v = parsed.data;

  db.transaction((tx) => {
    const machine = ownGear(tx, ownerId, v.machineId, 'machine');
    const grinder = ownGear(tx, ownerId, v.grinderId, 'grinder');
    const basketOk = v.basketId === null || !!ownGear(tx, ownerId, v.basketId, 'basket');
    const routineOk =
      v.routineId === null ||
      !!tx
        .select({ id: routine.id })
        .from(routine)
        .where(
          and(eq(routine.id, v.routineId), eq(routine.ownerId, ownerId), isNull(routine.archivedAt))
        )
        .get();
    if (!machine || !grinder || !basketOk || !routineOk) throw new MySetupRejected([NOT_FOUND]);

    const { dial } = grinder.spec as GrinderSpec;
    if (
      v.grind < Math.min(dial.finest, dial.coarsest) ||
      v.grind > Math.max(dial.finest, dial.coarsest)
    )
      throw new MySetupRejected(['Grind must be within the grinder’s range']);

    const spec = machine.spec as MachineSpec;
    const features = reconcileFeatures(spec, v.features, v.features);
    const problems = validateSetupAgainstMachine({ features, routine: null }, spec).map((p) => {
      if (p.problem === 'pressure_missing') return `Set the pressure for ${p.label} first.`;
      if (p.problem === 'out_of_range') return `${p.label} is out of range`;
      if (p.problem === 'pressure_out_of_range') return `${p.label} pressure is out of range`;
      return `Set ${p.label} first.`;
    });
    if (problems.length > 0) throw new MySetupRejected(problems);

    // Defaults for features this machine does not have switched on stay, for when a shot switches to another
    // machine; the chosen machine's own features are as checked above.
    const stored = tx
      .select({ features: userSettings.defaultFeatures })
      .from(userSettings)
      .where(eq(userSettings.userId, ownerId))
      .get();
    const others = Object.fromEntries(
      Object.entries(stored?.features ?? {}).filter(
        ([key]) => !spec.features.some((f) => f.key === key && f.enabled)
      )
    );

    const values = {
      defaultMachineId: v.machineId,
      defaultGrinderId: v.grinderId,
      defaultBasketId: v.basketId,
      defaultRoutineId: v.routineId,
      defaultGrind: v.grind,
      defaultDose: v.dose,
      defaultYield: v.yield,
      defaultFeatures: { ...others, ...features },
      updatedAt: now
    };
    // A routine chosen for the next shot gives way to another routine chosen here.
    tx.update(appState)
      .set({ nextRoutineId: null, updatedAt: now })
      .where(
        and(
          eq(appState.userId, ownerId),
          v.routineId === null
            ? isNotNull(appState.nextRoutineId)
            : ne(appState.nextRoutineId, v.routineId)
        )
      )
      .run();
    if (stored) tx.update(userSettings).set(values).where(eq(userSettings.userId, ownerId)).run();
    else
      tx.insert(userSettings)
        .values({ userId: ownerId, timeZone: 'UTC', createdAt: now, ...values })
        .run();
  });
}
