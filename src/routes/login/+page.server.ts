import { fail, redirect } from '@sveltejs/kit';
import { attemptSignIn } from '#lib/server/auth/account.ts';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '#lib/server/auth/session.ts';
import { SignInThrottle } from '#lib/server/auth/throttle.ts';
import { getDb } from '#lib/server/db/connection.ts';
import type { Actions } from './$types';

const throttle = new SignInThrottle();

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '');
    const now = Date.now();
    const db = getDb();
    const attempt = await attemptSignIn(
      db,
      throttle,
      name,
      String(form.get('password') ?? ''),
      now
    );
    if (attempt.outcome === 'throttled')
      return fail(429, { name, error: 'Too many tries. Wait a minute and try again.' });
    if (attempt.outcome === 'wrong')
      return fail(400, { name, error: 'That name and password do not match.' });
    cookies.set(
      SESSION_COOKIE,
      createSession(db, attempt.user.id, now),
      sessionCookieOptions(request)
    );
    redirect(303, '/');
  }
};
