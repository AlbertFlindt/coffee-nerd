// Backup and export. The backup is the whole database without sign-ins; the exports
// hold only the signed-in account's rows and never the password or sign-ins.
import Database from 'better-sqlite3';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { decimalsDeep, type ShotExportRow } from '../../domain/export';
import type { MachineSpec } from '../../domain/schemas';
import { setupDetail } from '../../domain/shot-form';
import { fromThousandths, type Thousandths } from '../../domain/units';
import type { Db, Queryable } from './client';
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
  user,
  userSettings
} from './schema';

/**
 * A copy of the whole database as one file, taken from a consistent snapshot while the app runs.
 * Sign-ins are removed and the copy is compacted, so not even their freed pages are left in it.
 */
export function backupDatabase(db: Db): Buffer {
  const image = db.$client.serialize();
  // The file is in WAL mode (client.ts), which a copy in memory cannot open: mark it as a plain file.
  // The app switches it back to WAL when it opens the restored file.
  image[18] = 1;
  image[19] = 1;
  const copy = new Database(image);
  try {
    copy.exec('delete from session; vacuum');
    return copy.serialize();
  } finally {
    copy.close();
  }
}

/** Every saved shot of the account, oldest first, named as the shot detail names it. */
export function exportShotRows(db: Queryable, ownerId: string): ShotExportRow[] {
  const rows = db
    .select({
      shot,
      recipe,
      bean: { name: bean.name, roaster: bean.roaster, roastDate: bean.roastDate }
    })
    .from(shot)
    .innerJoin(recipe, eq(recipe.id, shot.recipeId))
    .innerJoin(bean, eq(bean.id, recipe.beanId))
    .where(eq(shot.ownerId, ownerId))
    .orderBy(asc(shot.brewedAt), asc(shot.id))
    .all();
  const gearById = new Map(
    db
      .select({ id: gear.id, name: gear.name, spec: gear.spec })
      .from(gear)
      .where(eq(gear.ownerId, ownerId))
      .all()
      .map((g) => [g.id, g])
  );
  const flavors = new Map<string, string[]>();
  const ids = rows.map((r) => r.shot.id);
  for (let i = 0; i < ids.length; i += 500) {
    const pairs = db
      .select({ shotId: shotTag.shotId, name: tag.name })
      .from(shotTag)
      .innerJoin(tag, eq(tag.id, shotTag.tagId))
      .where(and(eq(tag.ownerId, ownerId), inArray(shotTag.shotId, ids.slice(i, i + 500))))
      .orderBy(asc(tag.name))
      .all();
    for (const { shotId, name } of pairs)
      flavors.set(shotId, [...(flavors.get(shotId) ?? []), name]);
  }
  return rows.map(({ shot: s, recipe: r, bean: b }) => {
    const machine = gearById.get(r.machineId)!;
    return {
      brewedAt: s.brewedAt,
      beanName: b.name,
      roaster: b.roaster,
      roastDate: b.roastDate,
      machine: machine.name,
      grinder: gearById.get(r.grinderId)!.name,
      basket: r.basketId ? (gearById.get(r.basketId)?.name ?? null) : null,
      routine: r.setup.routine?.name ?? null,
      setup: setupDetail(r.setup, (machine.spec as MachineSpec).features),
      grind: r.grind,
      dose: s.dose,
      yield: s.yield,
      time: s.time,
      score: s.score,
      balance: s.balance,
      body: s.body,
      sweetness: s.sweetness,
      aftertaste: s.aftertaste,
      flavors: flavors.get(s.id) ?? [],
      notes: s.notes
    };
  });
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const dec = (value: Thousandths | null) => (value === null ? null : fromThousandths(value));
const library = (row: { shared: boolean; archivedAt: number | null }) => ({
  shared: row.shared,
  archivedAt: iso(row.archivedAt)
});
const times = (row: { createdAt: number; updatedAt: number }) => ({
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt)
});

/**
 * Everything the account holds, archived rows included, with quantities as decimals in their units
 * and times in UTC (ISO 8601). Ids are kept so the links between rows hold.
 */
