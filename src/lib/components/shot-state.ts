// The values the shot form edits; sent to the server as one JSON object on Save (docs/SPEC.md §4.1).
import type { SetupSnapshot, Taste } from '../domain/schemas';
import type { Thousandths } from '../domain/units';

export type ShotState = {
  id: string;
  beanId: string;
  machineId: string;
  grinderId: string;
  basketId: string | null;
  routineId: string | null;
  grind: Thousandths;
  dose: Thousandths;
  setup: SetupSnapshot;
  yield: Thousandths | null;
  time: Thousandths | null;
  taste: Taste;
  tagIds: string[];
  /** Flavor notes added with "Add your own", created on save. */
  newTagNames: string[];
  notes: string | null;
};
