// Sign-in sessions (D-86): you stay signed in until you sign out; each visit renews the session, and it
// ends after a year without use. Only a SHA-256 of the cookie token is stored.
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { session, user } from '../db/schema';

export const SESSION_COOKIE = 'session';
export const SESSION_LIFETIME = 365 * 86_400_000;
/** Renew at most once a day, so a visit does not write to the database on every request. */
const RENEW_AFTER = 86_400_000;

export type SignedInUser = { id: string; name: string };

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Starts a session and returns the token for the cookie. */
export function createSession(db: Db, userId: string, now: number): string {
  const token = randomBytes(32).toString('base64url');
  db.insert(session)
    .values({
      id: hashToken(token),
      userId,
      expiresAt: now + SESSION_LIFETIME,
      createdAt: now,
      updatedAt: now
    })
    .run();
  return token;
}

/** The signed-in user for a cookie token, renewing the session; null when unknown or expired. */
export function validateSession(db: Db, token: string, now: number): SignedInUser | null {
  const id = hashToken(token);
  const row = db
    .select({
      userId: user.id,
      name: user.name,
      expiresAt: session.expiresAt
    })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(eq(session.id, id))
    .get();
  if (!row) return null;
  if (row.expiresAt <= now) {
    db.delete(session).where(eq(session.id, id)).run();
    return null;
  }
  if (row.expiresAt - now < SESSION_LIFETIME - RENEW_AFTER) {
    db.update(session)
      .set({ expiresAt: now + SESSION_LIFETIME, updatedAt: now })
      .where(and(eq(session.id, id), gt(session.expiresAt, now)))
      .run();
  }
  return { id: row.userId, name: row.name };
}

export function signOut(db: Db, token: string): void {
  db.delete(session)
    .where(eq(session.id, hashToken(token)))
    .run();
}

/** Ends every session of the user, e.g. after a password reset (D-87). */
export function signOutEverywhere(db: Db, userId: string): void {
  db.delete(session).where(eq(session.userId, userId)).run();
}
