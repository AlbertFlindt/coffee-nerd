// Library › Tags: your flavor notes by family, with the duplicate finder. Every query is
// scoped to the signed-in account. A note shots used is archived, not deleted.
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { duplicatePairs, FAMILIES, keptKey, type Family } from '../../domain/tags';
import type { Db, Queryable } from './client';
import { newId } from './ids';
import { shotTag, tag, tagMerged, tagPairKept } from './schema';

export type TagItem = {
  id: string;
  name: string;
  family: Family;
  /** Shots that used it. */
  count: number;
  /** Added by you, not built in: the "custom" label. */
  custom: boolean;
};

export type TagsPage = {
  /** All five families, in order, with their notes (built-ins first, then yours, oldest first). */
  families: { family: Family; label: string; tags: TagItem[] }[];
  total: number;
  /** The pair the "Same tag twice?" card suggests, or null. */
  duplicate: { keep: TagItem; merge: TagItem } | null;
};

export type TagInput = { name: string; family: Family };

export class TagRejected extends Error {
  constructor(readonly problems: string[]) {
    super(`Tag rejected: ${problems.join('; ')}`);
    this.name = 'TagRejected';
  }
}

const MAX_NAME = 40;
const isFamily = (f: string): f is Family => FAMILIES.some((x) => x.family === f);

export function loadTags(db: Queryable, ownerId: string): TagsPage {
  const rows = db
    .select({
      id: tag.id,
      name: tag.name,
      family: tag.family,
      builtIn: tag.builtIn,
      count: count(shotTag.shotId)
    })
    .from(tag)
    .leftJoin(shotTag, eq(shotTag.tagId, tag.id))
    .where(and(eq(tag.ownerId, ownerId), isNull(tag.archivedAt)))
    .groupBy(tag.id)
    .orderBy(desc(tag.builtIn), asc(tag.createdAt), sql`${tag}.rowid`)
    .all();
  const notes: TagItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    family: r.family,
    count: r.count,
    custom: !r.builtIn
  }));
  const kept = new Set(
    db
      .select({ a: tagPairKept.tagId, b: tagPairKept.otherTagId })
      .from(tagPairKept)
      .where(eq(tagPairKept.ownerId, ownerId))
      .all()
      .map((p) => keptKey(p.a, p.b))
  );
  return {
    families: FAMILIES.map((f) => ({ ...f, tags: notes.filter((n) => n.family === f.family) })),
    total: notes.length,
    duplicate: duplicatePairs(notes, kept)[0] ?? null
  };
}

/** The checked name and family, or TagRejected; `self` is the note being renamed. */
function checked(db: Queryable, ownerId: string, input: TagInput, self: string | null) {
  const name = input.name.trim();
  const problems: string[] = [];
  if (name.length === 0) problems.push('name: required');
  else if (name.length > MAX_NAME) problems.push('name: too long');
  if (!isFamily(input.family)) problems.push('family: unknown');
  const same = name
    ? db
        .select({ id: tag.id, archivedAt: tag.archivedAt })
        .from(tag)
        .where(and(eq(tag.ownerId, ownerId), sql`lower(${tag.name}) = lower(${name})`))
        .get()
    : undefined;
  if (same && same.id !== self && (same.archivedAt === null || self !== null))
    problems.push('name: taken');
  if (problems.length > 0) throw new TagRejected(problems);
  return { name, family: input.family, same };
}

/**
 * A new note in the chosen family. A removed note with the same name comes back instead,
 * in the chosen family if it is your own.
 */
export function addTag(db: Db, ownerId: string, input: TagInput, now: number): string {
  const { name, family, same } = checked(db, ownerId, input, null);
  if (same) {
    const own = db.select({ builtIn: tag.builtIn }).from(tag).where(eq(tag.id, same.id)).get()!;
    db.update(tag)
      .set({ archivedAt: null, ...(own.builtIn ? {} : { family }), updatedAt: now })
      .where(eq(tag.id, same.id))
      .run();
    return same.id;
  }
  const id = newId(now);
  db.insert(tag).values({ id, ownerId, name, family, createdAt: now, updatedAt: now }).run();
  return id;
}

/** Rename a note; only your own notes change family. False when it is not yours. */
export function saveTag(
  db: Db,
  ownerId: string,
  id: string,
  input: TagInput,
  now: number
): boolean {
  const existing = db
    .select({ builtIn: tag.builtIn, family: tag.family })
    .from(tag)
    .where(and(eq(tag.id, id), eq(tag.ownerId, ownerId), isNull(tag.archivedAt)))
    .get();
  if (!existing) return false;
  const { name, family } = checked(db, ownerId, input, id);
  if (existing.builtIn && family !== existing.family) throw new TagRejected(['family: built in']);
  db.update(tag).set({ name, family, updatedAt: now }).where(eq(tag.id, id)).run();
  return true;
}

/** Every shot with `fromId` gets `intoId` instead, then `fromId` goes. False when not possible. */
export function mergeTag(db: Db, ownerId: string, fromId: string, intoId: string): boolean {
  if (fromId === intoId) return false;
  const found = db
    .select({ id: tag.id })
    .from(tag)
    .where(and(inArray(tag.id, [fromId, intoId]), eq(tag.ownerId, ownerId), isNull(tag.archivedAt)))
    .all();
  if (found.length !== 2) return false;
  db.transaction((tx) => {
    tx.run(
      sql`insert or ignore into shot_tag (shot_id, tag_id) select shot_id, ${intoId} from shot_tag where tag_id = ${fromId}`
    );
    tx.delete(shotTag).where(eq(shotTag.tagId, fromId)).run();
    tx.delete(tag).where(eq(tag.id, fromId)).run();
    // A shot saved later with the old note gets this one.
    tx.insert(tagMerged).values({ tagId: fromId, ownerId, intoTagId: intoId }).run();
  });
  return true;
}

/** A note shots used is archived; one no shot used is deleted. Null when it is not yours. */
export function removeTag(
  db: Db,
  ownerId: string,
  id: string,
  now: number
): 'deleted' | 'archived' | null {
  const where = and(eq(tag.id, id), eq(tag.ownerId, ownerId), isNull(tag.archivedAt));
  if (!db.select({ id: tag.id }).from(tag).where(where).get()) return null;
  const used = db.select({ id: shotTag.shotId }).from(shotTag).where(eq(shotTag.tagId, id)).get();
  if (used) {
    db.update(tag).set({ archivedAt: now, updatedAt: now }).where(where).run();
    return 'archived';
  }
  db.delete(tag).where(where).run();
  return 'deleted';
}

/** "Keep both": the pair is no longer suggested. False when either note is not yours. */
export function keepBoth(db: Db, ownerId: string, a: string, b: string): boolean {
  if (a === b) return false;
  const found = db
    .select({ id: tag.id })
    .from(tag)
    .where(and(inArray(tag.id, [a, b]), eq(tag.ownerId, ownerId)))
    .all();
  if (found.length !== 2) return false;
  const [tagId, otherTagId] = a < b ? [a, b] : [b, a];
  db.insert(tagPairKept).values({ ownerId, tagId, otherTagId }).onConflictDoNothing().run();
  return true;
}
