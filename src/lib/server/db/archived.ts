// What was archived, and Restore (D-188). Gear, Puck prep and Tags each end with an "Archived" row that opens
// a list of what was archived there: gear; routines and steps; flavor notes. Restore puts an item back in its
// list and pickers. Past shots kept pointing to it all along (data-model §1).
import { and, asc, count, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { fitRoutine } from '../../domain/schemas';
import { FAMILIES } from '../../domain/tags';
import type { Db, Queryable } from './client';
import { summaryOf } from './gear';
import { unitOf } from './puck-prep';
import { gear, prepStep, routine, tag } from './schema';

export type ArchiveArea = 'gear' | 'puck-prep' | 'tags';
export type ArchivedKind = 'gear' | 'routine' | 'step' | 'tag';
export type ArchivedItem = { kind: ArchivedKind; id: string; name: string; detail: string | null };
export type ArchivedGroup = { title: string; items: ArchivedItem[] };

const GEAR_GROUPS = [
  ['machine', 'Machines'],
  ['grinder', 'Grinders'],
  ['basket', 'Baskets']
] as const;

/** The archived items of one area, in groups; groups without items are left out. */
export function loadArchived(db: Queryable, ownerId: string, area: ArchiveArea): ArchivedGroup[] {
  const groups: ArchivedGroup[] = [];
  if (area === 'gear') {
    const rows = db
      .select()
      .from(gear)
      .where(and(eq(gear.ownerId, ownerId), isNotNull(gear.archivedAt)))
      .orderBy(asc(gear.name))
      .all();
    for (const [kind, title] of GEAR_GROUPS)
      groups.push({
        title,
        items: rows
          .filter((r) => r.kind === kind)
          .map((r) => ({ kind: 'gear', id: r.id, name: r.name, detail: summaryOf(kind, r.spec) }))
      });
  } else if (area === 'puck-prep') {
    const routines = db
      .select()
      .from(routine)
      .where(and(eq(routine.ownerId, ownerId), isNotNull(routine.archivedAt)))
      .orderBy(asc(routine.name))
      .all();
    const names = new Map(
      db
        .select({ id: prepStep.id, name: prepStep.name })
        .from(prepStep)
        .where(eq(prepStep.ownerId, ownerId))
        .all()
        .map((s) => [s.id, s.name])
    );
    groups.push({
      title: 'Routines',
      items: routines.map((r) => ({
        kind: 'routine',
        id: r.id,
        name: r.name,
        detail: r.steps.map((s) => names.get(s.stepId) ?? '').join(' → ')
      }))
    });
    const steps = db
      .select()
      .from(prepStep)
      .where(and(eq(prepStep.ownerId, ownerId), isNotNull(prepStep.archivedAt)))
      .orderBy(asc(prepStep.name))
      .all();
    groups.push({
      title: 'Steps',
      items: steps.map((s) => ({ kind: 'step', id: s.id, name: s.name, detail: unitOf(s.setting) }))
    });
  } else {
    const notes = db
      .select()
      .from(tag)
      .where(and(eq(tag.ownerId, ownerId), isNotNull(tag.archivedAt)))
      .orderBy(asc(tag.name))
      .all();
    groups.push({
      title: 'Flavor notes',
      items: notes.map((t) => ({
        kind: 'tag',
        id: t.id,
        name: t.name,
        detail: FAMILIES.find((f) => f.family === t.family)?.label ?? null
      }))
    });
  }
  return groups.filter((g) => g.items.length > 0);
}

/** How many items an area has archived: its "Archived" row shows only when there are any (D-188). */
export function archivedCount(db: Queryable, ownerId: string, area: ArchiveArea): number {
  const of = (table: typeof gear | typeof routine | typeof prepStep | typeof tag) =>
    db
      .select({ n: count() })
      .from(table)
      .where(and(eq(table.ownerId, ownerId), isNotNull(table.archivedAt)))
      .get()!.n;
  if (area === 'gear') return of(gear);
  if (area === 'puck-prep') return of(routine) + of(prepStep);
  return of(tag);
}

/**
 * Restores an archived item (D-188): `restored`, or `fix` for a routine that no longer fit its steps and was
 * brought into range (or lost its steps), so it opens in the routine builder. A routine brings back the
 * archived steps it holds, since a step in a routine stays (D-169). Null when it is not yours or not archived.
 */
export function restoreArchived(
  db: Db,
  ownerId: string,
  kind: ArchivedKind,
  id: string,
  now: number
): 'restored' | 'fix' | null {
  const table = { gear, routine, step: prepStep, tag }[kind];
  const back = { archivedAt: null, updatedAt: now };
  return db.transaction((tx) => {
    const done = tx
      .update(table)
      .set(back)
      .where(and(eq(table.id, id), eq(table.ownerId, ownerId), isNotNull(table.archivedAt)))
      .run();
    if (done.changes === 0) return null;
    if (kind !== 'routine') return 'restored';

    const { steps } = tx
      .select({ steps: routine.steps })
      .from(routine)
      .where(eq(routine.id, id))
      .get()!;
    const stepIds = [...new Set(steps.map((s) => s.stepId))];
    if (stepIds.length > 0)
      tx.update(prepStep)
        .set(back)
        .where(and(eq(prepStep.ownerId, ownerId), inArray(prepStep.id, stepIds)))
        .run();
    // While archived, its steps could change or go (D-175 and D-176 guard only routines in use).
    const settings = Object.fromEntries(
      tx
        .select({ id: prepStep.id, setting: prepStep.setting })
        .from(prepStep)
        .where(and(eq(prepStep.ownerId, ownerId), isNull(prepStep.archivedAt)))
        .all()
        .map((s) => [s.id, s.setting])
    );
    const fitted = fitRoutine(steps, settings);
    if (fitted.changed)
      tx.update(routine)
        .set({ steps: fitted.steps, updatedAt: now })
        .where(eq(routine.id, id))
        .run();
    return fitted.changed || fitted.steps.length === 0 ? 'fix' : 'restored';
  });
}
