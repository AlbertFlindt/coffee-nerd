// D-186, run once when the database opens: recipes that differ only by a dose within 0.2 g become one.
// The fingerprint no longer holds the dose, so every recipe gets its new fingerprint; within a bean and
// machine, a recipe whose dose is within reach of an earlier recipe's (the closest; equally close, the one
// brewed most recently) gives it its shots and its Brew next mark, and is deleted. Shots keep their own dose (migration 0007).
import { asc, eq, max, sql } from 'drizzle-orm';
import { recipeFingerprint } from '../../domain/fingerprint';
import { closestDose } from '../../domain/shot-form';
import type { Db } from './client';
import { appState, recipe, shot } from './schema';

/** `PRAGMA user_version` once recipes are matched by dose (D-186). */
const MATCHED_BY_DOSE = 1;

export function rematchRecipesByDose(db: Db): void {
  const version = db.$client.pragma('user_version', { simple: true }) as number;
  if (version >= MATCHED_BY_DOSE) return;
  db.transaction((tx) => {
    const rows = tx.select().from(recipe).orderBy(asc(recipe.createdAt), asc(recipe.id)).all();
    const lastBrewed = new Map(
      tx
        .select({ id: shot.recipeId, at: max(shot.brewedAt) })
        .from(shot)
        .groupBy(shot.recipeId)
        .all()
        .map((r) => [r.id, r.at])
    );
    const kept = new Map<string, { id: string; dose: number; lastBrewedAt: number | null }[]>();
    for (const r of rows) {
      const fingerprint = recipeFingerprint(r);
      const scope = JSON.stringify([r.ownerId, r.beanId, r.machineId, fingerprint]);
      const earlier = kept.get(scope) ?? [];
      const into = closestDose(r.dose, earlier);
      if (into) {
        const at = lastBrewed.get(r.id) ?? null;
        if (at !== null && (into.lastBrewedAt === null || at > into.lastBrewedAt))
          into.lastBrewedAt = at;
        tx.update(shot).set({ recipeId: into.id }).where(eq(shot.recipeId, r.id)).run();
        tx.update(appState)
          .set({ brewNextRecipeId: into.id })
          .where(eq(appState.brewNextRecipeId, r.id))
          .run();
        tx.delete(recipe).where(eq(recipe.id, r.id)).run();
      } else {
        tx.update(recipe).set({ fingerprint }).where(eq(recipe.id, r.id)).run();
        kept.set(scope, [
          ...earlier,
          { id: r.id, dose: r.dose, lastBrewedAt: lastBrewed.get(r.id) ?? null }
        ]);
      }
    }
    tx.run(sql.raw(`PRAGMA user_version = ${MATCHED_BY_DOSE}`));
  });
}
