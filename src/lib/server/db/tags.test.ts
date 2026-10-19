import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './client';
import { loadLibrary } from './gear';
import { newId } from './ids';
import { shotTag, tag } from './schema';
import { seedReferenceSetup, type SeededIds } from './seed';
import { loadEditShotForm, loadShotForm } from './shot-form';
import { saveShot } from './shots';
import {
  addTag,
  keepBoth,
  loadTags,
  mergeTag,
  removeTag,
  saveTag,
  TagRejected,
  type TagItem
} from './tags';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-tags-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 19, 6, 0);
let db: Db;
let ids: SeededIds;
let counter = 0;

beforeEach(() => {
  db = openDatabase(join(dir, `tags-${counter++}.db`));
  ids = seedReferenceSetup(db, { now: T0, name: 'Demo', passwordHash: 'x' });
});

/** Saves a shot from the form's prefill with these notes; returns its id. */
function brew(minutes: number, tagIds: string[], newTagNames: string[] = []): string {
  const form = loadShotForm(db, ids.userId);
  if (form.state !== 'ready') throw new Error('Expected a ready form');
  const now = T0 + minutes * 60_000;
  const id = newId(now);
  saveShot(
    db,
    ids.userId,
    {
      ...form.prefill,
      id,
      yield: 36000,
      time: 28000,
      taste: { score: null, balance: null, body: null, sweetness: null, aftertaste: null },
      tagIds,
      newTagNames,
      notes: null,
      brewedAt: now
    },
    now
  );
  return id;
}

const all = (): TagItem[] => loadTags(db, ids.userId).families.flatMap((f) => f.tags);
const named = (name: string) => all().find((t) => t.name === name)!;
const shotTags = (shotId: string) =>
  db
    .select({ id: shotTag.tagId })
    .from(shotTag)
    .where(eq(shotTag.shotId, shotId))
    .all()
    .map((r) => r.id);

describe('loadTags', () => {
  it('D-53: the five families in order, each note with its count, built-ins not custom', () => {
    brew(1, [named('Berry').id]);
    brew(2, [named('Berry').id, named('Honey').id]);
    const page = loadTags(db, ids.userId);
    expect(page.families.map((f) => f.label)).toEqual([
      'Fruity',
      'Sweet',
      'Floral',
      'Nutty & roasty',
      'Other'
    ]);
    expect(page.total).toBe(15);
    expect(page.families[0].tags.map((t) => [t.name, t.count])).toEqual([
      ['Berry', 2],
      ['Citrus', 0],
      ['Stone fruit', 0],
      ['Tropical', 0]
    ]);
    expect(named('Honey')).toMatchObject({ count: 1, custom: false });
    expect(page.duplicate).toBeNull();
  });

  it('D-53: a note you added carries "custom" and comes after the built-ins', () => {
    addTag(db, ids.userId, { name: 'Blueberry jam', family: 'fruity' }, T0 + 1);
    const fruity = loadTags(db, ids.userId).families[0].tags;
    expect(fruity.at(-1)).toMatchObject({ name: 'Blueberry jam', custom: true, count: 0 });
  });

  it('D-53, D-173: suggests merging a look-alike into the more used note', () => {
    brew(1, [named('Caramel').id]);
    const carmel = addTag(db, ids.userId, { name: 'Carmel', family: 'sweet' }, T0 + 1);
    const { duplicate } = loadTags(db, ids.userId);
    expect(duplicate?.keep.name).toBe('Caramel');
    expect(duplicate?.merge.id).toBe(carmel);
  });
});

describe('addTag', () => {
  it('D-174: a name and a family', () => {
    const id = addTag(db, ids.userId, { name: '  Funky ', family: 'other' }, T0);
    expect(named('Funky')).toMatchObject({ id, family: 'other', custom: true });
  });

  it('refuses an empty, too long or taken name', () => {
    const problems = (name: string) => {
      try {
        addTag(db, ids.userId, { name, family: 'other' }, T0);
      } catch (e) {
        if (e instanceof TagRejected) return e.problems;
        throw e;
      }
      return [];
    };
    expect(problems(' ')).toEqual(['name: required']);
    expect(problems('x'.repeat(41))).toEqual(['name: too long']);
    expect(problems('berry')).toEqual(['name: taken']);
  });

  it('D-171: a removed note comes back when added again', () => {
    const funky = addTag(db, ids.userId, { name: 'Funky', family: 'other' }, T0);
    brew(1, [funky]);
    removeTag(db, ids.userId, funky, T0 + 2 * 60_000);
    expect(addTag(db, ids.userId, { name: 'funky', family: 'fruity' }, T0 + 3 * 60_000)).toBe(
      funky
    );
    expect(named('Funky')).toMatchObject({ family: 'fruity', count: 1 });
  });
});

