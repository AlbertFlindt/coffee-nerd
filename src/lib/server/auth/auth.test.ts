import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../db/client';
import { appState, session, tag, user, userSettings } from '../db/schema';
import { AccountError, attemptSignIn, createAccount, hasAccount, signIn } from './account';
import { hashPassword, verifyPassword } from './password.js';
import {
  createSession,
  SESSION_LIFETIME,
  signOut,
  signOutEverywhere,
  validateSession
} from './session';
import { SignInThrottle } from './throttle';

const dir = mkdtempSync(join(tmpdir(), 'coffee-nerd-auth-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 9, 17, 6, 0);
const DAY = 86_400_000;
let db: Db;
let counter = 0;
beforeEach(() => {
  db = openDatabase(join(dir, `auth-${counter++}.db`));
});

const account = (overrides: Partial<Parameters<typeof createAccount>[1]> = {}) =>
  createAccount(
    db,
    { name: 'Albert', password: 'espresso-at-dawn', timeZone: 'Europe/Copenhagen', ...overrides },
    T0
  );

describe('passwords', () => {
  it('D-60: a stored password is a salted hash that verifies only the right password', async () => {
    const hash = await hashPassword('espresso-at-dawn');
    expect(hash).not.toContain('espresso');
    expect(hash).not.toBe(await hashPassword('espresso-at-dawn'));
    expect(await verifyPassword('espresso-at-dawn', hash)).toBe(true);
    expect(await verifyPassword('espresso-at-dusk', hash)).toBe(false);
    expect(await verifyPassword('espresso-at-dawn', 'not-a-hash')).toBe(false);
  });
});

describe('first run (D-85, D-88)', () => {
  it('D-88: creating the account adds My setup with the time zone, app state and the built-in tags only', async () => {
    expect(hasAccount(db)).toBe(false);
    const userId = await account();
    expect(hasAccount(db)).toBe(true);
    expect(db.select().from(user).get()).toMatchObject({ id: userId, name: 'Albert', email: null });
    expect(db.select().from(userSettings).get()).toMatchObject({
      userId,
      timeZone: 'Europe/Copenhagen',
      defaultMachineId: null
    });
    expect(db.select().from(appState).get()).toMatchObject({ userId, currentBeanId: null });
    const tags = db.select().from(tag).where(eq(tag.ownerId, userId)).all();
    expect(tags).toHaveLength(15);
    expect(tags.every((t) => t.builtIn)).toBe(true);
  });

  it('D-60: there is only one account per installation', async () => {
    await account();
    await expect(account({ name: 'Someone else' })).rejects.toThrow(AccountError);
  });

  it('D-85: a name and a password of at least 8 characters are required', async () => {
    await expect(account({ name: '  ' })).rejects.toThrow(/name/i);
    await expect(account({ password: 'short' })).rejects.toThrow(/password/i);
    expect(hasAccount(db)).toBe(false);
  });

  it('data-model §1.8: an unknown time zone falls back to UTC', async () => {
    await account({ timeZone: 'Mars/Olympus' });
    expect(db.select().from(userSettings).get()?.timeZone).toBe('UTC');
  });
});

describe('signing in (D-85)', () => {
  it('D-85: the right name and password sign in; the name ignores case and spaces', async () => {
    const userId = await account();
    expect(await signIn(db, ' albert ', 'espresso-at-dawn')).toEqual({
      id: userId,
      name: 'Albert'
    });
  });

  it('D-85: a wrong name or password does not sign in', async () => {
    await account();
    expect(await signIn(db, 'Albert', 'wrong-password')).toBeNull();
    expect(await signIn(db, 'Bob', 'espresso-at-dawn')).toBeNull();
  });
});

describe('sessions (D-86)', () => {
  it('D-86: a session signs you in and stores only a hash of its token', async () => {
    const userId = await account();
    const token = createSession(db, userId, T0);
    expect(validateSession(db, token, T0 + DAY)).toEqual({ id: userId, name: 'Albert' });
    expect(db.select().from(session).get()?.id).not.toBe(token);
  });

  it('D-86: each visit renews the session, so you stay signed in while you use the app', async () => {
    const userId = await account();
    const token = createSession(db, userId, T0);
    for (let day = 300; day <= 1500; day += 300) {
      expect(validateSession(db, token, T0 + day * DAY)).not.toBeNull();
    }
  });

  it('D-86: a session ends after a year without use', async () => {
    const userId = await account();
    const token = createSession(db, userId, T0);
    expect(validateSession(db, token, T0 + SESSION_LIFETIME + DAY)).toBeNull();
    expect(db.select().from(session).all()).toHaveLength(0);
  });

  it('D-86: signing out ends that session only', async () => {
    const userId = await account();
    const phone = createSession(db, userId, T0);
    const laptop = createSession(db, userId, T0);
    signOut(db, phone);
    expect(validateSession(db, phone, T0)).toBeNull();
    expect(validateSession(db, laptop, T0)).not.toBeNull();
  });

  it('D-87: signing out everywhere ends every session', async () => {
    const userId = await account();
    const phone = createSession(db, userId, T0);
    const laptop = createSession(db, userId, T0);
    signOutEverywhere(db, userId);
    expect(validateSession(db, phone, T0)).toBeNull();
    expect(validateSession(db, laptop, T0)).toBeNull();
  });

  it('D-86: an unknown token signs nobody in', () => {
    expect(validateSession(db, 'made-up', T0)).toBeNull();
  });
});

describe('SignInThrottle', () => {
  it('D-85: after 5 wrong passwords in 15 minutes, sign-in waits a minute', () => {
    const throttle = new SignInThrottle();
    for (let i = 0; i < 5; i++) throttle.recordFailure(T0 + i * 1000);
    expect(throttle.retryAfter(T0 + 5000)).toBeGreaterThan(0);
    expect(throttle.retryAfter(T0 + 5000 + 61_000)).toBe(0);
  });

  it('D-85: fewer failures, old failures or a success do not slow sign-in', () => {
    const throttle = new SignInThrottle();
    for (let i = 0; i < 4; i++) throttle.recordFailure(T0);
    expect(throttle.retryAfter(T0)).toBe(0);
    throttle.recordFailure(T0 - 16 * 60_000);
    expect(throttle.retryAfter(T0)).toBe(0);
    throttle.recordFailure(T0);
    throttle.reset();
    expect(throttle.retryAfter(T0)).toBe(0);
  });
});

describe('attemptSignIn', () => {
  it('D-85: guesses sent all at once are limited like guesses sent one by one', async () => {
    await account();
    const throttle = new SignInThrottle();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => attemptSignIn(db, throttle, 'Albert', 'wrong-guess', T0))
    );
    expect(results.filter((r) => r.outcome === 'wrong')).toHaveLength(5);
    expect(results.filter((r) => r.outcome === 'throttled')).toHaveLength(5);
  });

  it('D-85: the right password signs in and clears earlier failures', async () => {
    const userId = await account();
    const throttle = new SignInThrottle();
    await attemptSignIn(db, throttle, 'Albert', 'wrong-guess', T0);
    expect(await attemptSignIn(db, throttle, 'Albert', 'espresso-at-dawn', T0)).toEqual({
      outcome: 'signed_in',
      user: { id: userId, name: 'Albert' }
    });
    expect(throttle.retryAfter(T0)).toBe(0);
  });
});
