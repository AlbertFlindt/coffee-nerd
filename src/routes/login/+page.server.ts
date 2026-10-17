import { fail, redirect } from '@sveltejs/kit';
import { signIn } from '#lib/server/auth/account.ts';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '#lib/server/auth/session.ts';
import { SignInThrottle } from '#lib/server/auth/throttle.ts';
import { getDb } from '#lib/server/db/connection.ts';
import type { Actions } from './$types';

const throttle = new SignInThrottle();

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '');
    const now = Date.now();
    if (throttle.retryAfter(now) > 0)
      return fail(429, { name, error: 'Too many tries. Wait a minute and try again.' });

    const db = getDb();
    const user = await signIn(db, name, String(form.get('password') ?? ''));
    if (!user) {
      throttle.recordFailure(now);
      return fail(400, { name, error: 'That name and password do not match.' });
    }
    throttle.reset();
    cookies.set(SESSION_COOKIE, createSession(db, user.id, now), sessionCookieOptions(url));
    redirect(303, '/');
  }
};
