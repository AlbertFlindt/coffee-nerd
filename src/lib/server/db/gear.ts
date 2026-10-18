// Gear (D-38, D-44, D-48, D-49): the Gear page, the gear pages, archiving, and the Library summaries
// (D-50). Every query is scoped by the owner (D-60).
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import { roastAgeDays } from '../../domain/bean';
import { basketName, basketSummary, grinderSummary, machineSummary } from '../../domain/gear';
import {
  gearSchema,
  type BasketSpec,
  type GrinderSpec,
  type MachineSpec
} from '../../domain/schemas';
import { setupDetail } from '../../domain/shot-form';
import { decimalsFor, formatQuantity } from '../../domain/units';
import type { Db, Queryable } from './client';
import { newId } from './ids';
import { bean, gear, prepStep, routine, shotTag, tag, userSettings } from './schema';

type Kind = 'machine' | 'grinder' | 'basket';

/** What a gear page saves: a basket is named by its brand and size (D-150), so it has no name. */
export type GearInput =
  | { kind: 'machine'; name: string; spec: MachineSpec }
  | { kind: 'grinder'; name: string; spec: GrinderSpec }
  | { kind: 'basket'; spec: BasketSpec };

export type GearItem = {
  id: string;
  kind: Kind;
  name: string;
  spec: MachineSpec | GrinderSpec | BasketSpec;
  /** My setup uses it: the Default chip (D-38), and no Archive (D-83). */
  isDefault: boolean;
  archived: boolean;
};

export type GearRow = { id: string; name: string; summary: string; isDefault: boolean };

export type GearPage = {
  /** The My setup card (D-38); null until My setup has a machine and a grinder. */
  mySetup: {
    machine: string;
    grinder: string;
    basket: string | null;
    routine: string | null;
    /** "Dose 18.0 g · Yield 36.0 g · Grind 1.6" */
    values: string;
    /** "93 °C · Flat 9.0 bar · Preinfusion 4 s" */
    setup: string;
  } | null;
  machines: GearRow[];
  grinders: GearRow[];
  baskets: GearRow[];
};

export class GearRejected extends Error {
  constructor(readonly problems: string[]) {
    super(`Gear rejected: ${problems.join('; ')}`);
    this.name = 'GearRejected';
  }
}

function settingsOf(db: Queryable, ownerId: string) {
  return db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
}

function defaultsOf(settings: ReturnType<typeof settingsOf>): Set<string> {
  return new Set(
    [settings?.defaultMachineId, settings?.defaultGrinderId, settings?.defaultBasketId].filter(
      (id): id is string => !!id
    )
  );
}

function summaryOf(kind: Kind, spec: unknown): string {
  if (kind === 'machine') return machineSummary(spec as MachineSpec);
  if (kind === 'grinder') return grinderSummary(spec as GrinderSpec);
  return basketSummary(spec as BasketSpec);
}

/** The Gear page (D-38): My setup, then machines, grinders and baskets; archived gear is left out. */
export function loadGearPage(db: Queryable, ownerId: string): GearPage {
  const settings = settingsOf(db, ownerId);
  const defaults = defaultsOf(settings);
  const rows = db
    .select()
    .from(gear)
    .where(and(eq(gear.ownerId, ownerId), isNull(gear.archivedAt)))
    .orderBy(asc(gear.createdAt), asc(gear.id))
    .all();
  const of = (kind: Kind): GearRow[] =>
    rows
      .filter((r) => r.kind === kind)
      .map((r) => ({
        id: r.id,
        name: r.name,
        summary: summaryOf(kind, r.spec),
        isDefault: defaults.has(r.id)
      }));
  return {
    mySetup: mySetupCard(db, ownerId, settings),
    machines: of('machine'),
    grinders: of('grinder'),
    baskets: of('basket')
  };
}

function mySetupCard(
  db: Queryable,
  ownerId: string,
  settings: ReturnType<typeof settingsOf>
): GearPage['mySetup'] {
  if (!settings?.defaultMachineId || !settings.defaultGrinderId) return null;
  const byId = (id: string | null) =>
    id
      ? db
          .select()
          .from(gear)
          .where(and(eq(gear.id, id), eq(gear.ownerId, ownerId)))
          .get()
      : undefined;
  const machine = byId(settings.defaultMachineId);
  const grinder = byId(settings.defaultGrinderId);
  if (!machine || !grinder) return null;
  const basket = byId(settings.defaultBasketId);
  const r = settings.defaultRoutineId
    ? db
        .select({ name: routine.name })
        .from(routine)
        .where(and(eq(routine.id, settings.defaultRoutineId), eq(routine.ownerId, ownerId)))
        .get()
    : undefined;
  const grams = (value: number, step: number) =>
    formatQuantity(value, { decimals: Math.max(1, decimalsFor(value, step)), unit: 'g' });
  const step = (grinder.spec as GrinderSpec).dial.step;
  const values = [
    settings.defaultDose !== null ? `Dose ${grams(settings.defaultDose, settings.doseStep)}` : null,
    settings.defaultYield !== null
      ? `Yield ${grams(settings.defaultYield, settings.yieldStep)}`
      : null,
    settings.defaultGrind !== null
      ? `Grind ${formatQuantity(settings.defaultGrind, { decimals: decimalsFor(settings.defaultGrind, step) })}`
      : null
  ].filter((v) => v !== null);
  return {
    machine: machine.name,
    grinder: grinder.name,
    basket: basket?.name ?? null,
    routine: r?.name ?? null,
    values: values.join(' · '),
    setup: setupDetail(
      { features: settings.defaultFeatures as never, routine: null },
      (machine.spec as MachineSpec).features
    )
  };
}