describe('saveTag', () => {
  it('D-172: a built-in note can be renamed but keeps its family', () => {
    const berry = named('Berry').id;
    saveTag(db, ids.userId, berry, { name: 'Berries', family: 'fruity' }, T0);
    expect(named('Berries').id).toBe(berry);
    expect(() =>
      saveTag(db, ids.userId, berry, { name: 'Berries', family: 'sweet' }, T0)
    ).toThrowError(TagRejected);
  });

  it('D-172: your own note can change family', () => {
    const funky = addTag(db, ids.userId, { name: 'Funky', family: 'other' }, T0);
    saveTag(db, ids.userId, funky, { name: 'Funky', family: 'fruity' }, T0);
    expect(named('Funky').family).toBe('fruity');
  });

  it('refuses a name another note has, but not a change of case', () => {
    const berry = named('Berry').id;
    expect(() =>
      saveTag(db, ids.userId, berry, { name: 'citrus', family: 'fruity' }, T0)
    ).toThrowError(TagRejected);
    saveTag(db, ids.userId, berry, { name: 'BERRY', family: 'fruity' }, T0);
    expect(named('BERRY').id).toBe(berry);
  });

  it('is scoped by owner', () => {
    expect(
      saveTag(db, 'someone-else', named('Berry').id, { name: 'X', family: 'fruity' }, T0)
    ).toBe(false);
  });
});

describe('mergeTag', () => {
  it('D-53: every shot of the old note moves to the kept one, and the old note goes', () => {
    const caramel = named('Caramel').id;
    const carmel = addTag(db, ids.userId, { name: 'Carmel', family: 'sweet' }, T0);
    const both = brew(1, [caramel, carmel]);
    const only = brew(2, [carmel]);
    expect(mergeTag(db, ids.userId, carmel, caramel)).toBe(true);
    expect(shotTags(both)).toEqual([caramel]);
    expect(shotTags(only)).toEqual([caramel]);
    expect(named('Caramel').count).toBe(2);
    expect(all().some((t) => t.name === 'Carmel')).toBe(false);
  });

  it('refuses merging a note into itself or into another owner’s note', () => {
    const berry = named('Berry').id;
    expect(mergeTag(db, ids.userId, berry, berry)).toBe(false);
    expect(mergeTag(db, ids.userId, berry, 'missing')).toBe(false);
  });
});

describe('removeTag', () => {
  it('D-171: a note no shot used is deleted', () => {
    const berry = named('Berry').id;
    expect(removeTag(db, ids.userId, berry, T0)).toBe('deleted');
    expect(db.select().from(tag).where(eq(tag.id, berry)).get()).toBeUndefined();
  });

  it('D-171: a used note is archived: off the page and the Tasting chips, kept on its shot', () => {
    const berry = named('Berry').id;
    const shotId = brew(1, [berry]);
    expect(removeTag(db, ids.userId, berry, T0 + 2 * 60_000)).toBe('archived');
    expect(all().some((t) => t.id === berry)).toBe(false);
    expect(loadTags(db, ids.userId).total).toBe(14);
    expect(shotTags(shotId)).toEqual([berry]);
    const form = loadShotForm(db, ids.userId);
    if (form.state !== 'ready') throw new Error('Expected a ready form');
    expect(form.tags.some((t) => t.id === berry)).toBe(false);
    // Editing that shot still shows its note.
    expect(loadEditShotForm(db, ids.userId, shotId)?.tags.some((t) => t.id === berry)).toBe(true);
    expect(loadLibrary(db, ids.userId, T0).tags[0]).toBe('14 flavor notes');
  });

  it('D-171: typing a removed note on the Tasting tab brings it back', () => {
    const berry = named('Berry').id;
    brew(1, [berry]);
    removeTag(db, ids.userId, berry, T0 + 2 * 60_000);
    const shotId = brew(3, [], ['berry']);
    expect(shotTags(shotId)).toEqual([berry]);
    expect(named('Berry').count).toBe(2);
  });
});

describe('keepBoth', () => {
  it('D-173: a kept pair is not suggested again', () => {
    const carmel = addTag(db, ids.userId, { name: 'Carmel', family: 'sweet' }, T0);
    expect(keepBoth(db, ids.userId, carmel, named('Caramel').id)).toBe(true);
    expect(loadTags(db, ids.userId).duplicate).toBeNull();
    // Keeping twice is fine.
    expect(keepBoth(db, ids.userId, named('Caramel').id, carmel)).toBe(true);
  });

  it('refuses notes that are not yours', () => {
    expect(keepBoth(db, ids.userId, named('Caramel').id, 'missing')).toBe(false);
  });
});
