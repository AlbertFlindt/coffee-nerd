// The one account of an installation (D-60): created on first run with a name and a password (D-85),
// with the built-in flavor tags and nothing else (D-88).
import { count } from 'drizzle-orm';
import { insertBuiltInTags } from '../db/built-in-tags';
import type { Db } from '../db/client';
import { newId } from '../db/ids';
import { appState, user, userSettings } from '../db/schema';
import { hashPassword, verifyPassword } from './password.js';
import type { SignedInUser } from './session';

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

/** The account for this name (ignoring case and surrounding spaces) and password, or null. */
export async function signIn(db: Db, name: string, password: string): Promise<SignedInUser | null> {
  const wanted = name.trim().toLowerCase();
  for (const row of db.select().from(user).all()) {
    if (row.name.toLowerCase() === wanted && (await verifyPassword(password, row.passwordHash)))
      return { id: row.id, name: row.name };
  }
  return null;
}

/** An IANA time zone the runtime knows, or UTC (data-model §1.8). */
function validTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}