/** One gear item for its page; null when it is not yours. */
export function loadGear(db: Queryable, ownerId: string, id: string): GearItem | null {
  const row = db
    .select()
    .from(gear)
    .where(and(eq(gear.id, id), eq(gear.ownerId, ownerId)))
    .get();
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    spec: row.spec as GearItem['spec'],
    isDefault: defaultsOf(settingsOf(db, ownerId)).has(row.id),
    archived: row.archivedAt !== null
  };
}

/** The input checked against its kind's schema (D-44, D-48, D-49); a basket's name comes from it (D-150). */
function checked(input: GearInput): { kind: Kind; name: string; spec: GearItem['spec'] } {
  const name = input.kind === 'basket' ? basketName(input.spec) : input.name;
  const parsed = gearSchema.safeParse({ kind: input.kind, name, spec: input.spec });
  if (!parsed.success)
    throw new GearRejected(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  return parsed.data;
}

/** Adds a machine, grinder or basket (D-147). */
export function addGear(db: Db, ownerId: string, input: GearInput, now: number): string {
  const item = checked(input);
  const id = newId(now);
  db.insert(gear)
    .values({
      id,
      ownerId,
      kind: item.kind,
      name: item.name,
      spec: item.spec,
      createdAt: now,
      updatedAt: now
    })
    .run();
  return id;
}

/** Saves a gear page (D-44, D-48, D-49). The kind never changes. */
export function saveGear(db: Db, ownerId: string, id: string, input: GearInput, now: number): void {
  const item = checked(input);
  const result = db
    .update(gear)
    .set({ name: item.name, spec: item.spec, updatedAt: now })
    .where(and(eq(gear.id, id), eq(gear.ownerId, ownerId), eq(gear.kind, item.kind)))
    .run();
  if (result.changes === 0) throw new GearRejected(['gear: not found']);
}

/**
 * Archives gear (D-148): it leaves the Gear page and the pickers, past shots keep pointing to it. An item
 * My setup uses is not archived (D-83). Null when it is not yours.
 */
export function archiveGear(
  db: Db,
  ownerId: string,
  id: string,
  now: number
): 'archived' | 'in_my_setup' | null {
  if (!loadGear(db, ownerId, id)) return null;
  if (defaultsOf(settingsOf(db, ownerId)).has(id)) return 'in_my_setup';
  db.update(gear)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(gear.id, id), eq(gear.ownerId, ownerId)))
    .run();
  return 'archived';
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The Library page's two short lines per section (D-50, D-156). */
export function loadLibrary(
  db: Queryable,
  ownerId: string,
  now: number
): { beans: string[]; gear: string[]; puckPrep: string[]; tags: string[] } {
  const settings = settingsOf(db, ownerId);
  const timeZone = settings?.timeZone ?? 'UTC';

  const beans = db.select().from(bean).where(eq(bean.ownerId, ownerId)).all();
  const open = beans.filter((b) => b.status === 'open');
  const freshest =
    open.length > 0 ? Math.min(...open.map((b) => roastAgeDays(b.roastDate, now, timeZone))) : null;

  const items = db
    .select({ id: gear.id, name: gear.name })
    .from(gear)
    .where(and(eq(gear.ownerId, ownerId), isNull(gear.archivedAt)))
    .all();
  const named = (id: string | null | undefined) => items.find((g) => g.id === id)?.name;
  const inUse = [named(settings?.defaultMachineId), named(settings?.defaultGrinderId)].filter(
    (n) => n
  );

  const routines = db
    .select({ id: routine.id, name: routine.name })
    .from(routine)
    .where(and(eq(routine.ownerId, ownerId), isNull(routine.archivedAt)))
    .all();
  const steps = db
    .select({ n: count() })
    .from(prepStep)
    .where(and(eq(prepStep.ownerId, ownerId), isNull(prepStep.archivedAt)))
    .get()!.n;
  const usedRoutine = routines.find((r) => r.id === settings?.defaultRoutineId)?.name;

  const tagCount = db.select({ n: count() }).from(tag).where(eq(tag.ownerId, ownerId)).get()!.n;
  const mostUsed = db
    .select({ name: tag.name, n: count() })
    .from(shotTag)
    .innerJoin(tag, eq(tag.id, shotTag.tagId))
    .where(eq(tag.ownerId, ownerId))
    .groupBy(tag.id)
    .orderBy(desc(count()), asc(tag.name))
    .get();

  const lines = (...l: (string | null | undefined)[]) => l.filter((x): x is string => !!x);
  return {
    beans: lines(
      `${open.length} open · ${beans.length - open.length} finished`,
      freshest !== null ? `Freshest: ${plural(freshest, 'day')}` : null
    ),
    gear: lines(plural(items.length, 'item'), inUse.length > 0 ? inUse.join(' · ') : null),
    puckPrep: lines(
      `${plural(routines.length, 'routine')} · ${plural(steps, 'step')}`,
      usedRoutine ? `In use: ${usedRoutine}` : null
    ),
    tags: lines(plural(tagCount, 'flavor note'), mostUsed ? `Most used: ${mostUsed.name}` : null)
  };
}
