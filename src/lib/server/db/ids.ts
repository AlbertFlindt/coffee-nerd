// Ids are UUID version 7 (data-model §1.5): they sort by creation time and can also be made on the phone.
import { v7 } from 'uuid';

/** A new UUID v7 for the given time (UTC milliseconds). */
export function newId(now: number): string {
  return v7({ msecs: now });
}
