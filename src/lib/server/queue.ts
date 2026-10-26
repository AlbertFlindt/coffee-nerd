// Shots that waited on the phone (D-61, D-220, D-223, D-224): each change is saved once, however often
// the phone sends it, and a new shot keeps the time it was brewed on the phone.
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from './db/client';
import { shot } from './db/schema';
import { editShot, rateShot, saveShot, shotRequestSchema, ShotRejected } from './db/shots';

export const queueRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    ownerId: z.string(),
    kind: z.literal('new'),
    shot: shotRequestSchema,
    brewedAt: z.number().int().nonnegative()
  }),
  z.object({ ownerId: z.string(), kind: z.literal('edit'), shot: shotRequestSchema }),
  z.object({
    ownerId: z.string(),
    kind: z.literal('rate'),
    shotId: z.string(),
    score: z.number()
  })
]);

/**
 * What the phone does with its entry: `saved` (also when it was saved before) and `gone` (the shot was
 * deleted meanwhile) end it; `refused` keeps it as "Not saved" (D-224); `other-account` keeps it waiting
 * for its own account.
 */
export type QueueOutcome = 'saved' | 'gone' | 'refused' | 'other-account';

export function receiveQueued(db: Db, ownerId: string, body: unknown, now: number): QueueOutcome {
  const parsed = queueRequestSchema.safeParse(body);
  if (!parsed.success) return 'refused';
  const request = parsed.data;
  if (request.ownerId !== ownerId) return 'other-account';
  try {
    if (request.kind === 'rate')
      return rateShot(db, ownerId, request.shotId, request.score, now) ? 'saved' : 'gone';
    const existing = db
      .select({ brewedAt: shot.brewedAt })
      .from(shot)
      .where(and(eq(shot.id, request.shot.id), eq(shot.ownerId, ownerId)))
      .get();
    if (request.kind === 'new' && !existing) {
      // D-220: the phone's time at Save; a phone clock ahead of the server never brews in the future.
      saveShot(db, ownerId, { ...request.shot, brewedAt: Math.min(request.brewedAt, now) }, now);
      return 'saved';
    }
    // A new shot the server already has (its answer was lost, or it was changed on the phone while it
    // was being sent) is saved as an edit: the latest values win, and it is still one shot (D-61, D-223).
    if (!existing) return 'gone';
    // D-113, D-220: an edit keeps the shot's brew time.
    editShot(db, ownerId, request.shot.id, { ...request.shot, brewedAt: existing.brewedAt }, now);
    return 'saved';
  } catch (e) {
    if (e instanceof ShotRejected) {
      console.error('Waiting shot rejected:', e.problems.join('; '));
      return 'refused';
    }
    throw e;
  }
}
