// The built-in flavor tags every account starts with, as on the Tags screen.
import type { Queryable } from './client';
import { newId } from './ids';
import { tag } from './schema';

type Family = (typeof tag.$inferInsert)['family'];

export const BUILT_IN_TAGS: readonly { name: string; family: Family }[] = [
  { name: 'Berry', family: 'fruity' },
  { name: 'Citrus', family: 'fruity' },
  { name: 'Stone fruit', family: 'fruity' },
  { name: 'Tropical', family: 'fruity' },
  { name: 'Dark chocolate', family: 'sweet' },
  { name: 'Caramel', family: 'sweet' },
  { name: 'Honey', family: 'sweet' },
  { name: 'Floral', family: 'floral' },
  { name: 'Jasmine', family: 'floral' },
  { name: 'Nutty', family: 'nutty_roasty' },
  { name: 'Almond', family: 'nutty_roasty' },
  { name: 'Toasted', family: 'nutty_roasty' },
  { name: 'Tea-like', family: 'other' },
  { name: 'Winey', family: 'other' },
  { name: 'Spicy', family: 'other' }
];

export function insertBuiltInTags(db: Queryable, ownerId: string, now: number) {
  db.insert(tag)
    .values(
      BUILT_IN_TAGS.map((t) => ({
        id: newId(now),
        ownerId,
        name: t.name,
        family: t.family,
        builtIn: true,
        createdAt: now,
        updatedAt: now
      }))
    )
    .run();
}
