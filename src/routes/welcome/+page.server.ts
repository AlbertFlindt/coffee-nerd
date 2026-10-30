import { fail, redirect } from '@sveltejs/kit';
import { AccountError, createAccount } from '#lib/server/auth/account.ts';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '#lib/server/auth/session.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { guideNext } from '#lib/server/first-run.ts';
import type { Actions } from './$types';

// First run: create the one account, sign in, and start the step-by-step start.
export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '');
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('repeat') ?? ''))
      return fail(400, { name, error: 'The two passwords are not the same.' });

    const db = getDb();
    const now = Date.now();
    let userId: string;
    try {
      userId = await createAccount(
        db,
        { name, password, timeZone: String(form.get('timeZone') ?? 'UTC') },
        now
      );
      cookies.set(SESSION_COOKIE, createSession(db, userId, now), sessionCookieOptions(request));
    } catch (error) {
      if (error instanceof AccountError) return fail(400, { name, error: error.message });
      throw error;
    }
    // The step-by-step start begins right after creating the account.
    redirect(303, guideNext(db, userId));
  }
};
