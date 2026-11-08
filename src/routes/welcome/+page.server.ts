import { fail, redirect } from '@sveltejs/kit';
import { readImport, type ImportData } from '#lib/domain/import.ts';
import { AccountError, createAccount } from '#lib/server/auth/account.ts';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '#lib/server/auth/session.ts';
import { getDb } from '#lib/server/db/connection.ts';
import { importEverything } from '#lib/server/db/import.ts';
import { guideNext } from '#lib/server/first-run.ts';
import type { Actions } from './$types';

// First run: create the one account and sign in. A new journal starts the step-by-step start; moving
// a journal imports the old server's "Export everything" file with the account, in one transaction.
export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '');
    const password = String(form.get('password') ?? '');
    const moving = form.get('start') === 'move';
    const again = { name, moving };
    if (password !== String(form.get('repeat') ?? ''))
      return fail(400, { ...again, error: 'The two passwords are not the same.' });

    let journal: ImportData | null = null;
    if (moving) {
      const file = form.get('file');
      if (!(file instanceof File) || file.size === 0)
        return fail(400, { ...again, error: 'Choose the file "Export everything" saved.' });
      const read = readImport(await file.text());
      if (!read.ok) return fail(400, { ...again, error: read.problem });
      journal = read.data;
    }

    const db = getDb();
    const now = Date.now();
    let userId: string;
    try {
      userId = await createAccount(
        db,
        { name, password, timeZone: String(form.get('timeZone') ?? 'UTC') },
        now,
        journal ? (tx, id) => importEverything(tx, id, journal, now) : undefined
      );
    } catch (error) {
      if (error instanceof AccountError) return fail(400, { ...again, error: error.message });
      if (!journal) throw error;
      // Ids already on this server, or anything else the database refused: no account was made.
      console.error('Import failed', error);
      return fail(400, {
        ...again,
        error: 'This file could not be imported. Nothing was changed.'
      });
    }
    cookies.set(SESSION_COOKIE, createSession(db, userId, now), sessionCookieOptions(request));
    // A moved journal is ready to brew; a new one begins the step-by-step start.
    redirect(303, journal ? '/' : guideNext(db, userId));
  }
};
