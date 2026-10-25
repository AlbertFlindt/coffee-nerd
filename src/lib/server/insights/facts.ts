// Shot facts (data-model §5, D-64): the `shot_facts` view read for one owner, with what needs the user's
// time zone or the units module added: the ratio, the local day, the week and the roast age.
import { and, asc, eq, getViewSelectedFields, gte, lt, type SQL } from 'drizzle-orm';
import { localDate, ratio, roastAgeDays } from '../../domain/bean';
import type { MachineSpec, SetupSnapshot } from '../../domain/schemas';
import type { Thousandths } from '../../domain/units';
import type { Queryable } from '../db/client';
import { gear, prepStep, shotFacts } from '../db/schema';
import type { DimensionContext } from './registry';

export type ShotFact = {
  shotId: string;
  recipeId: string;
  beanId: string;
  beanName: string;
  machineId: string;
  grinderId: string;
  grinderName: string;
  /** The grinder's dial step, for showing a grind with the right decimals. */
  grindStep: Thousandths;
  basketId: string | null;
  basketName: string | null;
  routineId: string | null;
  routineName: string | null;
  brewedAt: number;
  /** "2026-10-17" in the user's time zone (data-model §1.8). */
  localDay: string;
  /** The Monday that starts the shot's week, "2026-10-12", in the user's time zone (D-208). */
  week: string;
  roastAgeDays: number;
  /** Taste: null when not rated or not set, never 0 (D-11). */
  score: number | null;
  balance: number | null;
  body: number | null;
  sweetness: number | null;
  aftertaste: number | null;
  dose: Thousandths;
  yield: Thousandths | null;
  time: Thousandths | null;
  ratio: Thousandths | null;
  grind: Thousandths;
  recipeDose: Thousandths;
  process: 'washed' | 'natural' | 'honey' | 'anaerobic' | 'other' | null;
  countryCode: string | null;
  roaster: string | null;
  roastLevel: 'light' | 'medium_light' | 'medium' | 'dark' | null;
  /** How many shots the recipe has, for "reused recipes only" (D-203). */
  recipeShots: number;
  setup: SetupSnapshot;
};

export type FactFilters = {
  beanId?: string;
  recipeId?: string;
  /** Brewed at or after this UTC time. */
  from?: number;
  /** Brewed before this UTC time. */
  to?: number;
};

/** The owner's shots as facts, oldest first. Another owner's shots never appear (D-60). */
export function loadShotFacts(
  db: Queryable,
  ownerId: string,
  timeZone: string,
  filters: FactFilters = {}
): ShotFact[] {
  // The owner is the filter, not a fact.
  const { ownerId: owner, ...columns } = getViewSelectedFields(shotFacts);
  const where: SQL[] = [eq(owner, ownerId)];
  if (filters.beanId !== undefined) where.push(eq(shotFacts.beanId, filters.beanId));
  if (filters.recipeId !== undefined) where.push(eq(shotFacts.recipeId, filters.recipeId));
  if (filters.from !== undefined) where.push(gte(shotFacts.brewedAt, filters.from));
  if (filters.to !== undefined) where.push(lt(shotFacts.brewedAt, filters.to));
  const rows = db
    .select(columns)
    .from(shotFacts)
    .where(and(...where))
    .orderBy(asc(shotFacts.brewedAt), asc(shotFacts.shotId))
    .all();
  return rows.map(({ roastDate, ...row }) => {
    const localDay = localDate(row.brewedAt, timeZone);
    return {
      ...row,
      localDay,
      week: mondayOf(localDay),
      roastAgeDays: roastAgeDays(roastDate, row.brewedAt, timeZone),
      ratio: ratio(row.yield, row.dose)
    };
  });
}

/** The Monday on or before a calendar date; weeks start on Monday (data-model §1.8). */
export function mondayOf(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // getUTCDay: Sunday 0 … Saturday 6; Monday is 6 days back from Sunday.
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** What groups need to be worded: list step options and machine features (archived ones included). */
export function loadDimensionContext(db: Queryable, ownerId: string): DimensionContext {
  const steps = db
    .select({ id: prepStep.id, setting: prepStep.setting })
    .from(prepStep)
    .where(eq(prepStep.ownerId, ownerId))
    .all();
  const stepOptions: DimensionContext['stepOptions'] = {};
  for (const { id, setting } of steps)
    if (setting.kind === 'choice')
      stepOptions[id] = Object.fromEntries(setting.options.map((o) => [o.id, o.label]));
  const machines = db
    .select({ id: gear.id, spec: gear.spec })
    .from(gear)
    .where(and(eq(gear.ownerId, ownerId), eq(gear.kind, 'machine')))
    .all();
  const machineFeatures = Object.fromEntries(
    machines.map(({ id, spec }) => [id, (spec as MachineSpec).features])
  );
  return { stepOptions, machineFeatures };
}
