// The one account of an installation: created on first run with a name and a password,
// with the built-in flavor tags and nothing else.
import { randomBytes } from 'node:crypto';
import { count } from 'drizzle-orm';
import { insertBuiltInTags } from '../db/built-in-tags';
import type { Db } from '../db/client';
import { newId } from '../db/ids';
import { appState, user, userSettings } from '../db/schema';
import { hashPassword, verifyPassword } from './password.js';
import type { SignedInUser } from './session';
import type { SignInThrottle } from './throttle';

export const MIN_PASSWORD_LENGTH = 8;

/** The account could not be created; the message can be shown as it is. */
export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountError';
  }
}

export function hasAccount(db: Db): boolean {
  return (db.select({ n: count() }).from(user).get()?.n ?? 0) > 0;
}

/** Creates the account on first run. Throws AccountError for missing input or a second account. */
export async function createAccount(
  db: Db,
  input: { name: string; password: string; timeZone: string },
  now: number
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new AccountError('Enter your name.');
  if (input.password.length < MIN_PASSWORD_LENGTH)
    throw new AccountError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
  const passwordHash = await hashPassword(input.password);

  return db.transaction((tx) => {
    if ((tx.select({ n: count() }).from(user).get()?.n ?? 0) > 0)
      throw new AccountError('This installation already has an account.');
    const userId = newId(now);
    const stamps = { createdAt: now, updatedAt: now };
    tx.insert(user)
      .values({ id: userId, name, passwordHash, ...stamps })
      .run();
    tx.insert(userSettings)
      .values({ userId, timeZone: validTimeZone(input.timeZone), ...stamps })
      .run();
    tx.insert(appState)
      .values({ userId, ...stamps })
      .run();
    insertBuiltInTags(tx, userId, now);
    return userId;
  });
}

/** Checked against when no name matches, so a wrong name takes as long as a wrong password. */
const unmatchedHash = hashPassword(randomBytes(16).toString('hex'));

/**
 * The account for this name (ignoring case and surrounding spaces) and password, or null. Always runs
 * exactly one password check, so the answer time does not reveal whether the name exists.
 */
export async function signIn(db: Db, name: string, password: string): Promise<SignedInUser | null> {
  const wanted = name.trim().toLowerCase();
  const row = db
    .select()
    .from(user)
    .all()
    .find((u) => u.name.toLowerCase() === wanted);
  const matches = await verifyPassword(password, row?.passwordHash ?? (await unmatchedHash));
  return row && matches ? { id: row.id, name: row.name } : null;
}

export type SignInAttempt =
  { outcome: 'signed_in'; user: SignedInUser } | { outcome: 'wrong' } | { outcome: 'throttled' };

/**
 * One sign-in attempt through the throttle. The attempt counts as a failure before the password is
 * checked, so many guesses sent at once are limited just like guesses sent one after another.
 */
export async function attemptSignIn(
  db: Db,
  throttle: SignInThrottle,
  name: string,
  password: string,
  now: number
): Promise<SignInAttempt> {
  if (throttle.retryAfter(now) > 0) return { outcome: 'throttled' };
  throttle.recordFailure(now);
  const signedIn = await signIn(db, name, password);
  if (!signedIn) return { outcome: 'wrong' };
  throttle.reset();
  return { outcome: 'signed_in', user: signedIn };
}

/** An IANA time zone the runtime knows, or UTC (docs/SPEC.md §1.8). */
function validTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}