export function exportEverything(db: Queryable, ownerId: string, now: number) {
  const account = db.select({ name: user.name }).from(user).where(eq(user.id, ownerId)).get();
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, ownerId)).get();
  const state = db.select().from(appState).where(eq(appState.userId, ownerId)).get();
  const tagIds = new Map<string, string[]>();
  for (const { shotId, tagId } of db
    .select({ shotId: shotTag.shotId, tagId: shotTag.tagId })
    .from(shotTag)
    .innerJoin(shot, eq(shot.id, shotTag.shotId))
    .where(eq(shot.ownerId, ownerId))
    .orderBy(asc(shotTag.tagId))
    .all())
    tagIds.set(shotId, [...(tagIds.get(shotId) ?? []), tagId]);

  return {
    app: 'Coffee Nerd',
    exportedAt: iso(now),
    units: 'Weights in grams, times in seconds, temperatures in degrees Celsius, pressures in bar.',
    account: { name: account?.name ?? null },
    mySetup: settings && {
      machineId: settings.defaultMachineId,
      grinderId: settings.defaultGrinderId,
      basketId: settings.defaultBasketId,
      routineId: settings.defaultRoutineId,
      grind: dec(settings.defaultGrind),
      dose: dec(settings.defaultDose),
      yield: dec(settings.defaultYield),
      features: decimalsDeep(settings.defaultFeatures),
      timeZone: settings.timeZone,
      steps: {
        dose: dec(settings.doseStep),
        yield: dec(settings.yieldStep),
        time: dec(settings.timeStep)
      }
    },
    brewNextRecipeId: state?.brewNextRecipeId ?? null,
    gear: db
      .select()
      .from(gear)
      .where(eq(gear.ownerId, ownerId))
      .orderBy(asc(gear.createdAt), asc(gear.id))
      .all()
      .map((g) => ({
        id: g.id,
        kind: g.kind,
        name: g.name,
        spec: decimalsDeep(g.spec),
        ...library(g),
        ...times(g)
      })),
    beans: db
      .select()
      .from(bean)
      .where(eq(bean.ownerId, ownerId))
      .orderBy(asc(bean.createdAt), asc(bean.id))
      .all()
      .map((b) => ({
        id: b.id,
        name: b.name,
        roaster: b.roaster,
        countryCode: b.countryCode,
        region: b.region,
        variety: b.variety,
        process: b.process,
        altitudeMinMetres: b.altitudeMinM,
        altitudeMaxMetres: b.altitudeMaxM,
        roastLevel: b.roastLevel,
        roastDate: b.roastDate,
        bagWeight: dec(b.bagWeight),
        status: b.status,
        finishedAt: iso(b.finishedAt),
        finishedAutomatically: b.finishedAutomatically,
        rebuyOfId: b.rebuyOfId,
        shared: b.shared,
        ...times(b)
      })),
    puckPrepSteps: db
      .select()
      .from(prepStep)
      .where(eq(prepStep.ownerId, ownerId))
      .orderBy(asc(prepStep.createdAt), asc(prepStep.id))
      .all()
      .map((p) => ({
        id: p.id,
        name: p.name,
        setting: decimalsDeep(p.setting),
        ...library(p),
        ...times(p)
      })),
    routines: db
      .select()
      .from(routine)
      .where(eq(routine.ownerId, ownerId))
      .orderBy(asc(routine.createdAt), asc(routine.id))
      .all()
      .map((r) => ({
        id: r.id,
        name: r.name,
        steps: decimalsDeep(r.steps),
        ...library(r),
        ...times(r)
      })),
    flavorNotes: db
      .select()
      .from(tag)
      .where(eq(tag.ownerId, ownerId))
      .orderBy(asc(tag.name))
      .all()
      .map((t) => ({
        id: t.id,
        name: t.name,
        family: t.family,
        builtIn: t.builtIn,
        ...library(t),
        ...times(t)
      })),
    recipes: db
      .select()
      .from(recipe)
      .where(eq(recipe.ownerId, ownerId))
      .orderBy(asc(recipe.createdAt), asc(recipe.id))
      .all()
      .map((r) => ({
        id: r.id,
        method: r.method,
        beanId: r.beanId,
        machineId: r.machineId,
        grinderId: r.grinderId,
        basketId: r.basketId,
        routineId: r.routineId,
        grind: dec(r.grind),
        dose: dec(r.dose),
        setup: decimalsDeep(r.setup),
        ...times(r)
      })),
    shots: db
      .select()
      .from(shot)
      .where(eq(shot.ownerId, ownerId))
      .orderBy(asc(shot.brewedAt), asc(shot.id))
      .all()
      .map((s) => ({
        id: s.id,
        recipeId: s.recipeId,
        brewedAt: iso(s.brewedAt),
        dose: dec(s.dose),
        yield: dec(s.yield),
        time: dec(s.time),
        score: s.score,
        balance: s.balance,
        body: s.body,
        sweetness: s.sweetness,
        aftertaste: s.aftertaste,
        flavorNoteIds: tagIds.get(s.id) ?? [],
        notes: s.notes,
        ...times(s)
      }))
  };
}
